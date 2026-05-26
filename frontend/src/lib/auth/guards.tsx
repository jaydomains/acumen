"use client";

/**
 * Five-posture route-guard matrix (FE-1 §C.4, AC-CD20).
 *
 * Three postures expose the matrix via a single hook; layouts wrap
 * their `<Gate posture="…">` in a `<Suspense>` boundary so Next 15
 * accepts `useSearchParams()` inside the hook.
 *
 *  - "guest"   → (auth)/layout.tsx: unauth surfaces. Authed but
 *                un-ack'd users get bounced to /privacy (posture 3);
 *                authed ack'd users to their role dashboard (posture 5).
 *                A safe `?next=` (same-origin path) takes precedence
 *                over the dashboard default for posture 5.
 *  - "authed"  → (authed)/layout.tsx: authed surfaces. Unauth →
 *                /login?next=, un-ack'd → /privacy. Role-gating is
 *                added by FE-2's RequireAuth.
 *  - "privacy" → privacy/layout.tsx: bypass subgate. Authed users
 *                render (ack'd or not); unauth → /login.
 *
 * `RequireAuth` is a placeholder for FE-2's role-gated wrapper.
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
  // FE-2 owns /dashboard and /ops; until they exist the redirect
  // lands on the existing scaffold home at /.
  if (role === "admin") return "/";
  return "/";
};

/**
 * Same-origin path validator for `?next=` redirect targets. Rejects
 * absolute URLs (open-redirect vector), protocol-relative URLs
 * (`//evil.com/x`), the `javascript:` scheme, and empty strings. The
 * accepted shape is a path starting with a single `/` followed by a
 * path character (not a backslash or another slash).
 */
export const isSafeRedirectPath = (next: string | null | undefined): next is string => {
  if (typeof next !== "string" || next.length < 2) return false;
  if (next[0] !== "/") return false;
  // Block protocol-relative (//host) and backslash tricks.
  const second = next[1];
  if (second === "/" || second === "\\") return false;
  return true;
};

export const useAuthRedirect = (posture: GuardPosture): GuardResult => {
  const { status, privacy_ack_at, role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Extract the primitive value so the effect dep array depends on a
  // stable string instead of the searchParams object (which changes
  // identity every render and would re-fire the redirect endlessly).
  const nextParam = searchParams.get("next");

  useEffect(() => {
    if (status === "loading") return;

    if (posture === "guest") {
      if (status !== "authenticated") return;
      // Posture 3: authed but not ack'd → enforce privacy gate even
      // when the user lands on an unauth surface. Posture 5: ack'd →
      // honor a safe `?next=` then fall back to the role dashboard.
      if (privacy_ack_at === null) {
        router.replace("/privacy");
        return;
      }
      const target = isSafeRedirectPath(nextParam) ? nextParam : dashboardPathFor(role);
      router.replace(target);
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
  }, [status, posture, privacy_ack_at, role, router, pathname, nextParam]);

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

/**
 * Shared layout gate. Layouts wrap this in <Suspense> so Next 15
 * accepts the useSearchParams() call inside useAuthRedirect.
 */
export function Gate({
  posture,
  children,
}: {
  posture: GuardPosture;
  children: ReactNode;
}) {
  const { allow, fallback } = useAuthRedirect(posture);
  if (!allow) return <>{fallback}</>;
  return <>{children}</>;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  return <Gate posture="authed">{children}</Gate>;
}
