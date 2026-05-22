"""P11 Slice 1 — attempt-result PDF export (SPEC §3:136 / AC-CD1).

Covers ``GET /v1/attempts/{id}/export.pdf``: deterministic + mixed
attempts render; ownership gate; submission gate; PDF byte shape;
admin-as-non-owner access; per-Testee attempt with anchors.

Zero-DB / zero-network (AC-CD15) — ReportLab is pure-Python so the
sweep stays in the in-memory harness.
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app import permissions as p
from app.models import (
    SEED_TENANT_ID,
    AppUser,
    Question,
    QuestionType,
    Test,
    TestMode,
    TestStatus,
    TestVisibility,
    TimeoutBehaviour,
)
from tests.integration.conftest import (
    CatalogueFakeSession,
    bearer,
    cat_make_user,
    seed_system_settings,
)


def _testee(session: CatalogueFakeSession, email: str = "t@kbc.com") -> AppUser:
    return cat_make_user(session, email=email, role=p.ROLE_TESTEE)


def _admin(session: CatalogueFakeSession, email: str = "a@kbc.com") -> AppUser:
    return cat_make_user(session, email=email, role=p.ROLE_ADMINISTRATOR)


def _frozen_test(session: CatalogueFakeSession) -> Test:
    test = Test(
        tenant_id=SEED_TENANT_ID,
        name="Lift Safety Refresher",
        mode=TestMode.frozen,
        status=TestStatus.published,
        visibility=TestVisibility.library,
        timed=False,
        timeout_behaviour=TimeoutBehaviour.auto_submit,
        max_pause_duration_minutes=30,
        target_difficulty=5,
        randomise_question_order=True,
        randomise_option_order=True,
        pass_threshold=0.5,
    )
    session.add(test)
    return test


def _q(
    session: CatalogueFakeSession,
    test_id: uuid.UUID,
    qtype: QuestionType,
    config: dict,
) -> Question:
    q = Question(
        tenant_id=SEED_TENANT_ID,
        test_id=test_id,
        type=qtype,
        config=config,
        assigned_difficulty=5,
        question_group_id=None,
        realism_flag_count=0,
    )
    session.add(q)
    return q


def _start(client: TestClient, t: AppUser, test_id: uuid.UUID) -> dict:
    r = client.post("/v1/attempts", headers=bearer(t), json={"test_id": str(test_id)})
    assert r.status_code == 201, r.text
    return r.json()


def _autosave(
    client: TestClient,
    t: AppUser,
    attempt_id: str,
    question_id: str,
    payload: dict,
) -> None:
    r = client.post(
        f"/v1/attempts/{attempt_id}/autosave",
        headers=bearer(t),
        json={"question_id": question_id, "answer_payload": payload, "time_ms": 1000},
    )
    assert r.status_code == 200, r.text


def _submit(client: TestClient, t: AppUser, attempt_id: str) -> None:
    r = client.post(f"/v1/attempts/{attempt_id}/submit", headers=bearer(t))
    assert r.status_code == 200, r.text


def test_pdf_export_deterministic_attempt_returns_application_pdf(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """A fully-deterministic submitted attempt renders a complete PDF
    with the standard magic header bytes + the application/pdf MIME."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_test(cat_session)
    q = _q(
        cat_session,
        test.id,
        QuestionType.true_false,
        {"prompt": "The sky is blue.", "correct": True},
    )
    started = _start(cat_client, t, test.id)
    _autosave(cat_client, t, started["id"], str(q.id), {"answer": True})
    _submit(cat_client, t, started["id"])

    r = cat_client.get(f"/v1/attempts/{started['id']}/export.pdf", headers=bearer(t))
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "application/pdf"
    # PDF magic bytes per ISO 32000.
    assert r.content.startswith(b"%PDF-")
    # Non-trivial size: a real document, not a stub.
    assert len(r.content) > 1000
    # Attachment filename carries the attempt id so a printed PDF is
    # identifiable on disk.
    cd = r.headers.get("content-disposition", "")
    assert "attachment" in cd
    assert started["id"] in cd


def test_pdf_export_404_for_non_owner_non_admin(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """Another Testee cannot read someone else's PDF. Mirrors the
    ``_load`` 404 surface used by every attempt endpoint — the gate
    leaks no ownership info."""
    seed_system_settings(cat_session)
    owner = _testee(cat_session, email="owner@kbc.com")
    intruder = _testee(cat_session, email="other@kbc.com")
    test = _frozen_test(cat_session)
    q = _q(
        cat_session,
        test.id,
        QuestionType.true_false,
        {"prompt": "p", "correct": True},
    )
    started = _start(cat_client, owner, test.id)
    _autosave(cat_client, owner, started["id"], str(q.id), {"answer": True})
    _submit(cat_client, owner, started["id"])

    r = cat_client.get(
        f"/v1/attempts/{started['id']}/export.pdf", headers=bearer(intruder)
    )
    assert r.status_code == 404


def test_pdf_export_admin_can_read_any_attempt(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """Admin role bypasses the testee-ownership check on the standard
    ``_load`` path; the PDF endpoint inherits that surface."""
    seed_system_settings(cat_session)
    owner = _testee(cat_session, email="owner@kbc.com")
    admin = _admin(cat_session)
    test = _frozen_test(cat_session)
    q = _q(
        cat_session,
        test.id,
        QuestionType.true_false,
        {"prompt": "p", "correct": True},
    )
    started = _start(cat_client, owner, test.id)
    _autosave(cat_client, owner, started["id"], str(q.id), {"answer": True})
    _submit(cat_client, owner, started["id"])

    r = cat_client.get(f"/v1/attempts/{started['id']}/export.pdf", headers=bearer(admin))
    assert r.status_code == 200, r.text
    assert r.content.startswith(b"%PDF-")


def test_pdf_export_422_for_unsubmitted_attempt(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """An in-progress attempt has no result to render. The endpoint
    rejects with the typed ``attempt_not_submitted`` envelope (not 404
    — the attempt exists, the action is just not yet meaningful)."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_test(cat_session)
    _q(
        cat_session,
        test.id,
        QuestionType.true_false,
        {"prompt": "p", "correct": True},
    )
    started = _start(cat_client, t, test.id)
    # No submit — attempt stays open.

    r = cat_client.get(f"/v1/attempts/{started['id']}/export.pdf", headers=bearer(t))
    assert r.status_code == 422
    body = r.json()
    assert body["error"]["code"] == "attempt_not_submitted"


def test_pdf_export_404_for_missing_attempt(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """Unknown UUID returns the standard 404 ``not_found`` envelope
    from the shared ``_load`` helper — same surface every other
    attempt endpoint uses."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    r = cat_client.get(f"/v1/attempts/{uuid.uuid4()}/export.pdf", headers=bearer(t))
    assert r.status_code == 404


def test_pdf_export_multi_question_attempt_renders_each_question(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """Attempt with multiple questions produces a PDF that grows with
    the question count — coarse smoke that the per-question table
    expands rather than truncating to one row."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_test(cat_session)
    questions = [
        _q(
            cat_session,
            test.id,
            QuestionType.true_false,
            {"prompt": f"Statement {i} is true.", "correct": True},
        )
        for i in range(4)
    ]
    started = _start(cat_client, t, test.id)
    for q in questions:
        _autosave(cat_client, t, started["id"], str(q.id), {"answer": True})
    _submit(cat_client, t, started["id"])

    r_one = cat_client.get(f"/v1/attempts/{started['id']}/export.pdf", headers=bearer(t))
    assert r_one.status_code == 200
    size_four_q = len(r_one.content)

    # A second smaller attempt as a comparison floor — a single-Q PDF
    # should be smaller than a four-Q PDF. The size difference is
    # modest (tens of bytes) but real and stable across runs.
    t2 = _testee(cat_session, email="other@kbc.com")
    test2 = _frozen_test(cat_session)
    q = _q(
        cat_session,
        test2.id,
        QuestionType.true_false,
        {"prompt": "Solo.", "correct": True},
    )
    started2 = _start(cat_client, t2, test2.id)
    _autosave(cat_client, t2, started2["id"], str(q.id), {"answer": True})
    _submit(cat_client, t2, started2["id"])
    r_two = cat_client.get(
        f"/v1/attempts/{started2['id']}/export.pdf", headers=bearer(t2)
    )
    assert r_two.status_code == 200
    assert size_four_q > len(r_two.content)


def test_pdf_export_unauthenticated_returns_401(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """No bearer token → the standard 401 ``not_authenticated`` shape
    from ``get_current_user`` (transitively required by
    ``get_privacy_acked_user``)."""
    seed_system_settings(cat_session)
    r = cat_client.get(f"/v1/attempts/{uuid.uuid4()}/export.pdf")
    assert r.status_code == 401


def test_pdf_export_escapes_xml_special_chars_in_prompt_and_test_name(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """A test name and a question prompt carrying ``<``, ``>``, ``&``
    must NOT crash the ReportLab ``Paragraph`` parser (which interprets
    a subset of XML/HTML markup). The renderer escapes via
    ``reportlab.lib.utils.escapeOnce`` (Gitar PR-#24 Slice 1 finding
    #1; CVE-2023-33733 class). Regression: without the escape, the
    request 500s or worse."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    # Construct a test with XML-special chars in the name.
    test = Test(
        tenant_id=SEED_TENANT_ID,
        name="Maths & symbols <test>",
        mode=TestMode.frozen,
        status=TestStatus.published,
        visibility=TestVisibility.library,
        timed=False,
        timeout_behaviour=TimeoutBehaviour.auto_submit,
        max_pause_duration_minutes=30,
        target_difficulty=5,
        randomise_question_order=True,
        randomise_option_order=True,
        pass_threshold=0.5,
    )
    cat_session.add(test)
    q = _q(
        cat_session,
        test.id,
        QuestionType.true_false,
        # Prompt contains XML-special tokens: ``<``, ``>``, ``&``.
        {"prompt": "Is x < 5 && y > 3 always true?", "correct": False},
    )
    started = _start(cat_client, t, test.id)
    _autosave(cat_client, t, started["id"], str(q.id), {"answer": False})
    _submit(cat_client, t, started["id"])

    r = cat_client.get(f"/v1/attempts/{started['id']}/export.pdf", headers=bearer(t))
    assert r.status_code == 200, r.text
    assert r.content.startswith(b"%PDF-")
