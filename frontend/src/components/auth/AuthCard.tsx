import { forwardRef, type HTMLAttributes } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Auth surface card wrapper (FE-1 §C.1). Thin styling envelope around
 * the shadcn Card primitive — adds the auth-page padding the design
 * shows in `auth.jsx`; visual polish (paper-card chrome, shadows)
 * lands with FE-2's theme tokens.
 */
export const AuthCard = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <Card ref={ref} className={cn("p-6 sm:p-8", className)} {...props} />
  ),
);
AuthCard.displayName = "AuthCard";
