"use client";

/**
 * (auth) route group — unauthenticated surfaces (FE-1 §C.4 postures
 * 1, 2, 5; AC-CD20). Covers /login, /forgot, /reset/[token],
 * /setup/[token]. Authed users get bounced to their role dashboard.
 */

import type { ReactNode } from "react";
import { useAuthRedirect } from "@/lib/auth/guards";

export default function AuthGuestLayout({ children }: { children: ReactNode }) {
  const { allow, fallback } = useAuthRedirect("guest");
  if (!allow) return <>{fallback}</>;
  return <>{children}</>;
}
