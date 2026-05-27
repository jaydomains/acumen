"use client";

/**
 * Textarea — shadcn/ui primitive with FE-2 token remap (AC-CD23).
 * Token discipline matches `input.tsx`. Used by FE-4's short_answer +
 * scenario question renderers.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-none border border-line bg-bg-raised px-3 py-2 text-sm text-ink ring-offset-bg placeholder:text-ink-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
