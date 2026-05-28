"use client";

/**
 * Pills tab placeholder — full implementation lands in a later FE-8
 * catalogue slice per §B.2 (`fe-specs/FE-8-admin-catalogue.md:196–423`).
 */

import { TabPlaceholder } from "./tab-placeholder";

export function PillsTab() {
  return (
    <TabPlaceholder
      title="Pills"
      body="The pill authoring surface lands in the next slice — list, 5-variant modal, and lock-on-use behaviour per §B.2."
      testId="pills-tab-placeholder"
    />
  );
}
