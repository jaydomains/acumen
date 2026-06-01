/**
 * PageHeader — eyebrow + h-1 title + subtitle + actions slot. Used by every
 * page inside (testee)/ and (admin)/ from Slice 4 onward.
 *
 * Per FE-2-shell.md §B.4: `subtitle` accepts ReactNode (not just string) so
 * inline composition like "3 pills due · last review 2d ago" with chips
 * works without a wrapper component.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        // Stack vertically on small screens (title block, then actions
        // below); only at lg do title + actions sit on one baseline row.
        "mb-6 flex flex-col items-start gap-4",
        "lg:flex-row lg:flex-wrap lg:items-baseline lg:justify-between",
        className,
      )}
    >
      <div className="min-w-0 w-full lg:w-auto">
        {eyebrow ? <div className="eyebrow mb-2">{eyebrow}</div> : null}
        <h1 className="font-serif text-[26px] leading-[1.18] tracking-[-0.018em] sm:text-[30px] lg:text-[36px] break-words">{title}</h1>
        {subtitle ? (
          <div className="text-ink-3 mt-3 max-w-[52ch] text-[14px] leading-[1.6] break-words">{subtitle}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full lg:w-auto flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
