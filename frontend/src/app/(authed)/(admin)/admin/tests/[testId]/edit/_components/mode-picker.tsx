"use client";

/**
 * ModePicker — 4-card mode chooser per FE-8 admin-tests §B.2 §2
 * (`fe-specs/FE-8-admin-tests.md:240`).
 *
 * Active card flips to ink-bg per FE-2 segmented pattern. Cards are
 * disabled when `locked` is true (mode immutable post-create per
 * AC-D17 + Slice 12 drift Finding #6). The benchmark card is **always
 * disabled** per §E item 8 (Q4-a deferral) — clicking it is a no-op
 * and the card carries a "v1.x" badge + hover tooltip.
 */

import type { TestMode } from "@/lib/queries/admin-tests";
import { cn } from "@/lib/utils";

type ModeMeta = {
  id: TestMode;
  title: string;
  body: string;
  useCase: string;
};

const MODES: ModeMeta[] = [
  {
    id: "per_testee",
    title: "Per-testee",
    body: "Each testee sees a 4–12 question subset sampled at attempt-start.",
    useCase: "rapid checks · drill rotations",
  },
  {
    id: "frozen",
    title: "Frozen pool",
    body: "All testees see the same fixed pool of questions in the same order.",
    useCase: "audits · certifications",
  },
  {
    id: "hand_authored",
    title: "Hand-authored",
    body: "Same as frozen, but every question is written by hand — no AI.",
    useCase: "high-stakes content",
  },
  {
    id: "benchmark",
    title: "Benchmark",
    body: "Sequential walk across pre-calibrated anchors for cohort comparison.",
    useCase: "calibration · comparison",
  },
];

export type ModePickerProps = {
  value: TestMode | null;
  onChange: (mode: TestMode) => void;
  /** Locks every card (used in edit mode — mode immutable post-create). */
  locked: boolean;
};

export function ModePicker({ value, onChange, locked }: ModePickerProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="mode-picker">
      {MODES.map((m) => {
        const isBenchmark = m.id === "benchmark";
        // Benchmark card is always disabled in v1 (§E.8 deferral); other
        // cards disable when the test is locked.
        const disabled = locked || isBenchmark;
        const active = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              if (disabled) return;
              onChange(m.id);
            }}
            disabled={disabled}
            aria-pressed={active}
            data-testid={`mode-card-${m.id}`}
            title={isBenchmark ? "Benchmark authoring coming in v1.x" : undefined}
            className={cn(
              "text-left border px-4 py-3.5 transition-colors",
              active
                ? "bg-ink text-bg border-ink"
                : "bg-bg-raised border-line hover:bg-bg-sunk",
              disabled && "opacity-60 cursor-not-allowed hover:bg-bg-raised",
            )}
          >
            <div className="flex items-baseline justify-between gap-2">
              <div
                className={cn(
                  "font-mono text-[11px] uppercase tracking-[0.12em]",
                  active ? "text-bg" : "text-ink-3",
                )}
              >
                {m.id}
              </div>
              {isBenchmark ? (
                <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-warn">
                  v1.x
                </span>
              ) : null}
            </div>
            <div
              className={cn(
                "font-serif text-[18px] mt-1",
                active ? "text-bg" : "text-ink",
              )}
            >
              {m.title}
            </div>
            <div
              className={cn(
                "text-[12.5px] mt-1.5 leading-[1.45]",
                active ? "text-bg/80" : "text-ink-2",
              )}
            >
              {m.body}
            </div>
            <div
              className={cn(
                "font-mono text-[10.5px] uppercase tracking-[0.08em] mt-2.5",
                active ? "text-bg/70" : "text-ink-3",
              )}
            >
              use · {m.useCase}
            </div>
          </button>
        );
      })}
    </div>
  );
}
