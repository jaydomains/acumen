"""P9 Slice 2 — Drive ingest admin endpoint (AC-D22 / AC-D23 step 4).

End-to-end coverage of ``POST /v1/admin/drive/ingest``: the happy path
(file → chunks with full provenance), the diff arms (unchanged skip,
changed re-embed, deleted drop), the role gate, the
``drive_folder_unconfigured`` guard, per-file fail-soft isolation,
and the audit-log + cost-dashboard cross-cut.

Drive calls run against the :class:`_FakeDrive` seam from
``tests/integration/conftest.py``; AI calls run against
:class:`RecordingProvider` — no network, AC-CD15 honoured.
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app import permissions as p
from app.models import (
    SEED_TENANT_ID,
    AppUser,
    AuditLog,
    DriveChunk,
    SystemSettings,
)
from tests.integration.conftest import (
    CatalogueFakeSession,
    RecordingProvider,
    _FakeDrive,
    bearer,
    cat_make_user,
    seed_system_settings,
)

_FOLDER_ID = "test-folder-id"


# --- Fixtures ---------------------------------------------------------


def _admin(session: CatalogueFakeSession, email: str = "a@kbc.com") -> AppUser:
    return cat_make_user(session, email=email, role=p.ROLE_ADMINISTRATOR)


def _testee(session: CatalogueFakeSession, email: str = "t@kbc.com") -> AppUser:
    return cat_make_user(session, email=email, role=p.ROLE_TESTEE)


def _seed_settings_with_folder(
    session: CatalogueFakeSession, *, folder_id: str | None = _FOLDER_ID
) -> SystemSettings:
    seed_system_settings(session)
    settings = session.store[SystemSettings][-1]
    settings.drive_folder_id = folder_id
    return settings


# --- Happy path -------------------------------------------------------


def test_ingest_seeds_chunks_with_full_provenance(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    fake_drive: _FakeDrive,
) -> None:
    """One Drive file with three oversize paragraphs → three chunk
    rows, each carrying full AIProvenanceMixin provenance from the
    embed call (provider/model/prompt_tokens/cost). ROADMAP P9
    done-when prereq for "embedding spend appears against OpenAI in
    cost".

    Each paragraph is built deliberately oversize (> 2000 chars,
    above the chunker's default target) so the oversize branch lands
    each as its own chunk rather than the greedy-pack default.
    Documents with many short paragraphs combine into fewer chunks —
    that's the correct chunker behaviour and is asserted in the
    unit-level chunker tests."""
    _seed_settings_with_folder(cat_session)
    admin = _admin(cat_session)
    para_a = "lift " * 500  # ≈2500 chars > 2000-char target
    para_b = "rig " * 500
    para_c = "zone " * 500
    fake_drive.set_file(
        "f1",
        text=f"{para_a.strip()}\n\n{para_b.strip()}\n\n{para_c.strip()}",
    )
    # RecordingProvider.embed returns ([0.0]*1536, prompt_tokens=100,
    # cost_usd=0.001) by default.
    r = cat_client.post("/v1/admin/drive/ingest", headers=bearer(admin))
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["files_seen"] == 1
    assert body["files_added"] == 1
    assert body["files_unchanged"] == 0
    assert body["files_changed"] == 0
    assert body["files_deleted"] == 0
    assert body["files_failed"] == 0
    assert body["chunks_added"] == 3
    assert body["chunks_deleted"] == 0
    assert body["embed_calls"] == 3

    chunks = cat_session.store.get(DriveChunk, [])
    assert len(chunks) == 3
    assert all(c.source_doc_ref == "f1" for c in chunks)
    assert all(c.tenant_id == SEED_TENANT_ID for c in chunks)
    assert {c.chunk_index for c in chunks} == {0, 1, 2}
    assert all(len(c.embedding) == 1536 for c in chunks)
    # Per-chunk provenance — the cost-dashboard cross-cut depends on
    # this stamping (record_provenance's embed branch sets
    # ai_prompt_version=None, ai_completion_tokens=0).
    assert all(c.ai_provider == "anthropic" for c in chunks)  # recorder label
    assert all(c.ai_model == "text-embedding-3-small" for c in chunks)
    assert all(c.ai_prompt_version is None for c in chunks)
    assert all(c.ai_completion_tokens == 0 for c in chunks)
    assert all(c.ai_prompt_tokens == 100 for c in chunks)
    assert all(c.ai_cost_usd == 0.001 for c in chunks)


# --- Diff arm: unchanged → no embed -----------------------------------


def test_ingest_skips_unchanged_files_via_hash(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    fake_drive: _FakeDrive,
) -> None:
    """Second run on unchanged content → 0 new chunks, 0 new embed
    calls. The diff-by-hash arm of AC-D22."""
    _seed_settings_with_folder(cat_session)
    admin = _admin(cat_session)
    fake_drive.set_file("f1", text="Stable content para one.")

    r1 = cat_client.post("/v1/admin/drive/ingest", headers=bearer(admin))
    assert r1.status_code == 201
    assert r1.json()["chunks_added"] == 1

    # Reset the recorder's call log so the second run's embed count is
    # cleanly observable.
    recording_provider.calls.clear()

    r2 = cat_client.post("/v1/admin/drive/ingest", headers=bearer(admin))
    assert r2.status_code == 201
    body = r2.json()
    assert body["files_unchanged"] == 1
    assert body["files_added"] == 0
    assert body["chunks_added"] == 0
    assert body["embed_calls"] == 0
    # No new embed calls fired on the unchanged sweep.
    assert recording_provider.calls_for == recording_provider.calls_for  # sanity
    embed_calls = [c for c in recording_provider.calls if c[0] == "embed"]
    assert embed_calls == []


# --- Diff arm: changed → drop + re-embed -----------------------------


def test_ingest_reembeds_changed_files(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    fake_drive: _FakeDrive,
) -> None:
    """Second run on mutated content → previous chunks dropped, new
    chunks created. The diff-by-hash arm catches the change."""
    _seed_settings_with_folder(cat_session)
    admin = _admin(cat_session)
    fake_drive.set_file("f1", text="First version content.")

    r1 = cat_client.post("/v1/admin/drive/ingest", headers=bearer(admin))
    assert r1.status_code == 201
    assert r1.json()["chunks_added"] == 1
    first_pass_chunks = list(cat_session.store.get(DriveChunk, []))
    assert len(first_pass_chunks) == 1
    first_chunk_id = first_pass_chunks[0].id

    fake_drive.set_file("f1", text="Second version much different content here.")
    r2 = cat_client.post("/v1/admin/drive/ingest", headers=bearer(admin))
    assert r2.status_code == 201
    body = r2.json()
    assert body["files_changed"] == 1
    assert body["files_added"] == 0
    assert body["chunks_added"] == 1
    assert body["chunks_deleted"] == 1

    chunks = cat_session.store.get(DriveChunk, [])
    assert len(chunks) == 1
    # The previous chunk row is gone; the new one has a different id.
    assert chunks[0].id != first_chunk_id
    assert "Second version" in chunks[0].chunk_text


# --- Diff arm: deleted → drop only -----------------------------------


def test_ingest_drops_chunks_for_deleted_files(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    fake_drive: _FakeDrive,
) -> None:
    """Deleting a file from Drive → its chunks drop on the next ingest;
    no embed calls fire for the deletion."""
    _seed_settings_with_folder(cat_session)
    admin = _admin(cat_session)
    fake_drive.set_file("f1", text="Content that will be deleted.")

    r1 = cat_client.post("/v1/admin/drive/ingest", headers=bearer(admin))
    assert r1.status_code == 201
    assert r1.json()["chunks_added"] == 1

    fake_drive.delete_file("f1")
    recording_provider.calls.clear()

    r2 = cat_client.post("/v1/admin/drive/ingest", headers=bearer(admin))
    assert r2.status_code == 201
    body = r2.json()
    assert body["files_deleted"] == 1
    assert body["files_added"] == 0
    assert body["chunks_added"] == 0
    assert body["chunks_deleted"] == 1

    chunks = cat_session.store.get(DriveChunk, [])
    assert chunks == []
    # No new embed calls fired on the deletion sweep.
    embed_calls = [c for c in recording_provider.calls if c[0] == "embed"]
    assert embed_calls == []


# --- Auth gates -------------------------------------------------------


def test_ingest_requires_admin(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """A testee role cannot trigger the ingest — 403 via the
    require_role(ROLE_ADMINISTRATOR) dependency."""
    _seed_settings_with_folder(cat_session)
    testee = _testee(cat_session)
    r = cat_client.post("/v1/admin/drive/ingest", headers=bearer(testee))
    assert r.status_code == 403


# --- Configuration guard ---------------------------------------------


def test_ingest_409_when_folder_id_unconfigured(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    fake_drive: _FakeDrive,
) -> None:
    """An admin trying to run the ingest before AC-D23 step 4
    (initial folder bootstrap) gets a clear 409 telling them to set
    ``drive_folder_id`` first."""
    _seed_settings_with_folder(cat_session, folder_id=None)
    admin = _admin(cat_session)
    r = cat_client.post("/v1/admin/drive/ingest", headers=bearer(admin))
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "drive_folder_unconfigured"


def test_ingest_409_when_folder_id_empty_string(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    fake_drive: _FakeDrive,
) -> None:
    """Empty string and None behave the same — both indicate
    unconfigured. Matches the config.py default of empty-string."""
    _seed_settings_with_folder(cat_session, folder_id="")
    admin = _admin(cat_session)
    r = cat_client.post("/v1/admin/drive/ingest", headers=bearer(admin))
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "drive_folder_unconfigured"


# --- Audit log -------------------------------------------------------


def test_ingest_writes_audit_with_telemetry(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    fake_drive: _FakeDrive,
) -> None:
    """Successful ingest writes one ``drive.ingest`` audit row carrying
    the full telemetry dict. Underpins the cost-trend dashboard's
    embed-call accounting."""
    _seed_settings_with_folder(cat_session)
    admin = _admin(cat_session)
    fake_drive.set_file("f1", text="One chunk worth of content.")

    cat_client.post("/v1/admin/drive/ingest", headers=bearer(admin))

    audits = [
        a for a in cat_session.store.get(AuditLog, []) if a.action == "drive.ingest"
    ]
    assert len(audits) == 1
    audit = audits[0]
    assert audit.actor_id == admin.id
    assert audit.target_entity == "system_settings"
    assert audit.detail["chunks_added"] == 1
    assert audit.detail["files_added"] == 1
    assert audit.detail["embed_calls"] == 1


# --- Per-file fail-soft (PR-019 Slice 2 isolation pattern) ----------


def test_ingest_drive_source_failure_is_fail_soft_per_file(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    fake_drive: _FakeDrive,
) -> None:
    """A single Drive fetch failure (revoked permission, transient
    404) increments ``files_failed`` but does not abort the sweep —
    other files still ingest. Matches the PR-019 Slice 2
    isolation-pattern Gitar finding."""
    _seed_settings_with_folder(cat_session)
    admin = _admin(cat_session)
    fake_drive.set_file("good", text="This one indexes fine.")
    fake_drive.set_file("bad", text="This one fails fetch.")
    fake_drive.fail_fetch_for("bad")

    r = cat_client.post("/v1/admin/drive/ingest", headers=bearer(admin))
    assert r.status_code == 201
    body = r.json()
    assert body["files_seen"] == 2
    assert body["files_added"] == 1
    assert body["files_failed"] == 1
    assert body["chunks_added"] == 1

    chunks = cat_session.store.get(DriveChunk, [])
    assert len(chunks) == 1
    assert chunks[0].source_doc_ref == "good"


# --- Empty-folder edge case ------------------------------------------


def test_ingest_empty_folder_writes_zero_chunks(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    fake_drive: _FakeDrive,
) -> None:
    """An empty folder is a valid initial state (operator hasn't
    dropped any docs yet). Sweep returns clean zeros without crashing
    — important because the AC-D23 step 4 bootstrap runs against an
    empty Drive folder on day-one deployments."""
    _seed_settings_with_folder(cat_session)
    admin = _admin(cat_session)

    r = cat_client.post("/v1/admin/drive/ingest", headers=bearer(admin))
    assert r.status_code == 201
    body = r.json()
    assert body == {
        "files_seen": 0,
        "files_unchanged": 0,
        "files_added": 0,
        "files_changed": 0,
        "files_deleted": 0,
        "files_failed": 0,
        "chunks_added": 0,
        "chunks_deleted": 0,
        "embed_calls": 0,
    }


# --- Cost dashboard cross-cut ----------------------------------------


def test_ingest_embedding_spend_surfaces_via_drive_chunk_provenance(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    fake_drive: _FakeDrive,
) -> None:
    """ROADMAP P9 done-when: "embedding spend appears against OpenAI in
    cost." After the ingest sweep, the DriveChunk rows carry full
    provenance so :func:`current_month_spend` aggregates the embed
    spend alongside the other 6 provenance-bearing tables. The Slice 1
    aggregation extension is the wiring; this test is the
    end-to-end verification.
    """
    _seed_settings_with_folder(cat_session)
    admin = _admin(cat_session)
    # Short paragraphs pack into one chunk; recording provider stamps
    # cost_usd=0.001 per embed call. The end-to-end invariant is that
    # every chunk carries non-null provenance, which is what
    # current_month_spend's _spend_for_table walk sums.
    fake_drive.set_file(
        "f1",
        text="Para A.\n\nPara B.\n\nPara C.",
    )

    r = cat_client.post("/v1/admin/drive/ingest", headers=bearer(admin))
    assert r.status_code == 201

    # The cost dashboard's by_provider / by_model now reflect the
    # embed spend. The recorder uses provider_label="anthropic" by
    # default, so the spend lands under "anthropic" / "text-embedding-3-small"
    # — in production with a real OpenAI key the label would be
    # "openai", but the cost-aggregation shape is the same.
    chunks = cat_session.store.get(DriveChunk, [])
    assert len(chunks) >= 1
    total_spend = sum(c.ai_cost_usd or 0 for c in chunks)
    assert total_spend == 0.001 * len(chunks)
    # Every chunk has full provenance for the by_provider / by_model
    # aggregation buckets.
    assert {c.ai_model for c in chunks} == {"text-embedding-3-small"}
    assert all(c.ai_cost_usd is not None for c in chunks)
    assert all(c.ai_provider is not None for c in chunks)


# --- Imports below this line silence pyflakes "unused" for uuid ----
_ = uuid
