"use client";

import { cn } from "@/lib/utils";

export type TabPlaceholderProps = {
  title: string;
  body: string;
  testId: string;
  className?: string;
};

export function TabPlaceholder({ title, body, testId, className }: TabPlaceholderProps) {
  return (
    <div
      className={cn(
        "border border-dashed border-line bg-bg-raised p-10 text-center",
        className,
      )}
      data-testid={testId}
    >
      <div className="font-serif text-[20px] text-ink mb-2">{title}</div>
      <div className="eyebrow mb-3">Coming in next slice</div>
      <div className="text-[13px] text-ink-3 max-w-[52ch] mx-auto">{body}</div>
    </div>
  );
}
