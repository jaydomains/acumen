import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthCardTitle } from "@/components/auth/AuthCardTitle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Full-card replacement for the `invalid_token` (400) error
 * (FE-1 §B.3 / §B.4). The backend collapses expired and otherwise-
 * invalid tokens into a single code; copy here covers both cases.
 *
 * `flow` differentiates reset vs setup:
 *  - reset → CTA links to /forgot ("Request a new link")
 *  - setup → CTA is a plain styled paragraph ("Ask for a new
 *    invitation") and does NOT link anywhere; users must contact
 *    their admin per §B.4.6.
 */

export type TokenFlow = "reset" | "setup";

export type TokenErrorCardProps = {
  flow: TokenFlow;
};

export function TokenErrorCard({ flow }: TokenErrorCardProps) {
  if (flow === "reset") {
    return (
      <AuthCard>
        <AuthCardTitle>This link doesn&apos;t work</AuthCardTitle>
        <p className="mt-2 text-sm text-gray-600">
          Password reset links expire after 30 minutes, and each one only works once.
          Request a new link and try again.
        </p>
        <div className="mt-6">
          <Link href="/forgot" className={cn(buttonVariants(), "w-full")}>
            Request a new link
          </Link>
        </div>
      </AuthCard>
    );
  }
  return (
    <AuthCard>
      <AuthCardTitle>This invitation doesn&apos;t work</AuthCardTitle>
      <p className="mt-2 text-sm text-gray-600">
        Setup invitations expire after 7 days, and each one only works once.
      </p>
      <p className="mt-4 text-sm text-gray-600">
        <strong className="font-medium">Ask for a new invitation</strong> from your
        administrator.
      </p>
    </AuthCard>
  );
}
