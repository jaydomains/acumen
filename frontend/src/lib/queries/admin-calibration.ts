/**
 * Admin Anchor-calibration query + mutation layer
 * (FE-9 admin-systems §B.2 in `fe-specs/FE-9-admin-systems.md:225–446`).
 *
 * Surfaces:
 *   - `useFlaggedAnchors()` — GET the AC-D23 bootstrap-quality flag queue
 *     (oldest-first). Aggregated client-side into the per-pill drift
 *     table; `?pill=` filtering is client-side (no server param).
 *   - `useRunCalibration()` — POST the §8.9 calibration sweep; on success
 *     invalidates the flagged-anchors + ops.overview keys and stashes the
 *     `CalibrationSweepResult` under `calibration.lastRun()` so the
 *     summary strip can read it.
 *   - `useResolveAnchor()` — POST resolve (keep | reject |
 *     substitute_wording + new_config). Invalidates flagged-anchors +
 *     ops.overview.
 *
 * Row shape: `FlaggedAnchorItem` is enriched (§H(a) item 1 — carries
 * `pill_name`), so the table + drift grouping render without a second
 * lookup.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client, unwrap } from "@/lib/api/client";
import { adminKeys } from "@/lib/queries/admin-keys";
import type { components } from "@/lib/api/types";

export type FlaggedAnchorItem = components["schemas"]["FlaggedAnchorItem"];
export type FlaggedAnchorListResponse =
  components["schemas"]["FlaggedAnchorListResponse"];
export type AnchorResolveRequest = components["schemas"]["AnchorResolveRequest"];
export type AnchorResolveResult = components["schemas"]["AnchorResolveResult"];
export type CalibrationSweepResult = components["schemas"]["CalibrationSweepResult"];

export function useFlaggedAnchors() {
  return useQuery({
    queryKey: adminKeys.calibration.flaggedAnchors(),
    staleTime: 30_000,
    queryFn: () => unwrap(client.GET("/v1/admin/anchors/flagged")),
  });
}

export function useRunCalibration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(client.POST("/v1/admin/calibration/run")),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.calibration.flaggedAnchors() });
      queryClient.invalidateQueries({ queryKey: adminKeys.ops.overview() });
      // Session-local summary source for the stat strip.
      queryClient.setQueryData(adminKeys.calibration.lastRun(), result);
    },
  });
}

export function useResolveAnchor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { anchorId: string; body: AnchorResolveRequest }) =>
      unwrap(
        client.POST("/v1/admin/anchors/{anchor_id}/resolve", {
          params: { path: { anchor_id: input.anchorId } },
          body: input.body,
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.calibration.flaggedAnchors() });
      queryClient.invalidateQueries({ queryKey: adminKeys.ops.overview() });
    },
  });
}
