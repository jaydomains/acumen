"use client";

/**
 * Login form (FE-1 §B.1).
 *
 * Wires the locked submit-handler contract from the spec:
 *  1. zod validation gate (no network on empty fields)
 *  2. `POST /v1/auth/login` via the typed client
 *  3. on success: persist tokens via storage.ts, call `refreshMe()` so
 *     the auth context flips to "authenticated" — the (auth)/layout
 *     guard then handles the redirect (posture 3 → /privacy, posture
 *     5 → safe `?next=` or dashboard).
 *  4. on `account_deactivated`: render a sticky `<AuthNotice>` and
 *     lock the form (spec: "form is not resubmittable from the same
 *     render")
 *  5. on `invalid_credentials`: route the message to the email field
 *     via applyApiErrorToForm's fieldMap — RHF renders it inline under
 *     the email input (matches design auth.jsx:288). Submit re-enables
 *     by virtue of formState.isSubmitting flipping back.
 *  6. on any other failure: applyApiErrorToForm routes to root, the
 *     form shows it via <AuthNotice tone="danger"> above the fields.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError, client, unwrap } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import { setAccessToken, setRefreshToken } from "@/lib/auth/storage";
import { applyApiErrorToForm } from "@/lib/api/form-errors";
import { loginSchema, type LoginInput } from "@/lib/auth/login-schema";
import { AuthField } from "@/components/auth/AuthField";
import { AuthNotice, type AuthNoticeTone } from "@/components/auth/AuthNotice";
import { SubmitButton } from "@/components/auth/SubmitButton";

type StickyNotice = {
  tone: AuthNoticeTone;
  title: string;
  body: string;
};

export function LoginForm() {
  const { refreshMe } = useAuth();
  const [sticky, setSticky] = useState<StickyNotice | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onSubmit",
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginInput) => {
    setSticky(null);
    try {
      const tokens = await unwrap(
        client.POST("/v1/auth/login", { body: data }),
      );
      setAccessToken(tokens.access_token);
      setRefreshToken(tokens.refresh_token);
      await refreshMe();
      // The (auth)/layout's <Gate posture="guest"> useEffect re-runs
      // when status flips to "authenticated" and routes us out — no
      // explicit router.replace needed here. Posture 3 (un-ack'd) sends
      // us to /privacy; posture 5 (ack'd) honors a safe ?next= or
      // falls back to the role dashboard.
    } catch (err) {
      if (err instanceof ApiError && err.code === "account_deactivated") {
        setSticky({
          tone: "warn",
          title: "This account has been deactivated",
          body: err.message,
        });
        return;
      }
      applyApiErrorToForm(err, form, {
        fieldMap: { invalid_credentials: "email" },
      });
    }
  };

  const submitting = form.formState.isSubmitting;
  const rootError = form.formState.errors.root?.message;
  const disabled = !!sticky;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="space-y-4"
    >
      {sticky ? (
        <AuthNotice tone={sticky.tone} title={sticky.title} body={sticky.body} />
      ) : rootError ? (
        <AuthNotice tone="danger" body={rootError} />
      ) : null}

      <AuthField
        label="Email"
        type="email"
        autoComplete="email"
        autoFocus
        disabled={submitting || disabled}
        error={form.formState.errors.email?.message}
        {...form.register("email")}
      />
      <AuthField
        label="Password"
        type="password"
        autoComplete="current-password"
        disabled={submitting || disabled}
        error={form.formState.errors.password?.message}
        {...form.register("password")}
      />

      <SubmitButton
        state={submitting ? "submitting" : "idle"}
        idleLabel="Sign in →"
        submittingLabel="Signing in…"
        disabled={disabled}
        className="w-full"
      />
    </form>
  );
}
