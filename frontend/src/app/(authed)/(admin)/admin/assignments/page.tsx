/**
 * Admin assignments list (`/admin/assignments`) per FE-8 admin-identity §B.4
 * (`fe-specs/FE-8-admin-identity.md:651–822`).
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { AssignmentsList } from "./_components/assignments-list";

export const metadata: Metadata = {
  title: "Assignments · Acumen",
};

export default function AdminAssignmentsPage() {
  return (
    <Suspense>
      <AssignmentsList />
    </Suspense>
  );
}
