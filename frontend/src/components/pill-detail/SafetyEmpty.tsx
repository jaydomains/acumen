/**
 * SafetyEmpty — right-column empty state for safety pills whose
 * curated link set is empty or unavailable (FE-3 §B.4).
 * Mirrors `pill-detail.jsx:390–415`.
 *
 * Footer copy is VERBATIM per spec §B.4.6 Gherkin:
 *   "Per AC-D21 · Acumen never generates safety teaching content"
 */

import { Card } from "@/components/ui/card";
import { Icon } from "@/components/primitives/Icon";

export function SafetyEmpty() {
  return (
    <Card data-testid="safety-empty" className="flex flex-col gap-4 border-line p-6">
      <div className="eyebrow">Curated industry sources · AC-D21</div>
      <div className="flex items-start gap-3 text-ink-2">
        <Icon name="shield" size={20} className="mt-0.5 shrink-0 text-ink-3" />
        <p className="text-[14px] leading-[1.6]">
          No curated sources are available for this pill right now. Please ask your
          administrator for guidance before testing — we won&rsquo;t fall back to
          AI-generated material.
        </p>
      </div>
      <div className="mt-1 border-t border-line pt-3 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-4">
        Per AC-D21 · Acumen never generates safety teaching content
      </div>
    </Card>
  );
}
