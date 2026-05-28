"use client";

/**
 * Proposals tab placeholder — full implementation lands in a later
 * FE-8 catalogue slice per §B.4 (`fe-specs/FE-8-admin-catalogue.md:537–679`).
 */

import { TabPlaceholder } from "./tab-placeholder";

export function ProposalsTab() {
  return (
    <TabPlaceholder
      title="Proposals"
      body="AI-proposed pills queue — approve / reject ships in a later slice per §B.4."
      testId="proposals-tab-placeholder"
    />
  );
}
