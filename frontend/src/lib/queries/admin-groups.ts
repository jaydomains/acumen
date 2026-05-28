/**
 * Admin Groups query + mutation layer (FE-8 admin-identity §B.2 + §B.3
 * in `fe-specs/FE-8-admin-identity.md:313–649`). Mirrors `admin-users.ts`
 * and `admin-paths.ts` shape.
 *
 * Important: there is no `GET /v1/groups/{id}/members` endpoint on the
 * wire (Slice 9 drift Finding #1). The member list is derived client-
 * side from `GroupResponse.member_ids` joined against the cached
 * `useAdminUsers` directory — no separate `useGroupMembers` hook.
 *
 * `POST /v1/groups/{id}/members` accepts a single `{user_id}` body
 * (NOT bulk, drift Finding #2). The picker UX fans out N parallel
 * POSTs via `Promise.allSettled` to support multi-select.
 *
 * System groups (`is_system === true`) are immutable — no PATCH /
 * DELETE / member additions / member removals.
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

export type GroupResponse = components["schemas"]["GroupResponse"];
export type GroupCreate = components["schemas"]["GroupCreate"];
export type GroupUpdate = components["schemas"]["GroupUpdate"];
export type GroupMemberRequest = components["schemas"]["GroupMemberRequest"];
export type GroupsPage = components["schemas"]["Page_GroupResponse_"];

const PAGE_SIZE = 50;

export function useAdminGroups() {
  return useInfiniteQuery({
    queryKey: adminKeys.groups.list({}),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      unwrap(
        client.GET("/v1/groups", {
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

export function useAdminGroup(groupId: string | null) {
  return useQuery({
    queryKey: groupId
      ? adminKeys.groups.detail(groupId)
      : ["admin", "groups", "detail", "_disabled"],
    enabled: groupId !== null,
    queryFn: () =>
      unwrap(
        client.GET("/v1/groups/{group_id}", {
          params: { path: { group_id: groupId! } },
        }),
      ),
  });
}

export function flattenGroups(
  data: InfiniteData<GroupsPage> | undefined,
): GroupResponse[] {
  if (!data) return [];
  return data.pages.flatMap((p) => p.data);
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: GroupCreate) => unwrap(client.POST("/v1/groups", { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.groups.all() }),
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, body }: { groupId: string; body: GroupUpdate }) =>
      unwrap(
        client.PATCH("/v1/groups/{group_id}", {
          params: { path: { group_id: groupId } },
          body,
        }),
      ),
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: adminKeys.groups.all() });
      qc.invalidateQueries({ queryKey: adminKeys.groups.detail(vars.groupId) });
    },
  });
}

export function useAddGroupMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      unwrap(
        client.POST("/v1/groups/{group_id}/members", {
          params: { path: { group_id: groupId } },
          body: { user_id: userId },
        }),
      ),
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: adminKeys.groups.detail(vars.groupId) });
      qc.invalidateQueries({ queryKey: adminKeys.groups.all() });
    },
  });
}

export function useRemoveGroupMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      unwrap(
        client.DELETE("/v1/groups/{group_id}/members/{user_id}", {
          params: { path: { group_id: groupId, user_id: userId } },
        }),
      ),
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: adminKeys.groups.detail(vars.groupId) });
      qc.invalidateQueries({ queryKey: adminKeys.groups.all() });
    },
  });
}
