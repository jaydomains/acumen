"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ApiError, client, unwrap } from "@/lib/api/client";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthCardTitle } from "@/components/auth/AuthCardTitle";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthSkeleton } from "@/components/auth/AuthSkeleton";
import { Label } from "@/components/ui/label";
import { PasswordForm } from "@/components/auth/PasswordForm";
import { TokenErrorCard } from "@/components/auth/TokenErrorCard";

/**
 * /setup/[token] — first-time account setup (FE-1 §B.4).
 *
 * Flow:
 *  1. Mount: useQuery against GET /v1/auth/setup/{token}/preview
 *     to fetch the invitee email. The submit button is only
 *     reachable once this resolves (§B.4.7 — prevents the user
 *     typing a password against an invalid token).
 *  2. On preview success: render the readOnly email above the
 *     password form.
 *  3. On preview `invalid_token` (or consume `invalid_token`):
 *     swap the entire card to <TokenErrorCard flow="setup">.
 *     CTA reads "Ask for a new invitation" with no link (admin-
 *     initiated recovery per §B.4.6).
 *  4. On consume success: brief "You're all set" then push to
 *     /login — user must sign in fresh (no tokens returned).
 */

type SetupPreview = { email: string };

export default function SetupAccountPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const [consumeFailed, setConsumeFailed] = useState(false);

  const previewQuery = useQuery<SetupPreview, ApiError>({
    queryKey: ["setup-preview", token],
    queryFn: () =>
      unwrap(
        client.GET("/v1/auth/setup/{token}/preview", {
          params: { path: { token } },
        }),
      ),
    retry: false,
    staleTime: Infinity,
  });

  if (
    consumeFailed ||
    (previewQuery.isError && previewQuery.error?.code === "invalid_token")
  ) {
    return (
      <AuthShell>
        <div className="mb-8">
          <AuthLogo />
        </div>
        <TokenErrorCard flow="setup" />
      </AuthShell>
    );
  }

  // Non-invalid_token preview failure (500, network drop, etc.). Without
  // this branch the component falls through to the form with an empty
  // readonly email — the user could submit against a token the backend
  // never confirmed. Gitar review on PR#50.
  if (previewQuery.isError) {
    return (
      <AuthShell>
        <div className="mb-8">
          <AuthLogo />
        </div>
        <AuthCard>
          <AuthCardTitle>Something went wrong</AuthCardTitle>
          <p className="mt-2 text-sm text-gray-600">
            We couldn&apos;t load this invitation. Please try again in a moment.
          </p>
        </AuthCard>
      </AuthShell>
    );
  }

  if (previewQuery.isPending) {
    return (
      <AuthShell>
        <div className="mb-8">
          <AuthLogo />
        </div>
        <AuthSkeleton />
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="mb-8">
        <AuthLogo />
      </div>
      <AuthCard>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
          First time here
        </p>
        <AuthCardTitle className="mt-2">Welcome to Acumen</AuthCardTitle>
        <p className="mt-1 text-sm text-gray-600">
          Pick a password that meets all four rules below. You&apos;ll use it to sign in.
        </p>
        <div className="mt-6 space-y-1.5">
          <Label htmlFor="setup-email">Email</Label>
          <input
            id="setup-email"
            type="email"
            value={previewQuery.data?.email ?? ""}
            readOnly
            className="flex h-10 w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700"
          />
        </div>
        <div className="mt-4">
          <PasswordForm
            flow="setup"
            token={token}
            onSuccess={() => router.push("/login")}
            onTokenInvalid={() => setConsumeFailed(true)}
          />
        </div>
      </AuthCard>
    </AuthShell>
  );
}
