/**
 * Admin Grade-review query + mutation layer
 * (FE-9 admin-ops §B.2 in `fe-specs/FE-9-admin-ops.md:229–441`).
 * Mirrors the `admin-engagement.ts` / `admin-users.ts` module shape.
 *
 * Surfaces:
 *   - `useFlaggedGradeReviews(verdict)` — GET the queue, oldest-first.
 *     The `?verdict=` param (flagged | confirmed | all) IS wired on the
 *     backend (verified against the OpenAPI contract), so the queue
 *     page flips views without a second endpoint.
 *   - `useResolveGradeReview()` — POST the keep_ai / accept_reviewer /
 *     substitute resolution. On success invalidates `gradeReviews
 *     .flagged()` (all verdict variants via the `all()` root) AND the
 *     synthetic `ops.overview()` landing key.
 *
 * Wire-shape note: the §H(a) item 1 row-enrichment contract has LANDED
 * — `FlaggedGradeReviewItem` carries the full question/rubric/response
 * + AI-vs-reviewer comparison fields, so the DetailPane renders real
 * data (no sparse "—" placeholder). There is NO single-row
 * `GET /{id}` endpoint (§H(b) item 3); a deep-linked row that isn't in
 * the current view is recovered by reading the `verdict=all` list.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client, unwrap } from "@/lib/api/client";
import { adminKeys } from "@/lib/queries/admin-keys";
import type { components } from "@/lib/api/types";

export type FlaggedGradeReviewItem = components["schemas"]["FlaggedGradeReviewItem"];
export type FlaggedGradeReviewListResponse =
  components["schemas"]["FlaggedGradeReviewListResponse"];
export type GradeReviewResolveRequest =
  components["schemas"]["GradeReviewResolveRequest"];
export type GradeReviewResolveResult = components["schemas"]["GradeReviewResolveResult"];

export type VerdictFilter = "flagged" | "confirmed" | "all";

export function useFlaggedGradeReviews(
  verdict: VerdictFilter = "flagged",
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: adminKeys.gradeReviews.flagged({ verdict }),
    staleTime: 30_000,
    enabled: options.enabled ?? true,
    queryFn: () =>
      unwrap(
        client.GET("/v1/admin/grade-reviews/flagged", {
          params: { query: { verdict } },
        }),
      ),
  });
}

export function useResolveGradeReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { reviewId: string; body: GradeReviewResolveRequest }) =>
      unwrap(
        client.POST("/v1/admin/grade-reviews/{grade_review_id}/resolve", {
          params: { path: { grade_review_id: input.reviewId } },
          body: input.body,
        }),
      ),
    onSuccess: () => {
      // Invalidate every verdict variant via the gradeReviews root, plus
      // the synthetic landing key so the ops counters refresh.
      queryClient.invalidateQueries({ queryKey: adminKeys.gradeReviews.all() });
      queryClient.invalidateQueries({ queryKey: adminKeys.ops.overview() });
    },
  });
}
