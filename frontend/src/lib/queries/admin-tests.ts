/**
 * Admin Tests query layer (thin list-only ahead of Slice 11).
 *
 * Slice 10 needs `useAdminTests` to populate the AssignmentEditor's
 * Test / Path picker. Slice 11 will extend this file with full CRUD
 * (`useAdminTest` detail + create / update / delete mutations) when
 * the test-editor surface ships.
 */

import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import { client, unwrap } from "@/lib/api/client";
import { adminKeys } from "@/lib/queries/admin-keys";
import type { components } from "@/lib/api/types";

export type TestResponse = components["schemas"]["TestResponse"];
export type TestsPage = components["schemas"]["Page_TestResponse_"];

const PAGE_SIZE = 50;

export function useAdminTests() {
  return useInfiniteQuery({
    queryKey: adminKeys.tests.list({}),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      unwrap(
        client.GET("/v1/tests", {
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

export function flattenTests(data: InfiniteData<TestsPage> | undefined): TestResponse[] {
  if (!data) return [];
  return data.pages.flatMap((p) => p.data);
}
