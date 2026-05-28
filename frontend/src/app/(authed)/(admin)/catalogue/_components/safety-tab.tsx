"use client";

/**
 * Safety tab placeholder — full implementation lands in a later FE-8
 * catalogue slice per §B.5 (`fe-specs/FE-8-admin-catalogue.md:680–807`).
 */

import { TabPlaceholder } from "./tab-placeholder";

export function SafetyTab() {
  return (
    <TabPlaceholder
      title="Safety pills"
      body="Safety-tagged pill curation + override toggle ships in a later slice per §B.5."
      testId="safety-tab-placeholder"
    />
  );
}
