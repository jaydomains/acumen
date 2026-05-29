/**
 * Admin tests list (`/admin/tests`) per FE-8 admin-tests §B.1
 * (`fe-specs/FE-8-admin-tests.md:69–220`).
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { TestsTable } from "./_components/tests-table";

export const metadata: Metadata = {
  title: "Tests · Acumen",
};

export default function AdminTestsPage() {
  return (
    <Suspense>
      <TestsTable />
    </Suspense>
  );
}
