/**
 * scroll-to-question — smooth-scroll to a ByQuestionCard row + flash
 * the highlight. Shared anchor pattern between TransparencyBlock
 * (FE-6 §B.6 flagged-Q sub-line) and RealismAggregateCard
 * (§B.8 flagged-Q row click).
 *
 * Targets `[data-question-id="<attempt_position>"]` rows; falls back
 * silently if no element matches (page hasn't fully rendered yet,
 * etc.). The flash class on the row is removed after the keyframe
 * completes so subsequent anchor clicks re-trigger the animation.
 */

const FLASH_DURATION_MS = 700;

export function scrollToQuestion(attemptPosition: number | string): boolean {
  if (typeof document === "undefined") return false;
  const selector = `[data-question-id="${String(attemptPosition)}"]`;
  const target = document.querySelector<HTMLElement>(selector);
  if (!target) return false;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.classList.add("flash");
  window.setTimeout(() => {
    target.classList.remove("flash");
  }, FLASH_DURATION_MS);
  return true;
}
