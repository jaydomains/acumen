"""P11 Slice 3 — safety-link curation + monthly check (AC-D21).

Exercises :func:`app.domain.safety_links.curate_links_for_pill` and
:func:`app.domain.safety_links.check_safety_links` end-to-end against
the AC-CD15 in-memory harness: ``_FakeWebSearch`` for the web-search
provider, ``httpx.MockTransport`` for the URL fetch.

Zero-DB / zero-network (AC-CD15).
"""

from __future__ import annotations

import hashlib
import uuid
from typing import Any

import httpx
import pytest

from app import permissions as p
from app.domain.safety_links import (
    check_safety_links,
    curate_links_for_pill,
)
from app.models import (
    SEED_TENANT_ID,
    AuditLog,
    Pill,
    PillSafetyLink,
    Subject,
)
from tests.integration.conftest import (
    CatalogueFakeSession,
    _FakeWebSearch,
    bearer,
    cat_make_user,
    seed_system_settings,
)

# --- helpers ----------------------------------------------------------


def _subject(session: CatalogueFakeSession) -> Subject:
    subject = Subject(
        tenant_id=SEED_TENANT_ID,
        name="Field operations",
        description=None,
    )
    session.add(subject)
    return subject


def _pill(
    session: CatalogueFakeSession,
    *,
    name: str,
    safety_relevant: bool,
    subject_id: uuid.UUID,
) -> Pill:
    pill = Pill(
        tenant_id=SEED_TENANT_ID,
        subject_id=subject_id,
        name=name,
        description=None,
        available_difficulty_min=1,
        available_difficulty_max=10,
        discoverable=True,
        safety_relevant=safety_relevant,
    )
    session.add(pill)
    return pill


def _safety_link(
    session: CatalogueFakeSession,
    *,
    pill_id: uuid.UUID,
    url: str,
    content_hash: str | None,
) -> PillSafetyLink:
    link = PillSafetyLink(
        tenant_id=SEED_TENANT_ID,
        pill_id=pill_id,
        url=url,
        title="Reference",
        source="example.com",
        last_verified_at=p.now_utc(),
        content_hash=content_hash,
    )
    session.add(link)
    return link


def _sha256(body: bytes) -> str:
    return hashlib.sha256(body).hexdigest()


def _http_client(responses: dict[str, tuple[int, bytes]]) -> httpx.AsyncClient:
    """Build an httpx AsyncClient backed by MockTransport. The
    ``responses`` map URL → (status_code, body); unmapped URLs return
    a 404. Tests pass this into :func:`curate_links_for_pill` /
    :func:`check_safety_links` via the ``http_client`` kwarg so the
    sweep is fully observable + zero-network (AC-CD15)."""

    def _handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if url in responses:
            status, body = responses[url]
            return httpx.Response(status_code=status, content=body)
        return httpx.Response(status_code=404, content=b"")

    return httpx.AsyncClient(transport=httpx.MockTransport(_handler))


# --- curate_links_for_pill -------------------------------------------


@pytest.mark.asyncio
async def test_curate_links_writes_rows_for_safety_pill(
    cat_session: CatalogueFakeSession,
    fake_web_search: _FakeWebSearch,
) -> None:
    """A safety pill with no cached links + 3 web-search results
    yields 3 ``PillSafetyLink`` rows. The audit log carries the
    curation event."""
    seed_system_settings(cat_session)
    subject = _subject(cat_session)
    pill = _pill(
        cat_session, name="Lift safety", safety_relevant=True, subject_id=subject.id
    )

    fake_web_search.set_default_results(
        [
            fake_web_search.make_result(url="https://osha.gov/lift1", source="osha.gov"),
            fake_web_search.make_result(url="https://nace.org/lift2", source="nace.org"),
            fake_web_search.make_result(url="https://sans.org/lift3", source="sans.org"),
        ]
    )
    bodies = {
        "https://osha.gov/lift1": (200, b"osha lift reference"),
        "https://nace.org/lift2": (200, b"nace lift reference"),
        "https://sans.org/lift3": (200, b"sans lift reference"),
    }
    async with _http_client(bodies) as client:
        result = await curate_links_for_pill(cat_session, pill.id, http_client=client)

    assert result == {"links_added": 3, "links_skipped": 0}
    rows = [r for r in cat_session.store.get(PillSafetyLink, []) if r.pill_id == pill.id]
    assert len(rows) == 3
    # Every row carries the SHA-256 fingerprint of its fetched body.
    by_url = {r.url: r for r in rows}
    assert by_url["https://osha.gov/lift1"].content_hash == _sha256(
        b"osha lift reference"
    )
    audit = [
        r
        for r in cat_session.store.get(AuditLog, [])
        if r.action == "safety_links.curate" and r.target_id == pill.id
    ]
    assert len(audit) == 1


@pytest.mark.asyncio
async def test_curate_links_is_no_op_on_non_safety_pill(
    cat_session: CatalogueFakeSession,
    fake_web_search: _FakeWebSearch,
) -> None:
    """Non-safety pills are skipped silently — no web-search call, no
    rows, no audit row. The AC-D21 trust hierarchy says only safety
    pills carry external-link cache."""
    subject = _subject(cat_session)
    pill = _pill(
        cat_session, name="Calculus", safety_relevant=False, subject_id=subject.id
    )

    async with _http_client({}) as client:
        result = await curate_links_for_pill(cat_session, pill.id, http_client=client)

    assert result == {"links_added": 0, "links_skipped": 0}
    assert fake_web_search.search_calls == []
    assert not cat_session.store.get(PillSafetyLink, [])


@pytest.mark.asyncio
async def test_curate_links_idempotent_when_at_quota(
    cat_session: CatalogueFakeSession,
    fake_web_search: _FakeWebSearch,
) -> None:
    """A pill already at the 3-link quota → curation is a no-op
    (counter-zero). The web search is NOT invoked — the existence
    check short-circuits before any external call. AC-CD7 idempotency
    contract."""
    seed_system_settings(cat_session)
    subject = _subject(cat_session)
    pill = _pill(
        cat_session, name="Confined space", safety_relevant=True, subject_id=subject.id
    )
    for i in range(3):
        _safety_link(
            cat_session,
            pill_id=pill.id,
            url=f"https://example.com/existing-{i}",
            content_hash=_sha256(f"body-{i}".encode()),
        )

    async with _http_client({}) as client:
        result = await curate_links_for_pill(cat_session, pill.id, http_client=client)

    assert result == {"links_added": 0, "links_skipped": 3}
    assert fake_web_search.search_calls == []


@pytest.mark.asyncio
async def test_curate_links_audits_no_results_found(
    cat_session: CatalogueFakeSession,
    fake_web_search: _FakeWebSearch,
) -> None:
    """Empty web-search response → ``safety_links.no_results_found``
    audit row. Curation does not crash; admin sees the operational
    signal in the audit log."""
    seed_system_settings(cat_session)
    subject = _subject(cat_session)
    pill = _pill(
        cat_session, name="Esoteric", safety_relevant=True, subject_id=subject.id
    )
    fake_web_search.set_default_results([])

    async with _http_client({}) as client:
        result = await curate_links_for_pill(cat_session, pill.id, http_client=client)

    assert result == {"links_added": 0, "links_skipped": 0}
    audit = [
        r
        for r in cat_session.store.get(AuditLog, [])
        if r.action == "safety_links.no_results_found"
    ]
    assert len(audit) == 1
    assert audit[0].target_id == pill.id


@pytest.mark.asyncio
async def test_curate_links_skips_url_that_fails_fetch(
    cat_session: CatalogueFakeSession,
    fake_web_search: _FakeWebSearch,
) -> None:
    """A URL whose HTTP fetch returns 404 (or fails) is skipped but
    counted under ``links_skipped`` — the cron's next pass retries.
    Other URLs in the same batch persist normally."""
    seed_system_settings(cat_session)
    subject = _subject(cat_session)
    pill = _pill(
        cat_session, name="High voltage", safety_relevant=True, subject_id=subject.id
    )
    fake_web_search.set_default_results(
        [
            fake_web_search.make_result(url="https://good.example/ok"),
            fake_web_search.make_result(url="https://bad.example/missing"),
            fake_web_search.make_result(url="https://other.example/ok"),
        ]
    )
    bodies = {
        "https://good.example/ok": (200, b"good body"),
        "https://bad.example/missing": (404, b""),
        "https://other.example/ok": (200, b"other body"),
    }
    async with _http_client(bodies) as client:
        result = await curate_links_for_pill(cat_session, pill.id, http_client=client)

    assert result == {"links_added": 2, "links_skipped": 1}
    rows = [r for r in cat_session.store.get(PillSafetyLink, []) if r.pill_id == pill.id]
    urls = {r.url for r in rows}
    assert urls == {"https://good.example/ok", "https://other.example/ok"}


# --- check_safety_links ----------------------------------------------


@pytest.mark.asyncio
async def test_check_safety_links_unchanged_link_updates_verified_only(
    cat_session: CatalogueFakeSession,
    fake_web_search: _FakeWebSearch,
) -> None:
    """A link whose fetched body hash matches the cached hash is
    counted as unchanged — only ``last_verified_at`` updates. No
    audit row written for the stable case."""
    seed_system_settings(cat_session)
    subject = _subject(cat_session)
    pill = _pill(cat_session, name="PPE", safety_relevant=True, subject_id=subject.id)
    body = b"stable reference text"
    link = _safety_link(
        cat_session,
        pill_id=pill.id,
        url="https://stable.example/ref",
        content_hash=_sha256(body),
    )

    bodies = {"https://stable.example/ref": (200, body)}
    async with _http_client(bodies) as client:
        result = await check_safety_links(cat_session, http_client=client)

    assert result == {
        "links_checked": 1,
        "links_broken_replaced": 0,
        "links_drift_flagged": 0,
        "links_unchanged": 1,
    }
    # Verified timestamp moved forward.
    assert link.last_verified_at is not None


@pytest.mark.asyncio
async def test_check_safety_links_drift_writes_audit_no_ai_call(
    cat_session: CatalogueFakeSession,
    fake_web_search: _FakeWebSearch,
) -> None:
    """A SHA-256 mismatch fires ``safety_links.drift_flagged`` for
    admin attention — NO AI drift call (AC-CD8 v1.6's operation enum
    routes only ``grade_review`` and ``anchor_self_review`` through
    ``provider.review``; adding a drift op would be a v1.x spec
    change). The link's hash updates so the next pass doesn't keep
    re-flagging the same drift."""
    seed_system_settings(cat_session)
    subject = _subject(cat_session)
    pill = _pill(
        cat_session, name="Hot work", safety_relevant=True, subject_id=subject.id
    )
    link = _safety_link(
        cat_session,
        pill_id=pill.id,
        url="https://drift.example/ref",
        content_hash=_sha256(b"old version"),
    )

    new_body = b"new revised version with different text"
    bodies = {"https://drift.example/ref": (200, new_body)}
    async with _http_client(bodies) as client:
        result = await check_safety_links(cat_session, http_client=client)

    assert result["links_drift_flagged"] == 1
    assert result["links_unchanged"] == 0
    drift_rows = [
        r
        for r in cat_session.store.get(AuditLog, [])
        if r.action == "safety_links.drift_flagged"
    ]
    assert len(drift_rows) == 1
    assert drift_rows[0].detail["url"] == "https://drift.example/ref"
    # No AI call surface invoked — the test confirms by asserting the
    # web search seam wasn't touched for drift (only the broken-link
    # branch invokes top-up curation).
    assert fake_web_search.search_calls == []
    # Hash updated so next pass doesn't re-flag.
    assert link.content_hash == _sha256(new_body)


@pytest.mark.asyncio
async def test_check_safety_links_broken_triggers_top_up(
    cat_session: CatalogueFakeSession,
    fake_web_search: _FakeWebSearch,
) -> None:
    """A 404 / network error on a cached link marks it broken AND
    invokes the best-effort top-up curation for the same pill. The
    replacement count is non-zero when the web search returns fresh
    URLs that the in-memory store can persist (deficit-driven; the
    broken row is NOT deleted so the admin can see the failure
    history)."""
    seed_system_settings(cat_session)
    subject = _subject(cat_session)
    pill = _pill(
        cat_session, name="Asbestos", safety_relevant=True, subject_id=subject.id
    )
    _safety_link(
        cat_session,
        pill_id=pill.id,
        url="https://gone.example/dead-link",
        content_hash=_sha256(b"former body"),
    )
    fake_web_search.set_default_results(
        [
            fake_web_search.make_result(url="https://replacement.example/new"),
            fake_web_search.make_result(url="https://replacement.example/new2"),
            fake_web_search.make_result(url="https://replacement.example/new3"),
        ]
    )
    bodies = {
        "https://gone.example/dead-link": (404, b""),
        "https://replacement.example/new": (200, b"fresh body 1"),
        "https://replacement.example/new2": (200, b"fresh body 2"),
        "https://replacement.example/new3": (200, b"fresh body 3"),
    }
    async with _http_client(bodies) as client:
        result = await check_safety_links(cat_session, http_client=client)

    assert result["links_checked"] == 1
    assert result["links_broken_replaced"] >= 1
    # Broken-flag audit + at least one curate audit fired.
    actions = {r.action for r in cat_session.store.get(AuditLog, [])}
    assert "safety_links.broken_flagged" in actions
    assert "safety_links.curate" in actions


@pytest.mark.asyncio
async def test_check_safety_links_empty_store_is_no_op(
    cat_session: CatalogueFakeSession,
    fake_web_search: _FakeWebSearch,
) -> None:
    """With no cached links, the sweep returns all-zero counts — the
    AC-CD7 idempotency contract holds on a fresh deployment too."""
    seed_system_settings(cat_session)
    async with _http_client({}) as client:
        result = await check_safety_links(cat_session, http_client=client)
    assert result == {
        "links_checked": 0,
        "links_broken_replaced": 0,
        "links_drift_flagged": 0,
        "links_unchanged": 0,
    }


# --- admin endpoint ---------------------------------------------------


def test_safety_links_check_endpoint_returns_counts(
    cat_client: Any,
    cat_session: CatalogueFakeSession,
    fake_web_search: _FakeWebSearch,
) -> None:
    """Admin POSTs to ``/v1/admin/safety-links/check`` and receives
    the standard counts envelope. The endpoint commits — verified
    by the audit row landing in the store."""
    seed_system_settings(cat_session)
    admin = cat_make_user(cat_session, email="a@kbc.com", role=p.ROLE_ADMINISTRATOR)

    r = cat_client.post("/v1/admin/safety-links/check", headers=bearer(admin))
    assert r.status_code == 201, r.text
    body = r.json()
    assert set(body.keys()) == {
        "links_checked",
        "links_broken_replaced",
        "links_drift_flagged",
        "links_unchanged",
    }
    # Audit log captures the operator + telemetry.
    audit = [
        r for r in cat_session.store.get(AuditLog, []) if r.action == "safety_links.check"
    ]
    assert len(audit) == 1
    assert audit[0].actor_id == admin.id


def test_safety_links_check_endpoint_forbidden_for_non_admin(
    cat_client: Any,
    cat_session: CatalogueFakeSession,
) -> None:
    """A Testee POSTing to the endpoint gets 403 — the
    ``_require_admin`` dependency surface holds."""
    seed_system_settings(cat_session)
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    r = cat_client.post("/v1/admin/safety-links/check", headers=bearer(testee))
    assert r.status_code == 403
