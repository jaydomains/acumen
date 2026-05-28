/**
 * Admin catalogue shell (FE-8 §B.1, `fe-specs/FE-8-admin-catalogue.md:89–194`).
 *
 * Server component — exists only to export the static page title.
 * (FE-2's `(admin)/layout.tsx` is "use client" because it calls
 * `usePathname()`, so per-route metadata cannot ride on the layout —
 * absorbed under Slice 2 drift Finding #9.)
 *
 * Wraps the client shell in <Suspense> because `useSearchParams()` is
 * called inside CatalogueShell — Next 15 requires the boundary.
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { CatalogueShell } from "./_components/catalogue-shell";

export const metadata: Metadata = {
  title: "Catalogue · Acumen",
};

export default function AdminCataloguePage() {
  return (
    <Suspense>
      <CatalogueShell />
    </Suspense>
  );
}
