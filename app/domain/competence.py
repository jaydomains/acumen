"""competence_estimate — IRT-style per-response value + recency decay.

AC-D9 (v1.2) — full formula; AC-CD13 anchors the implementation; CODE_SPEC
§13. Near-full unit+branch coverage is required by AC-CD15 because this
file is one of the three statistical-core hot spots (CODE_SPEC §17) — a
subtle error here is silently wrong in production and not cheaply caught.

Slice 1 ships the **pure-function math** that AC-D9 v1.2 specifies:

  response_competence = effective_difficulty
                      + competence_sensitivity * (response_score - 0.5)
  attempt_competence  = mean(response_competence)
  weight_i            = 0.5 ** (age_days_i / competence_decay_halflife_days)
  competence_estimate = Σ(c_i * w_i) / Σ(w_i)

…plus :func:`loop_target_difficulty` which combines AC-D9's
``round(estimate + 0.5)`` rule, the per-pill ``available_difficulty_range``
clamp (AC-D9 v1.6), and the AC-D6 "three-consecutive well-below-difficulty"
step-down.

Slice 2 adds :func:`apply_competence_update` — the DB-writing wrapper
invoked from :func:`app.domain.attempts.submit_attempt`. It resolves
``effective_difficulty`` per response (anchor-pool ``AnchorQuestion.
effective_difficulty`` when the question is anchor-backed; else
``Question.assigned_difficulty``), loads every prior submitted attempt by
this Testee on the pill, and recomputes the recency-weighted aggregate
from scratch — write-time-with-all-history per the locked v1 decay
strategy. The stored value is therefore fresh as of the last submit and
goes stale between submits, but staleness only matters once new data
exists; if a future operational dashboard wants live decay against a
fixed point in time, that lookup recomputes from history (which is what
this code does) rather than reading the stored estimate.
"""

from __future__ import annotations

import math
import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.calibration import compute_fresh_question_delta
from app.models import (
    SEED_TENANT_ID,
    AnchorQuestion,
    Assignment,
    Attempt,
    AttemptAnchor,
    AttemptOrigin,
    CompetencyProfile,
    Grade,
    Question,
    Response,
    SystemSettings,
)
from app.permissions import now_utc

# Threshold for the AC-D6 "three consecutive well-below-difficulty"
# step-down. AC-D9 v1.2 names the rule but does not name the threshold —
# the exact wording is "Three consecutive attempts where the Testee's
# score is well below the difficulty trigger a step-down of one integer
# regardless of formula" (DECISIONS.md AC-D9 v1.2). AC-D9 also defines
# response_score = 0.5 as "performed exactly at the question's
# difficulty"; "well below the difficulty" therefore means materially
# under 0.5. The 0.4 cut-off is a P7 implementation choice (0.1 below
# the at-difficulty midpoint) — small enough to not fire on a normal
# 50/50 attempt but loose enough to catch a clear pattern of under-
# performance. Could become a ``system_settings`` column in v1.x if
# operational tuning needs it; for now a code constant per the user's
# direction.
_WELL_BELOW_DIFFICULTY_THRESHOLD = 0.4
_STEP_DOWN_CONSECUTIVE_COUNT = 3


def response_competence(
    effective_difficulty: float,
    response_score: float,
    sensitivity: float,
) -> float:
    """Per-response competence value (AC-D9 v1.2 IRT-style formula).

    ``response_competence = effective_difficulty
                          + sensitivity * (response_score - 0.5)``

    Interpretation: ``response_score = 0.5`` puts the Testee exactly at
    the question's difficulty. Scoring above 0.5 lifts competence above
    the difficulty; below 0.5 drops it. ``sensitivity`` sets how much.
    Default sensitivity is 2.0 (``system_settings.competence_sensitivity``).

    The function does not validate input ranges — AC-D9 says scores are
    0.0–1.0 and difficulty is 1.0–10.0 but the formula is well-defined
    over any reals, and the upstream gradebook is the boundary that
    enforces ranges. Garbage-in produces a number, not an exception.
    """
    return effective_difficulty + sensitivity * (response_score - 0.5)


def attempt_competence(response_competences: Sequence[float]) -> float | None:
    """Mean of ``response_competence`` across an attempt's responses
    (AC-D9 v1.2). Returns ``None`` on empty input — an attempt with no
    scored responses on the relevant pill has no competence signal and
    must not contribute to the aggregate.

    Callers are responsible for restricting the input to responses on
    a single pill — the aggregate is per ``(testee, pill)``.
    """
    if not response_competences:
        return None
    return sum(response_competences) / len(response_competences)


def compute_competence_estimate(
    attempts: Sequence[tuple[float, int]],
    *,
    halflife_days: int,
) -> float | None:
    """Recency-weighted aggregate (AC-D9 v1.2). ``attempts`` is a sequence
    of ``(attempt_competence, age_in_days)`` tuples — one per submitted
    attempt by the Testee on the pill. ``halflife_days`` is the decay
    constant from ``system_settings.competence_decay_halflife_days``
    (default 90).

    ``weight = 0.5 ** (age_days / halflife_days)``; an attempt today has
    weight 1.0, an attempt at one half-life has weight 0.5, and so on.

    Returns ``None`` on empty input — AC-D9 null-handling: "For pills
    with zero attempts by a Testee, ``competence_estimate`` is null. UI
    displays 'no data yet' rather than a band. Loop logic per AC-D6
    treats null as needing benchmark or first attempt, not as a failing
    score." Callers must propagate the null, never substitute 0.0.

    ``halflife_days`` must be positive; non-positive halflife is a
    configuration error and raises ``ValueError`` rather than producing
    a meaningless aggregate (silent division-by-zero or negative-decay
    weights would amplify older attempts arbitrarily).
    """
    if halflife_days <= 0:
        raise ValueError(
            f"halflife_days must be positive, got {halflife_days!r}; "
            "fix system_settings.competence_decay_halflife_days"
        )
    if not attempts:
        return None
    weighted_sum = 0.0
    weight_total = 0.0
    for comp, age in attempts:
        weight = 0.5 ** (age / halflife_days)
        weighted_sum += comp * weight
        weight_total += weight
    if weight_total == 0.0:
        # Defensive — weight is 0.5^x which is strictly positive for any
        # finite x, so this branch only fires if the input was empty
        # (already returned above) or contained infinities. Don't divide
        # by zero — return null and let the caller skip.
        return None
    return weighted_sum / weight_total


def loop_target_difficulty(
    competence_estimate: float,
    *,
    available_difficulty_min: int,
    available_difficulty_max: int,
    recent_attempt_scores: Sequence[float],
) -> int:
    """Compute the next attempt's target difficulty for the AC-D6 loop.

    Per AC-D9 v1.2:

        Next attempt's target difficulty =
            round(competence_estimate + 0.5)
        clamped to the pill's ``available_difficulty_range``.

    The +0.5 bias means "test slightly above current competence — where
    learning happens, rather than confirming what's known."

    Plus the AC-D6 / AC-D9 v1.2 step-down rule:

        Three consecutive attempts where the Testee's score is well
        below the difficulty trigger a step-down of one integer
        regardless of formula.

    "Well below the difficulty" is interpreted at the 0.4 threshold
    here (AC-D9 v1.2 defines response_score = 0.5 as "performed exactly
    at the difficulty"; 0.4 is materially below that midpoint). The
    threshold is a P7 implementation choice — see the module-level
    ``_WELL_BELOW_DIFFICULTY_THRESHOLD`` constant for the reasoning.

    Null ``competence_estimate`` is the caller's responsibility — AC-D9
    null-handling says "needs benchmark or first attempt, not a failing
    score". The caller routes the null path to ``assignment.difficulty``
    (the difficulty the original attempt was issued at) rather than
    invoking this helper.

    ``recent_attempt_scores`` is the sequence of overall attempt scores
    on this pill in **chronological order, most recent last**. Only the
    final 3 are consulted for step-down — earlier entries are ignored.

    Rounding mode: AC-D9 v1.2 says "round" without naming a mode, but
    the intent — "stretch slightly above current competence — where
    learning happens" — is incompatible with Python's banker's
    rounding. ``round(4.0 + 0.5) == 4`` under round-half-to-even, which
    kills the stretch on every even-integer estimate. We use
    ``math.floor(estimate + 1.0)`` so the bias is genuinely upward at
    every integer / half-integer boundary (mathematically equivalent
    to round-half-up of ``estimate + 0.5``). PR-019 / Gitar review.
    """
    if available_difficulty_min > available_difficulty_max:
        raise ValueError(
            f"invalid pill range: min={available_difficulty_min} > "
            f"max={available_difficulty_max}"
        )
    target = math.floor(competence_estimate + 1.0)
    last_three = list(recent_attempt_scores)[-_STEP_DOWN_CONSECUTIVE_COUNT:]
    if len(last_three) >= _STEP_DOWN_CONSECUTIVE_COUNT and all(
        s < _WELL_BELOW_DIFFICULTY_THRESHOLD for s in last_three
    ):
        target -= 1
    # Clamp last — the step-down must not push below the pill's floor
    # and the +0.5 bias must not push above its ceiling.
    if target < available_difficulty_min:
        return available_difficulty_min
    if target > available_difficulty_max:
        return available_difficulty_max
    return target


# --- DB-writing wrapper (Slice 2) -------------------------------------
#
# Scope: only single-pill assignment-backed attempts contribute to a
# CompetencyProfile per the locked P7 plan. Self-initiated and learning-
# path attempts have no single pill to attribute the update to — those
# scenarios produce WeaknessReport + LearningMaterial via the standard
# loop but skip the per-pill competence aggregate. Broader pill-
# resolution lands when self-directed pill selection lands on the data
# model (post-v1).

_DEFAULT_SENSITIVITY = 2.0
_DEFAULT_HALFLIFE_DAYS = 90

_COMPETENCE_SCOPED_ORIGINS = frozenset(
    {AttemptOrigin.assignment_driven, AttemptOrigin.loop_driven}
)


async def _system_settings(db: AsyncSession) -> SystemSettings | None:
    result = await db.execute(
        select(SystemSettings).where(SystemSettings.tenant_id == SEED_TENANT_ID)
    )
    return result.scalar_one_or_none()


async def _assignment(db: AsyncSession, assignment_id: uuid.UUID) -> Assignment | None:
    result = await db.execute(select(Assignment).where(Assignment.id == assignment_id))
    return result.scalar_one_or_none()


async def _responses_for(db: AsyncSession, attempt_id: uuid.UUID) -> list[Response]:
    result = await db.execute(select(Response).where(Response.attempt_id == attempt_id))
    return list(result.scalars().all())


async def _question_by_id(db: AsyncSession, question_id: uuid.UUID) -> Question | None:
    """Look up a Question by primary key regardless of ownership
    (frozen test → ``test_id``, per_testee generation → ``attempt_id``,
    anchor pool → ``pill_id``). The Response.question_id FK is the
    source of truth — we resolve through it rather than re-deriving
    ownership from any of the three optional parent FKs."""
    result = await db.execute(select(Question).where(Question.id == question_id))
    return result.scalar_one_or_none()


async def _grade_for_response(db: AsyncSession, response_id: uuid.UUID) -> Grade | None:
    result = await db.execute(select(Grade).where(Grade.response_id == response_id))
    return result.scalar_one_or_none()


async def _anchor_question(
    db: AsyncSession, question_id: uuid.UUID
) -> AnchorQuestion | None:
    result = await db.execute(
        select(AnchorQuestion).where(AnchorQuestion.id == question_id)
    )
    return result.scalar_one_or_none()


async def _attempt_anchor_records(
    db: AsyncSession, attempt_id: uuid.UUID
) -> list[tuple[float, float]]:
    """``[(effective_difficulty, assigned_difficulty), ...]`` for every
    anchor drawn into ``attempt_id`` — input to
    :func:`compute_fresh_question_delta`. Empty list when no anchors
    were drawn (learning-path / empty pool / non-per_testee mode).

    For an anchor whose ``effective_difficulty`` is still NULL (the
    P8 calibration sweep has not yet observed enough scores to write
    a shrunken value) we fall back to ``assigned_difficulty`` — the
    Bayesian prior — so the delta is well-defined from day one.
    """
    anchors_result = await db.execute(
        select(AttemptAnchor).where(
            AttemptAnchor.attempt_id == attempt_id,
            AttemptAnchor.tenant_id == SEED_TENANT_ID,
        )
    )
    anchors = list(anchors_result.scalars().all())
    if not anchors:
        return []
    records: list[tuple[float, float]] = []
    for attempt_anchor in anchors:
        aq = await _anchor_question(db, attempt_anchor.anchor_question_id)
        if aq is None:
            continue
        effective = (
            float(aq.effective_difficulty)
            if aq.effective_difficulty is not None
            else float(aq.assigned_difficulty)
        )
        records.append((effective, float(aq.assigned_difficulty)))
    return records


def _clamp_difficulty(value: float) -> float:
    """1.0-10.0 axis clamp (SPEC §5). Local copy of
    :func:`app.domain.calibration._clamp_difficulty` — kept local so the
    competence module doesn't import a private helper and so the clamp
    boundary is identical to the calibration sweep's clamp (both must
    track the same axis to keep the loop_target_difficulty rounding
    well-defined)."""
    if value < 1.0:
        return 1.0
    if value > 10.0:
        return 10.0
    return value


async def _effective_difficulty(db: AsyncSession, question: Question) -> float:
    """Resolve ``effective_difficulty`` for the AC-D9 v1.2 per-response
    formula.

    Three branches per the AC-D27 / AC-D20 / CODE_SPEC §12 wiring:

    1. **Anchor-pool questions** (``question.pill_id is not None``) —
       look up the shared-PK :class:`AnchorQuestion` and read its
       Bayesian-shrunk ``effective_difficulty`` (populated by the P8
       calibration sweep). Falls through to ``assigned_difficulty``
       when the column is still NULL — the cold-start case before
       the sweep has observed any scores.
    2. **Per_testee questions in anchor-bearing attempts**
       (``question.attempt_id is not None``) — apply the
       fresh-question delta (P8 Slice 3): mean per-anchor
       ``(effective - assigned)`` across the anchors drawn into the
       same attempt, added to the question's own
       ``assigned_difficulty``. Clamped to the 1.0-10.0 axis so a
       base-1 question with a +9 delta does not shoot past 10.
    3. **Fall-through** (no anchor, no attempt-owner, no triangulation)
       — return the bare ``assigned_difficulty``. Covers
       frozen / hand_authored test questions whose difficulty is
       admin-authored and not subject to calibration.
    """
    # An anchor question's Question row is owned by ``pill_id`` (AC-D20)
    # — a per_testee generated question is owned by ``attempt_id``. We
    # only look up an AnchorQuestion if the Question is pill-owned.
    if question.pill_id is not None:
        anchor = await _anchor_question(db, question.id)
        if anchor is not None and anchor.effective_difficulty is not None:
            return float(anchor.effective_difficulty)
        return float(question.assigned_difficulty)
    if question.attempt_id is not None:
        records = await _attempt_anchor_records(db, question.attempt_id)
        delta = compute_fresh_question_delta(records)
        return _clamp_difficulty(float(question.assigned_difficulty) + delta)
    return float(question.assigned_difficulty)


async def _attempt_competence_for(
    db: AsyncSession, attempt: Attempt, *, sensitivity: float
) -> float | None:
    """Compute ``attempt_competence`` for a single attempt by walking its
    Response rows, joining each to its Grade + Question, resolving
    effective_difficulty, then averaging the per-response competences.
    Returns ``None`` when the attempt has no scored responses (matches
    :func:`attempt_competence`'s null contract)."""
    responses = await _responses_for(db, attempt.id)
    if not responses:
        return None
    per_response: list[float] = []
    for response in responses:
        question = await _question_by_id(db, response.question_id)
        if question is None:
            continue
        grade = await _grade_for_response(db, response.id)
        if grade is None:
            continue
        eff_diff = await _effective_difficulty(db, question)
        per_response.append(response_competence(eff_diff, grade.score, sensitivity))
    return attempt_competence(per_response)


async def _prior_attempts_on_pill(
    db: AsyncSession, testee_id: uuid.UUID, pill_id: uuid.UUID
) -> list[Attempt]:
    """Every submitted attempt by ``testee_id`` whose assignment targets
    ``pill_id``. Self-initiated attempts have no assignment_id and are
    excluded — they would contribute no signal anyway (their pill
    membership is undefined under the locked v1 scope).

    Equality-only walk for harness compatibility (AC-CD15 zero-DB
    contract); at v1 scale (~10 attempts per (testee, pill)) this is
    cheap."""
    result = await db.execute(select(Attempt).where(Attempt.testee_id == testee_id))
    candidates = list(result.scalars().all())
    out: list[Attempt] = []
    for candidate in candidates:
        if candidate.submitted_at is None:
            continue
        if candidate.assignment_id is None:
            continue
        assignment = await _assignment(db, candidate.assignment_id)
        if assignment is None or assignment.pill_id != pill_id:
            continue
        out.append(candidate)
    return out


async def _competency_profile(
    db: AsyncSession, testee_id: uuid.UUID, pill_id: uuid.UUID
) -> CompetencyProfile | None:
    """Equality-only lookup; the harness has no compound where, so walk
    and match in Python."""
    result = await db.execute(
        select(CompetencyProfile).where(CompetencyProfile.testee_id == testee_id)
    )
    for row in result.scalars().all():
        if row.pill_id == pill_id:
            return row
    return None


async def apply_competence_update(db: AsyncSession, attempt: Attempt) -> None:
    """Recompute the (testee, pill) competence_estimate from this and
    every prior submitted attempt by the same Testee on the same pill,
    then upsert :class:`CompetencyProfile`. Idempotent — re-invocation on
    the same attempt produces the same write (assuming Grade rows have
    not changed underneath).

    Scope per the locked P7 plan: single-pill assignment-backed
    origins only (``assignment_driven`` and ``loop_driven``).
    Self-initiated and learning-path attempts return silently — their
    multi-pill / no-pill nature has no single pill to attribute the
    update to, and broader pill resolution is post-v1.

    Pure-function math is in :func:`response_competence`,
    :func:`attempt_competence`, and :func:`compute_competence_estimate`
    above; this wrapper handles the DB walk only. Decay strategy is
    write-time-with-all-history per the locked v1 choice — every
    submit recomputes from scratch so the stored estimate is fresh
    as of last submit.
    """
    if attempt.origin not in _COMPETENCE_SCOPED_ORIGINS:
        return
    if attempt.assignment_id is None:
        return
    assignment = await _assignment(db, attempt.assignment_id)
    if assignment is None or assignment.pill_id is None:
        return  # learning-path assignment — no single pill to attribute

    settings = await _system_settings(db)
    sensitivity = _DEFAULT_SENSITIVITY
    halflife = _DEFAULT_HALFLIFE_DAYS
    if settings is not None:
        # Explicit ``is None`` so an admin's intentional ``0`` (disabled
        # signal) is preserved — matches the pattern used by the rate-
        # limit defaults in attempts.py (Gitar PR-#15 precedent).
        configured_sens = getattr(settings, "competence_sensitivity", None)
        configured_half = getattr(settings, "competence_decay_halflife_days", None)
        if configured_sens is not None:
            sensitivity = float(configured_sens)
        if configured_half is not None:
            halflife = int(configured_half)

    pill_id = assignment.pill_id
    historical: list[tuple[float, int]] = []
    now = now_utc()
    for prior in await _prior_attempts_on_pill(db, attempt.testee_id, pill_id):
        if prior.id == attempt.id:
            # The current attempt is included separately below so we
            # don't double-count it (the submit-time flush has already
            # written the current attempt's Grade rows, so the prior
            # walk could pick it up too).
            continue
        if prior.submitted_at is None:
            # _prior_attempts_on_pill already filters but the type
            # narrowing doesn't propagate; restate to keep mypy happy.
            continue
        comp = await _attempt_competence_for(db, prior, sensitivity=sensitivity)
        if comp is None:
            continue
        age_days = max(0, (now - prior.submitted_at).days)
        historical.append((comp, age_days))

    current = await _attempt_competence_for(db, attempt, sensitivity=sensitivity)
    if current is None and not historical:
        # No signal at all — leave the profile untouched. AC-D9 null-
        # handling: never substitute 0.0.
        return
    if current is not None:
        historical.append((current, 0))

    estimate = compute_competence_estimate(historical, halflife_days=halflife)

    profile = await _competency_profile(db, attempt.testee_id, pill_id)
    if profile is None:
        profile = CompetencyProfile(
            tenant_id=SEED_TENANT_ID,
            testee_id=attempt.testee_id,
            pill_id=pill_id,
            competence_estimate=estimate,
            last_activity_at=now,
        )
        db.add(profile)
    else:
        profile.competence_estimate = estimate
        profile.last_activity_at = now
    await db.flush()


# --- Slice B B.4 — testee competence profile (FE-7) -------------------
# Thresholds mirror the FE prototype mapping in
# frontend/design-reference/prototype/data.jsx:51 (band-string axis is
# FE-only; BE returns the derived string so the constellation can render
# without a client-side band-lookup). Confidence reuses the AC-D20
# threshold (default 20) — n >= threshold → confident, else preliminary.
# n is sourced from CompetencyProfile.retake_count (closest existing
# attempt-count field; AC-D20 v1.2 names it as the threshold input).


def band_string(competence_estimate: float | None) -> str:
    """Map a 1.0–10.0 competence estimate to the 5-band FE axis. A
    None estimate (testee has no data yet) emits the lowest band so the
    constellation has a valid string to render against — the empty-state
    path filters n==0 pills out of any per-band aggregations anyway."""
    if competence_estimate is None:
        return "novice"
    if competence_estimate < 3:
        return "novice"
    if competence_estimate < 5:
        return "junior"
    if competence_estimate < 7:
        return "working"
    if competence_estimate < 8.5:
        return "advanced"
    return "expert"


async def list_me_competence(
    db: AsyncSession, testee_id: uuid.UUID
) -> list[dict[str, Any]]:
    """Per-pill competency snapshot for the testee (FE-7-profile.md
    §B.1 locked contract). One row per CompetencyProfile, joined with
    its Pill (for name + subject + safety) and PillRelated (for
    related_pill_ids). Ordered by pill name for a stable constellation
    layout (FE-7 §5 assumes deterministic order across requests)."""
    from app.models import (  # local import — competence.py is in the AC-CD2 hot path
        Pill,
        PillRelated,
    )

    settings = await _system_settings(db)
    threshold = (
        getattr(settings, "anchor_calibration_confidence_threshold", None) or 20
    )

    profiles_result = await db.execute(
        select(CompetencyProfile).where(CompetencyProfile.testee_id == testee_id)
    )
    profiles = list(profiles_result.scalars().all())
    if not profiles:
        return []

    pill_ids = [p.pill_id for p in profiles]
    pills_result = await db.execute(
        select(Pill).where(Pill.tenant_id == SEED_TENANT_ID)
    )
    pills_by_id = {p.id: p for p in pills_result.scalars().all() if p.id in pill_ids}

    related_result = await db.execute(
        select(PillRelated).where(PillRelated.tenant_id == SEED_TENANT_ID)
    )
    related_by_pill: dict[uuid.UUID, list[uuid.UUID]] = {}
    for row in related_result.scalars().all():
        related_by_pill.setdefault(row.pill_id, []).append(row.related_pill_id)

    items: list[dict[str, Any]] = []
    for profile in profiles:
        pill = pills_by_id.get(profile.pill_id)
        if pill is None:
            continue
        n = profile.retake_count or 0
        items.append(
            {
                "pill_id": profile.pill_id,
                "pill_name": pill.name,
                "subject_id": pill.subject_id,
                "competence_estimate": profile.competence_estimate,
                "band": band_string(profile.competence_estimate),
                "n": n,
                "confidence": "confident" if n >= threshold else "preliminary",
                "last_activity_at": profile.last_activity_at,
                "related_pill_ids": related_by_pill.get(profile.pill_id, []),
                "safety_relevant": bool(pill.safety_relevant),
            }
        )
    items.sort(key=lambda r: str(r["pill_name"]).lower())
    return items
