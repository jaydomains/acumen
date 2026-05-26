"use client";

/**
 * Minimal dashboard shell at `/` (FE-1 §E.3).
 *
 * FE-1 leaves a "Welcome, {name}" view replacing the scaffold debug
 * page from PR-032. The real shell (TopBar, role-aware navigation,
 * activity feed) lands in FE-2; this page exists so the (authed)
 * Gate has a real landing target — without it the round-trip
 * post-ack `router.push("/")` would land on a Next 404 or back on
 * the scaffold.
 *
 * Lives in the `(authed)/` group so the layout's Gate (posture
 * "authed") covers it: unauth → /login?next=, un-ack'd → /privacy.
 */

import { useAuth } from "@/lib/auth/context";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const { user, logout } = useAuth();
  const displayName = user?.name?.trim() || user?.email || "there";

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Welcome, {displayName}</h1>
      <p className="mt-2 text-sm text-gray-600">
        You&apos;re signed in to Acumen. The full dashboard lands soon.
      </p>

      <section className="mt-10 space-y-1 text-sm text-gray-700">
        <p>
          Signed in as <strong>{user?.email}</strong>
          {user?.role ? (
            <>
              {" "}
              (<code>{user.role}</code>)
            </>
          ) : null}
        </p>
        {user?.privacy_ack_at ? (
          <p className="text-xs text-gray-500">
            Privacy acknowledged{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5">{user.privacy_ack_at}</code>
          </p>
        ) : null}
      </section>

      <div className="mt-8">
        <Button variant="outline" onClick={() => void logout()}>
          Log out
        </Button>
      </div>
    </main>
  );
}
