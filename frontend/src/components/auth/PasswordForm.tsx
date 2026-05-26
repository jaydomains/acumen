"use client";

/**
 * Password form shared by /reset/[token] and /setup/[token]
 * (FE-1 §B.3 + §B.4).
 *
 * `flow` differentiates:
 *  - reset → POST /v1/auth/password-reset/consume
 *  - setup → POST /v1/auth/setup/consume
 *
 * On 400 `invalid_token`: bubble up via `onTokenInvalid` so the
 * parent page can swap the entire card to `<TokenErrorCard>`. On
 * 422: applyApiErrorToForm projects onto `new_password`. On
 * success: show the inline success notice then call `onSuccess`
 * after 1500ms so the page can redirect to /login.
 */

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError, client, unwrap } from "@/lib/api/client";
import { applyApiErrorToForm } from "@/lib/api/form-errors";
import { passwordSchema, type PasswordInput } from "@/lib/auth/password-schema";
import { AuthField } from "@/components/auth/AuthField";
import { AuthNotice } from "@/components/auth/AuthNotice";
import { PasswordRulesChecklist } from "@/components/auth/PasswordRulesChecklist";
import { SubmitButton } from "@/components/auth/SubmitButton";
import type { TokenFlow } from "@/components/auth/TokenErrorCard";

const SUCCESS_REDIRECT_DELAY_MS = 1500;

const ENDPOINT_FOR: Record<
  TokenFlow,
  "/v1/auth/password-reset/consume" | "/v1/auth/setup/consume"
> = {
  reset: "/v1/auth/password-reset/consume",
  setup: "/v1/auth/setup/consume",
};

const SUCCESS_COPY: Record<TokenFlow, { title: string; body: string }> = {
  reset: {
    title: "Password updated",
    body: "Taking you back to sign in…",
  },
  setup: {
    title: "You're all set",
    body: "Taking you back to sign in…",
  },
};

export type PasswordFormProps = {
  flow: TokenFlow;
  token: string;
  onSuccess: () => void;
  onTokenInvalid: () => void;
};

export function PasswordForm({
  flow,
  token,
  onSuccess,
  onTokenInvalid,
}: PasswordFormProps) {
  const [submittedOk, setSubmittedOk] = useState(false);
  const form = useForm<PasswordInput>({
    resolver: zodResolver(passwordSchema),
    mode: "onSubmit",
    defaultValues: { new_password: "", confirm_password: "" },
  });

  // Live value powers the rules checklist on every keystroke.
  const newPasswordValue =
    useWatch({ control: form.control, name: "new_password" }) ?? "";

  const onSubmit = async (data: PasswordInput) => {
    form.clearErrors();
    setSubmittedOk(false);
    try {
      await unwrap(
        client.POST(ENDPOINT_FOR[flow], {
          body: { token, new_password: data.new_password },
        }),
      );
      setSubmittedOk(true);
      // Brief success flash, then redirect (§B.3 / §B.4 spec — 1500ms).
      window.setTimeout(onSuccess, SUCCESS_REDIRECT_DELAY_MS);
    } catch (err) {
      if (err instanceof ApiError && err.code === "invalid_token") {
        onTokenInvalid();
        return;
      }
      applyApiErrorToForm(err, form, {
        fieldMap: {},
      });
    }
  };

  const { isSubmitting, errors } = form.formState;
  const rootError = errors.root?.message;
  // "Almost there" warn notice surfaces when the user submitted a
  // weak password — zod has surfaced per-rule errors via setError.
  const isWeak = !!errors.new_password && !rootError && !submittedOk;
  const copy = SUCCESS_COPY[flow];

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
      {submittedOk ? (
        <AuthNotice tone="ok" title={copy.title} body={copy.body} />
      ) : rootError ? (
        <AuthNotice tone="danger" body={rootError} />
      ) : isWeak ? (
        <AuthNotice tone="warn" body="Almost there — fix the highlighted rules." />
      ) : null}

      <AuthField
        label="New password"
        type="password"
        autoComplete="new-password"
        autoFocus
        disabled={isSubmitting || submittedOk}
        error={errors.new_password?.message}
        {...form.register("new_password")}
      />

      <PasswordRulesChecklist value={newPasswordValue} />

      <AuthField
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        disabled={isSubmitting || submittedOk}
        error={errors.confirm_password?.message}
        {...form.register("confirm_password")}
      />

      <SubmitButton
        state={isSubmitting ? "submitting" : submittedOk ? "success" : "idle"}
        idleLabel={flow === "setup" ? "Create account →" : "Update password →"}
        submittingLabel={flow === "setup" ? "Creating…" : "Updating…"}
        successLabel="Done"
        className="w-full"
      />
    </form>
  );
}
