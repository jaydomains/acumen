/**
 * PillWeaknessRow — one row in ByPillCard (FE-6 §B.3).
 *
 * Layout:
 *   - pill name + safety badge if `is_safety_tagged`
 *   - severity chip (critical/severe/info — colour-driven)
 *   - score-bar (progress bar tinted by severity); when score_percent
 *     is null the bar is hidden and we render the calibration suffix
 *     only — the v6 mock's "no anchors yet" state
 *   - calibration suffix: "estimate · n=N · preliminary|confident"
 *     with a Tooltip on hover for `preliminary` rows explaining
 *     the AC-D20 threshold gate
 */

import { Pill, type PillTone } from "@/components/primitives/Pill";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { components } from "@/lib/api/types";

type ResultPill = components["schemas"]["ResultPill"];

const SEVERITY_TONE: Record<string, PillTone> = {
  critical: "danger",
  severe: "warn",
  info: "info",
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: "CRITICAL",
  severe: "SEVERE",
  info: "INFO",
};

const BAR_TINT: Record<string, string> = {
  critical: "bg-danger",
  severe: "bg-warn",
  info: "bg-ok",
};

export type PillWeaknessRowProps = {
  pill: ResultPill;
};

export function PillWeaknessRow({ pill }: PillWeaknessRowProps) {
  const tone = SEVERITY_TONE[pill.severity] ?? "default";
  const tint = BAR_TINT[pill.severity] ?? "bg-ok";
  const pct =
    pill.score_percent === null || pill.score_percent === undefined
      ? null
      : Math.max(0, Math.min(100, pill.score_percent));

  return (
    <li
      data-testid="pill-weakness-row"
      data-severity={pill.severity}
      data-confidence={pill.confidence}
      data-safety-tagged={pill.is_safety_tagged ? "true" : "false"}
      className="border-t border-line py-3 first:border-t-0"
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="text-[13px] font-medium text-ink">{pill.pill_name}</span>
        {pill.is_safety_tagged ? (
          <Pill tone="info" mono>
            SAFETY
          </Pill>
        ) : null}
        <Pill tone={tone} mono className="ml-auto">
          {SEVERITY_LABEL[pill.severity] ?? pill.severity.toUpperCase()}
        </Pill>
        {pct !== null ? (
          <span className="font-mono text-[11px] text-ink-3 tabular-nums">
            {Math.round(pct)}%
          </span>
        ) : null}
      </div>
      {pct !== null ? (
        <div
          className="h-1 w-full bg-bg-sunk"
          data-testid="pill-weakness-bar"
          role="meter"
          aria-label={`${pill.pill_name} score`}
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className={cn("h-full", tint)} style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      <div className="mt-1 font-mono text-[11px] text-ink-3">
        {pill.competence_estimate !== null && pill.competence_estimate !== undefined
          ? `${pill.competence_estimate.toFixed(1)} · `
          : ""}
        n={pill.n} ·{" "}
        {pill.confidence === "confident" ? (
          <span className="text-ink-2">confident</span>
        ) : (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  data-testid="confidence-suffix"
                  className="text-ink-3 underline decoration-dotted underline-offset-2"
                >
                  preliminary
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Calibration pending — more observations on this pill will flip to
                confident.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </li>
  );
}
