/**
 * Admin Questions query + mutation layer (FE-8 admin-tests §B.3).
 *
 * Slice 13 drift sweep Finding #2 absorbed: `GET /v1/tests/{test_id}
 * /questions` accepts NO query params on the wire (the spec body's
 * `?cursor&limit=100` is fictional). We therefore use `useQuery`
 * rather than `useInfiniteQuery` — the whole pool comes back in one
 * call. Acceptable for v1 frozen pools (recommended ≤ 8, capped
 * pragmatically by FE; backend doesn't gate).
 *
 * Drift sweep Finding #1 absorbed: there is no
 * `GET /v1/tests/{test_id}/questions/{question_id}` endpoint either.
 * The modal prefills from the cached list response (§E item 7 LOCKED).
 *
 * Drift sweep Finding #4 absorbed: `QuestionCreate.config` is typed
 * `Record<string, never>` by openapi-typescript (uninhabitable). We
 * compose the body via `compose-question-config.ts` and cast at the
 * call boundary — same pattern as FE-6's nullable-field absorption.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client, unwrap } from "@/lib/api/client";
import { adminKeys } from "@/lib/queries/admin-keys";
import type { components } from "@/lib/api/types";
import type {
  ComposedQuestionCreate,
  ComposedQuestionUpdate,
} from "@/lib/tests/compose-question-config";

export type QuestionResponse = components["schemas"]["QuestionResponse"];
export type QuestionCreate = components["schemas"]["QuestionCreate"];
export type QuestionUpdate = components["schemas"]["QuestionUpdate"];
export type QuestionType = components["schemas"]["QuestionType"];

export function useAdminQuestions(testId: string | null) {
  return useQuery({
    queryKey: testId
      ? adminKeys.questions.list(testId)
      : ["admin", "tests", "_disabled", "questions"],
    enabled: testId !== null,
    queryFn: () =>
      unwrap(
        client.GET("/v1/tests/{test_id}/questions", {
          params: { path: { test_id: testId! } },
        }),
      ),
  });
}

export function flattenQuestions(
  data: { data: QuestionResponse[] } | undefined,
): QuestionResponse[] {
  return data?.data ?? [];
}

export function useCreateQuestion(testId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ComposedQuestionCreate) =>
      unwrap(
        client.POST("/v1/tests/{test_id}/questions", {
          params: { path: { test_id: testId ?? "" } },
          body: body as unknown as QuestionCreate,
        }),
      ),
    onSuccess: () => {
      if (!testId) return;
      qc.invalidateQueries({ queryKey: adminKeys.questions.all(testId) });
    },
  });
}

export function useUpdateQuestion(testId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      questionId,
      body,
    }: {
      questionId: string;
      body: ComposedQuestionUpdate;
    }) =>
      unwrap(
        client.PATCH("/v1/tests/{test_id}/questions/{question_id}", {
          params: {
            path: { test_id: testId ?? "", question_id: questionId },
          },
          body: body as unknown as QuestionUpdate,
        }),
      ),
    onSuccess: () => {
      if (!testId) return;
      qc.invalidateQueries({ queryKey: adminKeys.questions.all(testId) });
    },
  });
}

export function useDeleteQuestion(testId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (questionId: string) =>
      unwrap(
        client.DELETE("/v1/tests/{test_id}/questions/{question_id}", {
          params: {
            path: { test_id: testId ?? "", question_id: questionId },
          },
        }),
      ),
    onSuccess: () => {
      if (!testId) return;
      qc.invalidateQueries({ queryKey: adminKeys.questions.all(testId) });
    },
  });
}
