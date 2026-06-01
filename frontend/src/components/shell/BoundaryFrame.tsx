/**
 * BoundaryFrame — shared card layout for 404 / 500 / 403 boundaries.
 * Slice 4 mounts it inside `not-found.tsx`, the per-group `error.tsx`
 * files, and `403/page.tsx`. Posture (in-shell vs full-page) is decided
 * by the consumer — BoundaryFrame is layout-only.
 *
 * Footer is collapsible: when `footer` is provided, the card renders an
 * expandable "+ show details / — hide details" toggle that reveals the
 * footer. Used by 500 boundaries to surface ApiError.code / traceId
 * without cluttering the default presentation.
 */

"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BoundaryFrameProps = {
  glyph: ReactNode;
  eyebrow: string;
  title: ReactNode;
  body: ReactNode;
  actions: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function BoundaryFrame({
  glyph,
  eyebrow,
  title,
  body,
  actions,
  footer,
  className,
}: BoundaryFrameProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        "mx-auto max-w-[520px] px-6 py-12",
        "flex flex-col items-center text-center",
        className,
      )}
      data-testid="boundary-frame"
    >
      <div
        className={cn(
          "w-16 h-16 rounded-full bg-bg-sunk text-ink-3",
          "grid place-items-center mb-6",
        )}
        aria-hidden="true"
      >
        {glyph}
      </div>

      <div className="eyebrow mb-3">{eyebrow}</div>
      <h1 className="font-serif text-[26px] leading-[1.18] tracking-[-0.018em] sm:text-[30px] lg:text-[36px] mb-3 break-words">{title}</h1>
      <div className="text-ink-2 text-[14px] leading-[1.6] max-w-[44ch] break-words">{body}</div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {actions}
      </div>

      {footer ? (
        <div className="mt-10 w-full border-t border-line pt-4 text-[12px] text-ink-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="font-mono text-[11px] tracking-[0.06em] uppercase hover:text-ink-2 transition-colors"
            data-testid="boundary-details-toggle"
            aria-expanded={open}
          >
            {open ? "— hide details" : "+ show details"}
          </button>
          {open ? (
            <div
              className="mt-3 bg-bg-sunk px-3 py-2 font-mono text-[11px] text-left"
              data-testid="boundary-details"
            >
              {footer}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
