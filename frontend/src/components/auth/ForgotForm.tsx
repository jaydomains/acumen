"use client";

/**
 * Forgot-password form (FE-1 §B.2).
 *
 * Privacy-preserving contract: backend returns 200 regardless of
 * whether the email exists. The UI mirrors this — success state
 * shows a confirmation card with the entered email echoed back,
 * with no branching on existence.
 *
 * On 5xx / network failure: surface a danger notice and leave the
 * form resubmittable.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { client, unwrap } from "@/lib/api/client";
import { applyApiErrorToForm } from "@/lib/api/form-errors";
import { forgotSchema, type ForgotInput } from "@/lib/auth/forgot-schema";
import { AuthField } from "@/components/auth/AuthField";
import { AuthNotice } from "@/components/auth/AuthNotice";
import { SubmitButton } from "@/components/auth/SubmitButton";

export function ForgotForm({ onSuccess }: { onSuccess: (email: string) => void }) {
  const [, setSubmittedOk] = useState(false);
  const form = useForm<ForgotInput>({
    resolver: zodResolver(forgotSchema),
    mode: "onSubmit",
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ForgotInput) => {
    form.clearErrors();
    setSubmittedOk(false);
    try {
      await unwrap(client.POST("/v1/auth/password-reset/request", { body: data }));
      // Capture the entered email BEFORE the form unmounts — the
      // success view needs to echo it back per §B.2.7.
      setSubmittedOk(true);
      onSuccess(data.email);
    } catch (err) {
      applyApiErrorToForm(err, form);
    }
  };

  const { isSubmitting, errors } = form.formState;
  const rootError = errors.root?.message;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
      {rootError ? (
        <AuthNotice tone="danger" body="We couldn't send the link. Please try again." />
      ) : null}

      <AuthField
        label="Email"
        type="email"
        autoComplete="email"
        autoFocus
        disabled={isSubmitting}
        hint="We'll email a reset link if this address has an account."
        error={errors.email?.message}
        {...form.register("email")}
      />

      <SubmitButton
        state={isSubmitting ? "submitting" : "idle"}
        idleLabel="Send reset link →"
        submittingLabel="Sending…"
        className="w-full"
      />
    </form>
  );
}
