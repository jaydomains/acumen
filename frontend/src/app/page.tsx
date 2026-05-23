"use client";

/**
 * Scaffold placeholder home page (AC-CD19).
 *
 * Proves the foundation is wired end-to-end:
 *  - Build pipeline (this page renders).
 *  - Tailwind styling.
 *  - Typed API client + error envelope (the /healthz fetch).
 *  - Auth context + refresh flow (the /v1/auth/me read).
 *  - CORS (both calls cross-origin from :3000 to :8000).
 *
 * Real pages — login, dashboard, attempt flow, admin, etc. — land in
 * follow-up PRs. The "paste a refresh token in DevTools localStorage"
 * affordance is a debug-only crutch that disappears when the login
 * page lands (PR-033).
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/context";
import { config } from "@/lib/config";
import { ApiError, client, unwrap } from "@/lib/api/client";

type HealthPayload = { status: string; env: string };
type HealthState =
  | { kind: "loading" }
  | { kind: "ok"; payload: HealthPayload }
  | { kind: "error"; message: string };

export default function HomePage() {
  const { user, status, logout } = useAuth();
  const [health, setHealth] = useState<HealthState>({ kind: "loading" });

  useEffect(() => {
    void (async () => {
      try {
        const payload = await unwrap(client.GET("/healthz"));
        setHealth({ kind: "ok", payload: payload as HealthPayload });
      } catch (err) {
        const message = err instanceof ApiError ? err.message : String(err);
        setHealth({ kind: "error", message });
      }
    })();
  }, []);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Acumen</h1>
      <p className="mt-2 text-sm text-gray-600">
        Frontend scaffold (PR-032). Real pages land in follow-up PRs.
      </p>

      <section className="mt-10 space-y-2">
        <h2 className="text-lg font-medium">Backend connection</h2>
        <p className="text-sm text-gray-700">
          API base URL:{" "}
          <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
            {config.apiBaseUrl}
          </code>
        </p>
        <p className="text-sm text-gray-700">
          {health.kind === "loading" && "Pinging /healthz..."}
          {health.kind === "ok" && (
            <>
              <span className="text-green-700">✓</span> /healthz responded:{" "}
              <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
                {JSON.stringify(health.payload)}
              </code>
            </>
          )}
          {health.kind === "error" && (
            <>
              <span className="text-red-700">✗</span> /healthz failed: {health.message}
            </>
          )}
        </p>
      </section>

      <section className="mt-10 space-y-2">
        <h2 className="text-lg font-medium">Authentication</h2>
        {status === "loading" && (
          <p className="text-sm text-gray-700">Resolving identity...</p>
        )}
        {status === "authenticated" && user && (
          <div className="text-sm text-gray-700">
            <p>
              <span className="text-green-700">✓</span> Signed in as{" "}
              <strong>{user.email}</strong> (<code>{user.role}</code>)
            </p>
            <p className="mt-1">
              Privacy acknowledged:{" "}
              {user.privacy_ack_at ? (
                <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
                  {user.privacy_ack_at}
                </code>
              ) : (
                <span className="text-amber-700">not yet</span>
              )}
            </p>
            <button
              type="button"
              onClick={() => void logout()}
              className="mt-3 rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
            >
              Log out
            </button>
          </div>
        )}
        {status === "unauthenticated" && (
          <div className="text-sm text-gray-700">
            <p>Not authenticated.</p>
            <p className="mt-2 text-xs text-gray-500">
              Debug-only path until PR-033 lands the login UI: obtain a refresh token via{" "}
              <code className="rounded bg-gray-100 px-1 py-0.5">POST /v1/auth/login</code>{" "}
              and set <code>acumen.refresh_token</code> in this site&apos;s localStorage,
              then reload.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
