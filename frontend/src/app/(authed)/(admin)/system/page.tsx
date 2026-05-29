/**
 * Admin System operations (`/system`) per FE-9 admin-systems §B.3
 * (`fe-specs/FE-9-admin-systems.md:448–622`).
 *
 * Server component for static metadata; the client surface (5 op cards)
 * lives under `_components/`. Nav note (§H(b) item 14): the shipped rail
 * has no `system` entry yet — reachable by URL until the Slice 7 close-out
 * extends the rail.
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { SystemPage } from "./_components/system-page";

export const metadata: Metadata = {
  title: "System operations · Acumen",
};

export default function SystemOpsPage() {
  return (
    <Suspense>
      <SystemPage />
    </Suspense>
  );
}
