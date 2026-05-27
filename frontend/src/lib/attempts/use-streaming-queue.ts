"use client";

/**
 * ``useStreamingQueue`` — the per-Testee runner's SSE consumer
 * (FE-5 §B.1 §4, §C.3 / AC-D25).
 *
 * Wraps ``openAttemptStream`` and exposes a ``StreamingQueueState`` for
 * the JIT queue sidebar + streaming-aware progress dots. The hook does
 * NOT extend ``useAttempt``'s reducer — it runs alongside it and
 * coordinates via the cached AttemptView's ``paused`` / ``pause_reason``
 * flags (read by the consuming component, threaded back in via
 * ``enabled``).
 *
 * Lifecycle:
 *
 *   - Mount with ``enabled === true`` opens the SSE stream with
 *     ``?since=<state.arrivedIdx>`` (initially ``initialArrivedIdx``,
 *     usually 1 because Q1 is sync at POST /v1/attempts time).
 *   - Each question event advances ``arrivedIdx`` AND invalidates
 *     ``attemptQueryKeys.detail(attemptId)`` so the next refetch
 *     populates ``questions[]`` with the newly-persisted positions
 *     (TanStack Query v5 coalesces in-flight refetches — see
 *     FE-5 §C.5).
 *   - The terminal ``done`` event closes the iteration (generator
 *     returns) and invalidates so the final view reflects all
 *     persisted positions.
 *   - The terminal ``paused`` event closes the iteration AND
 *     invalidates the attempt cache (FE-5 plan amendment). When
 *     ``reason === "generation_failed"``, the backend has already
 *     marked the attempt paused, so the next refetched view carries
 *     ``paused: true`` + ``pause_reason: "generation_failed"`` — the
 *     consuming component flips ``enabled`` to false, which tears
 *     down this hook's effect on the next render. When
 *     ``reason === "reconnect_exhausted"`` the attempt is NOT
 *     server-paused; the invalidate is still safe (it just produces
 *     the same view back) and keeps the post-paused state coherent.
 *   - ``enabled === false`` (user-pause, system-pause, submit, route
 *     change, mode mismatch) closes the in-flight stream via
 *     ``AbortController.abort()``; the generator catches the
 *     ``AbortError`` and exits cleanly.
 *
 * Reconnect:
 *
 *   - The adapter itself owns the one-reconnect budget. Consumer-
 *     initiated reconnects (e.g. the system-glitch overlay's "Try
 *     resuming →" CTA) go through ``reconnect()`` which bumps an
 *     internal counter and re-runs the effect with the current
 *     ``state.arrivedIdx`` as the ``?since`` cursor.
 *
 * Returns the state + ``close()`` + ``reconnect()``. The state shape
 * is consumed by both the JIT queue sidebar and the streaming-aware
 * progress dots.
 */

import { useCallback, useEffect, useReducer, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { openAttemptStream, type AttemptStream, type PausedReason } from "@/lib/api/sse";
import { attemptQueryKeys } from "@/lib/queries/attempts";

export type StreamStatus =
  | "idle"
  | "connecting"
  | "streaming"
  | "done"
  | "paused"
  | "error";

export type StreamingQueueState = {
  arrivedIdx: number;
  status: StreamStatus;
  pausedReason: PausedReason | null;
  failedPosition: number | null;
  error: Error | null;
};

type Action =
  | { type: "connect-start" }
  | { type: "question-arrived"; attempt_position: number }
  | { type: "done" }
  | { type: "paused"; reason: PausedReason; failed_position: number | null }
  | { type: "error"; error: Error }
  | { type: "teardown" };

function makeInitialState(initialArrivedIdx: number): StreamingQueueState {
  return {
    arrivedIdx: initialArrivedIdx,
    status: "idle",
    pausedReason: null,
    failedPosition: null,
    error: null,
  };
}

function reducer(state: StreamingQueueState, action: Action): StreamingQueueState {
  switch (action.type) {
    case "connect-start":
      return { ...state, status: "connecting", error: null };
    case "question-arrived":
      return {
        ...state,
        arrivedIdx: Math.max(state.arrivedIdx, action.attempt_position),
        status: "streaming",
        pausedReason: null,
        failedPosition: null,
        error: null,
      };
    case "done":
      return { ...state, status: "done", pausedReason: null, failedPosition: null };
    case "paused":
      return {
        ...state,
        status: "paused",
        pausedReason: action.reason,
        failedPosition: action.failed_position,
      };
    case "error":
      return { ...state, status: "error", error: action.error };
    case "teardown":
      // Status flips to idle so a future enable/reconnect cleanly
      // re-runs the connect-start transition. arrivedIdx is preserved
      // — it is the cursor for the next ``?since`` value.
      return {
        ...state,
        status: "idle",
        pausedReason: null,
        failedPosition: null,
      };
  }
}

export type UseStreamingQueueOpts = {
  attemptId: string;
  /** Gate from the consumer: open the stream iff this is true.
   * Typically ``mode === "per_testee" && !attempt.paused && !attempt.submitted_at``. */
  enabled: boolean;
  /** Starting cursor. Usually 1 (Q1 is sync). */
  initialArrivedIdx?: number;
};

export type StreamingQueue = StreamingQueueState & {
  close: () => void;
  reconnect: () => void;
};

export function useStreamingQueue(opts: UseStreamingQueueOpts): StreamingQueue {
  const { attemptId, enabled, initialArrivedIdx = 1 } = opts;
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(reducer, initialArrivedIdx, makeInitialState);
  const streamRef = useRef<AttemptStream | null>(null);
  const arrivedIdxRef = useRef(state.arrivedIdx);
  // ``reconnectCounter`` bumps to force the effect to re-run even when
  // ``enabled`` / ``attemptId`` are stable (e.g. user clicks "Try
  // resuming →" after a ``reconnect_exhausted`` synthetic).
  const [reconnectCounter, bumpReconnectCounter] = useReducer((n: number) => n + 1, 0);

  // Keep ``arrivedIdxRef`` in lockstep so the connect effect can read
  // the latest cursor without subscribing to it as a dep (subscribing
  // would re-fire the effect on every event, churning the connection).
  arrivedIdxRef.current = state.arrivedIdx;

  useEffect(() => {
    if (!enabled) {
      streamRef.current?.close();
      streamRef.current = null;
      dispatch({ type: "teardown" });
      return;
    }

    let cancelled = false;
    dispatch({ type: "connect-start" });

    const stream = openAttemptStream(attemptId, {
      since: arrivedIdxRef.current,
    });
    streamRef.current = stream;

    (async () => {
      try {
        for await (const event of stream.events) {
          if (cancelled) return;
          switch (event.kind) {
            case "question":
              dispatch({
                type: "question-arrived",
                attempt_position: event.attempt_position,
              });
              await queryClient.invalidateQueries({
                queryKey: attemptQueryKeys.detail(attemptId),
              });
              // Belt-and-suspenders: ``invalidateQueries`` is awaited
              // and can resolve after the cleanup has set
              // ``cancelled``; bail out before the next iteration
              // dispatches.
              if (cancelled) return;
              break;
            case "done":
              dispatch({ type: "done" });
              await queryClient.invalidateQueries({
                queryKey: attemptQueryKeys.detail(attemptId),
              });
              if (cancelled) return;
              break;
            case "paused":
              dispatch({
                type: "paused",
                reason: event.reason,
                failed_position: event.failed_position,
              });
              // Plan amendment: terminal paused must also invalidate
              // so the reactive close on ``attempt.paused === true``
              // sees a fresh view (the backend marked the attempt
              // paused for ``generation_failed``; the ``reconnect_
              // exhausted`` case is FE-synthetic but invalidating is
              // still safe and keeps the post-paused view coherent).
              await queryClient.invalidateQueries({
                queryKey: attemptQueryKeys.detail(attemptId),
              });
              if (cancelled) return;
              break;
          }
        }
      } catch (err) {
        if (!cancelled) {
          dispatch({ type: "error", error: err as Error });
        }
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.close();
      streamRef.current = null;
    };
    // ``reconnectCounter`` is intentional — bumping it re-runs the
    // effect. ``arrivedIdxRef`` is a ref by design; do NOT add to
    // deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, enabled, reconnectCounter, queryClient]);

  const close = useCallback(() => {
    streamRef.current?.close();
    streamRef.current = null;
  }, []);

  const reconnect = useCallback(() => {
    bumpReconnectCounter();
  }, [bumpReconnectCounter]);

  return {
    ...state,
    close,
    reconnect,
  };
}
