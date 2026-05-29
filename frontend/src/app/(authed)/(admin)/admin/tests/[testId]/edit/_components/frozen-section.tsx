"use client";

/**
 * FrozenSection — v1 STUB per Slice 12. The question-pool table +
 * `QuestionEditorModal` integration ship in Slice 13 (binding pause
 * #2 carve-out — the question editor is its own 5-type discriminated
 * union pattern that warrants a standalone review).
 *
 * Slice 12 only proves the test-editor pattern with `per_testee` as
 * the fully-wired mode; frozen + hand_authored mount this placeholder
 * so admins selecting these modes get an honest "coming next slice"
 * notice rather than a broken form.
 */

export function FrozenSection() {
  return (
    <div
      className="border border-dashed border-line bg-bg-sunk p-6 text-center"
      data-testid="frozen-section-stub"
    >
      <div className="eyebrow mb-2">Frozen pool</div>
      <div className="font-serif text-[20px] text-ink mb-2">
        Question pool authoring ships in the next slice.
      </div>
      <div className="text-[13px] text-ink-3 max-w-md mx-auto">
        Save this test as a draft now to reserve the title. The Add-question UI and
        question editor modal land in Slice 13 — published frozen tests will then bind to
        assignments.
      </div>
    </div>
  );
}
