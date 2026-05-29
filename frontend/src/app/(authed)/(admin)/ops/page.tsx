/**
 * Admin ops landing (`/ops`) per FE-9 admin-ops §B.1 — the FE-9 close-out
 * (`fe-specs/FE-9-admin-ops.md:82–227`). Replaces the FE-2 placeholder
 * with the real five-card operations overview.
 *
 * Server component for static metadata; the read-only client surface
 * lives under `_components/`.
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { OpsLanding } from "./_components/ops-landing";

export const metadata: Metadata = {
  title: "Operations · Acumen",
};

export default function OpsPage() {
  return (
    <Suspense>
      <OpsLanding />
    </Suspense>
  );
}
