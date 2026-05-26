import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Auth surface centered container (FE-1 §C.1).
 *
 * Default width matches the design's 400px login/forgot/reset/setup
 * card column; `wide` switches to the 620px privacy column.
 */
export function AuthShell({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className={cn("w-full", wide ? "max-w-[620px]" : "max-w-[400px]")}>
        {children}
      </div>
    </div>
  );
}
