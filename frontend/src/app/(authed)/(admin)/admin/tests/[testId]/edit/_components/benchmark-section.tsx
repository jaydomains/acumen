"use client";

/**
 * BenchmarkSection — v1 PLACEHOLDER per §E item 8 (Q4-a deferral).
 * Benchmark *authoring* is deferred to v1.x; benchmark *attempts*
 * already ship via FE-4's `BenchmarkRunner`. This card surfaces the
 * asymmetry so admins arriving here understand why authoring is dark.
 *
 * Reachable today only via a pre-existing benchmark test row (legacy
 * data); the ModePicker disables the benchmark card so create-mode
 * can't land here.
 */

import { Icon } from "@/components/primitives/Icon";

export function BenchmarkSection() {
  return (
    <div
      className="border border-warn bg-warn-soft p-5"
      data-testid="benchmark-section-stub"
    >
      <div className="flex items-start gap-3">
        <Icon name="wave" size={20} className="text-warn mt-0.5 shrink-0" />
        <div>
          <div className="eyebrow mb-1.5">Benchmark mode</div>
          <div className="font-serif text-[20px] text-ink mb-2">
            Authoring coming in v1.x
          </div>
          <div className="text-[13px] text-ink-2 leading-[1.55]">
            Benchmark *attempts* already run today via the testee benchmark runner.
            Authoring a new benchmark — pills multi-select, difficulty curve, cohort
            window — lands in a v1.x follow-up. For now, use frozen mode for cohort
            comparison.
          </div>
        </div>
      </div>
    </div>
  );
}
