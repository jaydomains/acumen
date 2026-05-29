/**
 * Admin Grade-review queue (`/review`) per FE-9 admin-ops §B.2
 * (`fe-specs/FE-9-admin-ops.md:229–441`).
 *
 * Server component for static metadata; the client surface (URL-stated
 * two-column queue + override drawer) lives under `_components/`.
 * Mirrors the FE-8 users / FE-9 engagement page pattern.
 *
 * Route note: ships at top-level `/review` per the shipped nav rail
 * (`Rail.tsx:48`), not `/admin/grade-reviews` as the spec prose writes.
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { GradeReviewQueue } from "./_components/grade-review-queue";

export const metadata: Metadata = {
  title: "Grade review · Acumen",
};

export default function GradeReviewPage() {
  return (
    <Suspense>
      <GradeReviewQueue />
    </Suspense>
  );
}
