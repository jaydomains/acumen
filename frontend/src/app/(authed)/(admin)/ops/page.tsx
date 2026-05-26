"use client";

/**
 * Admin ops landing at `/ops`. Empty placeholder per FE-2-shell.md
 * §B.14 — FE-9 lands the real loop / engagement / cost / calibration
 * content on top of this scaffold.
 */

import { PageHeader } from "@/components/shell/PageHeader";

export default function OpsPage() {
  // TODO(FE-9): real ops content (loop actions, engagement sweep,
  // calibration, system page).
  return (
    <PageHeader
      eyebrow="OPERATIONS"
      title="Operations"
      subtitle="System overview — placeholder until FE-9 lands the loop / engagement / cost / calibration sections."
    />
  );
}
