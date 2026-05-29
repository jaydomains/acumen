/**
 * Admin users list (`/admin/users`) per FE-8 admin-identity §B.1
 * (`fe-specs/FE-8-admin-identity.md:66–311`).
 *
 * Server component for static metadata; client list lives under
 * `_components/`. Slice 2 + Slice 6 pattern.
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { UsersList } from "./_components/users-list";

export const metadata: Metadata = {
  title: "Users · Acumen",
};

export default function AdminUsersPage() {
  return (
    <Suspense>
      <UsersList />
    </Suspense>
  );
}
