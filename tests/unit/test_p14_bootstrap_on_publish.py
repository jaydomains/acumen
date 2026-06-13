"""Slice F1 — bootstrap-on-publish (reframed AC-D7/AC-D23) — the FINAL slice.

Zero-network (AC-CD15): the per-pill incremental bootstrap reuses the existing
anchor-pool + safety-link primitives (stubbed here), enqueued on auto-publish.
Covers: publish **enqueues** the bootstrap (async — not run inline so publish
returns fast), the per-pill bootstrap runs the reuse-only primitives + audits,
idempotency (``top_up=True``), the safety self-guard, the worker drain, and the
refiner approve path still publishing.
"""

from __future__ import annotations

import uuid

import pytest

import app.domain.bootstrap as boot
import app.domain.publish as pub
from app.domain.bootstrap import (
    BOOTSTRAP_TASK_NAME,
    bootstrap_pill,
    enqueue_pill_bootstrap,
    process_pending_bootstraps,
)
from app.domain.publish import auto_publish_draft
from app.domain.self_review import DegradeMode, PassVerdict, SelfReviewResult
from app.models import (
    SEED_TENANT_ID,
    AuditLog,
    GenerationProvenance,
    Pill,
    ProcessingTask,
    ProcessingTaskStatus,
    Subject,
)
from tests.integration.conftest import CatalogueFakeSession, seed_system_settings


def _async(value: object):
    async def _coro(*_a: object, **_k: object) -> object:
        return value

    return _coro()


def _review(*, safety_relevant: bool = False) -> SelfReviewResult:
    def _pv(name: str) -> PassVerdict:
        return PassVerdict(name, "pass", {}, "openai", "openai-review", 0.001)

    return SelfReviewResult(
        grounding=_pv("grounding"),
        safety=_pv("safety"),
        provenance=_pv("provenance"),
        safety_relevant=safety_relevant,
        unsupported_claims=[],
        orphan_claims=[],
        single_provider_verified=False,
        degrade_mode=DegradeMode.degrade,
    )


def _spy_primitives(monkeypatch: pytest.MonkeyPatch) -> dict[str, int]:
    calls = {"anchors": 0, "links": 0}

    async def _anchors(db: object, pill_id: object, **_k: object) -> dict[str, int]:
        calls["anchors"] += 1
        return {"anchors_generated": 0, "anchors_excluded": 0}

    async def _links(db: object, pill_id: object, **_k: object) -> dict[str, int]:
        calls["links"] += 1
        return {"links_added": 0}

    monkeypatch.setattr(boot, "generate_anchor_pool_for_pill", _anchors)
    monkeypatch.setattr(boot, "curate_links_for_pill", _links)
    return calls


def _seed_pill(session: CatalogueFakeSession) -> Pill:
    subj = Subject(tenant_id=SEED_TENANT_ID, name="Welding")
    session.add(subj)
    pill = Pill(
        tenant_id=SEED_TENANT_ID,
        subject_id=subj.id,
        name="Bolt torque",
        available_difficulty_min=2,
        available_difficulty_max=6,
    )
    session.add(pill)
    return pill


def _draft() -> dict:
    return {
        "draft_ref": "draft-1",
        "subject_id": str(uuid.uuid4()),
        "name": "Bolt torque",
        "description": "Fastener torque competency.",
        "available_difficulty_min": 2,
        "available_difficulty_max": 6,
    }


def _bootstrap_tasks(session: CatalogueFakeSession) -> list[ProcessingTask]:
    return [
        t
        for t in session.store.get(ProcessingTask, [])
        if t.task_name == BOOTSTRAP_TASK_NAME
    ]


async def test_publish_enqueues_bootstrap_async_not_inline(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A successful ``auto_publish_draft`` **enqueues** a ``pill_bootstrap`` task
    carrying the published pill id, and does **not** run the (N-AI-call) anchor /
    link primitives inline — so publish returns fast (DS14-a async)."""
    calls = _spy_primitives(monkeypatch)
    monkeypatch.setattr(pub, "self_review_draft", lambda *a, **k: _async(_review()))
    session = CatalogueFakeSession()
    seed_system_settings(session)
    session.add(
        GenerationProvenance(
            tenant_id=SEED_TENANT_ID,
            draft_ref="draft-1",
            claim_ref="c0",
            corpus_chunk_id=uuid.uuid4(),
            source_host="osha.gov",
            authority_tier=2,
            authority_score=0.6,
        )
    )
    task = ProcessingTask(
        tenant_id=SEED_TENANT_ID,
        task_name="pill_generation",
        status=ProcessingTaskStatus.pending,
        payload={"draft": _draft(), "batch_id": "batch-1"},
    )

    record = await auto_publish_draft(session, task)

    tasks = _bootstrap_tasks(session)
    assert len(tasks) == 1
    assert tasks[0].payload["pill_id"] == str(record.pill_id)
    assert tasks[0].status == ProcessingTaskStatus.pending
    # Async: the primitives are NOT called during publish.
    assert calls == {"anchors": 0, "links": 0}


async def test_bootstrap_pill_runs_primitives_and_audits(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = _spy_primitives(monkeypatch)
    session = CatalogueFakeSession()
    pill = _seed_pill(session)

    result = await bootstrap_pill(session, pill_id=pill.id)

    assert calls == {"anchors": 1, "links": 1}  # both reuse-only primitives ran
    assert result["pill_id"] == str(pill.id)
    audits = [
        a
        for a in session.store.get(AuditLog, [])
        if a.action == "pill_generation.bootstrap"
    ]
    assert len(audits) == 1 and audits[0].actor_id is None  # autonomous


async def test_bootstrap_pill_uses_top_up_idempotent_mode(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The anchor primitive is called with ``top_up=True`` so a re-run on an
    already-populated pill is a near-no-op (no ``anchors_exist`` 409)."""
    seen: dict[str, object] = {}

    async def _anchors(db: object, pill_id: object, **kw: object) -> dict[str, int]:
        seen["top_up"] = kw.get("top_up")
        return {"anchors_generated": 0, "anchors_excluded": 0}

    async def _links(db: object, pill_id: object, **_k: object) -> dict[str, int]:
        return {"links_added": 0}

    monkeypatch.setattr(boot, "generate_anchor_pool_for_pill", _anchors)
    monkeypatch.setattr(boot, "curate_links_for_pill", _links)
    session = CatalogueFakeSession()
    pill = _seed_pill(session)

    await bootstrap_pill(session, pill_id=pill.id)
    assert seen["top_up"] is True


async def test_bootstrap_pill_calls_curate_unconditionally_self_guarded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Link curation is called for every published pill — it self-guards on
    ``safety_relevant`` (a non-safety pill is a no-op inside the primitive), so
    the caller stays simple (#106 M-a)."""
    calls = _spy_primitives(monkeypatch)
    session = CatalogueFakeSession()
    pill = _seed_pill(session)  # non-safety by default

    await bootstrap_pill(session, pill_id=pill.id)
    assert calls["links"] == 1  # called regardless; the primitive self-guards


async def test_process_pending_bootstraps_drains_and_marks_done(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen: list[uuid.UUID] = []

    async def _stub_bootstrap_pill(
        db: object, *, pill_id: uuid.UUID, **_k: object
    ) -> dict:
        seen.append(pill_id)
        return {"pill_id": str(pill_id)}

    monkeypatch.setattr(boot, "bootstrap_pill", _stub_bootstrap_pill)
    session = CatalogueFakeSession()
    pid1, pid2 = uuid.uuid4(), uuid.uuid4()
    for pid in (pid1, pid2):
        await enqueue_pill_bootstrap(session, pill_id=pid)

    result = await process_pending_bootstraps(session)
    assert result == {"bootstrapped": 2, "failed": 0}
    assert set(seen) == {pid1, pid2}
    assert all(t.status == ProcessingTaskStatus.done for t in _bootstrap_tasks(session))


async def test_process_pending_bootstraps_isolates_a_failing_pill(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """One pill whose bootstrap raises is marked ``failed`` and the batch
    continues — the persistently-failing pill can't block the others, and the
    successful work isn't rolled back (Gitar #1 / poison-task isolation)."""
    bad = uuid.uuid4()

    async def _stub(db: object, *, pill_id: uuid.UUID, **_k: object) -> dict:
        if pill_id == bad:
            raise RuntimeError("anchor gen blew up")
        return {"pill_id": str(pill_id)}

    monkeypatch.setattr(boot, "bootstrap_pill", _stub)
    session = CatalogueFakeSession()
    good = uuid.uuid4()
    await enqueue_pill_bootstrap(session, pill_id=bad)
    await enqueue_pill_bootstrap(session, pill_id=good)

    result = await process_pending_bootstraps(session)
    assert result == {"bootstrapped": 1, "failed": 1}
    by_pill = {t.payload["pill_id"]: t.status for t in _bootstrap_tasks(session)}
    assert by_pill[str(bad)] == ProcessingTaskStatus.failed
    assert by_pill[str(good)] == ProcessingTaskStatus.done


async def test_refiner_proposal_publish_still_works(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The retained G7a refiner approve path (a ``proposal`` payload) still
    publishes through the same gate — and now also enqueues its bootstrap."""
    _spy_primitives(monkeypatch)
    monkeypatch.setattr(pub, "self_review_draft", lambda *a, **k: _async(_review()))
    session = CatalogueFakeSession()
    seed_system_settings(session)
    proposal = {
        "subject_id": str(uuid.uuid4()),
        "name": "Refiner pill",
        "description": "Admin-seeded, AI-polished.",
    }
    task = ProcessingTask(
        tenant_id=SEED_TENANT_ID,
        task_name="pill_proposal",
        status=ProcessingTaskStatus.pending,
        payload={"proposal": proposal},
    )

    record = await auto_publish_draft(session, task)
    assert record.pill_id is not None
    assert len(_bootstrap_tasks(session)) == 1  # every published pill bootstraps
