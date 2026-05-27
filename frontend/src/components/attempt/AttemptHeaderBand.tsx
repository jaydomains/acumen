"use client";

/**
 * AttemptHeaderBand (FE-4 §B.1 §2).
 *
 * Sticky header band: Exit + eyebrow + pill name + IntegrityBadge +
 * AutosaveIndicator + TimerPill + (slice 2: Pause). Beneath: the
 * `ProgressDots` strip. Renders inside `<AttemptShell>`.
 *
 * The pause button is rendered disabled in slice 1; slice 2 wires
 * the `onPause` / `onResume` handlers + PauseOverlay.
 */

import { Button } from "@/components/ui/button";
import { Pill } from "@/components/primitives/Pill";
import { IntegrityBadge } from "./IntegrityBadge";
import { TimerPill } from "./TimerPill";
import { AutosaveIndicator } from "./AutosaveIndicator";
import { ProgressDots } from "./ProgressDots";
import type { AutosaveState } from "@/lib/attempts/use-attempt";

export type AttemptHeaderBandProps = {
  pillName: string;
  difficulty: number | null;
  questionCount: number;
  timed: boolean;
  startedAtIso: string | null;
  durationMinutes: number | null;
  paused: boolean;
  nowMs: number;
  tabSwitches: number;
  autosaveState: AutosaveState;
  autosaveAt: number | null;
  autosaveRetries: number;
  /** Question id sequence for the dots strip. */
  questionIds: string[];
  currentIndex: number;
  answeredQuestionIds: Set<string>;
  /** Click-to-jump enabled in frozen mode; benchmark passes `false`. */
  jumpEnabled?: boolean;
  onJump?: (index: number) => void;
  onExit: () => void;
  /** Slice 2 will pass real handlers; slice 1 leaves these undefined. */
  onPause?: () => void;
  onResume?: () => void;
  pausePending?: boolean;
  /** Hide pause control entirely (benchmark v1 default). */
  hidePause?: boolean;
};

export function AttemptHeaderBand({
  pillName,
  difficulty,
  questionCount,
  timed,
  startedAtIso,
  durationMinutes,
  paused,
  nowMs,
  tabSwitches,
  autosaveState,
  autosaveAt,
  autosaveRetries,
  questionIds,
  currentIndex,
  answeredQuestionIds,
  jumpEnabled = true,
  onJump,
  onExit,
  onPause,
  onResume,
  pausePending = false,
  hidePause = false,
}: AttemptHeaderBandProps) {
  const totalLabel = `${questionCount} question${questionCount === 1 ? "" : "s"} · ${
    timed ? "timed" : "untimed"
  }`;
  return (
    <header
      data-testid="attempt-header-band"
      className="flex flex-col gap-3 border border-line bg-bg-raised p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" data-testid="attempt-exit" onClick={onExit}>
            ← Exit
          </Button>
          <div className="flex flex-col">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-3">
              Attempt
            </span>
            <div className="flex items-baseline gap-3">
              <h1 className="font-serif text-[20px] tracking-[-0.01em] text-ink">
                {pillName}
              </h1>
              {difficulty !== null && <Pill mono tone="accent">{`D${difficulty}`}</Pill>}
              <span className="text-[12px] text-ink-3">{totalLabel}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <IntegrityBadge tabSwitches={tabSwitches} />
          <AutosaveIndicator
            state={autosaveState}
            lastSavedAt={autosaveAt}
            nowMs={nowMs}
            retryCount={autosaveRetries}
          />
          <TimerPill
            timed={timed}
            startedAtIso={startedAtIso}
            durationMinutes={durationMinutes}
            paused={paused}
            nowMs={nowMs}
          />
          {!hidePause && (
            <Button
              variant="outline"
              size="sm"
              disabled={pausePending || !onPause || !onResume}
              data-testid="attempt-pause"
              onClick={paused ? onResume : onPause}
            >
              {paused ? "Resume →" : "Pause"}
            </Button>
          )}
        </div>
      </div>
      <ProgressDots
        questionIds={questionIds}
        currentIndex={currentIndex}
        answeredQuestionIds={answeredQuestionIds}
        onJump={onJump}
        interactive={jumpEnabled}
      />
    </header>
  );
}
