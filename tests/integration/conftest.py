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
    async def _override() -> AsyncIterator[CatalogueFakeSession]:
        yield cat_session

    app.dependency_overrides[get_db] = _override
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

    async def generate(self, operation: Any, payload: dict[str, Any]) -> Any:
        self.calls.append(("generate", operation, dict(payload)))
        return self._result(self.responses.get(operation, {}))

    async def grade(self, operation: Any, payload: dict[str, Any]) -> Any:
        self.calls.append(("grade", operation, dict(payload)))
        # Sensible default if the test didn't register a grading response.
        default = {"score": 1.0, "verdict": "full", "reasoning": "recording-default"}
        return self._result(self.responses.get(operation, default))

    async def review(self, operation: Any, payload: dict[str, Any]) -> Any:
        self.calls.append(("review", operation, dict(payload)))
        default = {"verdict": "confirmed", "reasoning": "recording-default"}
        return self._result(self.responses.get(operation, default))

    async def embed(self, operation: Any, text: str) -> Any:
        from app.ai.provider import EmbedResult as _EmbedResult

        self.calls.append(("embed", operation, {"text": text}))
        return _EmbedResult(
            embedding=[0.0] * 1536,
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
