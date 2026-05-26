"use client";

/**
 * (authed) route group — authenticated surfaces (FE-1 §C.4 postures
 * 1, 2, 3, 4). Unauth users bounce to /login?next=, un-ack'd users to
 * /privacy. Role-mismatch (posture 4) is wired by FE-2 via RequireAuth.
 */

import type { ReactNode } from "react";
import { useAuthRedirect } from "@/lib/auth/guards";

export default function AuthedLayout({ children }: { children: ReactNode }) {
  const { allow, fallback } = useAuthRedirect("authed");
  if (!allow) return <>{fallback}</>;
  return <>{children}</>;
}
