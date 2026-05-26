"use client";

import { useState } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthCardTitle } from "@/components/auth/AuthCardTitle";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { AuthShell } from "@/components/auth/AuthShell";
import { BackLink } from "@/components/auth/BackLink";
import { ForgotForm } from "@/components/auth/ForgotForm";

/**
 * /forgot — request password reset (FE-1 §B.2). Privacy-preserving:
 * success view renders for any 2xx, with the entered email echoed
 * back. The (auth)/layout's guest Gate handles posture routing.
 */

export default function ForgotPage() {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  return (
    <AuthShell>
      <div className="mb-8">
        <AuthLogo />
      </div>
      <AuthCard>
        {submittedEmail ? (
          <>
            <AuthCardTitle>Check your inbox</AuthCardTitle>
            <p className="mt-3 text-sm text-gray-600">
              If <strong className="font-medium">{submittedEmail}</strong> has an Acumen
              account, we&apos;ve sent a reset link. The link is valid for 30 minutes.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Didn&apos;t get it? Check your spam folder, then request another link.
            </p>
          </>
        ) : (
          <>
            <AuthCardTitle>Reset your password</AuthCardTitle>
            <p className="mt-1 text-sm text-gray-600">
              Enter the email you use to sign in.
            </p>
            <div className="mt-6">
              <ForgotForm onSuccess={setSubmittedEmail} />
            </div>
          </>
        )}
      </AuthCard>
      <div className="mt-6 flex justify-center">
        <BackLink href="/login">Back to sign in</BackLink>
      </div>
    </AuthShell>
  );
}
