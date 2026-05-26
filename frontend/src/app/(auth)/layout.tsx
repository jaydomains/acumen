"use client";

/**
 * (auth) route group — unauthenticated surfaces (FE-1 §C.4 postures
 * 1, 2, 3, 5; AC-CD20). Covers /login, /forgot, /reset/[token],
 * /setup/[token]. Authed un-ack'd users land on /privacy (posture 3);
 * authed ack'd users land on a safe `?next=` or their role dashboard
 * (posture 5).
 *
 * The Suspense wrapper is required because <Gate> calls
 * useSearchParams() to read `?next=`, and Next 15 forces useSearchParams
 * to live under a Suspense boundary (otherwise the build emits a
 * missing-suspense bailout).
 */

import { Suspense, type ReactNode } from "react";
import { Gate } from "@/lib/auth/guards";
import { AuthSkeleton } from "@/components/auth/AuthSkeleton";

export default function AuthGuestLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <Gate posture="guest">{children}</Gate>
    </Suspense>
  );
}
