"use client";

/**
 * Five-posture route-guard matrix (FE-1 §C.4, AC-CD20).
 *
 * Three postures are exposed as a single hook used by the three group
 * layouts:
 *  - "guest"   → (auth)/layout.tsx: unauth surfaces. Redirects authed
 *                users to their role dashboard.
 *  - "authed"  → (authed)/layout.tsx: authed surfaces. Redirects
 *                unauth users to /login?next=, un-ack'd users to
 *                /privacy. Role-gating is added by FE-2's RequireAuth.
 *  - "privacy" → privacy/layout.tsx: bypass subgate. Authed users
 *                render (ack'd or not); unauth users redirect to /login.
 *
 * `RequireAuth` is a placeholder for FE-2's role-gated wrapper; today
 * it is just an "authed" guard convenience.
 */

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { AuthSkeleton } from "@/components/auth/AuthSkeleton";

export type GuardPosture = "guest" | "authed" | "privacy";

export type GuardResult = {
  allow: boolean;
  fallback: ReactNode | null;
};

const dashboardPathFor = (role: "testee" | "admin" | null): string => {
  // FE-2 owns /dashboard and /ops; until they exist the redirect lands
  // on the existing scaffold home at /.
  if (role === "admin") return "/";
  return "/";
};

export const useAuthRedirect = (posture: GuardPosture): GuardResult => {
  const { status, privacy_ack_at, role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (status === "loading") return;

    if (posture === "guest") {
      if (status === "authenticated") {
        const next = searchParams.get("next");
        router.replace(next ?? dashboardPathFor(role));
      }
      return;
    }

    if (posture === "privacy") {
      if (status === "unauthenticated") {
        router.replace("/login");
      }
      return;
    }

    // posture === "authed"
    if (status === "unauthenticated") {
      const next = encodeURIComponent(pathname ?? "/");
      router.replace(`/login?next=${next}`);
      return;
    }
    if (privacy_ack_at === null) {
      router.replace("/privacy");
    }
  }, [status, posture, privacy_ack_at, role, router, pathname, searchParams]);

  let allow = false;
  if (status === "authenticated") {
    if (posture === "guest") {
      allow = false;
    } else if (posture === "privacy") {
      allow = true;
    } else {
      allow = privacy_ack_at !== null;
    }
  } else if (status === "unauthenticated") {
    allow = posture === "guest";
  }

  return { allow, fallback: allow ? null : <AuthSkeleton /> };
};

export function RequireAuth({ children }: { children: ReactNode }) {
  const { allow, fallback } = useAuthRedirect("authed");
  if (!allow) return <>{fallback}</>;
  return <>{children}</>;
}
