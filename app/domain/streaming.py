"""JIT streaming orchestrator (AC-D25 v1.8 / AC-CD10 v1.8 / §10).

Per-Testee Q1 generates synchronously inside ``start_attempt``
(``app/domain/attempts.py``); Q2..N stream as concurrent in-process
``asyncio`` tasks under an ``asyncio.Semaphore`` (bound
``Settings.jit_buffer_size``, env-default 3; ceiling
``Settings.jit_buffer_max``, env-default 5) inside the SSE response
handler (``app/routers/attempts.py``, Slice 4). Each per-question call
writes its own 1:1 ``record_provenance`` row (P10 retires the
``record_provenance_share`` 1:N shape for streamed generation);
positions are reserved at enqueue time so streamed-arrival order is
stable regardless of which task resolves first; on a Q-N task's second
failure (one orchestration-layer retry above tenacity's HTTP retries
in ``app/ai/anthropic.py::_invoke``) the attempt pauses via
``pause_attempt(system=True, reason=PAUSE_REASON_GENERATION_FAILED)``
and the SSE handler closes after in-flight tasks persist within
``Settings.jit_persist_grace_seconds``.

Slice 2 ships the pure-async orchestrator + per-task body. Slice 3
wires it into ``start_attempt``'s per-Testee branch. Slice 4 surfaces
it through the SSE endpoint.
"""

from __future__ import annotations

import asyncio
import enum
import logging
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass
from typing import Any

from app.ai.provider import AIProvider, Operation
from app.models import Question, QuestionType

_log = logging.getLogger(__name__)


class GenerationStatus(enum.Enum):
    """Lifecycle of a single per-Testee Q-N slot under
    ``asyncio.gather``. ``pending`` = enqueued, semaphore not yet
    acquired; ``in_flight`` = provider call in progress (possibly the
    second orchestration-layer attempt); ``done`` = persisted with
    ``attempt_position``; ``failed`` = both attempts raised (the
    orchestrator transitions the attempt to ``paused`` and re-raises).
    """

    pending = "pending"
    in_flight = "in_flight"
    done = "done"
    failed = "failed"


@dataclass(slots=True)
class GenerationSlot:
    """A single per-Testee Q-N slot, position-reserved at enqueue time."""

    attempt_id: uuid.UUID
    position: int
    status: GenerationStatus = GenerationStatus.pending
    question_id: uuid.UUID | None = None
    error: str | None = None


@dataclass(slots=True)
class OrchestratorResult:
    """Terminal state of one ``stream_attempt_questions`` invocation.

    ``completed_positions`` is the ``attempt_position`` set that
    persisted during this invocation (does NOT include positions
    replayed from prior SSE openings). ``paused`` is true when a Q-N
    failure exhausted the single orchestration-layer retry and
    triggered ``pause_attempt(system=True)``; the SSE handler emits a
    terminal ``event: paused`` and closes.
    """

    completed_positions: list[int]
    paused: bool
    pause_reason: str | None = None


class GenerationFailedError(RuntimeError):
    """A Q-N generation failed after the single orchestration-layer
    retry. Raised by ``stream_attempt_questions`` after it pauses the
    attempt via the AC-D11 system path. Carries the failing position
    and the set of positions that persisted before the pause took
    effect so the SSE handler can emit a structured terminal event."""

    def __init__(
        self,
        *,
        position: int,
        reason: str,
        completed_positions: list[int],
    ) -> None:
        super().__init__(
            f"Q{position} generation failed after orchestration-layer retry "
            f"({reason}); {len(completed_positions)} positions persisted "
            "before pause."
        )
        self.position = position
        self.reason = reason
        self.completed_positions = completed_positions


# Type aliases for the per-task session factory the orchestrator depends
# on (parameterised so tests inject a fake while production uses
# ``async_sessionmaker(engine)`` from ``app.models``).
SessionFactory = Callable[[], AbstractAsyncContextManager[Any]]
# Hook for AC-D11 system pause invocation; parameterised so the
# orchestrator's pause path is decoupled from the attempts module's
# import graph (matches the existing pattern of routers importing
# attempt_domain as a module, not pulling the function across). The
# implementation (in ``app/domain/attempts.py``, wired in Slice 3 / 4)
# opens its own session, loads the Attempt + Test, and invokes
# ``pause_attempt(..., system=True, reason=reason)``.
PauseFn = Callable[[uuid.UUID, str], Awaitable[None]]


async def _generate_position(
    *,
    attempt_id: uuid.UUID,
    tenant_id: uuid.UUID,
    position: int,
    payload: dict[str, Any],
    provider: AIProvider,
    semaphore: asyncio.Semaphore,
    session_factory: SessionFactory,
) -> GenerationSlot:
    """Per-Q-N task body. Acquires the semaphore, runs the
    orchestration-layer single-retry loop, and on success persists a
    ``Question`` row with the pre-assigned ``attempt_position`` + 1:1
    ``record_provenance``. Returns a ``GenerationSlot`` reflecting the
    terminal status of this slot only — the orchestrator decides
    whether the failure escalates to an attempt-level pause.

    The session is checked out from ``session_factory`` so it survives
    the SSE handler's request-scope close on disconnect: a Q-N task
    that started before the disconnect persists its row before the
    orchestrator's grace-window expiry, preserving partial progress.
    """
    # Late import to avoid circular import between
    # ``app.domain.streaming`` and ``app.domain.attempts``.
    from app.ai.cost import record_provenance

    slot = GenerationSlot(
        attempt_id=attempt_id,
        position=position,
        status=GenerationStatus.pending,
    )
    async with semaphore:
        slot.status = GenerationStatus.in_flight
        last_error: Exception | None = None
        for attempt_no in (1, 2):
            try:
                gen_result = await provider.generate(Operation.generation, payload)
                spec = _extract_single_question_spec(gen_result.content)
                question = Question(
                    tenant_id=tenant_id,
                    attempt_id=attempt_id,
                    type=QuestionType(spec["type"]),
                    config=spec["config"],
                    assigned_difficulty=spec["assigned_difficulty"],
                    realism_flag_count=0,
                    attempt_position=position,
                )
                record_provenance(question, gen_result)
                # Shield the persistence step from outer cancellation so
                # an SSE disconnect mid-commit does not lose work the
                # provider has already paid for. The shielded inner
                # commits to its own short-lived session (from
                # session_factory) and the row survives in the DB;
                # reconnect replays it. Without the shield, a cancel
                # arriving between ``sess.add`` and ``sess.commit``
                # would roll back the partial work and the position
                # would be re-orchestrated needlessly on the next SSE
                # open (Gitar PR-#23 Slice 2 finding #1 root cause —
                # the orchestrator's cancellation contract relies on
                # in-flight persistence surviving disconnect).
                await asyncio.shield(_persist_question(session_factory, question))
                slot.question_id = question.id
                slot.status = GenerationStatus.done
                return slot
            except Exception as exc:  # noqa: BLE001 — orchestrator policy
                last_error = exc
                if attempt_no == 1:
                    _log.info(
                        "JIT Q%s generation failed (attempt 1/2); retrying once",
                        position,
                        extra={"attempt_id": str(attempt_id), "position": position},
                    )
                    continue
                # attempt_no == 2 — second failure; surface to orchestrator.
                _log.warning(
                    "JIT Q%s generation failed after orchestration-layer retry",
                    position,
                    extra={
                        "attempt_id": str(attempt_id),
                        "position": position,
                        "error": str(exc),
                    },
                )
        slot.status = GenerationStatus.failed
        slot.error = str(last_error) if last_error is not None else "unknown"
        return slot


async def _persist_question(session_factory: SessionFactory, question: Question) -> None:
    """Open a fresh session, add the Question row, commit. Factored
    out as a separate coroutine so ``asyncio.shield`` can wrap the
    full add+commit sequence as one atomic unit — wrapping just
    ``sess.commit()`` would still leave a cancel-window between
    ``sess.add`` and ``commit``."""
    async with session_factory() as sess:
        sess.add(question)
        await sess.commit()


def _extract_single_question_spec(content: dict[str, Any]) -> dict[str, Any]:
    """Per-question call pattern (SPEC §6.1 v1.8): each generation call
    requests ``question_count=1`` and returns one question in the
    ``questions`` array. Defensive parse: missing keys / wrong types
    raise so the orchestrator's retry loop catches and either retries
    once or pauses the attempt. The whole-batch defensive skipping the
    pre-P10 ``start_attempt`` per_testee branch used is wrong here —
    per-question, a malformed spec IS the call failure."""
    questions = content.get("questions") or []
    if not questions:
        raise ValueError("provider returned no questions")
    spec = questions[0]
    if not isinstance(spec, dict):
        raise TypeError(f"expected question spec dict, got {type(spec).__name__}")
    for key in ("type", "config", "assigned_difficulty"):
        if key not in spec:
            raise KeyError(f"question spec missing required key: {key}")
    return spec


async def stream_attempt_questions(
    *,
    attempt_id: uuid.UUID,
    tenant_id: uuid.UUID,
    positions: list[int],
    payload_base: dict[str, Any],
    provider: AIProvider,
    semaphore: asyncio.Semaphore,
    session_factory: SessionFactory,
    pause_fn: PauseFn,
    grace_seconds: float = 10.0,
) -> AsyncIterator[GenerationSlot]:
    """Stream completed Q-N slots as concurrent in-process generation
    tasks resolve. Yields each successful slot; raises
    :class:`GenerationFailedError` after pausing the attempt when a
    Q-N task exhausts its single orchestration-layer retry.

    ``positions`` is the unfilled-position set the SSE handler computes
    by scanning persisted ``Question.attempt_position`` rows; the
    orchestrator never recomputes it from the DB so the assignment is
    deterministic and race-free.

    ``payload_base`` is the shared per-question payload (test_name,
    target_difficulty, rag_context, low_realism_negative_examples,
    attempt_id) — the orchestrator clones it and stamps
    ``question_count=1`` per call. The shared RAG context + low-realism
    examples are computed once at attempt start per SPEC §6.1 v1.8 and
    are reused unchanged across the per-question calls.

    On client disconnect (the SSE handler's request task cancels), the
    generator's ``finally`` clause waits up to ``grace_seconds`` for
    in-flight tasks to commit before propagating ``CancelledError`` —
    Question rows persisted within the grace survive in the DB and
    replay on the next SSE open. Tasks still running beyond the grace
    are cancelled and their work is lost (the position simply remains
    unfilled; the next SSE open re-orchestrates it).

    On a per-task failure (the slot returns ``status=failed`` after the
    retry), pending tasks complete within the grace and then the
    orchestrator pauses the attempt via the AC-D11 system path and
    raises ``GenerationFailedError``.
    """
    per_question_payload = {**payload_base, "question_count": 1}

    tasks: dict[asyncio.Task[GenerationSlot], int] = {
        asyncio.create_task(
            _generate_position(
                attempt_id=attempt_id,
                tenant_id=tenant_id,
                position=pos,
                payload=per_question_payload,
                provider=provider,
                semaphore=semaphore,
                session_factory=session_factory,
            ),
            name=f"jit-q{pos}",
        ): pos
        for pos in positions
    }
    pending: set[asyncio.Task[GenerationSlot]] = set(tasks.keys())
    completed_positions: list[int] = []
    failed_slot: GenerationSlot | None = None

    try:
        while pending and failed_slot is None:
            done_now, pending = await asyncio.wait(
                pending, return_when=asyncio.FIRST_COMPLETED
            )
            for task in done_now:
                slot = task.result()
                if slot.status == GenerationStatus.failed:
                    failed_slot = slot
                    # Don't yield the failed slot; the orchestrator
                    # signals failure via the raised exception so the
                    # SSE handler emits a structured ``paused`` event
                    # rather than a partial ``slot_done(failed)`` event.
                    continue
                completed_positions.append(slot.position)
                yield slot
    finally:
        # Either the consumer (SSE handler) stopped iterating (normal
        # disconnect or pause path), or we broke out on failure. Wait
        # for pending tasks to finish persisting within the grace
        # window — we do NOT cancel them up front because they own
        # their own per-task sessions and must commit to preserve
        # partial progress. Anything still running beyond the grace
        # is cancelled and its work is lost (the next SSE open will
        # re-orchestrate the unfilled position).
        #
        # Cancellation correctness (Gitar PR-#23 Slice 2 finding #1):
        # if the outer task is cancelled (SSE disconnect), Python
        # 3.11+ keeps the cancel request "sticky" — the next ``await``
        # in this finally re-raises ``CancelledError`` before the
        # cleanup runs, which would leak ``still_pending`` tasks and
        # produce stray Question rows. ``Task.uncancel()`` clears the
        # request while cleanup runs; the cancellation is restored
        # below so callers (the SSE handler) still see the disconnect.
        if pending:
            current = asyncio.current_task()
            cancellations = current.cancelling() if current is not None else 0
            if cancellations and current is not None:
                for _ in range(cancellations):
                    current.uncancel()
            done_in_grace: set[asyncio.Task[GenerationSlot]] = set()
            still_pending: set[asyncio.Task[GenerationSlot]] = pending
            try:
                done_in_grace, still_pending = await asyncio.wait(
                    pending, timeout=grace_seconds
                )
            except BaseException:  # noqa: BLE001 — incl. CancelledError
                # The cleanup wait was interrupted (e.g. a second
                # cancel arrived after uncancel above). Best-effort:
                # partition pending tasks by current done-state so
                # subsequent code can still account for completions
                # and cancel the rest.
                done_in_grace = {t for t in pending if t.done()}
                still_pending = pending - done_in_grace
            for task in done_in_grace:
                try:
                    slot = task.result()
                except BaseException:  # noqa: BLE001 — incl. CancelledError
                    # A per-task body cancelled externally during the
                    # grace window raises CancelledError from
                    # ``.result()`` — BaseException, not Exception.
                    # Catching the broad class here is intentional:
                    # this is terminal-state aggregation, not an
                    # error path we want to surface.
                    continue
                if slot.status == GenerationStatus.done:
                    completed_positions.append(slot.position)
            for task in still_pending:
                task.cancel()
            if cancellations and current is not None:
                # Restore the suppressed cancellation so the SSE
                # handler still observes the disconnect.
                for _ in range(cancellations):
                    current.cancel()

    if failed_slot is not None:
        # Late import: the constant lives on the attempts module so the
        # vocabulary stays single-sourced. Streaming carries the
        # pause-trigger; attempts owns the reason values.
        from app.domain.attempts import PAUSE_REASON_GENERATION_FAILED

        await pause_fn(attempt_id, PAUSE_REASON_GENERATION_FAILED)
        raise GenerationFailedError(
            position=failed_slot.position,
            reason=PAUSE_REASON_GENERATION_FAILED,
            completed_positions=sorted(completed_positions),
        )
