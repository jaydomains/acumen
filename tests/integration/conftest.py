"""P2 integration harness — zero-DB, zero-network (AC-CD15).

A minimal in-memory stand-in for ``AsyncSession`` supporting exactly
the query/mutation surface the auth seam uses (``select(Model).where(
col == value, ...)``, ``add``/``flush``/``commit``/``refresh``). The
``get_db`` dependency is overridden so no engine is ever built and no
socket is opened. SMTP is unconfigured by default, so the seam's
fail-soft capture (``captured_emails``) is the email test seam.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator, Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import permissions as p
from app.main import app
from app.models import AppUser, get_db


class _Result:
    def __init__(self, rows: list[Any]) -> None:
        self._rows = rows

    def scalar_one_or_none(self) -> Any | None:
        if not self._rows:
            return None
        return self._rows[0]

    # ``scalars().all()`` for the admin list-users path (PR closing the
    # pre-frontend API-surface gap). Mirrors the catalogue ``_CatResult``
    # shim; the P2 fake gains it once the auth seam grows a list
    # endpoint. Same equality-only ``where`` parser still applies.
    def scalars(self) -> _Result:
        return self

    def all(self) -> list[Any]:
        return list(self._rows)


class FakeSession:
    """In-memory session keyed by model class."""

    def __init__(self) -> None:
        self.store: dict[type, list[Any]] = {}

    # --- write side ---
    def add(self, obj: Any) -> None:
        if getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()
        now = p.now_utc()
        if getattr(obj, "created_at", None) is None:
            obj.created_at = now
        if getattr(obj, "updated_at", None) is None:
            obj.updated_at = now
        self.store.setdefault(type(obj), []).append(obj)

    async def flush(self) -> None:
        return None

    async def commit(self) -> None:
        return None

    async def refresh(self, obj: Any) -> None:
        return None

    # --- read side ---
    async def execute(self, stmt: Any) -> _Result:
        model = stmt.column_descriptions[0]["entity"]
        clause = stmt.whereclause
        parts = getattr(clause, "clauses", [clause]) if clause is not None else []
        conds = {c.left.key: c.right.value for c in parts}
        rows = [
            r
            for r in self.store.get(model, [])
            if all(getattr(r, k) == v for k, v in conds.items())
        ]
        return _Result(rows)


@pytest.fixture
def session() -> FakeSession:
    return FakeSession()


@pytest.fixture
def client(session: FakeSession) -> Iterator[TestClient]:
    async def _override() -> AsyncIterator[FakeSession]:
        yield session

    app.dependency_overrides[get_db] = _override
    p.clear_captured_emails()
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    p.clear_captured_emails()


def make_user(
    session: FakeSession,
    *,
    email: str,
    role: str,
    password: str | None = None,
    privacy_acked: bool = True,
    deactivated: bool = False,
) -> AppUser:
    """Seed a persisted user directly in the fake store."""
    from app.models import UserStatus

    user = AppUser(
        tenant_id=p.SEED_TENANT_ID,
        email=email,
        name=email.split("@")[0],
        role=role,
        password_hash=(
            p.hash_password(password)
            if password is not None
            else p.UNUSABLE_PASSWORD_HASH
        ),
        status=UserStatus.deactivated if deactivated else UserStatus.active,
    )
    if privacy_acked:
        user.privacy_ack_at = p.now_utc()
    session.add(user)
    return user


def bearer(user: AppUser) -> dict[str, str]:
    token = p.issue_access_token(str(user.id), user.role)
    return {"Authorization": f"Bearer {token}"}


# --- P3 catalogue harness ---------------------------------------------
# The P2 ``FakeSession`` only does ``scalar_one_or_none`` over a single
# equality ``where``. The catalogue domain layer also needs
# ``scalars().all()`` and ``delete()``. ``CatalogueFakeSession`` adds
# exactly that — still equality-only AND ``where`` (the domain layer
# does ordering / filtering / pagination in Python by design), so it
# stays zero-DB / zero-network (AC-CD15). The P2 fake is untouched.


class _CatResult:
    def __init__(self, rows: list[Any]) -> None:
        self._rows = rows

    def scalar_one_or_none(self) -> Any | None:
        return self._rows[0] if self._rows else None

    def scalars(self) -> _CatResult:
        return self

    def all(self) -> list[Any]:
        return list(self._rows)


class CatalogueFakeSession:
    def __init__(self) -> None:
        self.store: dict[type, list[Any]] = {}

    def add(self, obj: Any) -> None:
        if getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()
        now = p.now_utc()
        if getattr(obj, "created_at", None) is None:
            obj.created_at = now
        if getattr(obj, "updated_at", None) is None:
            obj.updated_at = now
        self.store.setdefault(type(obj), []).append(obj)

    async def flush(self) -> None:
        return None

    async def commit(self) -> None:
        return None

    async def refresh(self, obj: Any) -> None:
        return None

    async def rollback(self) -> None:
        # The P4 attempt-start path catches ``IntegrityError`` on the
        # ``(test_id, testee_id, sequence_number)`` unique constraint
        # and rolls back before retrying. The fake is a noop because
        # the retry test inserts/removes the failing row explicitly.
        return None

    async def delete(self, obj: Any) -> None:
        bucket = self.store.get(type(obj), [])
        if obj in bucket:
            bucket.remove(obj)

    async def execute(self, stmt: Any) -> _CatResult:
        model = stmt.column_descriptions[0]["entity"]
        clause = stmt.whereclause
        parts = getattr(clause, "clauses", [clause]) if clause is not None else []
        conds = {c.left.key: c.right.value for c in parts}
        rows = [
            r
            for r in self.store.get(model, [])
            if all(getattr(r, k) == v for k, v in conds.items())
        ]
        return _CatResult(rows)


# v1.3 default safety keyword list (mirrors the ``system_settings``
# server_default seeded by migration 0002).
DEFAULT_SAFETY_KEYWORDS = [
    "lift",
    "scaffold",
    "asbestos",
    "isocyanate",
    "cathodic",
    "confined space",
    "fall",
    "PPE",
    "high voltage",
    "hot work",
    "fire",
    "electrical",
    "hazardous",
    "toxic",
]


def seed_system_settings(
    session: CatalogueFakeSession,
    *,
    safety_keywords: list[str] | None = None,
) -> None:
    from app.models import SystemSettings

    session.add(
        SystemSettings(
            tenant_id=p.SEED_TENANT_ID,
            safety_keyword_list=(
                DEFAULT_SAFETY_KEYWORDS if safety_keywords is None else safety_keywords
            ),
        )
    )


def cat_make_user(session: CatalogueFakeSession, *, email: str, role: str) -> AppUser:
    from app.models import UserStatus

    user = AppUser(
        tenant_id=p.SEED_TENANT_ID,
        email=email,
        name=email.split("@")[0],
        role=role,
        password_hash=p.UNUSABLE_PASSWORD_HASH,
        status=UserStatus.active,
    )
    user.privacy_ack_at = p.now_utc()
    session.add(user)
    return user


@pytest.fixture
def cat_session() -> CatalogueFakeSession:
    return CatalogueFakeSession()


@pytest.fixture
def cat_client(cat_session: CatalogueFakeSession) -> Iterator[TestClient]:
    from contextlib import asynccontextmanager

    from app.routers.attempts import get_jit_session_factory

    async def _override() -> AsyncIterator[CatalogueFakeSession]:
        yield cat_session

    # P10 Slice 4: the SSE handler's per-task session factory is a
    # FastAPI dependency so tests can hand it a CatalogueFakeSession-
    # backed factory (no real Postgres). The factory is callable
    # returning an async context manager — production yields a fresh
    # ``async_sessionmaker`` session; tests yield the shared
    # ``cat_session`` so per-task persistence shows up in the same
    # in-memory store the assertions read.
    def _jit_factory_override() -> object:
        @asynccontextmanager
        async def _ctx() -> AsyncIterator[CatalogueFakeSession]:
            yield cat_session

        return _ctx

    app.dependency_overrides[get_db] = _override
    app.dependency_overrides[get_jit_session_factory] = _jit_factory_override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# --- P5 AI provider harness ------------------------------------------
# ``RecordingProvider`` substitutes the module-level Anthropic + OpenAI
# singletons in ``app.ai.provider`` via monkeypatch. One instance persists
# across every AI call in a test (Slice 3 budget-alert tests depend on
# this state-preservation contract, called out in the Slice 1 plan-
# review). Tests opt in via the ``recording_provider`` fixture; tests
# that don't opt in fall through to the dev/local :class:`StubAIProvider`
# fallback (the production fail-safe path).


class RecordingProvider:
    """In-memory AIProvider stand-in (AC-CD15). Records every call and
    returns canned content per-operation; defaults to a generic
    ``AIResult`` shape when no canned response is registered for the op."""

    name = "recording"

    def __init__(
        self,
        responses: dict[Any, dict[str, Any]] | None = None,
        *,
        provider_label: str = "anthropic",
        model_label: str = "claude-sonnet-4-6",
        prompt_tokens: int = 100,
        completion_tokens: int = 50,
        cost_usd: float = 0.001,
    ) -> None:
        # Imported here so test collection doesn't pay the AnthropicSDK
        # import on conftest load.
        from app.ai.provider import AIResult as _AIResult

        self._AIResult = _AIResult
        self.responses: dict[Any, dict[str, Any]] = dict(responses or {})
        self.provider_label = provider_label
        self.model_label = model_label
        self.prompt_tokens = prompt_tokens
        self.completion_tokens = completion_tokens
        self.cost_usd = cost_usd
        self.calls: list[tuple[str, Any, dict[str, Any]]] = []

    def set_response(self, operation: Any, content: dict[str, Any]) -> None:
        """Register / replace the canned content for an operation."""
        self.responses[operation] = content

    def set_response_fn(self, operation: Any, fn: Any) -> None:
        """Register a callable response for an operation. The callable
        receives the call's payload dict and returns the content dict;
        useful when the response shape depends on the input (e.g. the
        P8 anchor self-review needs the reviewer to echo each item's
        ``anchor_question_id`` per the AC-D23 prompt contract)."""
        self.responses[operation] = fn

    def calls_for(self, operation: Any) -> list[tuple[str, Any, dict[str, Any]]]:
        """All recorded calls for a given operation enum value."""
        return [c for c in self.calls if c[1] == operation]

    def _result(self, content: dict[str, Any]) -> Any:
        return self._AIResult(
            content=content,
            provider=self.provider_label,
            model=self.model_label,
            prompt_version="1.0.0-recording",
            prompt_tokens=self.prompt_tokens,
            completion_tokens=self.completion_tokens,
            cost_usd=self.cost_usd,
        )

    def _resolve_content(
        self, operation: Any, payload: dict[str, Any], default: dict[str, Any]
    ) -> dict[str, Any]:
        """Look up the canned content for ``operation``. If the
        registered value is callable (``set_response_fn``), invoke it
        with the payload to produce the content; otherwise treat it as
        a static dict."""
        cached = self.responses.get(operation, default)
        if callable(cached):
            return cached(payload)
        return cached

    async def generate(self, operation: Any, payload: dict[str, Any]) -> Any:
        self.calls.append(("generate", operation, dict(payload)))
        return self._result(self._resolve_content(operation, payload, {}))

    async def grade(self, operation: Any, payload: dict[str, Any]) -> Any:
        self.calls.append(("grade", operation, dict(payload)))
        # Sensible default if the test didn't register a grading response.
        default = {"score": 1.0, "verdict": "full", "reasoning": "recording-default"}
        return self._result(self._resolve_content(operation, payload, default))

    async def review(self, operation: Any, payload: dict[str, Any]) -> Any:
        self.calls.append(("review", operation, dict(payload)))
        default = {"verdict": "confirmed", "reasoning": "recording-default"}
        return self._result(self._resolve_content(operation, payload, default))

    async def embed(self, operation: Any, text: str) -> Any:
        from app.ai.provider import EmbedResult as _EmbedResult

        self.calls.append(("embed", operation, {"text": text}))
        # Non-zero vector so the Slice 3 cosine ranking actually
        # produces hits in tests — a zero-vector query would
        # short-circuit ``cosine_top_k`` (defensive guard against
        # NaN scores) and tests asserting non-empty rag_context
        # would fail spuriously. ``0.1`` is arbitrary; the only
        # constraint is non-zero so the norm is finite.
        return _EmbedResult(
            embedding=[0.1] * 1536,
            provider=self.provider_label,
            model="text-embedding-3-small",
            prompt_tokens=self.prompt_tokens,
            cost_usd=self.cost_usd,
        )


def _default_recording_responses() -> dict[Any, dict[str, Any]]:
    """Sensible canned responses per operation — tests that need
    different content call ``recording_provider.set_response`` to
    override. Imported lazily to avoid pulling the AI module at
    conftest load time."""
    from app.ai.provider import Operation

    return {
        Operation.generation: {
            "questions": [
                {
                    "type": "multiple_choice",
                    "assigned_difficulty": 5,
                    "config": {
                        "prompt": "What is 2 + 2?",
                        "options": ["3", "4", "5"],
                        "correct": 1,
                    },
                },
                {
                    "type": "short_answer",
                    "assigned_difficulty": 5,
                    "config": {
                        "prompt": "Explain Ohm's Law.",
                        "rubric": "Mentions V = I * R; explains relationship.",
                        "model_answer": "Voltage equals current times resistance.",
                    },
                },
            ]
        },
        Operation.grading: {
            "score": 0.8,
            "verdict": "partial",
            "reasoning": "Partial credit per the rubric.",
        },
        Operation.weakness: {"weak_pills": []},
        Operation.learning_material: {
            "explainer": (
                "Recorded explainer content used by Slice 2 integration "
                "tests; substantive enough to be a meaningful served_text "
                "snapshot for the F18 n-gram overlap path."
            )
        },
        Operation.pill_proposal: {
            "name": "Test Pill",
            "description": "Recorded proposal description.",
            "subject_id": None,
            "available_difficulty_min": 1,
            "available_difficulty_max": 10,
            "estimated_minutes": 30,
            "safety_relevant": False,
            "rationale": "Recorded rationale.",
        },
    }


@pytest.fixture
def recording_provider(monkeypatch: pytest.MonkeyPatch) -> RecordingProvider:
    """Substitute a single :class:`RecordingProvider` for both the
    Anthropic and the OpenAI module-level singletons, AND force both
    API keys non-empty so the resolver returns the substituted instance
    instead of the dev/local ``StubAIProvider`` fallback (which would
    bypass the recorder)."""
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "anthropic_api_key", "test-anthropic-key")
    monkeypatch.setattr(settings, "openai_api_key", "test-openai-key")

    provider = RecordingProvider(responses=_default_recording_responses())
    monkeypatch.setattr("app.ai.provider._ANTHROPIC", provider)
    monkeypatch.setattr("app.ai.provider._OPENAI", provider)
    return provider


# --- P9 Drive RAG harness ---------------------------------------------
# ``_FakeDrive`` substitutes the module-level
# :func:`app.domain.drive_source.get_drive_source` singleton via
# monkeypatch. Tests opt in via the ``fake_drive`` fixture; the
# production seam (``GoogleDriveSource``) is never reached and the
# Drive credentials env var stays unset (AC-CD15 — no network in
# tests). Files are an in-memory ``{file_id: (name, mime_type, text)}``
# dict; tests drive the diff via ``set_file`` / ``delete_file``.


class _FakeDrive:
    """In-memory :class:`~app.domain.drive_source.DriveSource` stand-in.

    Tests register files via ``set_file(file_id, text, ...)`` and
    remove them via ``delete_file(file_id)``; the ingest sweep sees
    exactly the current dict on each ``list_files`` call. ``fail_on``
    lets a test simulate a transient Drive failure for one specific
    file — the ingest sweep's per-file fail-soft path counts that
    file under ``files_failed`` and continues the sweep."""

    def __init__(self) -> None:
        from app.domain.drive_source import DriveFile as _DriveFile

        self._DriveFile = _DriveFile
        # file_id → (name, mime_type, text, modified_time)
        self._files: dict[str, tuple[str, str, str, str]] = {}
        self._fail_on: set[str] = set()
        self.list_calls: int = 0
        self.fetch_calls: list[str] = []

    def set_file(
        self,
        file_id: str,
        *,
        text: str,
        name: str = "doc.txt",
        mime_type: str = "text/plain",
        modified_time: str = "2026-05-21T00:00:00Z",
    ) -> None:
        """Add or replace a file in the fake Drive folder."""
        self._files[file_id] = (name, mime_type, text, modified_time)

    def delete_file(self, file_id: str) -> None:
        """Remove a file from the fake Drive folder — drives the
        deletion arm of :func:`diff_files`."""
        self._files.pop(file_id, None)

    def fail_fetch_for(self, file_id: str) -> None:
        """Configure the fake to raise on ``fetch_text`` for ``file_id``
        — exercises the per-file fail-soft branch in
        :func:`ingest_drive_folder`."""
        self._fail_on.add(file_id)

    async def list_files(self, *, folder_id: str) -> list[Any]:
        self.list_calls += 1
        return [
            self._DriveFile(
                id=fid,
                name=name,
                mime_type=mime_type,
                modified_time=mtime,
            )
            for fid, (name, mime_type, _text, mtime) in self._files.items()
        ]

    async def fetch_text(self, *, file_id: str, mime_type: str) -> str:
        self.fetch_calls.append(file_id)
        if file_id in self._fail_on:
            raise RuntimeError(f"_FakeDrive: simulated fetch failure for {file_id}")
        entry = self._files.get(file_id)
        if entry is None:
            return ""
        return entry[2]


@pytest.fixture
def fake_drive(monkeypatch: pytest.MonkeyPatch) -> _FakeDrive:
    """Substitute the :class:`_FakeDrive` for the module-level
    :func:`app.domain.drive_source.get_drive_source` singleton. Tests
    that drive Drive ingest end-to-end opt in via this fixture; tests
    that don't would fall through to ``GoogleDriveSource`` which would
    crash on the empty credentials env var (AC-CD15 fail-safe — no
    network from test paths)."""
    fake = _FakeDrive()
    monkeypatch.setattr("app.domain.drive_source._GOOGLE_DRIVE", fake)
    return fake


# --- P11 Slice 3 web search harness ----------------------------------
# ``_FakeWebSearch`` substitutes the module-level
# :func:`app.domain.web_search.get_web_search_source` singleton via
# monkeypatch. Tests opt in via the ``fake_web_search`` fixture; the
# production seam (``TavilyWebSearch``) is never reached and the
# Tavily API-key env var stays unset (AC-CD15 — no network in tests).
# Tests register canned results via ``set_results(query, results)`` or
# the catch-all ``set_default_results(results)``.


class _FakeWebSearch:
    """In-memory :class:`~app.domain.web_search.WebSearchSource`
    stand-in. Mirrors the :class:`_FakeDrive` shape (per-query canned
    results + a call log). The ``links_drift_flagged`` /
    ``links_broken_replaced`` paths in
    :func:`~app.domain.safety_links.check_safety_links` exercise the
    same seam by triggering best-effort top-up curation; the fake
    serves the same canned list each time, so the cron test can
    assert deterministic outcomes."""

    def __init__(self) -> None:
        from app.domain.web_search import WebSearchResult as _WebSearchResult

        self._WebSearchResult = _WebSearchResult
        self._per_query: dict[str, list[Any]] = {}
        self._default: list[Any] = []
        self.search_calls: list[tuple[str, int]] = []

    def set_default_results(self, results: list[Any]) -> None:
        """Set the result list returned for any query that lacks a
        specific override. Most tests use only this — the cron and
        curation paths don't care about query specifics, only the
        shape of the response."""
        self._default = list(results)

    def set_results(self, query: str, results: list[Any]) -> None:
        """Override results for an exact-match query string. Used
        when a test exercises the per-query mapping explicitly."""
        self._per_query[query] = list(results)

    def make_result(
        self,
        *,
        url: str,
        title: str = "Reference",
        snippet: str = "",
        source: str = "example.com",
    ) -> Any:
        """Construct a :class:`WebSearchResult` so tests don't need to
        import the dataclass directly."""
        return self._WebSearchResult(url=url, title=title, snippet=snippet, source=source)

    async def search(self, query: str, *, max_results: int = 5) -> list[Any]:
        self.search_calls.append((query, max_results))
        results = self._per_query.get(query, self._default)
        return list(results)[:max_results]


@pytest.fixture
def fake_web_search(monkeypatch: pytest.MonkeyPatch) -> _FakeWebSearch:
    """Substitute the :class:`_FakeWebSearch` for the module-level
    :func:`app.domain.web_search.get_web_search_source` singleton.
    Tests that exercise safety-link curation or the monthly check
    opt in via this fixture; tests that don't would fall through to
    ``TavilyWebSearch`` which would crash on the empty API-key env
    var (AC-CD15 fail-safe — no network from test paths)."""
    fake = _FakeWebSearch()
    monkeypatch.setattr("app.domain.web_search._TAVILY", fake)
    return fake
