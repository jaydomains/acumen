/**
 * Admin Tests query + mutation layer.
 *
 * Slice 10 shipped a thin `useAdminTests` list-only hook. Slice 11
 * extends this file with detail + create + update + delete to back
 * the `/admin/tests` list page (delete + navigation to the Slice 12
 * editor).
 *
 * Slice 11 drift Finding #1: `GET /v1/tests` does not accept `mode` or
 * `status` query params — they're declared in the spec body but absent
 * from the wire. Filter happens client-side over the flattened pages
 * per §E.7 family. `useAdminTests` therefore takes no filter argument;
 * the cache is shared across all consumers (assignment editor, tests
 * list, future test editor).
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

export type TestResponse = components["schemas"]["TestResponse"];
export type TestCreate = components["schemas"]["TestCreate"];
export type TestUpdate = components["schemas"]["TestUpdate"];
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

export function useAdminTest(testId: string | null) {
  return useQuery({
    queryKey: testId
      ? adminKeys.tests.detail(testId)
      : ["admin", "tests", "detail", "_disabled"],
    enabled: testId !== null,
    queryFn: () =>
      unwrap(
        client.GET("/v1/tests/{test_id}", {
          params: { path: { test_id: testId! } },
        }),
      ),
  });
}

export function flattenTests(data: InfiniteData<TestsPage> | undefined): TestResponse[] {
  if (!data) return [];
  return data.pages.flatMap((p) => p.data);
}

export function useCreateTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TestCreate) => unwrap(client.POST("/v1/tests", { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.tests.all() }),
  });
}

export function useUpdateTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ testId, body }: { testId: string; body: TestUpdate }) =>
      unwrap(
        client.PATCH("/v1/tests/{test_id}", {
          params: { path: { test_id: testId } },
          body,
        }),
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: adminKeys.tests.all() });
      qc.invalidateQueries({ queryKey: adminKeys.tests.detail(vars.testId) });
    },
  });
}

export function useDeleteTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (testId: string) =>
      unwrap(
        client.DELETE("/v1/tests/{test_id}", {
          params: { path: { test_id: testId } },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.tests.all() }),
  });
}
