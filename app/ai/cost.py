"""Per-call AI cost capture + monthly aggregation + budget alerts
(CODE_SPEC §7, AC-CD8 / amended AC-D18).

Slice 1 landed the pricing table, the per-call cost computation, and
the provenance helper. Slice 3 adds the monthly-spend aggregator
(``current_month_spend``) and the budget-alert dispatcher
(``maybe_fire_budget_alert`` — AC-D18 v1.1: alerts at 50/80/100 %,
operations continue, no hard enforcement).

Embedding spend is tracked against the OpenAI provider per amended
AC-D18 (Drive RAG / AC-D22 / P9).
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.provider import AIResult, EmbedResult, Operation
from app.permissions import now_utc

logger = logging.getLogger(__name__)

# (provider, model) → (input_usd_per_1m_tokens, output_usd_per_1m_tokens).
# Source: provider public price sheets (Anthropic, OpenAI) at v1 build time.
# Bumped manually when a provider changes pricing; bumping is a
# deliberate, audited change.
PRICE_TABLE: dict[tuple[str, str], tuple[float, float]] = {
    # Anthropic Claude Sonnet 4.6 — primary for the 5 Anthropic ops.
    ("anthropic", "claude-sonnet-4-6"): (3.00, 15.00),
    # OpenAI GPT-4o — cross-family review per AC-D19.
    ("openai", "gpt-4o"): (2.50, 10.00),
    # OpenAI text-embedding-3-small — Drive RAG per AC-D22.
    # Output tokens are 0 for embeddings (no completion side).
    ("openai", "text-embedding-3-small"): (0.02, 0.0),
    # The deterministic stub costs nothing.
    ("stub", "stub-1"): (0.0, 0.0),
    ("stub", "stub-embed-1"): (0.0, 0.0),
}


def compute_cost(
    provider: str, model: str, prompt_tokens: int, completion_tokens: int
) -> float:
    """USD cost for a single call. Raises :class:`ValueError` for any
    ``(provider, model)`` pair missing from :data:`PRICE_TABLE` — every
    pair seen in production must be priced so the cost dashboard never
    silently zeroes out a real spend."""
    try:
        in_rate, out_rate = PRICE_TABLE[(provider, model)]
    except KeyError as exc:
        raise ValueError(
            f"No price entry for provider={provider!r} model={model!r}. "
            "Add the (provider, model) pair to PRICE_TABLE before using "
            "this model in production (AC-D18 cost-tracking contract)."
        ) from exc
    return (prompt_tokens / 1_000_000) * in_rate + (
        completion_tokens / 1_000_000
    ) * out_rate


def record_provenance(entity: Any, result: AIResult | EmbedResult) -> None:
    """Stamp :class:`app.models.AIProvenanceMixin` columns on ``entity``
    from a provider result (AC-CD8 v1.6 / F7). Works for both
    :class:`AIResult` (Anthropic / OpenAI message ops) and
    :class:`EmbedResult` (OpenAI embeddings).

    Use when one AI call produces one entity (grading → Grade,
    weakness → WeaknessReport, learning_material → LearningMaterial,
    pill_proposal → ProcessingTask). For 1:N calls (generation → N
    Question rows) use :func:`record_provenance_share`.

    The entity is mutated in place — the caller still has to add it to
    the session and flush. The prompt_version is read from the result
    for message ops; embed results have no prompt_version (no template),
    so :attr:`AIProvenanceMixin.ai_prompt_version` stays ``None`` for
    embeddings.
    """
    entity.ai_provider = result.provider
    entity.ai_model = result.model
    entity.ai_prompt_tokens = result.prompt_tokens
    entity.ai_cost_usd = result.cost_usd
    if isinstance(result, AIResult):
        entity.ai_prompt_version = result.prompt_version
        entity.ai_completion_tokens = result.completion_tokens
    else:
        # EmbedResult — no prompt template, no completion tokens.
        entity.ai_prompt_version = None
        entity.ai_completion_tokens = 0


def record_provenance_share(entity: Any, result: AIResult, *, share_count: int) -> None:
    """Stamp the per-entity SHARE of a multi-entity AI call (the 1:N
    case where one call produces ``share_count`` entities, e.g.
    generation produces N Question rows from a single Messages-API
    response).

    Cost + tokens are divided evenly so summing across the produced
    rows reconstructs the call's total — the cost dashboard's
    per-attempt aggregation stays correct without de-duplicating
    same-call entities. Provider, model, and prompt_version are the
    full per-call values and replicated on every row (they describe
    the call, not the share).

    Token counts use floor division because :class:`AIProvenanceMixin`
    columns are int-typed; the rounding remainder (< ``share_count``
    tokens out of thousands) is operationally insignificant. Cost is
    float and divides exactly.
    """
    if share_count < 1:
        raise ValueError(
            f"record_provenance_share requires share_count >= 1, got " f"{share_count!r}."
        )
    entity.ai_provider = result.provider
    entity.ai_model = result.model
    entity.ai_prompt_version = result.prompt_version
    entity.ai_prompt_tokens = result.prompt_tokens // share_count
    entity.ai_completion_tokens = result.completion_tokens // share_count
    entity.ai_cost_usd = result.cost_usd / share_count


# --- Op routing reminder for callers ----------------------------------
# AC-CD8 v1.6: which protocol method handles which Operation. Domain
# code uses ``OP_TO_METHOD[op]`` to defensively assert routing in tests
# and as inline documentation — the resolver is the runtime path.

OP_TO_METHOD: dict[Operation, str] = {
    Operation.generation: "generate",
    Operation.grading: "grade",
    Operation.weakness: "generate",
    Operation.learning_material: "generate",
    Operation.pill_proposal: "generate",
    Operation.pill_generation: "generate",
    Operation.grade_review: "review",
    Operation.anchor_self_review: "review",
    Operation.content_self_review: "review",
    Operation.embed: "embed",
}


# --- Monthly spend aggregation (AC-D18) ------------------------------
# The cost dashboard surfaces rolling monthly AI spend across every
# AI-produced entity carrying :class:`AIProvenanceMixin` columns plus
# the pill-proposal provenance dict in ``processing_tasks.payload``.
# The dashboard endpoint in :mod:`app.routers.cost` consumes these.

# The provenance-bearing entity tables (6 message-op: Grade, GradeReview,
# Question, AnchorQuestion, WeaknessReport, LearningMaterial; 2 embed:
# DriveChunk, and CorpusChunk from AC-CD25 / A2) are enumerated explicitly
# in :func:`current_month_spend` so an added/removed mixin user is caught
# at lint time (no clever metaclass discovery).


def _start_of_current_month(now: datetime) -> datetime:
    """First instant of the calendar month containing ``now`` (UTC).
    Used to scope rolling-month aggregations."""
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


async def _spend_for_table(
    db: AsyncSession,
    model: Any,
    *,
    tenant_id: uuid.UUID,
    since: datetime,
) -> tuple[float, dict[str, float], dict[str, float]]:
    """Sum ``ai_cost_usd`` for a single AIProvenanceMixin-bearing table
    within the current month. Returns ``(total, by_provider, by_model)``.

    Iterates in Python because the FakeSession harness has no aggregate
    SUM / GROUP BY; at v1 scale (tens of users, hundreds of
    attempts/month) the row count is small enough that pulling rows
    and reducing in Python is fine. Profile in P11 if the deployment
    ever outgrows this.
    """
    result = await db.execute(select(model).where(model.tenant_id == tenant_id))
    total = 0.0
    by_provider: dict[str, float] = {}
    by_model: dict[str, float] = {}
    for row in result.scalars().all():
        created_at = getattr(row, "created_at", None)
        if created_at is None or created_at < since:
            continue
        cost = getattr(row, "ai_cost_usd", None)
        if cost is None:
            continue
        total += cost
        provider = getattr(row, "ai_provider", None) or "(unknown)"
        model_name = getattr(row, "ai_model", None) or "(unknown)"
        by_provider[provider] = by_provider.get(provider, 0.0) + cost
        by_model[model_name] = by_model.get(model_name, 0.0) + cost
    return total, by_provider, by_model


async def _pill_proposal_spend(
    db: AsyncSession, *, tenant_id: uuid.UUID, since: datetime
) -> tuple[float, dict[str, float], dict[str, float]]:
    """Sum the ``provenance.cost_usd`` carried in
    ``processing_tasks.payload`` for pill_proposal rows in the current
    month (the proposal provenance lives in the JSON payload per
    AC-CD8 v1.6 final clause, not in ``AIProvenanceMixin`` columns)."""
    from app.models import ProcessingTask

    PROPOSAL_TASK_NAME = "pill_proposal"
    result = await db.execute(
        select(ProcessingTask).where(ProcessingTask.tenant_id == tenant_id)
    )
    total = 0.0
    by_provider: dict[str, float] = {}
    by_model: dict[str, float] = {}
    for row in result.scalars().all():
        if row.task_name != PROPOSAL_TASK_NAME:
            continue
        created_at = getattr(row, "created_at", None)
        if created_at is None or created_at < since:
            continue
        payload = row.payload or {}
        prov = payload.get("provenance") or {}
        cost = prov.get("cost_usd")
        if cost is None:
            continue
        total += cost
        provider = prov.get("provider") or "(unknown)"
        model_name = prov.get("model") or "(unknown)"
        by_provider[provider] = by_provider.get(provider, 0.0) + cost
        by_model[model_name] = by_model.get(model_name, 0.0) + cost
    return total, by_provider, by_model


async def _pill_generation_spend(
    db: AsyncSession, *, tenant_id: uuid.UUID, since: datetime
) -> tuple[float, dict[str, float], dict[str, float]]:
    """Sum the per-draft ``provenance.cost_share`` carried in
    ``processing_tasks.payload`` for ``pill_generation`` rows in the current
    month (AC-D29 / B3 fan-out). One generation call fans out to N draft rows,
    each stamped with its 1/N cost share (``record_provenance_share``
    semantics); summing the N shares reconstructs the call cost, so the monthly
    total stays exact (AC-CD8 spend invariant). Mirrors
    :func:`_pill_proposal_spend` — the drafts live in the JSON payload, not on
    an :class:`AIProvenanceMixin` row, so the same payload-fold pattern reads
    them (the share key is ``cost_share``, the proposal's is ``cost_usd``)."""
    from app.models import ProcessingTask

    GENERATION_TASK_NAME = "pill_generation"
    result = await db.execute(
        select(ProcessingTask).where(ProcessingTask.tenant_id == tenant_id)
    )
    total = 0.0
    by_provider: dict[str, float] = {}
    by_model: dict[str, float] = {}
    for row in result.scalars().all():
        if row.task_name != GENERATION_TASK_NAME:
            continue
        created_at = getattr(row, "created_at", None)
        if created_at is None or created_at < since:
            continue
        payload = row.payload or {}
        prov = payload.get("provenance") or {}
        cost = prov.get("cost_share")
        if cost is None:
            continue
        total += cost
        provider = prov.get("provider") or "(unknown)"
        model_name = prov.get("model") or "(unknown)"
        by_provider[provider] = by_provider.get(provider, 0.0) + cost
        by_model[model_name] = by_model.get(model_name, 0.0) + cost
    return total, by_provider, by_model


async def _rag_retrieve_spend(
    db: AsyncSession, *, tenant_id: uuid.UUID, since: datetime
) -> tuple[float, dict[str, float], dict[str, float]]:
    """Sum the query-side embed cost stamped in ``AuditLog`` rows
    with ``action="rag.retrieve"`` (AC-D22 / P9 Slice 3).

    The retrieve-time embed call has no persisted entity to own its
    provenance — the :class:`DriveChunk` rows carry the *ingest*-side
    embed cost, but the *retrieve*-side embed (one per generation
    call that has a pill scope) is transient. The AC-CD8 v1.6 contract
    requires per-op provenance somewhere; we stamp it on an audit row
    keyed at ``action="rag.retrieve"`` and fold the rows into the
    monthly aggregate here so the cost dashboard's sum-to-call-total
    invariant holds across both ingest and retrieve.

    Mirrors :func:`_pill_proposal_spend`'s shape — the same audit-log
    fold pattern. Returns ``(total, by_provider, by_model)``.
    """
    from app.models import AuditLog

    result = await db.execute(select(AuditLog).where(AuditLog.tenant_id == tenant_id))
    total = 0.0
    by_provider: dict[str, float] = {}
    by_model: dict[str, float] = {}
    for row in result.scalars().all():
        # Both the Drive retrieve (``rag.retrieve``) and the reference-corpus
        # retrieve (``corpus.retrieve``, AC-CD25 / A3) stamp the query-side
        # embed cost on an audit row with no owning entity; fold both.
        if row.action not in ("rag.retrieve", "corpus.retrieve"):
            continue
        created_at = getattr(row, "created_at", None)
        if created_at is None or created_at < since:
            continue
        detail = row.detail or {}
        cost = detail.get("cost_usd")
        if cost is None:
            continue
        total += cost
        provider = detail.get("provider") or "(unknown)"
        model_name = detail.get("model") or "(unknown)"
        by_provider[provider] = by_provider.get(provider, 0.0) + cost
        by_model[model_name] = by_model.get(model_name, 0.0) + cost
    return total, by_provider, by_model


async def current_month_spend(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Aggregate rolling monthly AI spend across every provenance-bearing
    entity (AC-D18 cost dashboard surface).

    Returns ``{"total_usd": float, "by_provider": dict, "by_model":
    dict, "since": datetime}``. Tables included: Grade, GradeReview,
    Question, AnchorQuestion, WeaknessReport, LearningMaterial,
    DriveChunk, CorpusChunk (AC-CD25 corpus-embed spend); plus
    ``processing_tasks.payload['provenance']`` for pill_proposal
    (``cost_usd``) and pill_generation (``cost_share``, the B3 N-draft
    fan-out per AC-D29).

    ``DriveChunk`` joined the loop at P9 (AC-D22 / AC-CD8 v1.6): the
    OpenAI embedding spend now surfaces in ``by_provider["openai"]`` /
    ``by_model["text-embedding-3-small"]`` alongside the
    generation/grading/review spend. Embed rows carry
    ``ai_completion_tokens=0`` and ``ai_prompt_version=None`` per
    :func:`record_provenance`'s embed branch; ``_spend_for_table``
    only consults ``ai_cost_usd`` so the embed shape sums cleanly with
    the message-op shape (ROADMAP P9 "embedding spend appears against
    OpenAI in cost").

    The original implementation tried to interpolate
    ``_PROVENANCE_ENTITIES_HINT`` into this docstring via string
    concatenation, but Python only assigns ``__doc__`` from a bare
    string literal — a parenthesised concatenation expression
    silently leaves ``__doc__ = None``, breaking ``help()`` and IDE
    tooltips (Gitar PR-#16 Slice 3 finding #2).
    """
    from app.models import (
        AnchorQuestion,
        CorpusChunk,
        DriveChunk,
        Grade,
        GradeReview,
        LearningMaterial,
        Question,
        WeaknessReport,
    )

    when = now or now_utc()
    since = _start_of_current_month(when)

    total = 0.0
    by_provider: dict[str, float] = {}
    by_model: dict[str, float] = {}

    for model in (
        Grade,
        GradeReview,
        Question,
        AnchorQuestion,
        WeaknessReport,
        LearningMaterial,
        DriveChunk,
        CorpusChunk,
    ):
        sub_total, sub_provider, sub_model = await _spend_for_table(
            db, model, tenant_id=tenant_id, since=since
        )
        total += sub_total
        for p, c in sub_provider.items():
            by_provider[p] = by_provider.get(p, 0.0) + c
        for m, c in sub_model.items():
            by_model[m] = by_model.get(m, 0.0) + c

    # Pill proposals live in processing_tasks.payload, not on a mixin.
    sub_total, sub_provider, sub_model = await _pill_proposal_spend(
        db, tenant_id=tenant_id, since=since
    )
    total += sub_total
    for p, c in sub_provider.items():
        by_provider[p] = by_provider.get(p, 0.0) + c
    for m, c in sub_model.items():
        by_model[m] = by_model.get(m, 0.0) + c

    # Generated draft fan-out (B3): each pill_generation draft carries its
    # 1/N cost share in processing_tasks.payload['provenance'] (AC-D29).
    sub_total, sub_provider, sub_model = await _pill_generation_spend(
        db, tenant_id=tenant_id, since=since
    )
    total += sub_total
    for p, c in sub_provider.items():
        by_provider[p] = by_provider.get(p, 0.0) + c
    for m, c in sub_model.items():
        by_model[m] = by_model.get(m, 0.0) + c

    # RAG-retrieve query embeds live in audit_log.detail (no owning
    # entity to carry provenance; AC-CD8 v1.6 routing audit row).
    sub_total, sub_provider, sub_model = await _rag_retrieve_spend(
        db, tenant_id=tenant_id, since=since
    )
    total += sub_total
    for p, c in sub_provider.items():
        by_provider[p] = by_provider.get(p, 0.0) + c
    for m, c in sub_model.items():
        by_model[m] = by_model.get(m, 0.0) + c

    return {
        "total_usd": total,
        "by_provider": by_provider,
        "by_model": by_model,
        "since": since,
    }


# --- Budget alerts (AC-D18 v1.1: alerts at 50/80/100 %, no hard enforcement)


def _year_month_key(now: datetime) -> str:
    """``YYYY-MM`` calendar-month key used in the alert-deduplication
    audit-log row's ``detail``."""
    return f"{now.year:04d}-{now.month:02d}"


async def _alert_already_fired_this_month(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    threshold: int,
    year_month: str,
) -> bool:
    """Check the audit log for a ``budget_alert.fired`` row at this
    threshold for this calendar month. The audit-log row IS the
    dedupe state — no separate alerts table. P11 may add a richer
    surface; the simple one suffices for AC-D18 v1.1."""
    from app.models import AuditLog

    result = await db.execute(select(AuditLog).where(AuditLog.tenant_id == tenant_id))
    for row in result.scalars().all():
        if row.action != "budget_alert.fired":
            continue
        detail = row.detail or {}
        if (
            detail.get("threshold") == threshold
            and detail.get("year_month") == year_month
        ):
            return True
    return False


async def maybe_fire_budget_alert(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    now: datetime | None = None,
) -> list[int]:
    """Compute rolling monthly spend vs the configured budget; for any
    threshold newly crossed this month, send one alert email via the
    P2 ``SMTPClient`` seam and record a ``budget_alert.fired`` audit
    row so the threshold is not re-sent this month.

    Returns the list of thresholds fired in this call (most calls
    return ``[]``; the first call after crossing a threshold returns
    e.g. ``[50]``; if spend leaps from 0 % to 85 % between calls
    BOTH ``[50, 80]`` fire on the next call).

    AC-D18 v1.1: **operations continue regardless of threshold
    crossings — no hard enforcement.** This helper never raises and
    never refuses an AI call; it only notifies. The caller is
    responsible for invoking it post-call.

    The top-level ``try/except`` makes the "never raises" contract a
    real invariant rather than a docstring promise — a DB / SMTP /
    audit-write failure inside the inner body would otherwise
    propagate into the primary AI call path and fail the business
    operation due to a monitoring side-effect (Gitar PR-#16 Slice 3
    finding #1). The inner body lives in
    :func:`_maybe_fire_budget_alert_inner` so the happy path is
    testable in isolation and the wrapper stays narrow.

    Fail-soft on every dependency: a missing monthly_ai_budget skips
    silently; a missing settings row skips silently; the SMTP seam
    is already fail-soft (captures emails in tests, logs a warning
    when SMTP is unconfigured in dev).
    """
    try:
        return await _maybe_fire_budget_alert_inner(db, tenant_id=tenant_id, now=now)
    except Exception:
        logger.warning(
            "Budget alert poll failed (fail-soft, no hard enforcement)",
            exc_info=True,
        )
        return []


async def _maybe_fire_budget_alert_inner(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    now: datetime | None = None,
) -> list[int]:
    """Inner body of :func:`maybe_fire_budget_alert` — does the actual
    work and is allowed to raise. The public wrapper catches and logs
    so callers see a never-raises contract."""
    from app.domain.catalogue import record_audit
    from app.models import AppUser, SystemSettings, UserStatus
    from app.permissions import ROLE_ADMINISTRATOR, SMTPClient

    when = now or now_utc()
    settings_row = (
        await db.execute(
            select(SystemSettings).where(SystemSettings.tenant_id == tenant_id)
        )
    ).scalar_one_or_none()
    if settings_row is None:
        return []
    budget = getattr(settings_row, "monthly_ai_budget", None)
    if budget is None or budget <= 0:
        return []
    thresholds = sorted(int(t) for t in (settings_row.budget_alert_thresholds or []))
    if not thresholds:
        return []

    spend = await current_month_spend(db, tenant_id=tenant_id, now=when)
    percent = (spend["total_usd"] / budget) * 100.0
    year_month = _year_month_key(when)

    crossed: list[int] = []
    for threshold in thresholds:
        if percent < threshold:
            continue
        if await _alert_already_fired_this_month(
            db, tenant_id=tenant_id, threshold=threshold, year_month=year_month
        ):
            continue
        crossed.append(threshold)

    if not crossed:
        return []

    # Find an admin recipient. P11 may add a configurable
    # ``budget_alert_email`` field on system_settings; for now we pick
    # the first active admin for the tenant.
    admin_result = await db.execute(select(AppUser).where(AppUser.tenant_id == tenant_id))
    admin_email: str | None = None
    for user in admin_result.scalars().all():
        if user.role == ROLE_ADMINISTRATOR and user.status == UserStatus.active:
            admin_email = user.email
            break
    if admin_email is None:
        logger.warning(
            "Budget alert thresholds crossed (%s) but no active admin "
            "recipient found for tenant %s — alert not sent.",
            crossed,
            tenant_id,
        )
        return []

    smtp = SMTPClient()
    for threshold in crossed:
        subject = f"Acumen AI budget alert: {threshold}% of monthly cap"
        body = (
            f"Acumen monthly AI spend has reached {percent:.1f}% of the "
            f"configured ${budget:.2f} monthly budget "
            f"({year_month}). This is informational — operations "
            f"continue per AC-D18 (no hard enforcement). Total spend "
            f"this month: ${spend['total_usd']:.4f}."
        )
        smtp.send(admin_email, subject, body)
        await record_audit(
            db,
            actor_id=None,
            action="budget_alert.fired",
            target_entity="system_settings",
            target_id=settings_row.id,
            detail={
                "threshold": threshold,
                "year_month": year_month,
                "spend_usd": spend["total_usd"],
                "budget_usd": budget,
                "percent": percent,
            },
        )
    return crossed
