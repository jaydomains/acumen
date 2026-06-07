/**
 * V2 anchor-leak guard — **V2's testee-facing scope only**, not a global
 * "no AC-D anywhere" guard.
 *
 * Slice 4 closed V2 as audited: the testee-facing (+ flagged-queue) set of
 * 13 rendered `AC-Dxx` sites. This guard renders the cheaply-mountable
 * leaf surfaces among that set and asserts no `AC-D<digit>` token survives
 * in their rendered text. The fixtured/page surfaces carry the same check
 * in their own render tests (GradingOverlay.test, adaptive-loop-card.test,
 * admin-grade-review-queue.test, pill-detail.test).
 *
 * Deliberately NOT global: ~15 admin-surface `AC-Dxx` occurrences
 * (system-page / cost / engagement / loop / calibration eyebrows + a few
 * tooltips) are OUT of V2's audited testee scope — most are spec-verbatim
 * ops scaffolding pending a spec-author ruling — and are tracked as an
 * out-of-plan discovery in handovers/PR-102 (post-deploy UI-hygiene tier).
 * A codebase-wide regex would (correctly) fail on those; this guard must
 * stay scoped to the 13 V2 sites.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SafetyEmpty } from "@/components/pill-detail/SafetyEmpty";
import { SafetyLinks } from "@/components/pill-detail/SafetyLinks";
import { SafetyPosterCard } from "@/components/pill-detail/SafetyPosterCard";
import { IntegrityBadge } from "@/components/attempt/IntegrityBadge";
import { JITQueue } from "@/components/attempt/JITQueue";
import { SafetyToggle } from "@/components/admin/safety-toggle";

const ANCHOR = /AC-D\d/;

describe("V2 anchor-leak guard — no AC-Dxx in the testee-facing set", () => {
  it.each([
    ["SafetyEmpty", <SafetyEmpty key="se" />],
    [
      "SafetyLinks",
      <SafetyLinks
        key="sl"
        links={[
          {
            url: "https://example.org/0",
            title: "Title 0",
            source: "Source 0",
            last_verified_at: "2026-01-15T00:00:00Z",
          },
        ]}
      />,
    ],
    ["SafetyPosterCard", <SafetyPosterCard key="sp" />],
    ["IntegrityBadge", <IntegrityBadge key="ib" tabSwitches={2} />],
    [
      "JITQueue",
      <JITQueue
        key="jq"
        questionIds={["q-1", "q-2"]}
        currentIndex={0}
        arrivedIdx={2}
        answeredQuestionIds={new Set()}
        status="streaming"
      />,
    ],
    ["SafetyToggle (on)", <SafetyToggle key="st" on={true} onChange={() => {}} />],
  ])("%s renders no AC-Dxx token", (_name, node) => {
    const { container } = render(node);
    expect(container.textContent ?? "").not.toMatch(ANCHOR);
  });
});
