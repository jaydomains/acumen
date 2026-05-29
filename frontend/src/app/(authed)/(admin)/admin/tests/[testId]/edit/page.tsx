/**
 * Admin test editor (`/admin/tests/[testId]/edit`) per FE-8 admin-tests
 * §B.2 (`fe-specs/FE-8-admin-tests.md:223–516`).
 *
 * The literal `testId === "new"` triggers create mode; any UUID
 * triggers edit mode. Server component for static metadata; the
 * client editor lives in `_components/test-editor.tsx` matching the
 * path-editor precedent (Slice 7).
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { TestEditor } from "./_components/test-editor";

export const metadata: Metadata = {
  title: "Edit test · Acumen",
};

export default function TestEditorPage() {
  return (
    <Suspense>
      <TestEditor />
    </Suspense>
  );
}
