"use client";

/**
 * SSE adapter for ``GET /v1/attempts/{id}/stream`` (AC-CD22 / FE-5 §B.2).
 *
 * Uses fetch streaming (not the browser's ``EventSource``) so the
 * ``Authorization`` header can carry the bearer token — ``EventSource``
 * only supports cookies / URL-bound auth, which we explicitly rule out
 * per AC-CD22.
 *
 * Returns ``{ events, close }``. ``events`` is an async iterable that
 * yields typed ``StreamEvent`` values in arrival order; ``close()``
 * aborts the in-flight fetch and exits the iterator cleanly (no throw).
 *
 * Event shape (anchored against backend reality per ``app/routers/
 * attempts.py``):
 *
 *   - Question events use the default ``message`` event (no ``event:``
 *     line). The payload is identifying-only:
 *     ``{id, attempt_position, attempt_id}``. The consumer
 *     (``useStreamingQueue``) follows up with a
 *     ``GET /v1/attempts/{id}`` refetch to pick up the full question
 *     content.
 *   - Terminals use explicit ``event:`` headers: ``event: done``
 *     (payload ``{completed_positions, replayed_positions}``) and
 *     ``event: paused`` (payload
 *     ``{reason: "generation_failed", failed_position, completed_positions}``).
 *
 * Cursor + resume:
 *
 *   - On the first connect, ``opts.since`` (``?since=N`` query) wins
 *     over ``opts.lastEventId`` (``Last-Event-ID`` header). If neither
 *     is set, no cursor is sent (backend default).
 *   - On a mid-stream error (network drop, server 5xx after headers,
 *     unexpected EOF), the adapter reconnects ONCE with
 *     ``Last-Event-ID`` set to the highest received SSE id (which
 *     equals the highest received ``attempt_position`` — backend keeps
 *     the two aligned per ``_format_sse_event``).
 *   - On a second failure, the adapter yields a synthetic
 *     ``{kind: "paused", reason: "reconnect_exhausted", ...}`` event
 *     and returns. The attempt is NOT marked paused server-side in
 *     this case (the backend doesn't know the adapter died).
 *
 * Error surface:
 *
 *   - On 4xx / 5xx response status before any event arrives (e.g.
 *     ``409 not_per_testee``), the iterator throws ``ApiError`` on
 *     ``.next()`` — same envelope shape consumers see from
 *     ``client.GET`` via ``unwrap``.
 *   - Network errors before any event arrives are retried once; if the
 *     retry also fails, the iterator yields a synthetic ``paused``
 *     event with ``reason: "reconnect_exhausted"`` and returns.
 *
 * Token refresh: cannot be performed on the live SSE connection (the
 * headers are pinned at fetch time). If the access token expires
 * mid-stream the next reconnect picks up the fresh token via
 * ``getAccessToken()``. v1 acceptable trade per AC-CD22.
 */

import { apiErrorFromBody } from "@/lib/api/errors";
import { getApiBaseUrl } from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/storage";

export type QuestionStreamEvent = {
  kind: "question";
  id: string;
  attempt_position: number;
  attempt_id: string;
};

export type DoneStreamEvent = {
  kind: "done";
  completed_positions: number[];
  replayed_positions: number[];
};

export type PausedReason = "generation_failed" | "reconnect_exhausted";

export type PausedStreamEvent = {
  kind: "paused";
  reason: PausedReason;
  failed_position: number | null;
  completed_positions: number[];
};

export type StreamEvent = QuestionStreamEvent | DoneStreamEvent | PausedStreamEvent;

export type StreamOpts = {
  /** ``?since=N`` query — takes precedence over ``lastEventId`` on the
   * first connect. Always sent as a literal integer. */
  since?: number;
  /** ``Last-Event-ID`` header — used only if ``since`` is undefined on
   * the first connect. */
  lastEventId?: string;
};

export type AttemptStream = {
  events: AsyncIterable<StreamEvent>;
  close: () => void;
};

/**
 * Parsed raw SSE frame fields. Internal to the adapter; exported for
 * the parser unit tests.
 */
export type SseFrame = {
  id: string | null;
  event: string | null;
  data: string;
};

const DATA_FIELD = "data";
const ID_FIELD = "id";
const EVENT_FIELD = "event";

/**
 * Parse a buffer of SSE-protocol bytes into complete frames plus a
 * residual unterminated tail. Pure: takes the accumulated buffer,
 * returns ``{frames, residual}`` so the caller can re-feed
 * ``residual + nextChunk`` on the next read.
 *
 * Approach: split on the canonical SSE frame terminator (a blank
 * line — ``\n\n`` after CR / CRLF normalisation). Anything after the
 * last terminator is residual, including a partial frame whose own
 * lines are partly parsed — they get re-parsed when the next chunk
 * arrives. Per-line state is therefore never split across calls.
 *
 * Protocol nuances (per the WHATWG EventSource spec):
 *
 *   - Lines may be terminated with ``\n``, ``\r\n``, or ``\r``;
 *     normalised to ``\n`` internally.
 *   - A blank line dispatches the current frame.
 *   - ``id:``, ``event:``, ``data:`` set the respective fields.
 *   - Multiple ``data:`` lines concatenate with ``\n`` between values.
 *   - Lines beginning with ``:`` are comments — ignored.
 *   - A single leading space after the colon is stripped (per spec).
 *   - Lines with no colon are treated as the field name with empty
 *     value (per spec; not exercised by our backend but kept for
 *     conformance).
 *   - Unknown fields are ignored.
 *   - A frame is only emitted if it carries at least one
 *     non-comment field (an empty stretch of blank lines does not
 *     emit an empty frame).
 */
export function parseSseFrames(buffer: string): {
  frames: SseFrame[];
  residual: string;
} {
  const normalised = buffer.replace(/\r\n|\r/g, "\n");
  const frames: SseFrame[] = [];

  let cursor = 0;
  while (cursor < normalised.length) {
    const sepIdx = normalised.indexOf("\n\n", cursor);
    if (sepIdx === -1) break;
    const frameText = normalised.slice(cursor, sepIdx);
    cursor = sepIdx + 2;
    const frame = parseSingleFrame(frameText);
    if (frame !== null) frames.push(frame);
  }

  return { frames, residual: normalised.slice(cursor) };
}

function parseSingleFrame(text: string): SseFrame | null {
  if (text.length === 0) return null;
  let id: string | null = null;
  let event: string | null = null;
  const dataParts: string[] = [];
  let hasContent = false;

  for (const line of text.split("\n")) {
    if (line.length === 0) continue;
    if (line.startsWith(":")) continue;

    const colonIdx = line.indexOf(":");
    const field = colonIdx === -1 ? line : line.slice(0, colonIdx);
    let value = colonIdx === -1 ? "" : line.slice(colonIdx + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === ID_FIELD) {
      id = value;
      hasContent = true;
    } else if (field === EVENT_FIELD) {
      event = value;
      hasContent = true;
    } else if (field === DATA_FIELD) {
      dataParts.push(value);
      hasContent = true;
    }
  }

  if (!hasContent) return null;
  return { id, event, data: dataParts.join("\n") };
}

function frameToEvent(frame: SseFrame, attemptIdFallback: string): StreamEvent | null {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(frame.data) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (frame.event === "done") {
    return {
      kind: "done",
      completed_positions: extractIntArray(payload.completed_positions),
      replayed_positions: extractIntArray(payload.replayed_positions),
    };
  }

  if (frame.event === "paused") {
    return {
      kind: "paused",
      reason: "generation_failed",
      failed_position:
        typeof payload.failed_position === "number" ? payload.failed_position : null,
      completed_positions: extractIntArray(payload.completed_positions),
    };
  }

  // Default ``message`` event — question.
  const attempt_position =
    typeof payload.attempt_position === "number" ? payload.attempt_position : -1;
  if (attempt_position < 0) return null;

  return {
    kind: "question",
    id: typeof payload.id === "string" ? payload.id : "",
    attempt_position,
    attempt_id:
      typeof payload.attempt_id === "string" ? payload.attempt_id : attemptIdFallback,
  };
}

function extractIntArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const out: number[] = [];
  for (const v of value) {
    if (typeof v === "number" && Number.isFinite(v)) out.push(v);
  }
  return out;
}

function syntheticReconnectExhausted(arrived: Set<number>): PausedStreamEvent {
  return {
    kind: "paused",
    reason: "reconnect_exhausted",
    failed_position: null,
    completed_positions: [...arrived].sort((a, b) => a - b),
  };
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

export function openAttemptStream(attemptId: string, opts?: StreamOpts): AttemptStream {
  const abortController = new AbortController();
  let closed = false;

  async function* generator(): AsyncGenerator<StreamEvent, void, void> {
    const arrivedSet = new Set<number>();
    let lastReceivedId: string | null = null;
    let receivedAnyEvent = false;
    let attemptCount = 0;

    while (!closed) {
      attemptCount += 1;
      const isReconnect = attemptCount > 1;

      const url = new URL(
        `${getApiBaseUrl()}/v1/attempts/${encodeURIComponent(attemptId)}/stream`,
      );
      const headers: Record<string, string> = { Accept: "text/event-stream" };
      const token = getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;

      if (isReconnect && receivedAnyEvent && lastReceivedId !== null) {
        headers["Last-Event-ID"] = lastReceivedId;
      } else if (opts?.since !== undefined) {
        url.searchParams.set("since", String(opts.since));
      } else if (opts?.lastEventId !== undefined) {
        headers["Last-Event-ID"] = opts.lastEventId;
      }

      let response: Response;
      try {
        response = await fetch(url.toString(), {
          method: "GET",
          headers,
          signal: abortController.signal,
        });
      } catch (err) {
        if (closed || isAbortError(err)) return;
        if (attemptCount >= 2) {
          yield syntheticReconnectExhausted(arrivedSet);
          return;
        }
        continue;
      }

      if (!response.ok) {
        let body: unknown = null;
        try {
          body = await response.json();
        } catch {
          /* no body or non-JSON; envelope falls through to ``unknown`` */
        }
        throw apiErrorFromBody(
          response.status,
          response.statusText,
          body,
          response.headers.get("x-acumen-trace"),
        );
      }

      if (!response.body) {
        if (attemptCount >= 2) {
          yield syntheticReconnectExhausted(arrivedSet);
          return;
        }
        continue;
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let streamErrored = false;
      let streamEndedClean = false;

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            streamEndedClean = true;
            break;
          }
          buffer += value ?? "";
          const { frames, residual } = parseSseFrames(buffer);
          buffer = residual;
          for (const frame of frames) {
            const event = frameToEvent(frame, attemptId);
            if (!event) continue;
            if (event.kind === "question") {
              receivedAnyEvent = true;
              arrivedSet.add(event.attempt_position);
              lastReceivedId =
                frame.id !== null ? frame.id : String(event.attempt_position);
            }
            yield event;
            // ``close()`` may have been called while parked on the
            // yield — exit cleanly without consuming more chunks.
            if (closed) return;
            if (event.kind === "done" || event.kind === "paused") return;
          }
        }
      } catch (err) {
        if (closed || isAbortError(err)) return;
        streamErrored = true;
      } finally {
        try {
          reader.releaseLock();
        } catch {
          /* already released */
        }
      }

      // Stream ended without an explicit ``done`` / ``paused`` —
      // treat as a recoverable error subject to the one-reconnect
      // budget. Backend always emits a terminal so this only fires
      // on real network drops or partial response truncation.
      if (streamErrored || streamEndedClean) {
        if (attemptCount >= 2) {
          yield syntheticReconnectExhausted(arrivedSet);
          return;
        }
        continue;
      }
    }
  }

  return {
    events: generator(),
    close: () => {
      closed = true;
      abortController.abort();
    },
  };
}
