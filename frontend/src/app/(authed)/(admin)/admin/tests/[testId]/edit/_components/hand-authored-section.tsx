"use client";

/**
 * HandAuthoredSection — info-card + composed FrozenSection per FE-8
 * admin-tests §B.2 §2 (`fe-specs/FE-8-admin-tests.md:243`). Slice 13.
 *
 * Architectural lock C: composes `FrozenSection` and inherits both
 * `sectionLocked` + `poolLocked` props. The author-posture difference
 * is purely UX framing — the wire shape is identical to frozen tests.
 */

import { FrozenSection, type FrozenSectionProps } from "./frozen-section";

export type HandAuthoredSectionProps = FrozenSectionProps;

export function HandAuthoredSection(props: HandAuthoredSectionProps) {
  return (
    <div className="space-y-4">
      <div
        className="border border-line bg-bg-raised p-5"
        data-testid="hand-authored-info"
      >
        <div className="eyebrow mb-2">You&rsquo;re writing every question by hand</div>
        <div className="text-[13px] text-ink-2 leading-[1.55]">
          Hand-authored tests share the same question pool table as frozen tests, but no
          AI generation is invoked. Use this mode for high-stakes content where every
          question is reviewed by a human author.
        </div>
      </div>
      <FrozenSection {...props} />
    </div>
  );
}
