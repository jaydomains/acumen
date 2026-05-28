/**
 * Pills query + mutation layer (FE-8 catalogue §B.2 in
 * `fe-specs/FE-8-admin-catalogue.md:196–423`). Mirrors the
 * `admin-subjects.ts` shape Slice 2 established.
 *
 * Cursor pagination follows FE-3 §C.5 (`CatalogueGrid.tsx:30–44`).
 *
 * Filters: `q` (text search) and `subject_id` are NOT in the query
 * key or sent on the wire. `GET /v1/pills` only takes `cursor + limit`
 * per `frontend/openapi/schema.json:1227–1300`; spec §E.7 absorbs the
 * gap by filtering client-side over the flattened page array. Same
 * pattern Slice 2 applied to subjects.
 *
 * Safety toggle uses the dedicated `PATCH /v1/pills/{id}/safety`
 * endpoint per `frontend/openapi/schema.json:1538` because
 * `PillCreate` + `PillUpdate` both have `additionalProperties: false`
 * and neither carries `safety_relevant` — sending it inline 422s
 * (Slice 3 drift Finding #1, absorbed under standing pattern).
 *
 * `subject_id` is also absent from `PillUpdate` — the subject is
 * immutable post-create; the edit modal renders it read-only.
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

export type PillResponse = components["schemas"]["PillResponse"];
export type PillCreate = components["schemas"]["PillCreate"];
export type PillUpdate = components["schemas"]["PillUpdate"];
export type PillsPage = components["schemas"]["Page_PillResponse_"];

const PAGE_SIZE = 50;

export function useAdminPills() {
  return useInfiniteQuery({
    queryKey: adminKeys.pills.list({}),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      unwrap(
        client.GET("/v1/pills", {
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

export function flattenPills(data: InfiniteData<PillsPage> | undefined): PillResponse[] {
  if (!data) return [];
  return data.pages.flatMap((p) => p.data);
}

export function useCreatePill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PillCreate) => unwrap(client.POST("/v1/pills", { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.pills.all() }),
  });
}

export function useUpdatePill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pillId, body }: { pillId: string; body: PillUpdate }) =>
      unwrap(
        client.PATCH("/v1/pills/{pill_id}", {
          params: { path: { pill_id: pillId } },
          body,
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.pills.all() }),
  });
}

export function useSetPillSafety() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      pillId,
      safety_relevant,
    }: {
      pillId: string;
      safety_relevant: boolean;
    }) =>
      unwrap(
        client.PATCH("/v1/pills/{pill_id}/safety", {
          params: { path: { pill_id: pillId } },
          body: { safety_relevant },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.pills.all() }),
  });
}
