"use client";

/**
 * HandAuthoredSection — v1 STUB per Slice 12. Same Slice 13 carve-out
 * as `FrozenSection`. Both modes share the question-pool table; the
 * hand_authored variant adds an info-card explaining the author-posture
 * difference (no AI invoked).
 */

export function HandAuthoredSection() {
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
      <div
        className="border border-dashed border-line bg-bg-sunk p-6 text-center"
        data-testid="hand-authored-section-stub"
      >
        <div className="eyebrow mb-2">Question pool</div>
        <div className="font-serif text-[20px] text-ink mb-2">
          Question authoring ships in the next slice.
        </div>
        <div className="text-[13px] text-ink-3 max-w-md mx-auto">
          Save as draft now to reserve the title; the question editor lands in Slice 13.
        </div>
      </div>
    </div>
  );
}
