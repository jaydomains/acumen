/**
 * HowToReadCard — five-bullet "how to read this" explainer that lives
 * next to the SelectedPillDetailCard in the constellation view
 * (FE-7 §B.1 §2; prototype source at
 * `frontend/design-reference/prototype/constellation.jsx:247-256`).
 *
 * Pure presentational. Copy is locked at the spec — reviewers reject
 * PRs that paraphrase. Hidden in matrix view per FE-7 §B.1 §5
 * `happy_matrix` state.
 */

import { Card } from "@/components/ui/card";

export function HowToReadCard() {
  return (
    <Card
      data-testid="how-to-read-card"
      className="bg-bg-sunk p-5 text-[12.5px] text-ink-2"
    >
      <div className="eyebrow mb-2">How to read this</div>
      <ul className="m-0 list-disc pl-5 leading-7">
        <li>
          <strong className="text-ink">Size</strong> = your competence on that pill
        </li>
        <li>
          <strong className="text-ink">Colour</strong> = band (Novice → Expert)
        </li>
        <li>
          <strong className="text-ink">Ring length</strong> = calibration confidence (full
          ring = 30+ attempts)
        </li>
        <li>
          <strong className="text-ink">Lines</strong> = related pills as tagged by your
          administrator
        </li>
        <li>
          <strong className="text-ink">Red dot</strong> = safety-tagged (external links
          instead of AI explainers)
        </li>
      </ul>
    </Card>
  );
}
