/**
 * Admin path editor (`/admin/paths/[pathId]/edit`) per FE-8 §B.7
 * (`fe-specs/FE-8-admin-catalogue.md:898–1067`).
 *
 * The literal `pathId === "new"` is a magic value for create mode;
 * any UUID triggers edit mode (per §B.7 §1).
 *
 * Server component for static metadata; client editor lives under
 * `_components/`. Pattern absorbed in Slice 2 + Slice 6.
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { PathEditor } from "./_components/path-editor";

export const metadata: Metadata = {
  title: "Edit learning path · Acumen",
};

export default function PathEditorPage() {
  return (
    <Suspense>
      <PathEditor />
    </Suspense>
  );
}
