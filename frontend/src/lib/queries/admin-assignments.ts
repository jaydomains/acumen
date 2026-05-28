/**
 * Admin Assignments query + mutation layer (FE-8 admin-identity §B.4
 * in `fe-specs/FE-8-admin-identity.md:651–822`).
 *
 * v1 LOCKED scope per §E item 9: create + delete only. No PATCH/edit;
 * existing assignments are deleted + recreated. (`PATCH` doesn't exist
 * on the wire anyway per Slice 10 drift Finding #4.)
 *
 * List takes an optional `assigner_id` server-side filter — the page
 * defaults to `me` (current admin) per §B.4 §1; "all" omits the param.
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

export type AssignmentResponse = components["schemas"]["AssignmentResponse"];
export type AssignmentCreate = components["schemas"]["AssignmentCreate"];
export type AssignmentsPage = components["schemas"]["Page_AssignmentResponse_"];

const PAGE_SIZE = 50;

export function useAdminAssignments(filters: { assigner_id?: string } = {}) {
  return useInfiniteQuery({
    queryKey: adminKeys.assignments.list(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      unwrap(
        client.GET("/v1/assignments", {
          params: {
            query: {
              cursor: pageParam ?? null,
              limit: PAGE_SIZE,
              assigner_id: filters.assigner_id ?? null,
            },
          },
        }),
      ),
    getNextPageParam: (last) => last.meta.next_cursor ?? undefined,
  });
}

export function flattenAssignments(
  data: InfiniteData<AssignmentsPage> | undefined,
): AssignmentResponse[] {
  if (!data) return [];
  return data.pages.flatMap((p) => p.data);
}

export function useCreateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AssignmentCreate) =>
      unwrap(client.POST("/v1/assignments", { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.assignments.all() }),
  });
}

export function useDeleteAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) =>
      unwrap(
        client.DELETE("/v1/assignments/{assignment_id}", {
          params: { path: { assignment_id: assignmentId } },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.assignments.all() }),
  });
}
