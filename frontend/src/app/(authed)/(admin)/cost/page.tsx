/**
 * Admin Cost dashboard (`/cost`) per FE-9 admin-systems §B.1
 * (`fe-specs/FE-9-admin-systems.md:73–223`).
 *
 * Server component for static metadata; the read-only client surface
 * lives under `_components/`. Route `/cost` per the shipped nav rail
 * (`Rail.tsx:66`).
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { CostDashboard } from "./_components/cost-dashboard";

export const metadata: Metadata = {
  title: "AI cost · Acumen",
};

export default function CostPage() {
  return (
    <Suspense>
      <CostDashboard />
    </Suspense>
  );
}
