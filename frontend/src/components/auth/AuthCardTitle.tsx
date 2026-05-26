import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Auth-card title primitive (FE-1 §C.1; `auth.jsx:244–253`). The
 * design uses a serif + italic h1; theme tokens for the serif face
 * land at FE-2, so we render with the browser default serif. The
 * component encapsulates the pattern so forgot/reset/setup/privacy
 * can reuse it verbatim.
 */

export const AuthCardTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h1
    ref={ref}
    className={cn("font-serif text-2xl italic tracking-tight text-gray-900", className)}
    {...props}
  />
));
AuthCardTitle.displayName = "AuthCardTitle";
