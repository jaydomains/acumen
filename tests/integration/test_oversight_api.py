"""E1 — admin oversight dashboard read API (AC-CD26, read half).

Asserts the thin router (AC-CD2) over ``app.domain.oversight``:
* GET ``/v1/admin/oversight/publishes`` — newest-first, paginated, filterable.
* GET ``/v1/admin/oversight/publishes/{pill_id}/provenance`` — the claim→source
  →authority-tier chain (empty for an ungrounded publish).
* GET ``/v1/admin/oversight/source-authority`` — tier/host breakdown.
* GET ``/v1/admin/oversight/spot-check`` — seeded, low-confidence-weighted sample.
* Every endpoint is admin-role-gated (AC-CD5) — a Testee gets 403.

Zero-network (AC-CD15): pure DB reads over the in-memory fake session.
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app import permissions as p
from app.domain.generation import GENERATION_TASK_NAME
from app.models import (
    SEED_TENANT_ID,
    AppUser,
    GenerationProvenance,
    Pill,
    ProcessingTask,
    ProcessingTaskStatus,
    PublishRecord,
    Subject,
)
from tests.integration.conftest import (
    CatalogueFakeSession,
    bearer,
    cat_make_user,
)


def _admin(session: CatalogueFakeSession) -> AppUser:
    return cat_make_user(session, email="admin@kbc.com", role=p.ROLE_ADMINISTRATOR)


def _testee(session: CatalogueFakeSession) -> AppUser:
    return cat_make_user(session, email="t@kbc.com", role=p.ROLE_TESTEE)


def _seed_publish(
    session: CatalogueFakeSession,
    *,
    name: str,
    low_confidence: bool = False,
) -> Pill:
    subj = Subject(tenant_id=SEED_TENANT_ID, name="Welding")
    session.add(subj)
    pill = Pill(
        tenant_id=SEED_TENANT_ID,
        subject_id=subj.id,
        name=name,
        available_difficulty_min=1,
        available_difficulty_max=10,
    )
    session.add(pill)
    session.add(
        PublishRecord(
            tenant_id=SEED_TENANT_ID,
            pill_id=pill.id,
            batch_id=None,
            confidence=0.5 if low_confidence else 0.9,
            low_confidence=low_confidence,
            grounding_verdict="pass",
            safety_verdict="pass",
            provenance_verdict="pass",
            safety_relevant=False,
            single_provider_verified=False,
        )
    )
    return pill


def test_recent_publishes_requires_admin(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    testee = _testee(cat_session)
    r = cat_client.get("/v1/admin/oversight/publishes", headers=bearer(testee))
    assert r.status_code == 403


def test_recent_publishes_returns_paginated_page(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    admin = _admin(cat_session)
    _seed_publish(cat_session, name="Arc")
    _seed_publish(cat_session, name="MIG", low_confidence=True)

    r = cat_client.get("/v1/admin/oversight/publishes", headers=bearer(admin))
    assert r.status_code == 200
    body = r.json()
    assert body["has_more"] is False  # both rows fit one default page
    assert {row["pill_name"] for row in body["publishes"]} == {"Arc", "MIG"}
    # Confidence facet embedded in each row.
    assert all(
        "confidence" in row and "grounding_verdict" in row for row in body["publishes"]
    )

    low = cat_client.get(
        "/v1/admin/oversight/publishes?low_confidence=true", headers=bearer(admin)
    )
    assert [row["pill_name"] for row in low.json()["publishes"]] == ["MIG"]


def test_provenance_and_source_authority_require_admin(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    testee = _testee(cat_session)
    pill = _seed_publish(cat_session, name="Arc")
    assert (
        cat_client.get(
            f"/v1/admin/oversight/publishes/{pill.id}/provenance", headers=bearer(testee)
        ).status_code
        == 403
    )
    assert (
        cat_client.get(
            "/v1/admin/oversight/source-authority", headers=bearer(testee)
        ).status_code
        == 403
    )


def test_item_provenance_returns_chain(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    admin = _admin(cat_session)
    pill = _seed_publish(cat_session, name="Grounded")
    draft_ref = str(uuid.uuid4())
    cat_session.add(
        ProcessingTask(
            tenant_id=SEED_TENANT_ID,
            task_name=GENERATION_TASK_NAME,
            status=ProcessingTaskStatus.done,
            payload={"draft": {"draft_ref": draft_ref}, "created_pill_id": str(pill.id)},
        )
    )
    cat_session.add(
        GenerationProvenance(
            tenant_id=SEED_TENANT_ID,
            draft_ref=draft_ref,
            claim_ref=f"{draft_ref}:0",
            corpus_chunk_id=uuid.uuid4(),
            source_host="osha.gov",
            authority_tier=1,
            authority_score=0.95,
        )
    )

    r = cat_client.get(
        f"/v1/admin/oversight/publishes/{pill.id}/provenance", headers=bearer(admin)
    )
    assert r.status_code == 200
    body = r.json()
    assert body["draft_ref"] == draft_ref
    assert len(body["claims"]) == 1
    assert body["claims"][0]["source_host"] == "osha.gov"
    assert body["claims"][0]["authority_tier"] == 1


def test_source_authority_breakdown(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    admin = _admin(cat_session)
    for i, (host, tier) in enumerate([("osha.gov", 1), ("osha.gov", 1), ("wiki.org", 3)]):
        cat_session.add(
            GenerationProvenance(
                tenant_id=SEED_TENANT_ID,
                draft_ref=f"d{i}",
                claim_ref=f"c{i}",
                corpus_chunk_id=uuid.uuid4(),
                source_host=host,
                authority_tier=tier,
                authority_score=0.5,
            )
        )

    r = cat_client.get("/v1/admin/oversight/source-authority", headers=bearer(admin))
    assert r.status_code == 200
    body = r.json()
    assert body["total_claims"] == 3
    assert body["by_source"][0]["source_host"] == "osha.gov"
    assert body["by_source"][0]["claims"] == 2


def test_spot_check_is_seeded_and_admin_gated(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    for i in range(5):
        _seed_publish(cat_session, name=f"P{i}")

    assert (
        cat_client.get(
            "/v1/admin/oversight/spot-check", headers=bearer(testee)
        ).status_code
        == 403
    )

    a = cat_client.get(
        "/v1/admin/oversight/spot-check?n=2&seed=7", headers=bearer(admin)
    ).json()
    b = cat_client.get(
        "/v1/admin/oversight/spot-check?n=2&seed=7", headers=bearer(admin)
    ).json()
    assert a["seed"] == 7 and a["n"] == 2
    assert len(a["sample"]) == 2
    assert [row["pill_id"] for row in a["sample"]] == [
        row["pill_id"] for row in b["sample"]
    ]
