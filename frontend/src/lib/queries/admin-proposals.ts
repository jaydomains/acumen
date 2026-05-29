/**
 * Pill-proposals query + mutation layer (FE-8 catalogue §B.4 in
 * `fe-specs/FE-8-admin-catalogue.md:537–679`). Mirrors the
 * `admin-pills.ts` + `admin-subjects.ts` shape.
 *
 * Cursor pagination follows FE-3 §C.5. Status filter is NOT in the
 * query key or sent on the wire — `GET /v1/pill-proposals` only
 * takes `cursor + limit` (`frontend/openapi/schema.json:1865`).
 * Spec §E.7 absorbs the gap: filter the cached page array client-side
 * over the derived status (`parse-proposal-payload.ts:deriveProposalStatus`).
 *
 * Cross-resource invalidation per §C.1 lock:
 *   - approve fires `proposals.all()` AND `pills.all()` (approved
 *     proposal becomes a real pill row)
 *   - reject fires `proposals.all()` only
 *
 * Approve returns `PillResponse` (the created pill), not the proposal
 * — drift Finding #1, absorbed: we discard the return value and rely
 * on refetch via invalidation for the UI flip.
 */

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { client, unwrap } from "@/lib/api/client";
import { adminKeys } from "@/lib/queries/admin-keys";
import type { components } from "@/lib/api/types";

export type PillProposalResponse = components["schemas"]["PillProposalResponse"];
export type PillProposalsPage = components["schemas"]["Page_PillProposalResponse_"];

const PAGE_SIZE = 50;

export function useAdminPillProposals() {
  return useInfiniteQuery({
    queryKey: adminKeys.proposals.list({}),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      unwrap(
        client.GET("/v1/pill-proposals", {
          params: {
            query: {
              cursor: pageParam ?? null,
              limit: PAGE_SIZE,
            },
          },
        }),
      ),
    getNextPageParam: (last) => last.meta.next_cursor ?? undefined,
  });
}

export function flattenProposals(
  data: InfiniteData<PillProposalsPage> | undefined,
): PillProposalResponse[] {
  if (!data) return [];
  return data.pages.flatMap((p) => p.data);
}

export function useApproveProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) =>
      unwrap(
        client.POST("/v1/pill-proposals/{proposal_id}/approve", {
          params: { path: { proposal_id: proposalId } },
        }),
      ),
    onSuccess: () => {
      // Cross-resource: approved proposal becomes a pill, so both
      // domains must refetch per §C.1.
      qc.invalidateQueries({ queryKey: adminKeys.proposals.all() });
      qc.invalidateQueries({ queryKey: adminKeys.pills.all() });
    },
  });
}

export function useRejectProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) =>
      unwrap(
        client.POST("/v1/pill-proposals/{proposal_id}/reject", {
          params: { path: { proposal_id: proposalId } },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.proposals.all() }),
  });
}
