"use client";

/**
 * (authed) route group — authenticated surfaces (FE-1 §C.4 postures
 * 1, 2, 3, 4). Unauth users bounce to /login?next=, un-ack'd users to
 * /privacy. Role-mismatch (posture 4) is wired by FE-2 via RequireAuth.
 *
 * Suspense wrap matches (auth)/layout — see that file for the
 * useSearchParams rationale.
 */

import { Suspense, type ReactNode } from "react";
import { Gate } from "@/lib/auth/guards";
import { AuthSkeleton } from "@/components/auth/AuthSkeleton";

export default function AuthedLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <Gate posture="authed">{children}</Gate>
    </Suspense>
  );
}
