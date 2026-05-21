"""P8 Slice 4 — calibration sweep + admin trigger (AC-D27 / CODE_SPEC §12).

End-to-end coverage of ``POST /v1/admin/calibration/run`` and the
underlying :func:`app.domain.calibration.run_calibration_sweep`.
Worked fixtures: every expected ``effective_difficulty`` is computed
from the spec formula by hand and recorded alongside the assertion.
"""

from __future__ import annotations

import math
import uuid
from typing import Any

from fastapi.testclient import TestClient

from app import permissions as p
from app.models import (
    SEED_TENANT_ID,
    AnchorQuestion,
    AppUser,
    AttemptAnchor,
    Pill,
    Question,
    QuestionType,
    Subject,
)
from tests.integration.conftest import (
    CatalogueFakeSession,
    bearer,
    cat_make_user,
    seed_system_settings,
)


def _admin(s: CatalogueFakeSession) -> AppUser:
    return cat_make_user(s, email="a@kbc.com", role=p.ROLE_ADMINISTRATOR)


def _testee(s: CatalogueFakeSession) -> AppUser:
    return cat_make_user(s, email="t@kbc.com", role=p.ROLE_TESTEE)


def _pill(s: CatalogueFakeSession) -> Pill:
    sub = Subject(tenant_id=SEED_TENANT_ID, name="ops", description="")
    s.add(sub)
    pill = Pill(
        tenant_id=SEED_TENANT_ID,
        subject_id=sub.id,
        name="Lifting",
        description="",
        available_difficulty_min=1,
        available_difficulty_max=10,
        discoverable=True,
        safety_relevant=False,
    )
    s.add(pill)
    return pill


def _seed_anchor(
    s: CatalogueFakeSession,
    *,
    pill: Pill,
    assigned_difficulty: int = 5,
    band: int = 5,
    excluded: bool = False,
) -> AnchorQuestion:
    """Seed a matched (Question, AnchorQuestion) pair sharing one
    primary-key UUID per the shared-PK convention."""
    aid = uuid.uuid4()
    s.add(
        Question(
            id=aid,
            tenant_id=SEED_TENANT_ID,
            pill_id=pill.id,
            type=QuestionType.multiple_choice,
            config={"prompt": "q", "options": ["a", "b"], "correct": 0},
            assigned_difficulty=assigned_difficulty,
            realism_flag_count=0,
        )
    )
    anchor = AnchorQuestion(
        id=aid,
        tenant_id=SEED_TENANT_ID,
        pill_id=pill.id,
        band=band,
        type=QuestionType.multiple_choice,
        config={"prompt": "q", "options": ["a", "b"], "correct": 0},
        assigned_difficulty=assigned_difficulty,
        effective_difficulty=None,
        total_attempts=0,
        regeneration_attempts=0,
        excluded=excluded,
    )
    s.add(anchor)
    return anchor


def _record_observation(
    s: CatalogueFakeSession,
    *,
    anchor: AnchorQuestion,
    attempt_id: uuid.UUID,
    score: float | None,
) -> None:
    """Write an ``AttemptAnchor`` row with the given score directly —
    the calibration sweep reads these as the per-anchor observation
    list."""
    s.add(
        AttemptAnchor(
            tenant_id=SEED_TENANT_ID,
            attempt_id=attempt_id,
            anchor_question_id=anchor.id,
            score=score,
        )
    )


# --- Empty world ------------------------------------------------------


def test_calibration_sweep_empty_world_returns_zero_counts(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """A sweep against an empty DB returns zero counters and emits no
    audit-relevant side effects. Same operator-visible "queue is
    clean" signal the engagement / grade-review sweeps emit on idle
    tenants."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)

    r = cat_client.post("/v1/admin/calibration/run", headers=bearer(admin))
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["anchors_processed"] == 0
    assert body["anchors_updated"] == 0
    assert body["anchors_skipped_no_observations"] == 0
    assert body["mean_n"] == 0.0
    assert body["mean_effective_difficulty"] == 0.0


# --- No observations -> skipped ---------------------------------------


def test_calibration_sweep_skips_anchors_with_no_observations(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """Anchors with no answered attempts (no AttemptAnchor row, or
    only rows with ``score IS NULL``) are skipped — their
    ``effective_difficulty`` stays at the prior. The
    ``anchors_skipped_no_observations`` counter tracks them so the
    operator can see how much of the pool is still cold."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    pill = _pill(cat_session)
    anchor = _seed_anchor(cat_session, pill=pill)
    # AttemptAnchor exists but score=NULL → still "no observations".
    _record_observation(cat_session, anchor=anchor, attempt_id=uuid.uuid4(), score=None)

    r = cat_client.post("/v1/admin/calibration/run", headers=bearer(admin))
    assert r.status_code == 201
    body = r.json()
    assert body["anchors_processed"] == 1
    assert body["anchors_updated"] == 0
    assert body["anchors_skipped_no_observations"] == 1
    # The anchor's effective_difficulty is unchanged (None — the prior).
    assert anchor.effective_difficulty is None


# --- Worked fixture: shrinkage estimator ------------------------------


def test_calibration_sweep_worked_fixture_shrinks_toward_observed_mean(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """Worked fixture from AC-D27 / CODE_SPEC §12.

    Anchor with ``assigned_difficulty=5``, prior_weight=20,
    sensitivity=2.0. Twenty Testees all score 0.0:

        observed_i      = 5 + 2.0 * (0.5 - 0.0) = 6.0 each
        effective       = (5*20 + 6.0*20) / (20+20)
                        = (100 + 120) / 40
                        = 5.5         (halfway between prior 5.0 and
                                       observed mean 6.0)
        total_attempts  = 20
        pass_rate       = 0/20 = 0.0
    """
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    pill = _pill(cat_session)
    anchor = _seed_anchor(cat_session, pill=pill, assigned_difficulty=5)
    for _ in range(20):
        _record_observation(
            cat_session, anchor=anchor, attempt_id=uuid.uuid4(), score=0.0
        )

    r = cat_client.post("/v1/admin/calibration/run", headers=bearer(admin))
    assert r.status_code == 201
    body = r.json()
    assert body["anchors_processed"] == 1
    assert body["anchors_updated"] == 1
    assert body["anchors_skipped_no_observations"] == 0
    assert body["mean_n"] == 20.0
    assert math.isclose(body["mean_effective_difficulty"], 5.5)
    # Verify the row was actually updated.
    assert math.isclose(anchor.effective_difficulty, 5.5)
    assert anchor.total_attempts == 20
    assert anchor.pass_rate == 0.0


def test_calibration_sweep_pass_rate_is_fraction_at_or_above_half(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """``pass_rate`` is the fraction of observations with
    ``score >= 0.5`` — the same 0.5 threshold used by the AC-D9
    competence formula to mean "at-difficulty performance"."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    pill = _pill(cat_session)
    anchor = _seed_anchor(cat_session, pill=pill)
    scores = [1.0, 1.0, 0.5, 0.5, 0.0]  # 4/5 at or above 0.5
    for s in scores:
        _record_observation(cat_session, anchor=anchor, attempt_id=uuid.uuid4(), score=s)

    r = cat_client.post("/v1/admin/calibration/run", headers=bearer(admin))
    assert r.status_code == 201
    assert math.isclose(anchor.pass_rate, 4.0 / 5.0)


# --- Excluded anchors are not touched --------------------------------


def test_calibration_sweep_skips_excluded_anchors(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """Excluded anchors (failed 3-strikes self-review or
    admin-rejected via Slice 4 resolve) are not part of the live
    pool — the sweep skips them entirely so a stray observation
    cannot drive their ``effective_difficulty`` once admin has
    rejected the slot."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    pill = _pill(cat_session)
    excluded_anchor = _seed_anchor(cat_session, pill=pill, excluded=True)
    _record_observation(
        cat_session, anchor=excluded_anchor, attempt_id=uuid.uuid4(), score=0.0
    )

    r = cat_client.post("/v1/admin/calibration/run", headers=bearer(admin))
    assert r.status_code == 201
    body = r.json()
    assert body["anchors_processed"] == 0  # excluded → not walked
    assert excluded_anchor.effective_difficulty is None


# --- Per-anchor failure isolation -------------------------------------


def test_calibration_sweep_isolates_per_anchor_failures(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    monkeypatch: Any,
) -> None:
    """A bad anchor (here: zero prior_weight forced into the math
    via a monkeypatch on one row) raises mid-sweep; the per-row
    try/except logs and continues, and the next anchor is still
    updated. Mirrors the same defensive isolation PR-019 added to
    the submit-path hooks."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    pill = _pill(cat_session)
    bad_anchor = _seed_anchor(cat_session, pill=pill)
    good_anchor = _seed_anchor(cat_session, pill=pill)
    _record_observation(
        cat_session, anchor=bad_anchor, attempt_id=uuid.uuid4(), score=1.0
    )
    _record_observation(
        cat_session, anchor=good_anchor, attempt_id=uuid.uuid4(), score=1.0
    )

    from app.domain import calibration as calibration_module

    real_compute = calibration_module.compute_effective_difficulty

    def _explode_on_bad(
        assigned_difficulty: float,
        observed_scores: Any,
        *,
        prior_weight: int,
        sensitivity: float,
    ) -> float:
        # Detect the bad anchor by its scores fixture (1 observation
        # of 1.0 at assigned=5). Both anchors match — disambiguate by
        # call order: the first call gets the explosion, the second
        # gets the real math. Calls are deterministic because the
        # sweep walks anchors in insertion order via the fake session.
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise RuntimeError("simulated bad anchor")
        return real_compute(
            assigned_difficulty,
            observed_scores,
            prior_weight=prior_weight,
            sensitivity=sensitivity,
        )

    call_count = 0
    monkeypatch.setattr(
        calibration_module, "compute_effective_difficulty", _explode_on_bad
    )

    r = cat_client.post("/v1/admin/calibration/run", headers=bearer(admin))
    assert r.status_code == 201
    body = r.json()
    # Both walked; one failed inside the try/except (skipped from
    # counts), one succeeded.
    assert body["anchors_processed"] == 2
    assert body["anchors_updated"] == 1
    # The good anchor got its update; the bad one stayed cold.
    assert good_anchor.effective_difficulty is not None
    assert bad_anchor.effective_difficulty is None


# --- 403 unauthorised --------------------------------------------------


def test_calibration_sweep_forbidden_for_non_admin(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    r = cat_client.post("/v1/admin/calibration/run", headers=bearer(testee))
    assert r.status_code == 403
