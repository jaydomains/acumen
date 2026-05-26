"use client";

/**
 * /privacy lives outside (auth) and (authed) (FE-1 §C.4) so it can
 * render for authed users whose `privacy_ack_at` is still null without
 * recursing through (authed)'s posture-3 redirect to itself. Only
 * unauth users get bounced (to /login).
 */

import type { ReactNode } from "react";
import { useAuthRedirect } from "@/lib/auth/guards";

export default function PrivacyLayout({ children }: { children: ReactNode }) {
  const { allow, fallback } = useAuthRedirect("privacy");
  if (!allow) return <>{fallback}</>;
  return <>{children}</>;
}
