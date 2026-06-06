/**
 * SafetyPosterCard — left-column safety-only card (FE-3 §B.4).
 *
 * Mirrors `pill-detail.jsx:124–143`. Renders only for safety pills
 * (`pill.safety_relevant === true`), below PillMetaCard. AC-D21:
 * Acumen does not generate AI safety teaching content; this card
 * is the testee-facing framing of that policy.
 */

import { Card } from "@/components/ui/card";
import { Icon } from "@/components/primitives/Icon";

export function SafetyPosterCard() {
  return (
    <Card
      data-testid="safety-poster-card"
      className="flex flex-col gap-3 border-transparent bg-danger-soft p-6 text-ink"
    >
      <div className="flex items-center gap-2 text-danger">
        <Icon name="shield" size={18} />
        <span className="font-mono text-[11px] uppercase tracking-[0.08em]">
          Safety pill
        </span>
      </div>
      <p className="text-[14px] leading-[1.6] text-ink-2">
        Acumen doesn&rsquo;t generate teaching content for safety topics. For this pill,
        we surface a curated set of authoritative external sources instead — regulators,
        standards bodies, and incident-based case studies. Read those first, then come
        back and test.
      </p>
    </Card>
  );
}
