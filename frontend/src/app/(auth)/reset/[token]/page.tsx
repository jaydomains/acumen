"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthCardTitle } from "@/components/auth/AuthCardTitle";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { AuthShell } from "@/components/auth/AuthShell";
import { BackLink } from "@/components/auth/BackLink";
import { PasswordForm } from "@/components/auth/PasswordForm";
import { TokenErrorCard } from "@/components/auth/TokenErrorCard";

/**
 * /reset/[token] — password reset (FE-1 §B.3). Renders the password
 * form against the path-segment token. On `invalid_token` from
 * /v1/auth/password-reset/consume, the entire card swaps to
 * <TokenErrorCard flow="reset"> per §B.3.6.
 *
 * The token must never appear in logs, error reports, or telemetry
 * (§B.3.7). It only flows through the consume mutation body.
 */

export default function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const [tokenInvalid, setTokenInvalid] = useState(false);

  return (
    <AuthShell>
      <div className="mb-8">
        <AuthLogo />
      </div>
      {tokenInvalid ? (
        <TokenErrorCard flow="reset" />
      ) : (
        <AuthCard>
          <AuthCardTitle>Set a new password</AuthCardTitle>
          <p className="mt-1 text-sm text-gray-600">
            Pick something memorable that meets all four rules below.
          </p>
          <div className="mt-6">
            <PasswordForm
              flow="reset"
              token={token}
              onSuccess={() => router.push("/login")}
              onTokenInvalid={() => setTokenInvalid(true)}
            />
          </div>
        </AuthCard>
      )}
      <div className="mt-6 flex justify-center">
        <BackLink href="/login">Back to sign in</BackLink>
      </div>
    </AuthShell>
  );
}
