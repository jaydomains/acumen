/**
 * Stat — large numeric / textual headline + small label + optional hint.
 * Used by dashboards (FE-3, FE-9). The 54px serif value treatment matches
 * `prototype/shell.jsx::Stat` + the `.stat-big` class in styles.css.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatTone = "accent" | "default";

export type StatProps = {
  value: ReactNode; // string / number / formatted node — caller controls precision
  label: ReactNode;
  hint?: ReactNode;
  tone?: StatTone;
  className?: string;
};

export function Stat({ value, label, hint, tone = "default", className }: StatProps) {
  return (
    <div className={cn("font-serif", className)}>
      <div
        data-testid="stat-value"
        className={cn(
          "font-serif text-[54px] leading-none tracking-[-0.025em] font-semibold tabular-nums",
          tone === "accent" ? "text-accent" : "text-ink",
        )}
      >
        {value}
      </div>
      <div className="mt-2 font-mono text-[11px] tracking-[0.04em] text-ink-3">
        {label}
      </div>
      {hint ? <div className="mt-2 text-[12px] text-ink-3">{hint}</div> : null}
    </div>
  );
}
