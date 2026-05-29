/**
 * Admin Engagement page (`/engagement`) per FE-9 admin-ops §B.4
 * (`fe-specs/FE-9-admin-ops.md:645–778`).
 *
 * Server component for static metadata; the client surface (sweep
 * affordance + pending list) lives under `_components/`. Mirrors the
 * FE-8 users page (Slice 2) pattern.
 *
 * Route note: the shipped nav rail (`Rail.tsx:49`) anchors engagement
 * at top-level `/engagement` (like `/ops`), so the segment lives under
 * the `(admin)` group directly rather than `/admin/engagement`.
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { PendingList } from "./_components/pending-list";

export const metadata: Metadata = {
  title: "Engagement · Acumen",
};

export default function EngagementPage() {
  return (
    <Suspense>
      <PendingList />
    </Suspense>
  );
}
