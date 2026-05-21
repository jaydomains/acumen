"""JIT streaming orchestrator (AC-D25 v1.8 / AC-CD10 v1.8 / §10).

Per-Testee Q1 generates synchronously inside ``start_attempt``
(``app/domain/attempts.py``); Q2..N stream as concurrent in-process
``asyncio`` tasks under an ``asyncio.Semaphore`` (bound
``Settings.jit_buffer_size``, env-default 3; ceiling
``Settings.jit_buffer_max``, env-default 5) inside the SSE response
handler (``app/routers/attempts.py``). Each per-question call writes
its own 1:1 ``record_provenance`` row (P10 retires the
``record_provenance_share`` 1:N shape for streamed generation);
positions are reserved at enqueue time so streamed-arrival order is
stable regardless of which task resolves first; on a Q-N task's second
failure (one orchestration-layer retry above tenacity's HTTP retries
in ``app/ai/anthropic.py::_invoke``) the attempt pauses via
``pause_attempt(system=True, reason=PAUSE_REASON_GENERATION_FAILED)``
and the SSE handler closes after in-flight shielded children persist
within ``Settings.jit_persist_grace_seconds``.

This Slice 1 module ships the typed contracts only — ``GenerationSlot``
+ ``GenerationStatus`` + ``OrchestratorResult`` — so Slice 2's
``stream_attempt_questions`` / ``_generate_position`` signatures are
pre-reviewable. No orchestration logic here; Slice 2 fills it in.
"""

from __future__ import annotations

import enum
import uuid
from dataclasses import dataclass


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
