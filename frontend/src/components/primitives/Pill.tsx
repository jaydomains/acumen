/**
 * Pill — generic chip primitive (tone × mono variants). Naming note: this
 * is NOT the Acumen domain "pill" (the unit of learning content); it's the
 * UI chip. Per Slice 2 amendment, every variant is expressed as Tailwind
 * utilities — no co-located `.chip` CSS class.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { PillTone } from "./pill-tone";

const TONE_CLASS: Record<PillTone, string> = {
  default: "bg-bg-deep border border-line text-ink-2",
  accent: "bg-accent-soft border-transparent text-accent-ink",
  ok: "bg-ok-soft border-transparent text-ok",
  warn: "bg-warn-soft border-transparent text-warn",
  danger: "bg-danger-soft border-transparent text-danger",
  info: "bg-info-soft border-transparent text-info",
};

export type PillProps = {
  tone?: PillTone;
  mono?: boolean;
  className?: string;
  children: ReactNode;
};

export function Pill({ tone = "default", mono = false, className, children }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-none whitespace-nowrap font-medium",
        mono ? "font-mono text-[10.5px] tracking-[0.02em]" : "text-[11.5px]",
        TONE_CLASS[tone],
        className,
      )}
      data-tone={tone}
    >
      {children}
    </span>
  );
}

export type { PillTone };
