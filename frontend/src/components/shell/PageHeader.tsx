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
        "mb-6 flex flex-wrap items-baseline justify-between gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <div className="eyebrow mb-2">{eyebrow}</div> : null}
        <h1 className="h-1">{title}</h1>
        {subtitle ? (
          <div className="text-ink-3 mt-2 max-w-[52ch] text-[14px]">{subtitle}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
