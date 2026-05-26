/**
 * Catalogue query keys + hooks (FE-3 §B.5, §C.2; AC-CD21).
 *
 * Key shape: `[domain, resource, ...params]`. Keys are referentially
 * stable for equal params via TanStack Query's structural equality.
 *
 * Page files MUST import hooks + keys from this module — never inline
 * a key shape. Adding a new catalogue query extends this file, not the
 * caller.
 *
 * Invalidation:
 *   `queryClient.invalidateQueries({ queryKey: catalogueQueryKeys.all })`
 * clears every catalogue cache entry (pills lists + subjects).
 */

import {
  useInfiniteQuery,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import { client, unwrap } from "@/lib/api/client";
import type { components } from "@/lib/api/types";
import { pillQueryKeys } from "./pills";

export type PillResponse = components["schemas"]["PillResponse"];
export type PillsPage = components["schemas"]["Page_PillResponse_"];

export type PillsQueryParams = {
  search?: string;
  subject_id?: string;
  difficulty?: number;
};

export const catalogueQueryKeys = {
  all: ["catalogue"] as const,
  pills: (params?: PillsQueryParams) =>
    [...catalogueQueryKeys.all, "pills", params ?? {}] as const,
  subjects: () => [...catalogueQueryKeys.all, "subjects"] as const,
};

const PAGE_SIZE = 50;

/**
 * Cursor-paginated catalogue discovery (FE-3 §C.5).
 *
 * Side effect on success: every pill in the page is also primed in
 * `pillQueryKeys.detail(pill.id)` so navigating from catalogue to
 * `/pills/[id]` skips a redundant fetch (FE-3 §D.3, spec D.3).
 */
export function useCataloguePills(
  params: PillsQueryParams,
  queryClient: QueryClient,
) {
  return useInfiniteQuery({
    queryKey: catalogueQueryKeys.pills(params),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const page = await unwrap(
        client.GET("/v1/catalogue/pills", {
          params: {
            query: {
              cursor: pageParam ?? null,
              limit: PAGE_SIZE,
              subject_id: params.subject_id ?? null,
              difficulty: params.difficulty ?? null,
              search: params.search ?? null,
            },
          },
        }),
      );
      for (const pill of page.data) {
        queryClient.setQueryData(pillQueryKeys.detail(pill.id), pill);
      }
      return page;
    },
    getNextPageParam: (last) => last.meta.next_cursor ?? undefined,
  });
}

/** Flatten infinite pages → single pill array. */
export function flattenPills(
  data: InfiniteData<PillsPage> | undefined,
): PillResponse[] {
  if (!data) return [];
  return data.pages.flatMap((p) => p.data);
}
