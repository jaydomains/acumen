"""Assignment persistence + assignee resolution (AC-D6 / AC-D15 /
AC-D26).

An assignment is an admin instruction to engage a pill/path. It targets
individual Testees and/or Groups (AC-D15); group membership is resolved
and **snapshotted** into ``assignment_assignee`` at creation so later
membership changes never rewrite assignment history. The three seeded
system groups carry rule-derived membership (not stored); the rule is
applied here.

``engagement_status`` is intentionally derived per (assignment, Testee),
not stored — that read-time derivation + the reminder/escalation sweep
land in P4 Slice 3 (``app.domain.engagement``). This module owns CRUD +
the assignee snapshot only. Routers stay thin (CODE_SPEC §2/§3); queries
stay at id/tenant equality with Python-side filtering/pagination
(catalogue precedent), preserving the AC-CD15 zero-DB seam.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.catalogue import (
    DEFAULT_PAGE_LIMIT,
    MAX_PAGE_LIMIT,
    paginate,
    record_audit,
)
from app.models import (
    SEED_GROUP_ALL_ADMINS_ID,
    SEED_GROUP_ALL_TESTEES_ID,
    SEED_GROUP_ALL_USERS_ID,
    SEED_TENANT_ID,
    AppUser,
    Assignment,
    AssignmentAssignee,
    Group,
    GroupMember,
    LoopMode,
    UserStatus,
)
from app.permissions import ROLE_ADMINISTRATOR, ROLE_TESTEE, APIError

__all__ = [
    "DEFAULT_PAGE_LIMIT",
    "MAX_PAGE_LIMIT",
    "create_assignment",
    "get_assignment",
    "list_assignments",
    "assignee_ids",
    "withdraw_assignment",
]


async def _tenant_rows(db: AsyncSession, model: Any) -> list[Any]:
    result = await db.execute(select(model).where(model.tenant_id == SEED_TENANT_ID))
    return list(result.scalars().all())


async def _by_id(db: AsyncSession, model: Any, obj_id: uuid.UUID) -> Any | None:
    result = await db.execute(
        select(model).where(model.id == obj_id, model.tenant_id == SEED_TENANT_ID)
    )
    return result.scalar_one_or_none()


async def _active_users(db: AsyncSession) -> list[AppUser]:
    rows = await _tenant_rows(db, AppUser)
    return [u for u in rows if u.status == UserStatus.active]


async def _resolve_group_members(db: AsyncSession, group: Group) -> list[uuid.UUID]:
    """System groups have rule-derived membership (not stored); ad-hoc
    groups read ``group_member`` rows (AC-D15). Deactivated users are
    excluded from targeting (AC-D16)."""
    if group.is_system:
        users = await _active_users(db)
        if group.id == SEED_GROUP_ALL_USERS_ID:
            return [u.id for u in users]
        if group.id == SEED_GROUP_ALL_TESTEES_ID:
            return [u.id for u in users if u.role == ROLE_TESTEE]
        if group.id == SEED_GROUP_ALL_ADMINS_ID:
            return [u.id for u in users if u.role == ROLE_ADMINISTRATOR]
        return []
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group.id,
            GroupMember.tenant_id == SEED_TENANT_ID,
        )
    )
    member_ids = [m.user_id for m in result.scalars().all()]
    active_ids = {u.id for u in await _active_users(db)}
    return [uid for uid in member_ids if uid in active_ids]


async def create_assignment(
    db: AsyncSession,
    *,
    actor_id: uuid.UUID,
    pill_id: uuid.UUID | None,
    learning_path_id: uuid.UUID | None,
    difficulty: int,
    deadline: Any | None,
    is_mandatory: bool,
    loop_mode: LoopMode,
    testee_ids: list[uuid.UUID],
    group_ids: list[uuid.UUID],
) -> Assignment:
    """Create an assignment and freeze its assignee set (AC-D15).

    Individual targets are recorded first with ``via_group_id`` NULL
    (direct target); group members follow, tagged with the group they
    were resolved through. A user targeted both ways is recorded once
    (the unique constraint on ``(assignment_id, user_id)``); the
    individual target wins. Deactivated users (AC-D16) are excluded.
    """
    assignment = Assignment(
        tenant_id=SEED_TENANT_ID,
        assigner_id=actor_id,
        pill_id=pill_id,
        learning_path_id=learning_path_id,
        difficulty=difficulty,
        deadline=deadline,
        is_mandatory=is_mandatory,
        loop_mode=loop_mode,
    )
    db.add(assignment)
    await db.flush()
    await db.refresh(assignment)

    active_user_ids = {u.id for u in await _active_users(db)}
    seen: set[uuid.UUID] = set()
    targets: list[tuple[uuid.UUID, uuid.UUID | None]] = []
    for uid in testee_ids:
        if uid in seen or uid not in active_user_ids:
            continue
        seen.add(uid)
        targets.append((uid, None))
    for gid in group_ids:
        group = await _by_id(db, Group, gid)
        if group is None:
            raise APIError(422, "invalid_group", "group_id does not reference a group.")
        for uid in await _resolve_group_members(db, group):
            if uid not in seen:
                seen.add(uid)
                targets.append((uid, gid))

    if not targets:
        raise APIError(
            422,
            "no_assignees",
            "An assignment must resolve to at least one active Testee.",
        )

    for uid, via_group_id in targets:
        db.add(
            AssignmentAssignee(
                tenant_id=SEED_TENANT_ID,
                assignment_id=assignment.id,
                user_id=uid,
                via_group_id=via_group_id,
            )
        )
    await db.flush()
    await record_audit(
        db,
        actor_id=actor_id,
        action="assignment.create",
        target_entity="assignment",
        target_id=assignment.id,
        detail={"assignee_count": len(targets), "mandatory": is_mandatory},
    )
    return assignment


async def _assignees(
    db: AsyncSession, assignment_id: uuid.UUID
) -> list[AssignmentAssignee]:
    result = await db.execute(
        select(AssignmentAssignee).where(
            AssignmentAssignee.assignment_id == assignment_id,
            AssignmentAssignee.tenant_id == SEED_TENANT_ID,
        )
    )
    return list(result.scalars().all())


async def assignee_ids(db: AsyncSession, assignment_id: uuid.UUID) -> list[uuid.UUID]:
    rows = await _assignees(db, assignment_id)
    return [a.user_id for a in rows]


async def _assignee_map(db: AsyncSession) -> dict[uuid.UUID, list[uuid.UUID]]:
    """All tenant assignee rows in a single query, grouped by assignment.

    The list path filters/paginates in Python (catalogue precedent for
    v1 single-tenant scale; the AC-CD15 zero-DB harness is id/tenant
    equality only — no JOIN/IN). Loading the join table once keeps that
    shape while making the whole list path O(1) queries instead of
    per-assignment N+1.
    """
    result = await db.execute(
        select(AssignmentAssignee).where(AssignmentAssignee.tenant_id == SEED_TENANT_ID)
    )
    grouped: dict[uuid.UUID, list[uuid.UUID]] = {}
    for row in result.scalars().all():
        grouped.setdefault(row.assignment_id, []).append(row.user_id)
    return grouped


async def get_assignment(db: AsyncSession, assignment_id: uuid.UUID) -> Assignment | None:
    return await _by_id(db, Assignment, assignment_id)


async def list_assignments(
    db: AsyncSession,
    *,
    cursor: str | None,
    limit: int,
    assignee_id: uuid.UUID | None = None,
    assigner_id: uuid.UUID | None = None,
) -> tuple[list[tuple[Assignment, list[uuid.UUID]]], str | None]:
    """Admin lists all (optionally by assigner); a Testee lists only
    assignments they are a snapshotted assignee of.

    Returns ``(assignment, assignee_ids)`` pairs so the router never
    re-queries per row (mirrors the approved P3 ``list_groups`` shape).
    Assignee rows are loaded once via ``_assignee_map`` — the filter and
    the response both read that map, so the page costs O(1) queries.
    """
    rows = await _tenant_rows(db, Assignment)
    if assigner_id is not None:
        rows = [a for a in rows if a.assigner_id == assigner_id]
    amap = await _assignee_map(db)
    if assignee_id is not None:
        rows = [a for a in rows if assignee_id in amap.get(a.id, [])]
    page, next_cursor = paginate(rows, cursor, limit)
    return [(a, amap.get(a.id, [])) for a in page], next_cursor


async def withdraw_assignment(
    db: AsyncSession, assignment: Assignment, *, actor_id: uuid.UUID
) -> None:
    for assignee in await _assignees(db, assignment.id):
        await db.delete(assignee)
    await db.delete(assignment)
    await record_audit(
        db,
        actor_id=actor_id,
        action="assignment.withdraw",
        target_entity="assignment",
        target_id=assignment.id,
    )
