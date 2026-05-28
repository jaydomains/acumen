/**
 * Learning-paths query + mutation layer (FE-8 catalogue §B.6 + §B.7 in
 * `fe-specs/FE-8-admin-catalogue.md:809–1067`). Mirrors `admin-pills.ts`
 * shape. Full CRUD shipped in Slice 6 even though the list page only
 * consumes list + delete + (navigates-to-create), to avoid a second
 * handlers.ts edit when Slice 7 ships the editor.
 *
 * Cursor pagination follows FE-3 §C.5. No `q`/owner filter in v1 per
 * §E item 5 (path volume is small enough not to warrant filter UX).
 */

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { client, unwrap } from "@/lib/api/client";
import { adminKeys } from "@/lib/queries/admin-keys";
import type { components } from "@/lib/api/types";

export type LearningPathResponse = components["schemas"]["LearningPathResponse"];
export type LearningPathCreate = components["schemas"]["LearningPathCreate"];
export type LearningPathUpdate = components["schemas"]["LearningPathUpdate"];
export type LearningPathsPage = components["schemas"]["Page_LearningPathResponse_"];

const PAGE_SIZE = 50;

export function useAdminPaths() {
  return useInfiniteQuery({
    queryKey: adminKeys.paths.list(),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      unwrap(
        client.GET("/v1/learning-paths", {
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

export function useAdminPath(pathId: string | null) {
  return useQuery({
    queryKey: pathId
      ? adminKeys.paths.detail(pathId)
      : ["admin", "paths", "detail", "_disabled"],
    enabled: pathId !== null,
    queryFn: () =>
      unwrap(
        client.GET("/v1/learning-paths/{path_id}", {
          params: { path: { path_id: pathId! } },
        }),
      ),
  });
}

export function flattenPaths(
  data: InfiniteData<LearningPathsPage> | undefined,
): LearningPathResponse[] {
  if (!data) return [];
  return data.pages.flatMap((p) => p.data);
}

export function useCreatePath() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LearningPathCreate) =>
      unwrap(client.POST("/v1/learning-paths", { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.paths.all() }),
  });
}

export function useUpdatePath() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pathId, body }: { pathId: string; body: LearningPathUpdate }) =>
      unwrap(
        client.PATCH("/v1/learning-paths/{path_id}", {
          params: { path: { path_id: pathId } },
          body,
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.paths.all() }),
  });
}

export function useDeletePath() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pathId: string) =>
      unwrap(
        client.DELETE("/v1/learning-paths/{path_id}", {
          params: { path: { path_id: pathId } },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.paths.all() }),
  });
}
