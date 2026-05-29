/**
 * Admin Anchor-calibration (`/calibration`) per FE-9 admin-systems §B.2
 * (`fe-specs/FE-9-admin-systems.md:225–446`).
 *
 * Server component for static metadata; the client surface lives under
 * `_components/`. Nav note (§H(b) item 14): the shipped rail has no
 * `calibration` entry yet — reachable by URL / the system-page CTA (Slice
 * 6) until the rail is extended in the Slice 7 close-out.
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { CalibrationView } from "./_components/calibration-view";

export const metadata: Metadata = {
  title: "Anchor calibration · Acumen",
};

export default function CalibrationPage() {
  return (
    <Suspense>
      <CalibrationView />
    </Suspense>
  );
}
