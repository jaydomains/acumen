"""P10 / AC-D25 v1.8 / AC-CD10 v1.8 — JIT streaming orchestrator core.

Pure-async unit tests for ``app/domain/streaming.py``: semaphore bounds,
position allocation, the orchestration-layer single-retry-then-AC-D11-
pause path, and the SSE-disconnect grace window. The orchestrator is
parameterised on ``session_factory`` + ``provider`` + ``pause_fn`` so
these tests substitute lightweight in-memory stand-ins; the production
wiring (Slice 3 / 4) hands in ``async_sessionmaker(engine)`` + the
resolved Anthropic provider + an attempts-module pause helper.

Zero-DB / zero-network (AC-CD15) — the socket guard in
``tests/conftest.py`` covers the asyncio coroutines uniformly.
"""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import Any

import pytest

from app.ai.provider import AIResult, Operation
from app.domain.streaming import (
    GenerationFailedError,
    GenerationSlot,
    GenerationStatus,
    stream_attempt_questions,
)
from app.models import Question

# --- fakes ------------------------------------------------------------


@dataclass
class FakeSession:
    """Records ``add`` and ``commit`` calls so tests can assert on
    per-task persistence ordering + 1:1 provenance stamping."""

    added: list[Any] = field(default_factory=list)
    commits: int = 0

    def add(self, obj: Any) -> None:
        self.added.append(obj)

    async def commit(self) -> None:
        self.commits += 1

    async def flush(self) -> None:
        pass


class FakeSessionFactory:
    """Tracks how many sessions were opened so tests can assert one
    session per per-task persistence (load-bearing for the
    request-session-survival contract)."""

    def __init__(self) -> None:
        self.sessions: list[FakeSession] = []

    def __call__(self) -> Any:
        @asynccontextmanager
        async def _ctx() -> AsyncIterator[FakeSession]:
            sess = FakeSession()
            self.sessions.append(sess)
            try:
                yield sess
            finally:
                # No close work — FakeSession is a value object.
                pass

        return _ctx()


@dataclass
class CallRecord:
    operation: Any
    payload: dict[str, Any]


class FakeProvider:
    """In-memory ``AIProvider`` stand-in scoped to streaming tests.

    Distinct from ``tests/integration/conftest.py::RecordingProvider``
    so unit tests don't import the integration conftest's heavier
    fixture surface. Supports per-call timing (await an asyncio.Event)
    + per-call success / failure via a callable factory.
    """

    name = "fake"

    def __init__(
        self,
        *,
        responder: Callable[[dict[str, Any]], Awaitable[dict[str, Any]]] | None = None,
        provider_label: str = "anthropic",
        model_label: str = "claude-sonnet-4-6",
        prompt_tokens: int = 100,
        completion_tokens: int = 50,
        cost_usd: float = 0.001,
    ) -> None:
        self.responder = responder
        self.provider_label = provider_label
        self.model_label = model_label
        self.prompt_tokens = prompt_tokens
        self.completion_tokens = completion_tokens
        self.cost_usd = cost_usd
        self.calls: list[CallRecord] = []
        self._concurrent = 0
        self.max_concurrent = 0

    async def generate(self, operation: Operation, payload: dict[str, Any]) -> AIResult:
        self._concurrent += 1
        self.max_concurrent = max(self.max_concurrent, self._concurrent)
        try:
            self.calls.append(CallRecord(operation, dict(payload)))
            if self.responder is None:
                content = _default_question_payload(payload)
            else:
                content = await self.responder(payload)
            return AIResult(
                content=content,
                provider=self.provider_label,
                model=self.model_label,
                prompt_version="1.0.0-fake",
                prompt_tokens=self.prompt_tokens,
                completion_tokens=self.completion_tokens,
                cost_usd=self.cost_usd,
            )
        finally:
            self._concurrent -= 1

    async def grade(self, operation: Any, payload: dict[str, Any]) -> Any:
        raise NotImplementedError

    async def review(self, operation: Any, payload: dict[str, Any]) -> Any:
        raise NotImplementedError

    async def embed(self, operation: Any, text: str) -> Any:
        raise NotImplementedError


def _default_question_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """One well-formed question; deterministic across the test set."""
    return {
        "questions": [
            {
                "type": "multiple_choice",
                "config": {"prompt": "p", "options": ["a", "b"], "correct": 0},
                "assigned_difficulty": payload.get("target_difficulty", 5),
            }
        ]
    }


class RecordingPauseFn:
    """Captures invocations of the orchestrator's AC-D11 system-pause
    hook so tests can assert "pause fires exactly once after the
    retry exhaustion, with the locked reason"."""

    def __init__(self) -> None:
        self.calls: list[tuple[uuid.UUID, str]] = []

    async def __call__(self, attempt_id: uuid.UUID, reason: str) -> None:
        self.calls.append((attempt_id, reason))


# --- helpers ----------------------------------------------------------


def _payload_base(attempt_id: uuid.UUID) -> dict[str, Any]:
    return {
        "test_name": "T",
        "target_difficulty": 5,
        "attempt_id": str(attempt_id),
        "rag_context": "(none)",
        "low_realism_negative_examples": "(none)",
    }


async def _drain(gen: AsyncIterator[GenerationSlot]) -> list[GenerationSlot]:
    """Consume an orchestrator async generator into a list."""
    return [slot async for slot in gen]


# --- tests ------------------------------------------------------------


async def test_semaphore_bounds_concurrent_provider_calls() -> None:
    """With ``jit_buffer_size=2`` and 5 positions, never more than 2
    provider.generate calls are in flight simultaneously."""
    attempt_id = uuid.uuid4()
    tenant_id = uuid.uuid4()
    semaphore = asyncio.Semaphore(2)

    release = asyncio.Event()

    async def slow_responder(payload: dict[str, Any]) -> dict[str, Any]:
        # Block until release fires; tasks pile up against the
        # semaphore boundary so we can read max_concurrent.
        await release.wait()
        return _default_question_payload(payload)

    provider = FakeProvider(responder=slow_responder)
    factory = FakeSessionFactory()
    pause_fn = RecordingPauseFn()

    consumer = asyncio.create_task(
        _drain(
            stream_attempt_questions(
                attempt_id=attempt_id,
                tenant_id=tenant_id,
                positions=[2, 3, 4, 5, 6],
                payload_base=_payload_base(attempt_id),
                provider=provider,
                semaphore=semaphore,
                session_factory=factory,
                pause_fn=pause_fn,
            )
        )
    )
    # Give the orchestrator + tasks a few event-loop ticks to reach
    # the semaphore.acquire boundary.
    for _ in range(20):
        await asyncio.sleep(0)
    assert provider.max_concurrent == 2
    release.set()
    slots = await consumer
    assert len(slots) == 5
    assert pause_fn.calls == []
    # Higher-water mark is unchanged after release; bound was 2.
    assert provider.max_concurrent == 2


async def test_positions_assigned_at_enqueue_time_never_race() -> None:
    """Each per-task body receives its pre-assigned position; the set
    of persisted positions exactly matches the input set with no
    duplicates and no missing slots."""
    attempt_id = uuid.uuid4()
    tenant_id = uuid.uuid4()
    semaphore = asyncio.Semaphore(3)
    provider = FakeProvider()
    factory = FakeSessionFactory()
    pause_fn = RecordingPauseFn()

    slots = await _drain(
        stream_attempt_questions(
            attempt_id=attempt_id,
            tenant_id=tenant_id,
            positions=[2, 3, 4, 5],
            payload_base=_payload_base(attempt_id),
            provider=provider,
            semaphore=semaphore,
            session_factory=factory,
            pause_fn=pause_fn,
        )
    )
    persisted_positions = {s.position for s in slots}
    assert persisted_positions == {2, 3, 4, 5}
    # Every persisted Question carries the matching attempt_position.
    question_positions = sorted(
        q.attempt_position for sess in factory.sessions for q in sess.added
    )
    assert question_positions == [2, 3, 4, 5]


async def test_orchestration_retry_once_then_success() -> None:
    """A position that fails on the first provider call and succeeds
    on the second resolves to ``done`` — no pause, the SSE handler
    sees the slot exactly once."""
    attempt_id = uuid.uuid4()
    semaphore = asyncio.Semaphore(3)
    pause_fn = RecordingPauseFn()
    factory = FakeSessionFactory()

    call_count = 0

    async def fail_once(payload: dict[str, Any]) -> dict[str, Any]:
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise RuntimeError("transient HTTP 500")
        return _default_question_payload(payload)

    provider = FakeProvider(responder=fail_once)

    slots = await _drain(
        stream_attempt_questions(
            attempt_id=attempt_id,
            tenant_id=uuid.uuid4(),
            positions=[2],
            payload_base=_payload_base(attempt_id),
            provider=provider,
            semaphore=semaphore,
            session_factory=factory,
            pause_fn=pause_fn,
        )
    )
    assert len(slots) == 1
    assert slots[0].status == GenerationStatus.done
    assert call_count == 2  # one retry above tenacity's HTTP retries
    assert pause_fn.calls == []


async def test_failure_after_retry_pauses_attempt_and_raises() -> None:
    """A position that fails on BOTH provider calls (the single
    orchestration-layer retry exhausted) triggers
    ``pause_fn(attempt_id, PAUSE_REASON_GENERATION_FAILED)`` and the
    orchestrator raises ``GenerationFailedError``. Other positions
    that completed before the failure are recorded in the raised
    exception's ``completed_positions`` list."""
    attempt_id = uuid.uuid4()
    semaphore = asyncio.Semaphore(3)
    pause_fn = RecordingPauseFn()
    factory = FakeSessionFactory()

    async def always_fail_position_3(payload: dict[str, Any]) -> dict[str, Any]:
        # The fake's payload carries ``attempt_id`` but not the
        # position — we discriminate by the test_name-style key. For
        # this test, every call fails; only the orchestrator's
        # second-attempt path matters.
        raise RuntimeError("provider down")

    provider = FakeProvider(responder=always_fail_position_3)

    with pytest.raises(GenerationFailedError) as exc:
        await _drain(
            stream_attempt_questions(
                attempt_id=attempt_id,
                tenant_id=uuid.uuid4(),
                positions=[2],
                payload_base=_payload_base(attempt_id),
                provider=provider,
                semaphore=semaphore,
                session_factory=factory,
                pause_fn=pause_fn,
            )
        )
    assert exc.value.position == 2
    assert exc.value.reason == "generation_failed"
    assert len(pause_fn.calls) == 1
    paused_attempt_id, paused_reason = pause_fn.calls[0]
    assert paused_attempt_id == attempt_id
    assert paused_reason == "generation_failed"


async def test_other_in_flight_tasks_persist_before_pause() -> None:
    """Per the v1.8 spec: 'Other in-flight Q-N tasks continue and
    persist their results before the pause takes effect — partial
    progress is preserved.' Position 3 fails twice; positions 2, 4,
    5 succeed. After the orchestrator raises, all three successful
    positions are persisted and recorded in the exception's
    ``completed_positions`` list."""
    attempt_id = uuid.uuid4()
    tenant_id = uuid.uuid4()
    semaphore = asyncio.Semaphore(5)  # all run concurrently
    pause_fn = RecordingPauseFn()
    factory = FakeSessionFactory()

    # Position 3's two-call failure resolves first (no I/O); we gate
    # positions 2/4/5 on a release event so they're guaranteed in
    # flight at the moment the failure surfaces, exercising the
    # "in-flight tasks continue and persist before pause takes effect"
    # contract.
    release = asyncio.Event()
    call_index = 0

    async def per_position(payload: dict[str, Any]) -> dict[str, Any]:
        nonlocal call_index
        call_index += 1
        my_index = call_index
        # The first two calls go to position 3's two attempts (since
        # it has no await before raising, its task wins the semaphore
        # race before the others' await release.wait()).
        if my_index <= 2:
            raise RuntimeError(f"call {my_index} failed")
        await release.wait()
        return _default_question_payload(payload)

    provider = FakeProvider(responder=per_position)

    # Spawn the consumer first.
    consumer = asyncio.create_task(
        _drain(
            stream_attempt_questions(
                attempt_id=attempt_id,
                tenant_id=tenant_id,
                positions=[3, 2, 4, 5],
                payload_base=_payload_base(attempt_id),
                provider=provider,
                semaphore=semaphore,
                session_factory=factory,
                pause_fn=pause_fn,
                grace_seconds=2.0,
            )
        )
    )
    # Yield a few times to let position 3's task fail twice and
    # surface the failure; the other three tasks are blocked on the
    # release event.
    for _ in range(50):
        await asyncio.sleep(0)
    # Now release the in-flight tasks; they persist within the grace
    # window.
    release.set()
    with pytest.raises(GenerationFailedError) as exc:
        await consumer
    # The exception names position 3 as the failure.
    assert exc.value.position == 3
    # ``completed_positions`` includes the three successes that
    # persisted within the grace window.
    assert set(exc.value.completed_positions) == {2, 4, 5}
    # Pause fired exactly once.
    assert len(pause_fn.calls) == 1


async def test_per_task_persists_question_with_attempt_position_and_provenance() -> None:
    """Each completed Q-N writes a ``Question`` with the pre-assigned
    ``attempt_position`` and 1:1 provenance (full per-call cost, not
    the 1:N share the pre-P10 batched path used)."""
    attempt_id = uuid.uuid4()
    tenant_id = uuid.uuid4()
    semaphore = asyncio.Semaphore(2)
    pause_fn = RecordingPauseFn()
    factory = FakeSessionFactory()
    provider = FakeProvider(cost_usd=0.0042, prompt_tokens=200, completion_tokens=80)

    slots = await _drain(
        stream_attempt_questions(
            attempt_id=attempt_id,
            tenant_id=tenant_id,
            positions=[2, 3, 4],
            payload_base=_payload_base(attempt_id),
            provider=provider,
            semaphore=semaphore,
            session_factory=factory,
            pause_fn=pause_fn,
        )
    )
    assert len(slots) == 3

    questions: list[Question] = [
        q for sess in factory.sessions for q in sess.added if isinstance(q, Question)
    ]
    assert len(questions) == 3
    for q in questions:
        assert q.attempt_id == attempt_id
        assert q.tenant_id == tenant_id
        assert q.attempt_position in (2, 3, 4)
        # 1:1 provenance: each Question carries the FULL per-call
        # cost + tokens, not 0.0042/3 / 200/3 / 80/3 (the pre-P10
        # share_count=3 shape).
        assert q.ai_cost_usd == pytest.approx(0.0042)
        assert q.ai_prompt_tokens == 200
        assert q.ai_completion_tokens == 80
        assert q.ai_provider == "anthropic"
        assert q.ai_model == "claude-sonnet-4-6"
        assert q.ai_prompt_version == "1.0.0-fake"


async def test_one_session_per_persistence_for_request_session_survival() -> None:
    """The orchestrator opens a fresh session per per-task persistence
    so the request session's close on SSE disconnect doesn't stall
    in-flight commits. With 4 positions, we expect exactly 4
    session check-outs (no shared session across tasks)."""
    attempt_id = uuid.uuid4()
    semaphore = asyncio.Semaphore(4)
    pause_fn = RecordingPauseFn()
    factory = FakeSessionFactory()
    provider = FakeProvider()

    await _drain(
        stream_attempt_questions(
            attempt_id=attempt_id,
            tenant_id=uuid.uuid4(),
            positions=[2, 3, 4, 5],
            payload_base=_payload_base(attempt_id),
            provider=provider,
            semaphore=semaphore,
            session_factory=factory,
            pause_fn=pause_fn,
        )
    )
    assert len(factory.sessions) == 4
    for sess in factory.sessions:
        assert sess.commits == 1
        assert len(sess.added) == 1


async def test_per_call_question_count_is_1() -> None:
    """SPEC §6.1 v1.8: per-Testee streaming invokes generation
    ``question_count=1`` per call (vs the pre-P10 batched
    ``question_count=N`` shape). The orchestrator stamps the value
    on every per-question payload regardless of what the base
    payload contains."""
    attempt_id = uuid.uuid4()
    semaphore = asyncio.Semaphore(3)
    pause_fn = RecordingPauseFn()
    factory = FakeSessionFactory()
    provider = FakeProvider()

    base = _payload_base(attempt_id)
    # Even if a caller incorrectly includes ``question_count=5`` in
    # the base, the orchestrator overrides to 1 per call.
    base["question_count"] = 5

    await _drain(
        stream_attempt_questions(
            attempt_id=attempt_id,
            tenant_id=uuid.uuid4(),
            positions=[2, 3, 4],
            payload_base=base,
            provider=provider,
            semaphore=semaphore,
            session_factory=factory,
            pause_fn=pause_fn,
        )
    )
    assert len(provider.calls) == 3
    for call in provider.calls:
        assert call.payload["question_count"] == 1


async def test_shared_payload_keys_carry_through_to_each_per_question_call() -> None:
    """The shared RAG context + low-realism examples + test metadata
    flow unchanged into each per-question call (SPEC §6.1 v1.8: the
    shared inputs are computed once at attempt start and reused
    across the per-question calls)."""
    attempt_id = uuid.uuid4()
    semaphore = asyncio.Semaphore(2)
    pause_fn = RecordingPauseFn()
    factory = FakeSessionFactory()
    provider = FakeProvider()

    base = _payload_base(attempt_id)
    base["rag_context"] = "## RAG chunks: [chunk-A]"
    base["low_realism_negative_examples"] = "## Avoid: [example-1]"
    base["test_name"] = "Crane Lift Procedures"

    await _drain(
        stream_attempt_questions(
            attempt_id=attempt_id,
            tenant_id=uuid.uuid4(),
            positions=[2, 3],
            payload_base=base,
            provider=provider,
            semaphore=semaphore,
            session_factory=factory,
            pause_fn=pause_fn,
        )
    )
    for call in provider.calls:
        assert call.payload["rag_context"] == "## RAG chunks: [chunk-A]"
        assert call.payload["low_realism_negative_examples"] == "## Avoid: [example-1]"
        assert call.payload["test_name"] == "Crane Lift Procedures"
        assert call.payload["attempt_id"] == str(attempt_id)


async def test_empty_positions_set_yields_nothing_and_does_not_call_provider() -> None:
    """The SSE handler computes ``positions`` as the unfilled set —
    when every position is already filled (the reconnect-after-full-
    completion case), the orchestrator is a no-op: no provider call,
    no pause, no slot yielded."""
    attempt_id = uuid.uuid4()
    semaphore = asyncio.Semaphore(3)
    pause_fn = RecordingPauseFn()
    factory = FakeSessionFactory()
    provider = FakeProvider()

    slots = await _drain(
        stream_attempt_questions(
            attempt_id=attempt_id,
            tenant_id=uuid.uuid4(),
            positions=[],
            payload_base=_payload_base(attempt_id),
            provider=provider,
            semaphore=semaphore,
            session_factory=factory,
            pause_fn=pause_fn,
        )
    )
    assert slots == []
    assert provider.calls == []
    assert pause_fn.calls == []
    assert factory.sessions == []


async def test_malformed_question_payload_triggers_retry_then_pause() -> None:
    """A provider that returns a non-conforming ``questions`` payload
    (missing required keys) trips the orchestration-layer retry; if
    the second call returns the same shape, the slot fails and the
    attempt pauses. Regression-locks the per-question defensive
    parser at ``_extract_single_question_spec``."""
    attempt_id = uuid.uuid4()
    semaphore = asyncio.Semaphore(2)
    pause_fn = RecordingPauseFn()
    factory = FakeSessionFactory()

    async def always_malformed(payload: dict[str, Any]) -> dict[str, Any]:
        return {"questions": [{"type": "multiple_choice"}]}  # missing keys

    provider = FakeProvider(responder=always_malformed)
    with pytest.raises(GenerationFailedError):
        await _drain(
            stream_attempt_questions(
                attempt_id=attempt_id,
                tenant_id=uuid.uuid4(),
                positions=[2],
                payload_base=_payload_base(attempt_id),
                provider=provider,
                semaphore=semaphore,
                session_factory=factory,
                pause_fn=pause_fn,
            )
        )
    # Two calls: original + one orchestration-layer retry.
    assert len(provider.calls) == 2
    assert len(pause_fn.calls) == 1


async def test_provider_returns_empty_questions_array_treated_as_failure() -> None:
    """``provider.generate`` returning ``{"questions": []}`` is a
    failure case — exercise the parser's empty-array guard."""
    attempt_id = uuid.uuid4()
    semaphore = asyncio.Semaphore(2)
    pause_fn = RecordingPauseFn()
    factory = FakeSessionFactory()

    async def empty(payload: dict[str, Any]) -> dict[str, Any]:
        return {"questions": []}

    provider = FakeProvider(responder=empty)
    with pytest.raises(GenerationFailedError):
        await _drain(
            stream_attempt_questions(
                attempt_id=attempt_id,
                tenant_id=uuid.uuid4(),
                positions=[2],
                payload_base=_payload_base(attempt_id),
                provider=provider,
                semaphore=semaphore,
                session_factory=factory,
                pause_fn=pause_fn,
            )
        )
    assert len(provider.calls) == 2  # original + retry
    assert len(pause_fn.calls) == 1
