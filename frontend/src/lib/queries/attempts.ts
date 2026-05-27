/**
 * Attempt query keys + hooks (FE-4 §B.5, §C.5, §F.1; AC-CD21).
 *
 * Key shape follows the FE-3 §B.5 pattern (`pillQueryKeys`):
 *   `[domain, id]` for the attempt detail,
 *   `[domain, id, "result"]` for the post-submit poll cache,
 *   `[domain, "inflight"]` for the localStorage resume-bridge shim
 *     (slice 2 — kept here so the key vocabulary is single-source).
 *
 * **Test fetch (drift item 3 in plan).** `AttemptView` does NOT carry
 * `test.mode` (verified — `app/schemas.py:550`, only `test_id`). The
 * runner needs `test.mode`, `test.timed`, `test.duration_minutes`,
 * `test.pause_allowance`, `test.max_pause_duration_minutes` to branch
 * mode + drive the TimerPill + pause UX. `useAttemptView` issues two
 * parallel `useQuery` calls and returns a combined view-state object,
 * keyed by the attempt id so the standard
 * `queryClient.invalidateQueries({ queryKey: attemptQueryKeys.detail })`
 * still works.
 *
 * Mutations:
 *   - `useAutosaveAttempt` — POST /v1/attempts/{id}/autosave. Per-
 *     question debounce + retry are owned by `useAttempt`'s reducer
 *     queue (see `lib/attempts/use-attempt.ts`); this hook is the bare
 *     mutation primitive.
 *   - `useFlagRealism` — POST /v1/attempts/{id}/questions/{qid}/flag-
 *     realism. Idempotent on (question, testee) server-side; FE
 *     adopts an optimistic-flag-on-success-only policy (a 5xx reverts).
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { client, unwrap } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

export type AttemptView = components["schemas"]["AttemptView"];
export type TestResponse = components["schemas"]["TestResponse"];
export type AttemptResultResponse = components["schemas"]["AttemptResultResponse"];

export const attemptQueryKeys = {
  all: ["attempts"] as const,
  detail: (id: string) => [...attemptQueryKeys.all, id] as const,
  result: (id: string) => [...attemptQueryKeys.all, id, "result"] as const,
  /**
   * Resume-prompt localStorage shim (slice 2). Distinct from
   * `detail()` so prefetch / invalidation of one does not race the
   * other; the queryFn for this key reads localStorage, not the wire.
   * The leading `__` keeps it disjoint from any attempt UUID — keys
   * `["attempts", "<uuid>"]` and `["attempts", "__inflight"]` never
   * collide.
   */
  inFlight: () => [...attemptQueryKeys.all, "__inflight"] as const,
};

export function invalidateAttempt(qc: QueryClient, attemptId: string) {
  return qc.invalidateQueries({ queryKey: attemptQueryKeys.detail(attemptId) });
}

/**
 * Fetch the AttemptView. Detail data changes on every interaction in
 * theory (autosaves, pauses) but the reducer owns optimistic state —
 * we only re-fetch when invalidated explicitly (on resume from pause,
 * on submit). `staleTime: 0` here would re-fire on every focus; the
 * default `staleTime: Infinity` (set in queryClient) plus explicit
 * invalidation is the right posture.
 */
export function useAttemptDetail(attemptId: string | null | undefined) {
  return useQuery({
    queryKey: attemptId ? attemptQueryKeys.detail(attemptId) : ["attempts", "noop"],
    queryFn: async () => {
      if (!attemptId) throw new Error("attemptId required");
      return unwrap(
        client.GET("/v1/attempts/{attempt_id}", {
          params: { path: { attempt_id: attemptId } },
        }),
      );
    },
    enabled: Boolean(attemptId),
  });
}

/**
 * Fetch the parent Test for an AttemptView so the runner can read
 * `mode` / `timed` / `duration_minutes` / `pause_allowance` /
 * `max_pause_duration_minutes`. Not currently re-fetched (tests are
 * mostly immutable while an attempt is in flight); kept in the cache
 * keyed by test id for cross-attempt reuse.
 */
export function useTestForAttempt(testId: string | null | undefined) {
  return useQuery({
    queryKey: testId ? (["tests", testId] as const) : (["tests", "noop"] as const),
    queryFn: async () => {
      if (!testId) throw new Error("testId required");
      return unwrap(
        client.GET("/v1/tests/{test_id}", {
          params: { path: { test_id: testId } },
        }),
      );
    },
    enabled: Boolean(testId),
  });
}

/**
 * Composite view: fetch the AttemptView, then the parent Test once
 * the attempt resolves so `test.mode` is available for the mode-
 * branch in the page. `useQueries` keeps both subqueries observable
 * with one render cycle; the consumer destructures `attempt` /
 * `test` from the returned `{queries, attempt, test, status, error}`.
 *
 * `status` collapses the two subqueries' status into a single value
 * the page can render:
 *   - "pending" while either is loading,
 *   - "error" if either fails (the error envelope of the first one to
 *     reject wins; ApiError is preserved),
 *   - "success" only when both have data.
 */
export type AttemptViewBundle = {
  attempt: AttemptView | undefined;
  test: TestResponse | undefined;
  status: "pending" | "error" | "success";
  error: Error | null;
};

export function useAttemptView(attemptId: string | null | undefined): AttemptViewBundle {
  const attemptQuery = useAttemptDetail(attemptId);
  const testId = attemptQuery.data?.test_id ?? null;
  const testQuery = useTestForAttempt(testId);

  if (attemptQuery.isPending || (attemptQuery.isSuccess && testQuery.isPending)) {
    return {
      attempt: attemptQuery.data,
      test: undefined,
      status: "pending",
      error: null,
    };
  }
  if (attemptQuery.isError) {
    return {
      attempt: undefined,
      test: undefined,
      status: "error",
      error: attemptQuery.error as Error,
    };
  }
  if (testQuery.isError) {
    return {
      attempt: attemptQuery.data,
      test: undefined,
      status: "error",
      error: testQuery.error as Error,
    };
  }
  return {
    attempt: attemptQuery.data,
    test: testQuery.data,
    status: "success",
    error: null,
  };
}

export type AutosaveBody = {
  question_id: string;
  answer_payload: Record<string, unknown> | null;
  time_ms?: number | null;
};

export function useAutosaveAttempt(attemptId: string) {
  return useMutation({
    mutationKey: ["attempts", attemptId, "autosave"],
    mutationFn: async (body: AutosaveBody) => {
      // Backend types `answer_payload` as `Record<string, never> | null`
      // because the Pydantic field is untyped `dict`. The generated TS
      // shape thus rejects any concrete record; cast through `unknown`
      // at the single seam rather than littering it through callers.
      const payload: components["schemas"]["AutosaveRequest"] = {
        question_id: body.question_id,
        answer_payload: body.answer_payload as unknown as Record<string, never> | null,
        time_ms: body.time_ms ?? null,
      };
      return unwrap(
        client.POST("/v1/attempts/{attempt_id}/autosave", {
          params: { path: { attempt_id: attemptId } },
          body: payload,
        }),
      );
    },
  });
}

export function useFlagRealism(attemptId: string) {
  return useMutation({
    mutationKey: ["attempts", attemptId, "flag-realism"],
    mutationFn: async (questionId: string) => {
      return unwrap(
        client.POST("/v1/attempts/{attempt_id}/questions/{question_id}/flag-realism", {
          params: {
            path: { attempt_id: attemptId, question_id: questionId },
          },
        }),
      );
    },
  });
}
