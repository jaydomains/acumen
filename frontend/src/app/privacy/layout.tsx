/**
 * /privacy lives outside (auth) and (authed) (FE-1 §C.4) so it can
 * render for authed users whose `privacy_ack_at` is still null without
 * recursing through (authed)'s posture-3 redirect to itself.
 *
 * The Gate moved into `page.tsx` in Slice D so the post-decline
 * "You've been signed out" terminal view can render after logout
 * without being unmounted by the unauth-redirect. The layout only
 * provides the Suspense boundary required by `useSearchParams()`
 * inside the page's Gate.
 */

import { Suspense, type ReactNode } from "react";
import { AuthSkeleton } from "@/components/auth/AuthSkeleton";

export default function PrivacyLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<AuthSkeleton />}>{children}</Suspense>;
}
