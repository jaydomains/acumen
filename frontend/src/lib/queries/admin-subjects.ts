/**
 * Subjects query + mutation layer (FE-8 catalogue §B.3 in
 * `fe-specs/FE-8-admin-catalogue.md:425–533`). Owns the `useAdminSubjects`
 * infinite-list hook + create/update/delete mutations consumed by the
 * SubjectsTab.
 *
 * Cursor pagination follows FE-3 §C.5's pattern (`fe-specs/FE-3-content.md:634`):
 * `useInfiniteQuery` keyed off `adminKeys.subjects.list({})`,
 * `getNextPageParam: (last) => last.meta.next_cursor ?? undefined`.
 *
 * Search `q` is NOT in the query key or sent on the wire — the
 * `GET /v1/subjects` endpoint has no `q` param per `frontend/openapi/schema.json:917`,
 * absorbed under §E.7 ("client-side filter fallback"). Consumers filter
 * the flattened page array locally.
 *
 * Mutations invalidate `adminKeys.subjects.all()`, which prefix-matches
 * every `list(...)` key per §C.1.
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

export type SubjectResponse = components["schemas"]["SubjectResponse"];
export type SubjectCreate = components["schemas"]["SubjectCreate"];
export type SubjectUpdate = components["schemas"]["SubjectUpdate"];
export type SubjectsPage = components["schemas"]["Page_SubjectResponse_"];

const PAGE_SIZE = 50;

export function useAdminSubjects() {
  return useInfiniteQuery({
    queryKey: adminKeys.subjects.list({}),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      unwrap(
        client.GET("/v1/subjects", {
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

export function flattenSubjects(
  data: InfiniteData<SubjectsPage> | undefined,
): SubjectResponse[] {
  if (!data) return [];
  return data.pages.flatMap((p) => p.data);
}

export function useCreateSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SubjectCreate) => unwrap(client.POST("/v1/subjects", { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.subjects.all() }),
  });
}

export function useUpdateSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subjectId, body }: { subjectId: string; body: SubjectUpdate }) =>
      unwrap(
        client.PATCH("/v1/subjects/{subject_id}", {
          params: { path: { subject_id: subjectId } },
          body,
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.subjects.all() }),
  });
}

export function useDeleteSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subjectId: string) =>
      unwrap(
        client.DELETE("/v1/subjects/{subject_id}", {
          params: { path: { subject_id: subjectId } },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.subjects.all() }),
  });
}
