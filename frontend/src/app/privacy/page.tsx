"use client";

/**
 * /privacy — privacy acknowledgement (FE-1 §B.5).
 *
 * The Gate is rendered *inside* the page so the declined terminal
 * view can short-circuit before it. Per spec §B.5.7:
 *   "set local declined true BEFORE calling logout(), render
 *    confirmation regardless of auth state"
 * If Gate sat at the layout level, the post-logout
 * status='unauthenticated' would trigger Gate's /login redirect and
 * unmount the page, eclipsing the confirmation. Conditional Gate
 * fixes this without leaking the Gate posture into ad-hoc auth
 * checks.
 *
 * Two terminal flows:
 *   1. "I acknowledge" → POST /v1/auth/privacy/acknowledge →
 *      setUserPrivacyAck(resp.privacy_ack_at) → router.push("/").
 *      Pattern B toast surfaces on failure; card stays mounted.
 *   2. "Decline and log out" → set declined=true → logout() in the
 *      background. The Gate is not rendered, so no auto-redirect.
 *      "Return to sign in" then pushes to /login.
 *
 * The privacy notice copy is AC-D16 placeholder text and must clear
 * legal review before any external user sees it. Tagged below.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { client, unwrap } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import { Gate } from "@/lib/auth/guards";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthCardTitle } from "@/components/auth/AuthCardTitle";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { AuthShell } from "@/components/auth/AuthShell";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Button } from "@/components/ui/button";

// TODO(AC-D16): placeholder copy, needs legal review before production.
// Pulled from design-Claude's mock notice text (auth.jsx:592-614) —
// plausible-sounding-but-not-legal-reviewed. Block external launch on
// legal sign-off; the gate-flow plumbing is independent of the copy.
const PRIVACY_NOTICE_PARAGRAPHS = [
  "Acumen processes your responses to assessment items, the time you take to respond, and metadata about your sessions to build a private competency profile that helps you and your administrators understand your progress.",
  "Your individual answers are not shared with peers. Aggregate, de-identified statistics may be used to improve the assessment models and surfaced to administrators within your organization.",
  "You can request a copy of the data we hold about you at any time, and you can ask for your account to be deleted; deletion removes your personally-identifiable identity from the active dataset within 30 days.",
  'By clicking "I acknowledge" you confirm that you have read this notice and understand how your data is used. If you do not agree, choose "Decline and log out" and contact your administrator.',
];

function DeclinedView({ onReturnToSignIn }: { onReturnToSignIn: () => void }) {
  return (
    <AuthShell>
      <div className="mb-8">
        <AuthLogo />
      </div>
      <AuthCard>
        <div className="flex flex-col items-center text-center">
          <div
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-xl text-gray-700"
          >
            ◔
          </div>
          <AuthCardTitle className="mt-4">You&apos;ve been signed out</AuthCardTitle>
          <p className="mt-2 text-sm text-gray-600">You can sign back in at any time.</p>
          <Button onClick={onReturnToSignIn} className="mt-6 w-full">
            Return to sign in →
          </Button>
        </div>
      </AuthCard>
    </AuthShell>
  );
}

function NoticeView({
  submitting,
  onAcknowledge,
  onDecline,
}: {
  submitting: boolean;
  onAcknowledge: () => void;
  onDecline: () => void;
}) {
  return (
    <AuthShell wide>
      <div className="mb-8">
        <AuthLogo />
      </div>
      <AuthCard>
        <AuthCardTitle>Privacy notice</AuthCardTitle>
        <p className="mt-1 text-sm text-gray-600">
          Before you continue, please review how Acumen handles your data.
        </p>
        <div
          className="mt-4 max-h-80 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700"
          tabIndex={0}
          role="region"
          aria-label="Privacy notice"
        >
          {PRIVACY_NOTICE_PARAGRAPHS.map((paragraph, i) => (
            <p key={i} className={i > 0 ? "mt-3" : undefined}>
              {paragraph}
            </p>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse sm:items-center sm:justify-between">
          <SubmitButton
            type="button"
            state={submitting ? "submitting" : "idle"}
            idleLabel="I acknowledge →"
            submittingLabel="Acknowledging…"
            onClick={onAcknowledge}
            disabled={submitting}
            className="sm:w-auto"
          />
          <button
            type="button"
            onClick={onDecline}
            disabled={submitting}
            className="text-sm text-gray-600 hover:text-gray-900 disabled:pointer-events-none disabled:opacity-50"
          >
            Decline and log out
          </button>
        </div>
      </AuthCard>
    </AuthShell>
  );
}

export default function PrivacyPage() {
  const router = useRouter();
  const { logout, setUserPrivacyAck } = useAuth();
  const [declined, setDeclined] = useState(false);

  const ackMutation = useMutation({
    mutationFn: () => unwrap(client.POST("/v1/auth/privacy/acknowledge")),
    onSuccess: (resp) => {
      setUserPrivacyAck(resp.privacy_ack_at);
      router.push("/");
    },
    onError: () => {
      toast.error("Couldn't acknowledge — try again.");
    },
  });

  const handleDecline = (): void => {
    setDeclined(true);
    // Fire-and-forget logout; the declined view doesn't depend on
    // its resolution. The auth state flip will not unmount us because
    // Gate is not rendered below.
    void logout();
  };

  if (declined) {
    return <DeclinedView onReturnToSignIn={() => router.push("/login")} />;
  }

  return (
    <Gate posture="privacy">
      <NoticeView
        submitting={ackMutation.isPending}
        onAcknowledge={() => ackMutation.mutate()}
        onDecline={handleDecline}
      />
    </Gate>
  );
}
