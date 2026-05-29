/**
 * Admin groups list (`/admin/groups`) per FE-8 admin-identity §B.2
 * (`fe-specs/FE-8-admin-identity.md:313–452`).
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { GroupsList } from "./_components/groups-list";

export const metadata: Metadata = {
  title: "Groups · Acumen",
};

export default function AdminGroupsPage() {
  return (
    <Suspense>
      <GroupsList />
    </Suspense>
  );
}
