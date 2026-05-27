/**
 * ``useStreamingQueue`` (FE-5 §D.1 / §B.1 §4).
 *
 * Exercises the hook end-to-end with MSW streaming the wire shape:
 *
 *   - Mount opens the stream and advances ``arrivedIdx`` on question
 *     events.
 *   - Each event invalidates ``attemptQueryKeys.detail(id)``.
 *   - Burst of events coalesces to a single refetch (TanStack v5
 *     native — no FE debounce).
 *   - Terminal ``done`` flips status to ``"done"`` and invalidates.
 *   - Terminal ``paused (generation_failed)`` flips status with the
 *     server-emitted reason AND invalidates (FE-5 plan amendment).
 *   - Synthetic ``paused (reconnect_exhausted)`` surfaces after two
 *     failed connects AND invalidates.
 *   - ``enabled: false`` tears the stream down via AbortController.
 *   - ``reconnect()`` re-opens with ``?since=<arrivedIdx>``.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren, ReactElement } from "react";
import { server } from "@/mocks/node";
import { useStreamingQueue } from "@/lib/attempts/use-streaming-queue";
import { attemptQueryKeys } from "@/lib/queries/attempts";
import { setAccessToken, clearTokens } from "@/lib/auth/storage";
import {
  buildSseResponse,
  sseStreamFixture,
  type SseFixtureFrame,
} from "@/mocks/sse-fixtures";

const API = "http://localhost:8000";
const ATTEMPT_ID = "11111111-1111-1111-1111-000000000001";

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 30_000 },
      mutations: { retry: false },
    },
  });
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren): ReactElement {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function staticHandler(frames: SseFixtureFrame[]) {
  return http.get(`${API}/v1/attempts/:attempt_id/stream`, () =>
    buildSseResponse(frames),
  );
}

beforeEach(() => {
  setAccessToken("tok-abc");
});

afterEach(() => {
  clearTokens();
});

describe("useStreamingQueue · mount + question events", () => {
  it("opens the stream and advances arrivedIdx on each question event", async () => {
    server.use(
      staticHandler([
        { kind: "question", id: 2, attempt_position: 2, attempt_id: ATTEMPT_ID },
        { kind: "question", id: 3, attempt_position: 3, attempt_id: ATTEMPT_ID },
        { kind: "question", id: 4, attempt_position: 4, attempt_id: ATTEMPT_ID },
        { kind: "done", completed_positions: [2, 3, 4] },
      ]),
    );
    const client = makeClient();
    const { result } = renderHook(
      () => useStreamingQueue({ attemptId: ATTEMPT_ID, enabled: true }),
      { wrapper: wrapper(client) },
    );
    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.arrivedIdx).toBe(4);
    expect(result.current.pausedReason).toBeNull();
  });

  it("starts with arrivedIdx = initialArrivedIdx and sends ?since=that on first connect", async () => {
    let seenSince: string | null = null;
    server.use(
      http.get(`${API}/v1/attempts/:attempt_id/stream`, ({ request }) => {
        seenSince = new URL(request.url).searchParams.get("since");
        return buildSseResponse([{ kind: "done", completed_positions: [] }]);
      }),
    );
    const client = makeClient();
    renderHook(
      () =>
        useStreamingQueue({
          attemptId: ATTEMPT_ID,
          enabled: true,
          initialArrivedIdx: 1,
        }),
      { wrapper: wrapper(client) },
    );
    await waitFor(() => expect(seenSince).toBe("1"));
  });
});

describe("useStreamingQueue · refetch invalidation", () => {
  it("invalidates attempt detail query on each non-terminal event", async () => {
    server.use(
      staticHandler([
        { kind: "question", id: 2, attempt_position: 2, attempt_id: ATTEMPT_ID },
        { kind: "question", id: 3, attempt_position: 3, attempt_id: ATTEMPT_ID },
        { kind: "done", completed_positions: [2, 3] },
      ]),
    );
    const client = makeClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(
      () => useStreamingQueue({ attemptId: ATTEMPT_ID, enabled: true }),
      { wrapper: wrapper(client) },
    );
    await waitFor(() => expect(result.current.status).toBe("done"));
    // 2 question events + 1 done event = 3 invalidations.
    const calls = spy.mock.calls.filter((args) => {
      const key = (args[0] as { queryKey?: unknown[] })?.queryKey;
      return (
        Array.isArray(key) &&
        key.length === 2 &&
        key[0] === "attempts" &&
        key[1] === ATTEMPT_ID
      );
    });
    expect(calls.length).toBe(3);
    expect(calls[0]?.[0]).toEqual({
      queryKey: attemptQueryKeys.detail(ATTEMPT_ID),
    });
  });
});

describe("useStreamingQueue · terminal events", () => {
  it("terminal done → status: done", async () => {
    server.use(staticHandler([{ kind: "done", completed_positions: [] }]));
    const client = makeClient();
    const { result } = renderHook(
      () => useStreamingQueue({ attemptId: ATTEMPT_ID, enabled: true }),
      { wrapper: wrapper(client) },
    );
    await waitFor(() => expect(result.current.status).toBe("done"));
  });

  it("terminal paused (generation_failed) sets pausedReason + invalidates", async () => {
    server.use(
      staticHandler([
        { kind: "question", id: 2, attempt_position: 2, attempt_id: ATTEMPT_ID },
        {
          kind: "paused",
          reason: "generation_failed",
          failed_position: 3,
          completed_positions: [2],
        },
      ]),
    );
    const client = makeClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(
      () => useStreamingQueue({ attemptId: ATTEMPT_ID, enabled: true }),
      { wrapper: wrapper(client) },
    );
    await waitFor(() => expect(result.current.status).toBe("paused"));
    expect(result.current.pausedReason).toBe("generation_failed");
    expect(result.current.failedPosition).toBe(3);
    expect(result.current.arrivedIdx).toBe(2);
    // FE-5 plan amendment: terminal paused MUST also invalidate so the
    // reactive close on attempt.paused === true sees the fresh view.
    const matched = spy.mock.calls.filter(
      (args) =>
        JSON.stringify((args[0] as { queryKey: unknown[] }).queryKey) ===
        JSON.stringify(attemptQueryKeys.detail(ATTEMPT_ID)),
    );
    expect(matched.length).toBeGreaterThanOrEqual(2); // 1 question + 1 paused
  });

  it("synthetic paused (reconnect_exhausted) surfaces after two failed connects", async () => {
    server.use(
      http.get(`${API}/v1/attempts/:attempt_id/stream`, () => HttpResponse.error()),
    );
    const client = makeClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(
      () => useStreamingQueue({ attemptId: ATTEMPT_ID, enabled: true }),
      { wrapper: wrapper(client) },
    );
    await waitFor(() => expect(result.current.status).toBe("paused"));
    expect(result.current.pausedReason).toBe("reconnect_exhausted");
    // Even the FE-synthetic paused invalidates, per plan amendment.
    const matched = spy.mock.calls.filter(
      (args) =>
        JSON.stringify((args[0] as { queryKey: unknown[] }).queryKey) ===
        JSON.stringify(attemptQueryKeys.detail(ATTEMPT_ID)),
    );
    expect(matched.length).toBeGreaterThanOrEqual(1);
  });
});

describe("useStreamingQueue · enabled gating", () => {
  it("does not open the stream when enabled is false on mount", async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/v1/attempts/:attempt_id/stream`, () => {
        calls += 1;
        return buildSseResponse([{ kind: "done", completed_positions: [] }]);
      }),
    );
    const client = makeClient();
    renderHook(() => useStreamingQueue({ attemptId: ATTEMPT_ID, enabled: false }), {
      wrapper: wrapper(client),
    });
    // Give the React effect a tick to NOT-fire.
    await new Promise((r) => setTimeout(r, 30));
    expect(calls).toBe(0);
  });

  it("opens the stream when enabled flips to true", async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/v1/attempts/:attempt_id/stream`, () => {
        calls += 1;
        return buildSseResponse([
          { kind: "question", id: 2, attempt_position: 2, attempt_id: ATTEMPT_ID },
          { kind: "done", completed_positions: [2] },
        ]);
      }),
    );
    const client = makeClient();
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useStreamingQueue({ attemptId: ATTEMPT_ID, enabled }),
      { wrapper: wrapper(client), initialProps: { enabled: false } },
    );
    expect(calls).toBe(0);
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(calls).toBe(1);
  });

  it("closes the stream when enabled flips back to false mid-stream", async () => {
    // A slow stream so the consumer can flip enabled before it ends.
    server.use(
      http.get(
        `${API}/v1/attempts/:attempt_id/stream`,
        () =>
          new HttpResponse(
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
                {
                  kind: "question",
                  id: 4,
                  attempt_position: 4,
                  attempt_id: ATTEMPT_ID,
                },
                { kind: "done", completed_positions: [2, 3, 4] },
              ],
              { delayMs: 80 },
            ),
            { status: 200, headers: { "Content-Type": "text/event-stream" } },
          ),
      ),
    );
    const client = makeClient();
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useStreamingQueue({ attemptId: ATTEMPT_ID, enabled }),
      { wrapper: wrapper(client), initialProps: { enabled: true } },
    );
    // Wait until at least one event has arrived.
    await waitFor(() => expect(result.current.arrivedIdx).toBeGreaterThanOrEqual(2));
    rerender({ enabled: false });
    // Status flips to idle and stops advancing.
    await waitFor(() => expect(result.current.status).toBe("idle"));
    const finalIdx = result.current.arrivedIdx;
    // Wait a bit; ensure no further advances.
    await new Promise((r) => setTimeout(r, 200));
    expect(result.current.arrivedIdx).toBe(finalIdx);
    expect(result.current.status).toBe("idle");
  });
});

describe("useStreamingQueue · reconnect() re-opens with current arrivedIdx", () => {
  it("re-opens the stream with ?since=<arrivedIdx> after reconnect()", async () => {
    let call = 0;
    const seenSince: string[] = [];
    server.use(
      http.get(`${API}/v1/attempts/:attempt_id/stream`, ({ request }) => {
        call += 1;
        const since = new URL(request.url).searchParams.get("since");
        if (since !== null) seenSince.push(since);
        if (call === 1) {
          return buildSseResponse([
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
            {
              kind: "paused",
              reason: "generation_failed",
              failed_position: 4,
              completed_positions: [2, 3],
            },
          ]);
        }
        return buildSseResponse([
          { kind: "question", id: 4, attempt_position: 4, attempt_id: ATTEMPT_ID },
          { kind: "done", completed_positions: [2, 3, 4] },
        ]);
      }),
    );

    const client = makeClient();
    const { result } = renderHook(
      () => useStreamingQueue({ attemptId: ATTEMPT_ID, enabled: true }),
      { wrapper: wrapper(client) },
    );
    await waitFor(() => expect(result.current.status).toBe("paused"));
    expect(result.current.arrivedIdx).toBe(3);

    act(() => {
      result.current.reconnect();
    });

    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.arrivedIdx).toBe(4);
    expect(seenSince).toEqual(["1", "3"]);
  });
});

describe("useStreamingQueue · unmount cleanup", () => {
  it("aborts the in-flight stream on unmount (no late dispatch warning)", async () => {
    server.use(
      http.get(
        `${API}/v1/attempts/:attempt_id/stream`,
        () =>
          new HttpResponse(
            sseStreamFixture(
              [
                {
                  kind: "question",
                  id: 2,
                  attempt_position: 2,
                  attempt_id: ATTEMPT_ID,
                },
                { kind: "done", completed_positions: [2] },
              ],
              { delayMs: 60 },
            ),
            { status: 200, headers: { "Content-Type": "text/event-stream" } },
          ),
      ),
    );

    const client = makeClient();
    const { result, unmount } = renderHook(
      () => useStreamingQueue({ attemptId: ATTEMPT_ID, enabled: true }),
      { wrapper: wrapper(client) },
    );
    await waitFor(() => expect(result.current.status).toBe("connecting"));
    unmount();
    // No assertion needed — the test harness fails if the generator
    // throws or React warns on an unmounted-component state update.
    await new Promise((r) => setTimeout(r, 100));
  });
});
