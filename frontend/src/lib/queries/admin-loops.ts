/**
 * Admin Loop-queue query + mutation layer
 * (FE-9 admin-ops §B.3 in `fe-specs/FE-9-admin-ops.md:443–642`).
 * Mirrors the `admin-grade-reviews.ts` module shape.
 *
 * Surfaces:
 *   - `useLoopQueue(status)` — GET the admin-reviewed loop queue,
 *     oldest-first. The `?status=` param (review | queued | step-down |
 *     material-served | closed) IS wired server-side; "all" omits it.
 *   - `useApproveLoop()` — POST approve (empty body) → returns
 *     `follow_up_count`.
 *   - `useRejectLoop()` — POST reject with `{ reason }` (the backend
 *     `LoopRejectRequest` accepts a reason, verified against the contract).
 * Both mutations invalidate `loops.queue()` (all status variants via the
 * `all()` root) and the synthetic `ops.overview()` landing key.
 *
 * Wire-shape note: the §H(a) item 1 enrichment has LANDED —
 * `LoopQueueItem` carries `testee_name / loop_mode / iteration (string) /
 * last_attempt_at / status`. The endpoint returns admin-reviewed rows
 * only (autonomous loops self-progress and never enter the queue), so the
 * Mode column always reads "admin-reviewed" in practice.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client, unwrap } from "@/lib/api/client";
import { adminKeys } from "@/lib/queries/admin-keys";
import type { components } from "@/lib/api/types";

export type LoopQueueItem = components["schemas"]["LoopQueueItem"];
export type LoopQueueListResponse = components["schemas"]["LoopQueueListResponse"];
export type LoopApproveResult = components["schemas"]["LoopApproveResult"];
export type LoopRejectResult = components["schemas"]["LoopRejectResult"];

/** Derived 5-value status enum (matches the wire) plus the "all" view. */
export type LoopStatus = LoopQueueItem["status"];
export type LoopStatusFilter = LoopStatus | "all";

export function useLoopQueue(status: LoopStatusFilter = "review") {
  return useQuery({
    queryKey: adminKeys.loops.queue({ status }),
    staleTime: 30_000,
    queryFn: () =>
      unwrap(
        client.GET("/v1/admin/loop/queue", {
          // "all" omits the param (backend returns every routed-to-admin row).
          params: { query: { status: status === "all" ? null : status } },
        }),
      ),
  });
}

export function useApproveLoop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reportId: string) =>
      unwrap(
        client.POST("/v1/admin/loop/queue/{weakness_report_id}/approve", {
          params: { path: { weakness_report_id: reportId } },
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.loops.all() });
      queryClient.invalidateQueries({ queryKey: adminKeys.ops.overview() });
    },
  });
}

export function useRejectLoop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { reportId: string; reason: string }) =>
      unwrap(
        client.POST("/v1/admin/loop/queue/{weakness_report_id}/reject", {
          params: { path: { weakness_report_id: input.reportId } },
          body: { reason: input.reason },
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.loops.all() });
      queryClient.invalidateQueries({ queryKey: adminKeys.ops.overview() });
    },
  });
}
