/**
 * Admin Users query + mutation layer (FE-8 admin-identity §B.1 in
 * `fe-specs/FE-8-admin-identity.md:66–311`). Mirrors `admin-paths.ts`
 * shape from Slice 6.
 *
 * Filter discipline:
 *   - `role` + `status` go on the wire (server-supported per
 *     `frontend/openapi/schema.json:507–589`).
 *   - `q` text search is client-side per §E.11 / Slice 8 drift
 *     Finding #3 (server doesn't accept it).
 *
 * Wire status enum is `active | deactivated` only; the UI's "Invited"
 * status is derived client-side via `deriveUserStatus` per drift
 * Finding #5.
 *
 * `useResendSetup` is NOT shipped — endpoint TBD per drift Finding #6;
 * the row action ships as a disabled affordance.
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

export type UserResponse = components["schemas"]["UserResponse"];
export type AdminCreateUserRequest = components["schemas"]["AdminCreateUserRequest"];
export type UserUpdate = components["schemas"]["UserUpdate"];
export type UsersPage = components["schemas"]["Page_UserResponse_"];

export type UserListFilters = {
  role?: "admin" | "testee";
  status?: "active" | "deactivated";
};

const PAGE_SIZE = 50;

export function useAdminUsers(filters: UserListFilters = {}) {
  return useInfiniteQuery({
    queryKey: adminKeys.users.list(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      unwrap(
        client.GET("/v1/users", {
          params: {
            query: {
              cursor: pageParam ?? null,
              limit: PAGE_SIZE,
              role: filters.role ?? null,
              status: filters.status ?? null,
            },
          },
        }),
      ),
    getNextPageParam: (last) => last.meta.next_cursor ?? undefined,
  });
}

export function useAdminUser(userId: string | null) {
  return useQuery({
    queryKey: userId
      ? adminKeys.users.detail(userId)
      : ["admin", "users", "detail", "_disabled"],
    enabled: userId !== null,
    queryFn: () =>
      unwrap(
        client.GET("/v1/users/{user_id}", {
          params: { path: { user_id: userId! } },
        }),
      ),
  });
}

export function flattenUsers(data: InfiniteData<UsersPage> | undefined): UserResponse[] {
  if (!data) return [];
  return data.pages.flatMap((p) => p.data);
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminCreateUserRequest) =>
      unwrap(client.POST("/v1/users", { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.users.all() }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, body }: { userId: string; body: UserUpdate }) =>
      unwrap(
        client.PATCH("/v1/users/{user_id}", {
          params: { path: { user_id: userId } },
          body,
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.users.all() }),
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      unwrap(
        client.POST("/v1/users/{user_id}/deactivate", {
          params: { path: { user_id: userId } },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.users.all() }),
  });
}

export function useReactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      unwrap(
        client.POST("/v1/users/{user_id}/reactivate", {
          params: { path: { user_id: userId } },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.users.all() }),
  });
}
