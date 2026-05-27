/**
 * SSE fixture helpers for MSW (FE-5 §D.1 / §D.2).
 *
 * Composes ``ReadableStream<Uint8Array>`` bodies for the
 * ``GET /v1/attempts/:id/stream`` MSW handler so tests can describe
 * event sequences declaratively. The backend wire format is mirrored
 * verbatim:
 *
 *   - Question events: ``id: <N>\ndata: <json>\n\n`` (no ``event:``).
 *   - Terminals: ``event: done|paused\ndata: <json>\n\n``.
 *
 * ``buildSseResponse`` returns a ready-to-return ``Response`` with the
 * correct ``text/event-stream`` headers; MSW handlers can either yield
 * that directly or wrap it in ``HttpResponse``.
 *
 * Two test-only knobs:
 *
 *   - ``delayMs`` — pause between frames so burst-coalesce tests can
 *     interleave with timers.
 *   - ``abortAfter`` — terminate the stream with an error after the
 *     N-th frame (simulates a mid-stream network drop for the
 *     reconnect-with-Last-Event-ID scenario).
 */

export type SseFixtureFrame =
  | {
      kind: "question";
      id: number;
      attempt_position: number;
      attempt_id: string;
      questionId?: string;
    }
  | {
      kind: "done";
      completed_positions: number[];
      replayed_positions?: number[];
    }
  | {
      kind: "paused";
      reason: "generation_failed";
      failed_position: number | null;
      completed_positions: number[];
    }
  | { kind: "comment"; text: string }
  | { kind: "raw"; bytes: string };

export function encodeSseFrame(frame: SseFixtureFrame): string {
  switch (frame.kind) {
    case "question":
      return (
        `id: ${frame.id}\n` +
        `data: ${JSON.stringify({
          id: frame.questionId ?? `q-${frame.attempt_position}`,
          attempt_position: frame.attempt_position,
          attempt_id: frame.attempt_id,
        })}\n\n`
      );
    case "done":
      return (
        `event: done\n` +
        `data: ${JSON.stringify({
          completed_positions: frame.completed_positions,
          replayed_positions: frame.replayed_positions ?? [],
        })}\n\n`
      );
    case "paused":
      return (
        `event: paused\n` +
        `data: ${JSON.stringify({
          reason: frame.reason,
          failed_position: frame.failed_position,
          completed_positions: frame.completed_positions,
        })}\n\n`
      );
    case "comment":
      return `:${frame.text}\n`;
    case "raw":
      return frame.bytes;
  }
}

export type SseFixtureOpts = {
  /** Milliseconds between frame enqueues (default 0 — synchronous). */
  delayMs?: number;
  /** After the N-th frame, close the stream WITHOUT emitting a
   * terminal ``done`` / ``paused``. The consumer adapter treats this
   * mid-stream EOF as a reconnect-eligible error (same code path as a
   * real network drop). Indices are 1-based: ``abortAfter: 2`` emits
   * exactly two frames then closes.
   *
   * Using ``controller.close()`` rather than ``controller.error()``
   * avoids a race in Node WebStreams where an in-flight enqueued
   * chunk can be discarded if the error is signalled in the same
   * tick. The adapter exercises both code paths via the
   * ``HttpResponse.error()`` test (real network error) and this
   * fixture (mid-stream EOF). */
  abortAfter?: number;
};

export function sseStreamFixture(
  frames: SseFixtureFrame[],
  opts: SseFixtureOpts = {},
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (opts.abortAfter !== undefined && i >= opts.abortAfter) {
        controller.close();
        return;
      }
      if (i >= frames.length) {
        controller.close();
        return;
      }
      if (opts.delayMs && i > 0) {
        await new Promise((resolve) => setTimeout(resolve, opts.delayMs));
      }
      const frame = frames[i] as SseFixtureFrame;
      i += 1;
      controller.enqueue(encoder.encode(encodeSseFrame(frame)));
    },
  });
}

export function buildSseResponse(
  frames: SseFixtureFrame[],
  opts?: SseFixtureOpts,
): Response {
  return new Response(sseStreamFixture(frames, opts), {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
