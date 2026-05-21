"""P9 Slice 3 — RAG retrieval injected at all 3 generation call sites.

End-to-end coverage of :func:`app.domain.drive_rag.retrieve_for_generation`
wired into:

* ``app.domain.attempts.start_attempt`` (per_testee mode,
  assignment-driven origin → pill scope → retrieve → inject)
* ``app.domain.learning_material.generate_for_weakness`` (pill scope
  given directly → retrieve → inject)
* ``app.domain.calibration.generate_anchor_pool_for_pill`` (anchor
  bootstrap loop → one retrieve per (pill, band) cached across slots)

Plus the cross-cuts: fail-soft on embed failure, empty-pool empty
hits, query-text shape, and the ``rag.retrieve`` audit-row spend trace
for the cost dashboard. AI calls run against
:class:`RecordingProvider`; AC-CD15 honoured.
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import permissions as p
from app.ai.provider import Operation
from app.models import (
    SEED_TENANT_ID,
    AnchorQuestion,
    AppUser,
    Assignment,
    AssignmentAssignee,
    AttemptOrigin,
    AuditLog,
    DriveChunk,
    LearningMaterial,
    LoopMode,
    Pill,
    Question,
    QuestionType,
    Subject,
    SystemSettings,
    Test,
    TestMode,
    TestStatus,
    TestVisibility,
    TimeoutBehaviour,
    WeaknessReport,
    WeaknessReportPill,
)
from app.permissions import now_utc
from tests.integration.conftest import (
    CatalogueFakeSession,
    RecordingProvider,
    bearer,
    cat_make_user,
    seed_system_settings,
)

# --- Fixtures ---------------------------------------------------------


def _testee(s: CatalogueFakeSession, email: str = "t@kbc.com") -> AppUser:
    return cat_make_user(s, email=email, role=p.ROLE_TESTEE)


def _admin(s: CatalogueFakeSession, email: str = "a@kbc.com") -> AppUser:
    return cat_make_user(s, email=email, role=p.ROLE_ADMINISTRATOR)


def _pill(
    s: CatalogueFakeSession,
    *,
    name: str = "Lifting",
    description: str = "Crane operator duties, lift planning, rigging.",
    band_min: int = 1,
    band_max: int = 10,
) -> Pill:
    sub = Subject(tenant_id=SEED_TENANT_ID, name="ops", description="")
    s.add(sub)
    pill = Pill(
        tenant_id=SEED_TENANT_ID,
        subject_id=sub.id,
        name=name,
        description=description,
        available_difficulty_min=band_min,
        available_difficulty_max=band_max,
        discoverable=True,
        safety_relevant=False,
    )
    s.add(pill)
    return pill


def _per_testee_test(s: CatalogueFakeSession, target_difficulty: int = 5) -> Test:
    test = Test(
        tenant_id=SEED_TENANT_ID,
        name="Lifting Diagnostic",
        mode=TestMode.per_testee,
        status=TestStatus.published,
        visibility=TestVisibility.library,
        timed=False,
        timeout_behaviour=TimeoutBehaviour.auto_submit,
        max_pause_duration_minutes=30,
        target_difficulty=target_difficulty,
        randomise_question_order=False,
        randomise_option_order=False,
        pass_threshold=0.5,
    )
    s.add(test)
    return test


def _assignment(
    s: CatalogueFakeSession, *, pill: Pill | None, assigner: AppUser
) -> Assignment:
    a = Assignment(
        tenant_id=SEED_TENANT_ID,
        assigner_id=assigner.id,
        pill_id=pill.id if pill else None,
        learning_path_id=None,
        difficulty=5,
        deadline=None,
        is_mandatory=False,
        loop_mode=LoopMode.autonomous,
    )
    s.add(a)
    return a


def _assignee(
    s: CatalogueFakeSession, *, assignment: Assignment, testee: AppUser
) -> AssignmentAssignee:
    row = AssignmentAssignee(
        tenant_id=SEED_TENANT_ID,
        assignment_id=assignment.id,
        user_id=testee.id,
        via_group_id=None,
    )
    s.add(row)
    return row


def _seed_chunk(
    s: CatalogueFakeSession,
    *,
    source_doc_ref: str = "f1",
    chunk_text: str = "KBC lift plan procedure documentation.",
    embedding: list[float] | None = None,
) -> DriveChunk:
    """Drop a DriveChunk directly into the index — bypasses the
    Slice 2 ingest pipeline so each retrieval test can stage its own
    fixture without the embed-call noise of going through ingest."""
    chunk = DriveChunk(
        tenant_id=SEED_TENANT_ID,
        source_doc_ref=source_doc_ref,
        chunk_index=0,
        chunk_text=chunk_text,
        content_hash="a" * 64,
        embedding=embedding or ([0.5] * 1536),
        indexed_at=now_utc(),
        ai_provider="openai",
        ai_model="text-embedding-3-small",
        ai_prompt_version=None,
        ai_prompt_tokens=10,
        ai_completion_tokens=0,
        ai_cost_usd=0.0001,
    )
    s.add(chunk)
    return chunk


def _start_assignment_attempt(
    client: TestClient, t: AppUser, *, test: Test, assignment: Assignment
) -> dict:
    r = client.post(
        "/v1/attempts",
        headers=bearer(t),
        json={
            "test_id": str(test.id),
            "origin": AttemptOrigin.assignment_driven.value,
            "assignment_id": str(assignment.id),
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


# --- Per-testee start_attempt --------------------------------------


def test_per_testee_start_attempt_embeds_query_and_injects_context(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """An assignment-driven per_testee attempt: one embed call fires
    for the retrieval query; the generation call's payload carries a
    non-empty ``rag_context`` rendering the seeded chunk."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    pill = _pill(cat_session)
    _seed_chunk(cat_session, chunk_text="KBC crane lift safety checklist.")
    test = _per_testee_test(cat_session)
    assignment = _assignment(cat_session, pill=pill, assigner=admin)
    _assignee(cat_session, assignment=assignment, testee=testee)

    _start_assignment_attempt(cat_client, testee, test=test, assignment=assignment)

    embed_calls = [c for c in recording_provider.calls if c[0] == "embed"]
    gen_calls = recording_provider.calls_for(Operation.generation)
    assert len(embed_calls) == 1
    assert len(gen_calls) == 1
    _, _, gen_payload = gen_calls[0]
    assert "rag_context" in gen_payload
    assert "KBC crane lift safety checklist." in gen_payload["rag_context"]
    assert "[f1]" in gen_payload["rag_context"]


def test_per_testee_self_initiated_no_assignment_no_rag(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """A self-initiated attempt (no ``assignment_id``) has no pill
    scope → no embed call fires, the generation payload's
    ``rag_context`` is the "(none)" sentinel."""
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    _seed_chunk(cat_session)
    test = _per_testee_test(cat_session)

    r = cat_client.post(
        "/v1/attempts", headers=bearer(testee), json={"test_id": str(test.id)}
    )
    assert r.status_code == 201, r.text

    embed_calls = [c for c in recording_provider.calls if c[0] == "embed"]
    gen_calls = recording_provider.calls_for(Operation.generation)
    assert len(embed_calls) == 0
    assert len(gen_calls) == 1
    _, _, gen_payload = gen_calls[0]
    assert gen_payload["rag_context"] == "(none)"


def test_per_testee_learning_path_assignment_no_rag(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """An assignment with no ``pill_id`` (learning-path scope) has no
    single-pill query — retrieve helper returns empty, generation
    payload's ``rag_context`` is "(none)" (no embed call)."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    _seed_chunk(cat_session)
    test = _per_testee_test(cat_session)
    assignment = _assignment(cat_session, pill=None, assigner=admin)
    _assignee(cat_session, assignment=assignment, testee=testee)

    _start_assignment_attempt(cat_client, testee, test=test, assignment=assignment)

    embed_calls = [c for c in recording_provider.calls if c[0] == "embed"]
    gen_calls = recording_provider.calls_for(Operation.generation)
    assert len(embed_calls) == 0
    assert len(gen_calls) == 1
    _, _, gen_payload = gen_calls[0]
    assert gen_payload["rag_context"] == "(none)"


def test_per_testee_empty_chunk_index_renders_none_sentinel(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """An empty Drive index (day-one deployment, AC-D23 step 4 not
    run yet) → embed fires (the spend trace stamps an audit row),
    retrieval returns ``[]``, prompt sees "(none)"."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    pill = _pill(cat_session)
    # No DriveChunk seeded — empty index.
    test = _per_testee_test(cat_session)
    assignment = _assignment(cat_session, pill=pill, assigner=admin)
    _assignee(cat_session, assignment=assignment, testee=testee)

    _start_assignment_attempt(cat_client, testee, test=test, assignment=assignment)

    embed_calls = [c for c in recording_provider.calls if c[0] == "embed"]
    assert len(embed_calls) == 1  # query-side embed still fires
    gen_calls = recording_provider.calls_for(Operation.generation)
    _, _, gen_payload = gen_calls[0]
    assert gen_payload["rag_context"] == "(none)"


# --- Query-text shape (user-locked decision) ----------------------


def test_query_text_matches_pill_name_description_difficulty_band(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """The query embed call sees the exact format string from
    :func:`build_rag_query` — pill name + description + difficulty
    band, newline-separated. Pins the user-locked retrieval-query
    shape so a future refactor can't silently change it."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    pill = _pill(
        cat_session,
        name="Lifting Operations",
        description="Crane operator duties.",
    )
    _seed_chunk(cat_session)
    test = _per_testee_test(cat_session, target_difficulty=7)
    assignment = _assignment(cat_session, pill=pill, assigner=admin)
    _assignee(cat_session, assignment=assignment, testee=testee)

    _start_assignment_attempt(cat_client, testee, test=test, assignment=assignment)

    embed_calls = [c for c in recording_provider.calls if c[0] == "embed"]
    assert len(embed_calls) == 1
    _, _, embed_payload = embed_calls[0]
    assert (
        embed_payload["text"]
        == "Lifting Operations\nCrane operator duties.\nDifficulty band 7"
    )


# --- Audit-log spend trace ---------------------------------------


def test_query_side_embed_writes_rag_retrieve_audit_for_spend_dashboard(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """The retrieve helper stamps a ``rag.retrieve`` audit row carrying
    the embed call's per-call cost / model / pill_id — the cost
    dashboard's :func:`_rag_retrieve_spend` helper folds these into
    the monthly aggregate so AC-CD8 v1.6 per-op provenance is honoured
    for the transient query-side embed."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    pill = _pill(cat_session)
    _seed_chunk(cat_session)
    test = _per_testee_test(cat_session, target_difficulty=5)
    assignment = _assignment(cat_session, pill=pill, assigner=admin)
    _assignee(cat_session, assignment=assignment, testee=testee)

    _start_assignment_attempt(cat_client, testee, test=test, assignment=assignment)

    audits = [
        a for a in cat_session.store.get(AuditLog, []) if a.action == "rag.retrieve"
    ]
    assert len(audits) == 1
    audit = audits[0]
    assert audit.detail["provider"] == "anthropic"  # recorder label
    assert audit.detail["model"] == "text-embedding-3-small"
    assert audit.detail["cost_usd"] == 0.001  # recording provider default
    assert audit.detail["pill_id"] == str(pill.id)
    assert audit.detail["target_difficulty"] == 5
    assert audit.detail["hits_returned"] >= 1


# --- Embed failure → fail-soft fall-through ----------------------


def test_embed_failure_falls_through_to_empty_context_per_spec_61(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """SPEC §6.1: "Drive RAG fetch failures: generation continues
    without RAG context; logged for review". Monkeypatch the embed
    call to raise; the retrieve returns ``[]``; the generation
    payload's ``rag_context`` is "(none)"; the attempt still starts."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    pill = _pill(cat_session)
    _seed_chunk(cat_session)
    test = _per_testee_test(cat_session)
    assignment = _assignment(cat_session, pill=pill, assigner=admin)
    _assignee(cat_session, assignment=assignment, testee=testee)

    async def _failing_embed(
        self: Any, operation: Any, text: str
    ) -> Any:  # pragma: no cover - the exception path is the contract
        raise RuntimeError("simulated transient embed failure")

    monkeypatch.setattr(type(recording_provider), "embed", _failing_embed, raising=True)

    body = _start_assignment_attempt(cat_client, testee, test=test, assignment=assignment)

    assert body["id"]  # attempt did start
    gen_calls = recording_provider.calls_for(Operation.generation)
    assert len(gen_calls) == 1
    _, _, gen_payload = gen_calls[0]
    assert gen_payload["rag_context"] == "(none)"


# --- Top-k cap -----------------------------------------------------


def test_top_k_caps_at_five_against_larger_chunk_index(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Seed 8 chunks; the retrieval returns at most 5 (the
    ``_DEFAULT_TOP_K`` constant). Prevents prompt-bloat regression
    if a future change accidentally widens the cap."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    pill = _pill(cat_session)
    for i in range(8):
        _seed_chunk(
            cat_session,
            source_doc_ref=f"f{i}",
            chunk_text=f"chunk {i}",
        )
    test = _per_testee_test(cat_session)
    assignment = _assignment(cat_session, pill=pill, assigner=admin)
    _assignee(cat_session, assignment=assignment, testee=testee)

    _start_assignment_attempt(cat_client, testee, test=test, assignment=assignment)

    gen_calls = recording_provider.calls_for(Operation.generation)
    _, _, gen_payload = gen_calls[0]
    rag_lines = [
        line for line in gen_payload["rag_context"].splitlines() if line.startswith("- [")
    ]
    assert len(rag_lines) == 5


# --- learning_material call site (P7 loop wiring) ------------------


@pytest.mark.asyncio
async def test_learning_material_generate_for_weakness_injects_rag(
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """``generate_for_weakness`` builds the generation payload with
    ``rag_context`` so the explainer can ground in KBC-specific
    material per SPEC §6.4."""
    from app.domain.learning_material import generate_for_weakness

    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    pill = _pill(cat_session)
    _seed_chunk(cat_session, chunk_text="KBC lift incident postmortem notes.")

    wr = WeaknessReport(
        tenant_id=SEED_TENANT_ID,
        attempt_id=uuid.uuid4(),
    )
    cat_session.add(wr)
    wrp = WeaknessReportPill(
        tenant_id=SEED_TENANT_ID,
        weakness_report_id=wr.id,
        pill_id=pill.id,
        severity=0.7,
    )
    cat_session.add(wrp)

    material = await generate_for_weakness(
        cat_session,
        weakness_report=wr,
        pill_id=pill.id,
        testee_id=testee.id,
    )
    assert isinstance(material, LearningMaterial)

    # The generation call's payload carried the rag_context block.
    gen_calls = recording_provider.calls_for(Operation.learning_material)
    assert len(gen_calls) == 1
    _, _, gen_payload = gen_calls[0]
    assert "rag_context" in gen_payload
    assert "KBC lift incident postmortem notes." in gen_payload["rag_context"]


# --- Anchor bootstrap call site + per-(pill, band) cache -----------


def test_anchor_bootstrap_caches_rag_per_band_one_embed_per_band(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """The anchor bootstrap loop emits one query-side embed call PER
    BAND, not per slot. Otherwise N slots × M bands would amplify
    embed spend (~60 embeds at default pool_size=20 × 3 bands).
    Pool size 2, 3 bands → 3 query-side embed calls total (not 6)."""
    import json

    seed_system_settings(cat_session)
    settings = cat_session.store[SystemSettings][-1]
    settings.anchor_pool_size_per_band = 2
    admin = _admin(cat_session)
    pill = _pill(cat_session, band_min=4, band_max=6)
    _seed_chunk(cat_session)

    # Per-anchor self-review must echo each item's anchor_question_id
    # per AC-D23. Default "ok" for everything keeps the bootstrap loop
    # on the happy path (matches P8's _ok_review_fn).
    def _ok_review_fn(payload: dict[str, Any]) -> dict[str, Any]:
        items = json.loads(payload["items_json"])
        return {
            "items": [
                {"anchor_question_id": item["anchor_question_id"], "verdict": "ok"}
                for item in items
            ]
        }

    recording_provider.set_response_fn(Operation.anchor_self_review, _ok_review_fn)

    r = cat_client.post(
        f"/v1/admin/pills/{pill.id}/anchors/generate", headers=bearer(admin)
    )
    assert r.status_code == 201, r.text

    # 3 bands × 2 slots = 6 generation calls, but only 3 embed calls
    # (one per band, cached across slots).
    gen_calls = recording_provider.calls_for(Operation.generation)
    embed_calls = [c for c in recording_provider.calls if c[0] == "embed"]
    assert len(gen_calls) == 6
    assert len(embed_calls) == 3

    # Each generation payload carried the rag_context for its band.
    assert all("rag_context" in c[2] for c in gen_calls)
    rag_contexts = {c[2]["rag_context"] for c in gen_calls}
    # The same chunk is in the index for all 3 bands → 3 bands all
    # see non-empty rag_context.
    assert all(ctx != "(none)" for ctx in rag_contexts)


# --- Anchor pool population — sanity check for the AnchorQuestion --


def test_anchor_bootstrap_persists_chunks_and_rag_audit(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Smoke: the bootstrap loop writes the expected
    :class:`AnchorQuestion` rows AND stamps the
    ``rag.retrieve`` audit rows for the cost dashboard fold."""
    import json

    seed_system_settings(cat_session)
    settings = cat_session.store[SystemSettings][-1]
    settings.anchor_pool_size_per_band = 1
    admin = _admin(cat_session)
    pill = _pill(cat_session, band_min=5, band_max=5)
    _seed_chunk(cat_session)

    def _ok_review_fn(payload: dict[str, Any]) -> dict[str, Any]:
        items = json.loads(payload["items_json"])
        return {
            "items": [
                {"anchor_question_id": item["anchor_question_id"], "verdict": "ok"}
                for item in items
            ]
        }

    recording_provider.set_response_fn(Operation.anchor_self_review, _ok_review_fn)

    r = cat_client.post(
        f"/v1/admin/pills/{pill.id}/anchors/generate", headers=bearer(admin)
    )
    assert r.status_code == 201

    anchors = cat_session.store.get(AnchorQuestion, [])
    questions = cat_session.store.get(Question, [])
    audits = [
        a for a in cat_session.store.get(AuditLog, []) if a.action == "rag.retrieve"
    ]

    assert len(anchors) == 1  # 1 band × 1 slot
    assert len(questions) == 1  # shared-PK with anchor
    assert len(audits) == 1  # one band → one cached retrieve

    assert audits[0].detail["target_difficulty"] == 5
    _ = QuestionType  # silence pyflakes unused
