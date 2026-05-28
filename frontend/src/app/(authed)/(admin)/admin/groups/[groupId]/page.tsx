/**
 * Group detail / membership view (`/admin/groups/[groupId]`) per FE-8
 * admin-identity §B.3 (`fe-specs/FE-8-admin-identity.md:453–649`).
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { GroupDetail } from "./_components/group-detail";

export const metadata: Metadata = {
  title: "Group · Acumen",
};

export default function AdminGroupDetailPage() {
  return (
    <Suspense>
      <GroupDetail />
    </Suspense>
  );
}
