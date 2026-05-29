/**
 * Admin System-operations query + mutation layer
 * (FE-9 admin-systems §B.3 in `fe-specs/FE-9-admin-systems.md:448–622`).
 *
 * Two status GETs (drive-index, realism-status) drive card stats; four
 * bare POST mutations trigger the operational sweeps. Each mutation
 * invalidates its card's status key + the synthetic `ops.overview()`;
 * bootstrap invalidates a wider set (it touches anchors, safety links,
 * and the Drive index) per §C.1.
 *
 * Bootstrap + safety-link cards have no status GET — their stats are
 * session-local (mirroring the calibration `lastRun` pattern), populated
 * from the POST result.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client, unwrap } from "@/lib/api/client";
import { adminKeys } from "@/lib/queries/admin-keys";
import type { components } from "@/lib/api/types";

export type DriveIndexStatus = components["schemas"]["DriveIndexStatus"];
export type DriveIngestResult = components["schemas"]["DriveIngestResult"];
export type RealismStatusResponse = components["schemas"]["RealismStatusResponse"];
export type RealismAggregationResult = components["schemas"]["RealismAggregationResult"];
export type SafetyLinkCheckResult = components["schemas"]["SafetyLinkCheckResult"];
export type BootstrapRunResult = components["schemas"]["BootstrapRunResult"];

export function useDriveIndex() {
  return useQuery({
    queryKey: adminKeys.system.driveIndex(),
    staleTime: 30_000,
    queryFn: () => unwrap(client.GET("/v1/admin/drive/index")),
  });
}

export function useRealismStatus() {
  return useQuery({
    queryKey: adminKeys.system.realismStatus(),
    staleTime: 30_000,
    queryFn: () => unwrap(client.GET("/v1/admin/realism/status")),
  });
}

export function useRunBootstrap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(client.POST("/v1/admin/bootstrap/run")),
    onSuccess: () => {
      // Bootstrap touches anchors + safety links + the Drive index.
      queryClient.invalidateQueries({ queryKey: adminKeys.system.driveIndex() });
      queryClient.invalidateQueries({ queryKey: adminKeys.calibration.flaggedAnchors() });
      queryClient.invalidateQueries({ queryKey: adminKeys.pills.all() });
      queryClient.invalidateQueries({ queryKey: adminKeys.ops.overview() });
    },
  });
}

export function useRunDriveIngest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(client.POST("/v1/admin/drive/ingest")),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.system.driveIndex() });
      queryClient.invalidateQueries({ queryKey: adminKeys.ops.overview() });
    },
  });
}

export function useRunRealismAggregate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(client.POST("/v1/admin/realism/aggregate")),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.system.realismStatus() });
      queryClient.invalidateQueries({ queryKey: adminKeys.ops.overview() });
    },
  });
}

export function useRunSafetyLinkCheck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(client.POST("/v1/admin/safety-links/check")),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.system.safetyLinkStatus() });
      queryClient.invalidateQueries({ queryKey: adminKeys.ops.overview() });
    },
  });
}
