/**
 * ``openAttemptStream`` (FE-5 §D.1, AC-CD22).
 *
 * Covers the AC-CD22 contract end-to-end via MSW v2 ``ReadableStream``
 * response bodies:
 *
 *   - Bearer + Accept headers on the request.
 *   - ``?since=N`` precedence over ``Last-Event-ID``.
 *   - Question event parsing + arrival order.
 *   - Reconnect-once with ``Last-Event-ID`` on mid-stream error.
 *   - Synthetic ``paused (reconnect_exhausted)`` after second failure.
 *   - ``close()`` exits the iterator cleanly (no throw).
 *   - 4xx response (e.g. ``409 not_per_testee``) throws ``ApiError``.
 *   - Terminal ``done`` / ``paused (generation_failed)`` close the
 *     stream.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/node";
import { openAttemptStream, type StreamEvent } from "@/lib/api/sse";
import { ApiError } from "@/lib/api/errors";
import { setAccessToken, clearTokens } from "@/lib/auth/storage";
import {
  buildSseResponse,
  encodeSseFrame,
  sseStreamFixture,
  type SseFixtureFrame,
} from "@/mocks/sse-fixtures";

const API = "http://localhost:8000";
const ATTEMPT_ID = "11111111-1111-1111-1111-000000000001";

beforeEach(() => {
  setAccessToken("tok-abc");
});

afterEach(() => {
  clearTokens();
});

async function collect(
  stream: { events: AsyncIterable<StreamEvent>; close: () => void },
  opts: { take?: number } = {},
): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const e of stream.events) {
    events.push(e);
    if (opts.take !== undefined && events.length >= opts.take) break;
  }
  return events;
}

function streamResponse(frames: SseFixtureFrame[]) {
  return new HttpResponse(sseStreamFixture(frames), {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}

describe("openAttemptStream · bearer + URL + query", () => {
  it("sends Authorization + Accept and parses a single question event + done", async () => {
    let seenAuth: string | null = null;
    let seenAccept: string | null = null;
    let seenUrl: string | null = null;
    server.use(
      http.get(`${API}/v1/attempts/:attempt_id/stream`, ({ request }) => {
        seenAuth = request.headers.get("Authorization");
        seenAccept = request.headers.get("Accept");
        seenUrl = request.url;
        return streamResponse([
          {
            kind: "question",
            id: 2,
            attempt_position: 2,
            attempt_id: ATTEMPT_ID,
            questionId: "q-uuid-2",
          },
          { kind: "done", completed_positions: [2] },
        ]);
      }),
    );

    const stream = openAttemptStream(ATTEMPT_ID, { since: 1 });
    const events = await collect(stream);

    expect(seenAuth).toBe("Bearer tok-abc");
    expect(seenAccept).toBe("text/event-stream");
    expect(seenUrl).toContain(`/v1/attempts/${ATTEMPT_ID}/stream`);
    expect(seenUrl).toContain("since=1");
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      kind: "question",
      id: "q-uuid-2",
      attempt_position: 2,
      attempt_id: ATTEMPT_ID,
    });
    expect(events[1]).toMatchObject({ kind: "done", completed_positions: [2] });
  });

  it("omits Authorization when no access token is set", async () => {
    clearTokens();
    let seenAuth: string | null = null;
    server.use(
      http.get(`${API}/v1/attempts/:attempt_id/stream`, ({ request }) => {
        seenAuth = request.headers.get("Authorization");
        return streamResponse([{ kind: "done", completed_positions: [] }]);
      }),
    );
    const stream = openAttemptStream(ATTEMPT_ID);
    await collect(stream);
    expect(seenAuth).toBeNull();
  });
});

describe("openAttemptStream · cursor precedence", () => {
  it("uses ``?since=N`` and omits ``Last-Event-ID`` when both opts are set", async () => {
    let seenUrl: string | null = null;
    let seenLastEventId: string | null = null;
    server.use(
      http.get(`${API}/v1/attempts/:attempt_id/stream`, ({ request }) => {
        seenUrl = request.url;
        seenLastEventId = request.headers.get("Last-Event-ID");
        return streamResponse([{ kind: "done", completed_positions: [] }]);
      }),
    );
    const stream = openAttemptStream(ATTEMPT_ID, { since: 4, lastEventId: "2" });
    await collect(stream);
    expect(seenUrl).toContain("since=4");
    expect(seenLastEventId).toBeNull();
  });

  it("falls back to ``Last-Event-ID`` when ``since`` is absent", async () => {
    let seenLastEventId: string | null = null;
    let seenUrl: string | null = null;
    server.use(
      http.get(`${API}/v1/attempts/:attempt_id/stream`, ({ request }) => {
        seenLastEventId = request.headers.get("Last-Event-ID");
        seenUrl = request.url;
        return streamResponse([{ kind: "done", completed_positions: [] }]);
      }),
    );
    const stream = openAttemptStream(ATTEMPT_ID, { lastEventId: "3" });
    await collect(stream);
    expect(seenLastEventId).toBe("3");
    expect(seenUrl).not.toContain("since=");
  });

  it("sends no cursor when neither opt is set", async () => {
    let seenUrl: string | null = null;
    let seenLastEventId: string | null = null;
    server.use(
      http.get(`${API}/v1/attempts/:attempt_id/stream`, ({ request }) => {
        seenUrl = request.url;
        seenLastEventId = request.headers.get("Last-Event-ID");
        return streamResponse([{ kind: "done", completed_positions: [] }]);
      }),
    );
    const stream = openAttemptStream(ATTEMPT_ID);
    await collect(stream);
    expect(seenUrl).not.toContain("since=");
    expect(seenLastEventId).toBeNull();
  });
});

describe("openAttemptStream · arrival order + multiple events", () => {
  it("yields question events in arrival order then terminal done", async () => {
    server.use(
      http.get(`${API}/v1/attempts/:attempt_id/stream`, () =>
        streamResponse([
          { kind: "question", id: 2, attempt_position: 2, attempt_id: ATTEMPT_ID },
          { kind: "question", id: 3, attempt_position: 3, attempt_id: ATTEMPT_ID },
          { kind: "question", id: 4, attempt_position: 4, attempt_id: ATTEMPT_ID },
          { kind: "done", completed_positions: [2, 3, 4] },
        ]),
      ),
    );
    const stream = openAttemptStream(ATTEMPT_ID, { since: 1 });
    const events = await collect(stream);
    expect(
      events.map((e) => (e.kind === "question" ? e.attempt_position : e.kind)),
    ).toEqual([2, 3, 4, "done"]);
  });
});

describe("openAttemptStream · reconnect-once with Last-Event-ID", () => {
  it("reconnects with the highest received id on mid-stream error", async () => {
    let call = 0;
    const seenHeaders: { lastEventId: string | null; since: string | null }[] = [];

    server.use(
      http.get(`${API}/v1/attempts/:attempt_id/stream`, ({ request }) => {
        call += 1;
        const url = new URL(request.url);
        seenHeaders.push({
          lastEventId: request.headers.get("Last-Event-ID"),
          since: url.searchParams.get("since"),
        });
        if (call === 1) {
          // First call: emit two questions then ERROR before terminal.
          return new HttpResponse(
            sseStreamFixture(
              [
                {
                  kind: "question",
                  id: 2,
                  attempt_position: 2,
                  attempt_id: ATTEMPT_ID,
                },
                {
                  kind: "question",
                  id: 3,
                  attempt_position: 3,
                  attempt_id: ATTEMPT_ID,
                },
              ],
              { abortAfter: 2 },
            ),
            {
              status: 200,
              headers: { "Content-Type": "text/event-stream" },
            },
          );
        }
        // Second call: deliver positions 4..N + done.
        return streamResponse([
          { kind: "question", id: 4, attempt_position: 4, attempt_id: ATTEMPT_ID },
          { kind: "done", completed_positions: [2, 3, 4] },
        ]);
      }),
    );

    const stream = openAttemptStream(ATTEMPT_ID, { since: 1 });
    const events = await collect(stream);

    expect(call).toBe(2);
    expect(seenHeaders[0]).toEqual({ lastEventId: null, since: "1" });
    expect(seenHeaders[1]).toEqual({ lastEventId: "3", since: null });
    expect(
      events.map((e) => (e.kind === "question" ? e.attempt_position : e.kind)),
    ).toEqual([2, 3, 4, "done"]);
  });
});

describe("openAttemptStream · synthetic paused after second failure", () => {
  it("yields ``reconnect_exhausted`` when both connects fail before any frame", async () => {
    let call = 0;
    server.use(
      http.get(`${API}/v1/attempts/:attempt_id/stream`, () => {
        call += 1;
        return HttpResponse.error();
      }),
    );

    const stream = openAttemptStream(ATTEMPT_ID, { since: 1 });
    const events = await collect(stream);

    expect(call).toBe(2);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "paused",
      reason: "reconnect_exhausted",
      failed_position: null,
      completed_positions: [],
    });
  });

  it("carries the arrived-position set when retry fails after partial progress", async () => {
    let call = 0;
    server.use(
      http.get(`${API}/v1/attempts/:attempt_id/stream`, () => {
        call += 1;
        if (call === 1) {
          // Emit two frames then drop.
          return new HttpResponse(
            sseStreamFixture(
              [
                {
                  kind: "question",
                  id: 2,
                  attempt_position: 2,
                  attempt_id: ATTEMPT_ID,
                },
                {
                  kind: "question",
                  id: 3,
                  attempt_position: 3,
                  attempt_id: ATTEMPT_ID,
                },
              ],
              { abortAfter: 2 },
            ),
            { status: 200, headers: { "Content-Type": "text/event-stream" } },
          );
        }
        return HttpResponse.error();
      }),
    );

    const stream = openAttemptStream(ATTEMPT_ID, { since: 1 });
    const events = await collect(stream);

    expect(call).toBe(2);
    const last = events[events.length - 1];
    expect(last).toMatchObject({
      kind: "paused",
      reason: "reconnect_exhausted",
      completed_positions: [2, 3],
    });
  });
});

describe("openAttemptStream · terminals", () => {
  it("terminal ``done`` yields then completes the iterator", async () => {
    server.use(
      http.get(`${API}/v1/attempts/:attempt_id/stream`, () =>
        streamResponse([
          { kind: "done", completed_positions: [2, 3, 4], replayed_positions: [2] },
        ]),
      ),
    );
    const stream = openAttemptStream(ATTEMPT_ID, { since: 1 });
    const events = await collect(stream);
    expect(events).toEqual([
      {
        kind: "done",
        completed_positions: [2, 3, 4],
        replayed_positions: [2],
      },
    ]);
  });

  it("terminal ``paused (generation_failed)`` yields then completes", async () => {
    server.use(
      http.get(`${API}/v1/attempts/:attempt_id/stream`, () =>
        streamResponse([
          {
            kind: "paused",
            reason: "generation_failed",
            failed_position: 5,
            completed_positions: [2, 3, 4],
          },
        ]),
      ),
    );
    const stream = openAttemptStream(ATTEMPT_ID, { since: 1 });
    const events = await collect(stream);
    expect(events).toEqual([
      {
        kind: "paused",
        reason: "generation_failed",
        failed_position: 5,
        completed_positions: [2, 3, 4],
      },
    ]);
  });
});

describe("openAttemptStream · close()", () => {
  it("exits the iterator cleanly with no throw", async () => {
    server.use(
      http.get(
        `${API}/v1/attempts/:attempt_id/stream`,
        () =>
          new HttpResponse(
            sseStreamFixture(
              [
                { kind: "question", id: 2, attempt_position: 2, attempt_id: ATTEMPT_ID },
                { kind: "question", id: 3, attempt_position: 3, attempt_id: ATTEMPT_ID },
                { kind: "done", completed_positions: [2, 3] },
              ],
              { delayMs: 50 },
            ),
            { status: 200, headers: { "Content-Type": "text/event-stream" } },
          ),
      ),
    );

    const stream = openAttemptStream(ATTEMPT_ID, { since: 1 });
    const iterator = stream.events[Symbol.asyncIterator]();
    const first = await iterator.next();
    expect(first.done).toBe(false);
    expect((first.value as { attempt_position: number }).attempt_position).toBe(2);

    stream.close();
    const exit = await iterator.next();
    expect(exit.done).toBe(true);
  });
});

describe("openAttemptStream · error envelope on 4xx", () => {
  it("throws ApiError when the server responds 409 not_per_testee", async () => {
    server.use(
      http.get(`${API}/v1/attempts/:attempt_id/stream`, () =>
        HttpResponse.json(
          {
            error: {
              code: "not_per_testee",
              message: "SSE streaming is per-Testee mode only",
              detail: null,
            },
          },
          { status: 409 },
        ),
      ),
    );

    const stream = openAttemptStream(ATTEMPT_ID, { since: 1 });
    let caught: unknown = null;
    try {
      await collect(stream);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(409);
    expect((caught as ApiError).code).toBe("not_per_testee");
  });

  it("throws ApiError on a 500 with no JSON body", async () => {
    server.use(
      http.get(
        `${API}/v1/attempts/:attempt_id/stream`,
        () =>
          new HttpResponse("oops", {
            status: 500,
            headers: { "Content-Type": "text/plain" },
          }),
      ),
    );
    const stream = openAttemptStream(ATTEMPT_ID, { since: 1 });
    let caught: unknown = null;
    try {
      await collect(stream);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(500);
    expect((caught as ApiError).code).toBe("unknown");
  });
});

describe("openAttemptStream · stream-end-without-terminal counts as reconnect-eligible", () => {
  it("treats a clean EOF without ``done`` / ``paused`` as a reconnectable error", async () => {
    let call = 0;
    server.use(
      http.get(`${API}/v1/attempts/:attempt_id/stream`, () => {
        call += 1;
        if (call === 1) {
          // Emit a single question then close cleanly — no terminal.
          return new HttpResponse(
            sseStreamFixture([
              {
                kind: "question",
                id: 2,
                attempt_position: 2,
                attempt_id: ATTEMPT_ID,
              },
            ]),
            { status: 200, headers: { "Content-Type": "text/event-stream" } },
          );
        }
        return streamResponse([{ kind: "done", completed_positions: [2] }]);
      }),
    );

    const stream = openAttemptStream(ATTEMPT_ID, { since: 1 });
    const events = await collect(stream);
    expect(call).toBe(2);
    expect(events.map((e) => e.kind)).toEqual(["question", "done"]);
  });
});

describe("openAttemptStream · encoding", () => {
  it("works with chunked decoding (data straddling read boundary)", async () => {
    // Build a stream that delivers the same frame across two enqueues.
    const full = encodeSseFrame({
      kind: "question",
      id: 2,
      attempt_position: 2,
      attempt_id: ATTEMPT_ID,
    });
    const splitAt = full.length - 5;
    const a = full.slice(0, splitAt);
    const b =
      full.slice(splitAt) +
      encodeSseFrame({
        kind: "done",
        completed_positions: [2],
      });
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(a));
        setTimeout(() => {
          controller.enqueue(encoder.encode(b));
          controller.close();
        }, 5);
      },
    });
    server.use(
      http.get(
        `${API}/v1/attempts/:attempt_id/stream`,
        () =>
          new HttpResponse(body, {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          }),
      ),
    );
    const stream = openAttemptStream(ATTEMPT_ID, { since: 1 });
    const events = await collect(stream);
    expect(events.map((e) => e.kind)).toEqual(["question", "done"]);
  });
});

describe("openAttemptStream · ignores unknown ``paused`` reasons", () => {
  it("normalises an unknown reason to ``generation_failed``", async () => {
    server.use(
      http.get(`${API}/v1/attempts/:attempt_id/stream`, () => {
        const encoder = new TextEncoder();
        const raw = `event: paused\ndata: ${JSON.stringify({
          reason: "some_future_reason",
          failed_position: 7,
          completed_positions: [2, 3, 4, 5, 6],
        })}\n\n`;
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode(raw));
            controller.close();
          },
        });
        return new HttpResponse(body, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      }),
    );
    const stream = openAttemptStream(ATTEMPT_ID, { since: 1 });
    const events = await collect(stream);
    expect(events[0]).toMatchObject({
      kind: "paused",
      reason: "generation_failed",
      failed_position: 7,
    });
  });
});

describe("openAttemptStream · buildSseResponse helper sanity", () => {
  it("returns a Response with text/event-stream content type", () => {
    const resp = buildSseResponse([{ kind: "done", completed_positions: [] }]);
    expect(resp.status).toBe(200);
    expect(resp.headers.get("Content-Type")).toBe("text/event-stream");
  });
});
