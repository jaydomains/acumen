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
 *                /login?next=, un-ack'd → /privacy. Optional role gate
 *                (Slice 4) redirects to /403 when role mismatches.
 *  - "privacy" → privacy/layout.tsx: bypass subgate. Authed un-ack'd
 *                users render the page; unauth → /login; authed AND
 *                ack'd → role dashboard (so /privacy isn't a leak path
 *                back to the legal copy after acknowledgement).
 *
 * Slice 4 adds the optional `requiredRole` parameter that powers the
 * (testee)/(admin) layout groups' role-mismatch redirect to /403.
 */

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { AuthSkeleton } from "@/components/auth/AuthSkeleton";

export type GuardPosture = "guest" | "authed" | "privacy";
export type RequiredRole = "testee" | "admin";

export type GuardResult = {
  allow: boolean;
  fallback: ReactNode | null;
};

const dashboardPathFor = (role: "testee" | "admin" | null): string => {
  if (role === "admin") return "/ops";
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

export const useAuthRedirect = (
  posture: GuardPosture,
  requiredRole?: RequiredRole,
): GuardResult => {
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
        return;
      }
      // Already-ack'd users shouldn't see the privacy gate; bounce
      // them to the role dashboard so /privacy isn't a leak path
      // back to the legal copy. Per spec §B.5.6 scenario 4.
      if (privacy_ack_at !== null) {
        router.replace(dashboardPathFor(role));
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
      return;
    }
    // Posture 4 (role mismatch). Only fires when (a) authed + ack'd,
    // and (b) the layout specified a required role. Without
    // requiredRole the gate behaves exactly as FE-1 shipped it.
    // The denied route + the required role ride along as `?from=` +
    // `?required=` so the 403 page can surface them dynamically.
    // Without `from`, usePathname() on /403 just returns "/403"
    // (useless diagnostic); without `required`, the 403 copy is
    // hardcoded to "administrators" which is wrong when an admin
    // hits a testee-only route.
    if (requiredRole && role !== requiredRole) {
      const from = encodeURIComponent(pathname ?? "/");
      router.replace(`/403?from=${from}&required=${requiredRole}`);
      return;
    }
  }, [status, posture, privacy_ack_at, role, router, pathname, nextParam, requiredRole]);

  let allow = false;
  if (status === "authenticated") {
    if (posture === "guest") {
      allow = false;
    } else if (posture === "privacy") {
      // The privacy gate is the ONLY route an un-ack'd user can hit;
      // ack'd users get redirected away above.
      allow = privacy_ack_at === null;
    } else {
      const ackOk = privacy_ack_at !== null;
      const roleOk = !requiredRole || role === requiredRole;
      allow = ackOk && roleOk;
    }
  } else if (status === "unauthenticated") {
    allow = posture === "guest";
  }

  return { allow, fallback: allow ? null : <AuthSkeleton /> };
};

/**
 * Shared layout gate. Layouts wrap this in <Suspense> so Next 15
 * accepts the useSearchParams() call inside useAuthRedirect.
 *
 * The optional `role` prop opt-ins to FE-2's posture-4 role check —
 * authed-and-ack'd users whose role doesn't match get redirected to
 * /403 instead of rendering children.
 */
export function Gate({
  posture,
  role,
  children,
}: {
  posture: GuardPosture;
  role?: RequiredRole;
  children: ReactNode;
}) {
  const { allow, fallback } = useAuthRedirect(posture, role);
  if (!allow) return <>{fallback}</>;
  return <>{children}</>;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  return <Gate posture="authed">{children}</Gate>;
}
