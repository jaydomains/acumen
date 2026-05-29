/**
 * Admin Engagement query + mutation layer
 * (FE-9 admin-ops §B.4 in `fe-specs/FE-9-admin-ops.md:645–778`).
 * Mirrors the `admin-users.ts` query-module shape.
 *
 * Two surfaces:
 *   - `useEngagementPending` — GET list of pending mandatory
 *     assignments past the stale threshold (`staleTime: 30_000`).
 *   - `useSweepEngagement` — bare POST mutation; on success it
 *     invalidates `engagement.pending()` AND `ops.overview()` (the
 *     synthetic landing key) per §C.1 invalidation discipline.
 *
 * Wire-shape note: the §H(a) item 1 row-enrichment contract has
 * LANDED in the backend schema — `EngagementWidgetItem` carries
 * `testee_name / pill_or_test_name / assigner_name / days_stale /
 * reminders_sent / escalated`, and `SweepResult` carries
 * `first_reminders_sent / second_reminders_sent / assignments_processed
 * / duration_ms / last_swept_at`. The spec prose was authored against
 * the pre-enrichment sparse shape; we build to the enriched (current)
 * wire contract, which is the spec's documented post-enrichment target.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client, unwrap } from "@/lib/api/client";
import { adminKeys } from "@/lib/queries/admin-keys";
import type { components } from "@/lib/api/types";

export type EngagementWidgetItem = components["schemas"]["EngagementWidgetItem"];
export type EngagementWidgetResponse =
  components["schemas"]["EngagementWidgetResponse"];
export type SweepResult = components["schemas"]["SweepResult"];

export function useEngagementPending() {
  return useQuery({
    queryKey: adminKeys.engagement.pending(),
    staleTime: 30_000,
    queryFn: () => unwrap(client.GET("/v1/admin/engagement/pending")),
  });
}

export function useSweepEngagement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(client.POST("/v1/admin/engagement/sweep")),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.engagement.pending() });
      queryClient.invalidateQueries({ queryKey: adminKeys.ops.overview() });
    },
  });
}
