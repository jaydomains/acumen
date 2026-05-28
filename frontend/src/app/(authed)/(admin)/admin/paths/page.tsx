/**
 * Admin paths list (`/admin/paths`) per FE-8 §B.6
 * (`fe-specs/FE-8-admin-catalogue.md:809–894`).
 *
 * Server component for static metadata; the client list lives under
 * `_components/`. Pattern absorbed in Slice 2 (catalogue page).
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { PathsList } from "./_components/paths-list";

export const metadata: Metadata = {
  title: "Learning paths · Acumen",
};

export default function AdminPathsPage() {
  return (
    <Suspense>
      <PathsList />
    </Suspense>
  );
}
