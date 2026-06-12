"""Catalogue persistence + ops (AC-D7 / AC-D8 / AC-D14 / AC-D15 / AC-D21).

The data-access seam for Subjects, Pills, Learning Paths, Groups, the
generic audit writer, and the AI pill-proposal queue. Routers stay thin
(CODE_SPEC §2/§3): they own HTTP status + envelopes and delegate every
row read/write here.

Zero-DB tests substitute the session (P1/P2 precedent). Collection
listing and the Testee discovery filter intentionally fetch the
tenant-scoped rows and finish filtering / ordering / cursor-pagination
in Python: v1 is single-tenant internal-staff scale (tens–hundreds of
pills), so this is correct and keeps the test seam simple; pushing the
predicates into SQL is a localized, behaviour-preserving change when
catalogue size warrants it.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.cost import maybe_fire_budget_alert
from app.ai.provider import Operation, resolve_provider
from app.domain.safety_links import auto_tag_safety
from app.models import (
    SEED_TENANT_ID,
    AuditLog,
    Group,
    GroupMember,
    LearningPath,
    LearningPathPill,
    Pill,
    ProcessingTask,
    ProcessingTaskStatus,
    Subject,
)
from app.permissions import now_utc

DEFAULT_PAGE_LIMIT = 50
MAX_PAGE_LIMIT = 200
PROPOSAL_TASK_NAME = "pill_proposal"


# --- audit ------------------------------------------------------------


async def record_audit(
    db: AsyncSession,
    *,
    actor_id: uuid.UUID | None,
    action: str,
    target_entity: str,
    target_id: uuid.UUID,
    detail: dict[str, Any] | None = None,
) -> None:
    """Append an audit row (SPEC §5). Append-only; never updated."""
    db.add(
        AuditLog(
            tenant_id=SEED_TENANT_ID,
            actor_id=actor_id,
            action=action,
            target_entity=target_entity,
            target_id=target_id,
            detail=detail,
        )
    )


# --- pagination -------------------------------------------------------


def _sort_key(row: Any) -> tuple[Any, str]:
    return (row.created_at, str(row.id))


def paginate(
    rows: Sequence[Any], cursor: str | None, limit: int
) -> tuple[list[Any], str | None, int]:
    """Stable (created_at, id) cursor pagination (CODE_SPEC §5).

    The cursor is the opaque id of the last row of the previous page.
    Returns ``(page, next_cursor, total)`` where ``total`` is the full
    collection size (pre-cursor, pre-limit) — surfaced as
    ``PageMeta.count`` so callers can read a total from a ``?limit=1``
    probe without walking every page (FE-9 count meta).
    """
    total = len(rows)
    limit = max(1, min(limit, MAX_PAGE_LIMIT))
    ordered = sorted(rows, key=_sort_key)
    if cursor:
        start = next((i + 1 for i, r in enumerate(ordered) if str(r.id) == cursor), 0)
        ordered = ordered[start:]
    page = ordered[:limit]
    next_cursor = str(page[-1].id) if len(ordered) > limit else None
    return page, next_cursor, total


async def _tenant_rows(db: AsyncSession, model: Any) -> list[Any]:
    result = await db.execute(select(model).where(model.tenant_id == SEED_TENANT_ID))
    return list(result.scalars().all())


async def _by_id(db: AsyncSession, model: Any, obj_id: uuid.UUID) -> Any | None:
    result = await db.execute(
        select(model).where(model.id == obj_id, model.tenant_id == SEED_TENANT_ID)
    )
    return result.scalar_one_or_none()


# --- subjects ---------------------------------------------------------


async def create_subject(
    db: AsyncSession, *, name: str, description: str | None
) -> Subject:
    subject = Subject(tenant_id=SEED_TENANT_ID, name=name, description=description)
    db.add(subject)
    await db.flush()
    await db.refresh(subject)
    return subject


async def get_subject(db: AsyncSession, subject_id: uuid.UUID) -> Subject | None:
    return await _by_id(db, Subject, subject_id)


async def list_subjects(
    db: AsyncSession, *, cursor: str | None, limit: int
) -> tuple[list[Subject], str | None, int]:
    return paginate(await _tenant_rows(db, Subject), cursor, limit)


async def update_subject(
    db: AsyncSession, subject: Subject, fields: dict[str, Any]
) -> Subject:
    for key, value in fields.items():
        setattr(subject, key, value)
    await db.flush()
    return subject


async def delete_subject(db: AsyncSession, subject: Subject) -> None:
    await db.delete(subject)


# --- pills ------------------------------------------------------------


async def create_pill(
    db: AsyncSession,
    *,
    subject_id: uuid.UUID,
    name: str,
    description: str | None,
    available_difficulty_min: int,
    available_difficulty_max: int,
    discoverable: bool,
    estimated_minutes: int | None,
    ai_safety_classification: bool | None = None,
) -> Pill:
    safety = await auto_tag_safety(
        name, description, db, ai_safety_classification=ai_safety_classification
    )
    pill = Pill(
        tenant_id=SEED_TENANT_ID,
        subject_id=subject_id,
        name=name,
        description=description,
        available_difficulty_min=available_difficulty_min,
        available_difficulty_max=available_difficulty_max,
        discoverable=discoverable,
        safety_relevant=safety,
        estimated_minutes=estimated_minutes,
    )
    db.add(pill)
    await db.flush()
    await db.refresh(pill)
    return pill


async def get_pill(db: AsyncSession, pill_id: uuid.UUID) -> Pill | None:
    return await _by_id(db, Pill, pill_id)


async def list_pills(
    db: AsyncSession, *, cursor: str | None, limit: int
) -> tuple[list[Pill], str | None, int]:
    """Admin listing — includes retired and non-discoverable pills."""
    return paginate(await _tenant_rows(db, Pill), cursor, limit)


async def update_pill(db: AsyncSession, pill: Pill, fields: dict[str, Any]) -> Pill:
    """Apply edits, then re-evaluate the safety tag on a name/description
    change **unless** an admin has explicitly overridden it (AC-D21).
    The override marker (set by ``override_pill_safety``) makes the admin
    decision win over edit-time re-evaluation."""
    content_changed = False
    for key, value in fields.items():
        if key in ("name", "description") and getattr(pill, key) != value:
            content_changed = True
        setattr(pill, key, value)
    if content_changed and pill.safety_relevant_overridden_at is None:
        pill.safety_relevant = await auto_tag_safety(pill.name, pill.description, db)
    await db.flush()
    return pill


async def delete_pill(db: AsyncSession, pill: Pill) -> None:
    await db.delete(pill)


async def retire_pill(db: AsyncSession, pill: Pill, *, actor_id: uuid.UUID) -> Pill:
    """Admin-only retire (AC-D14): hidden from active flows, retained."""
    if pill.retired_at is None:
        pill.retired_at = now_utc()
    await record_audit(
        db,
        actor_id=actor_id,
        action="pill.retire",
        target_entity="pill",
        target_id=pill.id,
    )
    await db.flush()
    return pill


async def override_pill_safety(
    db: AsyncSession, pill: Pill, *, safety_relevant: bool, actor_id: uuid.UUID
) -> Pill:
    """Admin override of the safety tag in either direction (AC-D21).
    Stamps the override marker so later edits stop re-evaluating it."""
    pill.safety_relevant = safety_relevant
    pill.safety_relevant_overridden_at = now_utc()
    await record_audit(
        db,
        actor_id=actor_id,
        action="pill.safety_override",
        target_entity="pill",
        target_id=pill.id,
        detail={"safety_relevant": safety_relevant},
    )
    await db.flush()
    return pill


async def get_discoverable_pill(db: AsyncSession, pill_id: uuid.UUID) -> Pill | None:
    """Testee-facing single-pill fetch (AC-D8). Returns ``None`` when
    the pill is missing, not discoverable, or retired — the router
    collapses all three into ``404 not_found`` for the same reason
    :func:`list_discoverable_pills` hides them from the discovery list."""
    pill = await _by_id(db, Pill, pill_id)
    if pill is None or not pill.discoverable or pill.retired_at is not None:
        return None
    return pill


async def list_discoverable_pills(
    db: AsyncSession,
    *,
    cursor: str | None,
    limit: int,
    subject_id: uuid.UUID | None = None,
    difficulty: int | None = None,
    search: str | None = None,
) -> tuple[list[Pill], str | None, int]:
    """Testee discovery (AC-D8): discoverable, non-retired pills only.
    Optional subject / difficulty-band / name-search filters."""
    rows = [
        p for p in await _tenant_rows(db, Pill) if p.discoverable and p.retired_at is None
    ]
    if subject_id is not None:
        rows = [p for p in rows if p.subject_id == subject_id]
    if difficulty is not None:
        rows = [
            p
            for p in rows
            if p.available_difficulty_min <= difficulty <= p.available_difficulty_max
        ]
    if search:
        needle = search.lower()
        rows = [
            p
            for p in rows
            if needle in p.name.lower() or (p.description or "").lower().find(needle) >= 0
        ]
        # §6.5 discovery-miss signal (D1-D2): a non-empty search that returns no
        # good match is a coverage gap — capture it for the D3 gap-detection
        # sweep (deduped at the signal layer). Commits with the request.
        if not rows:
            from app.domain.signals import capture_discovery_miss

            await capture_discovery_miss(db, search=search, result_count=0)
    return paginate(rows, cursor, limit)


# --- learning paths ---------------------------------------------------


async def _path_pill_ids(db: AsyncSession, path_id: uuid.UUID) -> list[uuid.UUID]:
    result = await db.execute(
        select(LearningPathPill).where(
            LearningPathPill.learning_path_id == path_id,
            LearningPathPill.tenant_id == SEED_TENANT_ID,
        )
    )
    members = sorted(result.scalars().all(), key=lambda m: m.position)
    return [m.pill_id for m in members]


async def _set_path_pills(
    db: AsyncSession, path_id: uuid.UUID, pill_ids: list[uuid.UUID]
) -> None:
    result = await db.execute(
        select(LearningPathPill).where(
            LearningPathPill.learning_path_id == path_id,
            LearningPathPill.tenant_id == SEED_TENANT_ID,
        )
    )
    for existing in list(result.scalars().all()):
        await db.delete(existing)
    for position, pill_id in enumerate(pill_ids):
        db.add(
            LearningPathPill(
                tenant_id=SEED_TENANT_ID,
                learning_path_id=path_id,
                pill_id=pill_id,
                position=position,
            )
        )
    await db.flush()


async def create_path(
    db: AsyncSession,
    *,
    name: str,
    description: str | None,
    pill_ids: list[uuid.UUID],
) -> tuple[LearningPath, list[uuid.UUID]]:
    path = LearningPath(
        tenant_id=SEED_TENANT_ID,
        name=name,
        description=description,
        is_private=False,
    )
    db.add(path)
    await db.flush()
    await db.refresh(path)
    await _set_path_pills(db, path.id, pill_ids)
    return path, list(pill_ids)


async def get_path(
    db: AsyncSession, path_id: uuid.UUID
) -> tuple[LearningPath, list[uuid.UUID]] | None:
    path = await _by_id(db, LearningPath, path_id)
    if path is None:
        return None
    return path, await _path_pill_ids(db, path_id)


async def list_paths(
    db: AsyncSession, *, cursor: str | None, limit: int
) -> tuple[list[tuple[LearningPath, list[uuid.UUID]]], str | None, int]:
    page, next_cursor, total = paginate(
        await _tenant_rows(db, LearningPath), cursor, limit
    )
    return [(p, await _path_pill_ids(db, p.id)) for p in page], next_cursor, total


async def update_path(
    db: AsyncSession,
    path: LearningPath,
    fields: dict[str, Any],
    pill_ids: list[uuid.UUID] | None,
) -> tuple[LearningPath, list[uuid.UUID]]:
    for key, value in fields.items():
        setattr(path, key, value)
    if pill_ids is not None:
        await _set_path_pills(db, path.id, pill_ids)
    await db.flush()
    return path, await _path_pill_ids(db, path.id)


async def delete_path(db: AsyncSession, path: LearningPath) -> None:
    await _set_path_pills(db, path.id, [])
    await db.delete(path)


# --- groups -----------------------------------------------------------


async def _group_member_ids(db: AsyncSession, group_id: uuid.UUID) -> list[uuid.UUID]:
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.tenant_id == SEED_TENANT_ID,
        )
    )
    return [m.user_id for m in result.scalars().all()]


async def create_group(
    db: AsyncSession, *, name: str, description: str | None, actor_id: uuid.UUID
) -> Group:
    group = Group(
        tenant_id=SEED_TENANT_ID,
        name=name,
        description=description,
        is_system=False,
        created_by=actor_id,
    )
    db.add(group)
    await db.flush()
    await db.refresh(group)
    return group


async def get_group(
    db: AsyncSession, group_id: uuid.UUID
) -> tuple[Group, list[uuid.UUID]] | None:
    group = await _by_id(db, Group, group_id)
    if group is None:
        return None
    return group, await _group_member_ids(db, group_id)


async def list_groups(
    db: AsyncSession, *, cursor: str | None, limit: int
) -> tuple[list[tuple[Group, list[uuid.UUID]]], str | None, int]:
    page, next_cursor, total = paginate(await _tenant_rows(db, Group), cursor, limit)
    return [(g, await _group_member_ids(db, g.id)) for g in page], next_cursor, total


async def update_group(
    db: AsyncSession, group: Group, fields: dict[str, Any]
) -> tuple[Group, list[uuid.UUID]]:
    for key, value in fields.items():
        setattr(group, key, value)
    await db.flush()
    return group, await _group_member_ids(db, group.id)


async def delete_group(db: AsyncSession, group: Group) -> None:
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group.id,
            GroupMember.tenant_id == SEED_TENANT_ID,
        )
    )
    for member in list(result.scalars().all()):
        await db.delete(member)
    await db.delete(group)


async def add_group_member(
    db: AsyncSession, group: Group, user_id: uuid.UUID
) -> list[uuid.UUID]:
    existing = await _group_member_ids(db, group.id)
    if user_id not in existing:
        db.add(GroupMember(tenant_id=SEED_TENANT_ID, group_id=group.id, user_id=user_id))
        await db.flush()
        existing = await _group_member_ids(db, group.id)
    return existing


async def remove_group_member(
    db: AsyncSession, group: Group, user_id: uuid.UUID
) -> list[uuid.UUID]:
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group.id,
            GroupMember.user_id == user_id,
            GroupMember.tenant_id == SEED_TENANT_ID,
        )
    )
    member = result.scalar_one_or_none()
    if member is not None:
        await db.delete(member)
        await db.flush()
    return await _group_member_ids(db, group.id)


# --- AI pill-proposal queue (AC-D7 / AC-D8; AI stubbed) ---------------
# Persisted on ``processing_tasks`` (AC-CD7) — there is no SPEC §5
# "pill proposal" entity. status pending -> done; the terminal payload
# carries the admin decision (approved -> created pill id, or rejected
# + reason) so "failed" stays reserved for genuine processing errors.


async def enqueue_pill_proposal(
    db: AsyncSession,
    *,
    subject_id: uuid.UUID,
    name: str,
    description: str | None,
    available_difficulty_min: int = 1,
    available_difficulty_max: int = 10,
    estimated_minutes: int | None = None,
) -> ProcessingTask:
    """Build a proposal via the configured AIProvider and persist it
    ``pending`` for admin review. P5 Slice 1 swaps the call signature
    to the new ``Operation`` enum + :class:`~app.ai.provider.AIResult`
    shape; P5 Slice 2 persists full provenance (provider, model,
    prompt_version, tokens, cost) inside ``payload`` per AC-CD8 v1.6.
    No network in tests (AC-CD15) — ``RecordingProvider`` substitutes
    the module-level provider singleton."""
    provider = resolve_provider(Operation.pill_proposal)
    result = await provider.generate(
        Operation.pill_proposal,
        {
            "subject_id": str(subject_id),
            "name": name,
            "description": description,
            "available_difficulty_min": available_difficulty_min,
            "available_difficulty_max": available_difficulty_max,
            "estimated_minutes": estimated_minutes,
        },
    )
    # Per AC-CD8 v1.6 (final sentence): provenance persists on every
    # AI-produced entity — for pill proposals (which use
    # ``processing_tasks`` as their persistence row per AC-CD7), the
    # provenance dict lives alongside the proposal in ``payload`` so
    # the cost dashboard's per-operation aggregation can sum proposal
    # spend without a separate provenance column on
    # ``processing_tasks`` itself.
    task = ProcessingTask(
        tenant_id=SEED_TENANT_ID,
        task_name=PROPOSAL_TASK_NAME,
        status=ProcessingTaskStatus.pending,
        payload={
            "proposal": result.content,
            "provenance": {
                "provider": result.provider,
                "model": result.model,
                "prompt_version": result.prompt_version,
                "prompt_tokens": result.prompt_tokens,
                "completion_tokens": result.completion_tokens,
                "cost_usd": result.cost_usd,
            },
        },
    )
    db.add(task)
    await db.flush()
    await db.refresh(task)
    await maybe_fire_budget_alert(db, tenant_id=SEED_TENANT_ID)
    return task


async def list_pill_proposals(
    db: AsyncSession, *, cursor: str | None, limit: int
) -> tuple[list[ProcessingTask], str | None, int]:
    rows = [
        t
        for t in await _tenant_rows(db, ProcessingTask)
        if t.task_name == PROPOSAL_TASK_NAME
    ]
    return paginate(rows, cursor, limit)


async def get_pill_proposal(
    db: AsyncSession, proposal_id: uuid.UUID
) -> ProcessingTask | None:
    task = await _by_id(db, ProcessingTask, proposal_id)
    if task is None or task.task_name != PROPOSAL_TASK_NAME:
        return None
    return task


async def reject_pill_proposal(
    db: AsyncSession,
    task: ProcessingTask,
    *,
    actor_id: uuid.UUID,
    reason: str | None,
) -> ProcessingTask:
    task.status = ProcessingTaskStatus.done
    task.finished_at = now_utc()
    task.payload = {
        **(task.payload or {}),
        "decision": "rejected",
        "reason": reason,
    }
    await record_audit(
        db,
        actor_id=actor_id,
        action="pill_proposal.reject",
        target_entity="processing_tasks",
        target_id=task.id,
        detail={"reason": reason},
    )
    await db.flush()
    return task
