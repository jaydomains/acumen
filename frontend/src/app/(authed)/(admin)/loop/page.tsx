/**
 * Admin Loop queue (`/loop`) per FE-9 admin-ops §B.3
 * (`fe-specs/FE-9-admin-ops.md:443–642`).
 *
 * Server component for static metadata; the client surface (status-
 * filtered table + approve/reject modals) lives under `_components/`.
 * Mirrors the FE-9 engagement / grade-review page pattern.
 *
 * Route note: ships at top-level `/loop` (singular) per the shipped nav
 * rail (`Rail.tsx:67`), not `/admin/loops` as the spec prose writes.
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { LoopQueue } from "./_components/loop-queue";

export const metadata: Metadata = {
  title: "Loops · Acumen",
};

export default function LoopPage() {
  return (
    <Suspense>
      <LoopQueue />
    </Suspense>
  );
}
