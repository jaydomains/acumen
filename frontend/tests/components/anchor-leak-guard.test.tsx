/**
 * V2 anchor-leak guard (audit finding V2 — no internal AC-Dxx anchor IDs
 * rendered as visible UI text). Slice 4 stripped the decorative
 * "· AC-Dxx" / "(AC-Dxx)" provenance from 13 sites; this guard renders the
 * cheaply-mountable leaf surfaces among them — including the spec-locked
 * Safety* group (amended in #97) and the testee-facing integrity popover —
 * and asserts no `AC-D<digit>` token survives in their rendered text.
 *
 * The remaining stripped surfaces (GradingOverlay phase copy, JITQueue,
 * grade-review-queue eyebrow, loop-step-row, pill-detail subtitle) are
 * exercised by their own render tests; their strings were stripped in the
 * same commit.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SafetyEmpty } from "@/components/pill-detail/SafetyEmpty";
import { SafetyPosterCard } from "@/components/pill-detail/SafetyPosterCard";
import { IntegrityBadge } from "@/components/attempt/IntegrityBadge";
import { SafetyToggle } from "@/components/admin/safety-toggle";

const ANCHOR = /AC-D\d/;

describe("V2 anchor-leak guard — no AC-Dxx in rendered UI text", () => {
  it.each([
    ["SafetyEmpty", <SafetyEmpty key="se" />],
    ["SafetyPosterCard", <SafetyPosterCard key="sp" />],
    ["IntegrityBadge", <IntegrityBadge key="ib" tabSwitches={2} />],
    ["SafetyToggle (on)", <SafetyToggle key="st" on={true} onChange={() => {}} />],
  ])("%s renders no AC-Dxx token", (_name, node) => {
    const { container } = render(node);
    expect(container.textContent ?? "").not.toMatch(ANCHOR);
  });
});
