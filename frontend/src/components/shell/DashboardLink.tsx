"use client";

/**
 * Role-aware "Go to dashboard" recovery CTA (audit V1).
 *
 * The root 404 / 403 / 500 recovery surfaces hardcoded `href="/"`, but
 * `/` is testee-gated — an admin bounced there ran straight into the
 * `/` → `/403` → `/` loop. This client component reads the live role and
 * targets the role's home (`/ops` for admins, `/` for testees) via the
 * shared `dashboardPathFor`. It is a client component so a *server*
 * surface (`not-found.tsx`) can still get role-aware recovery without
 * calling `useAuth()` itself.
 */

import Link from "next/link";
import { useAuth } from "@/lib/auth/context";
import { dashboardPathFor } from "@/lib/auth/guards";
import { buttonVariants } from "@/components/ui/button";

export function DashboardLink({
  className,
  children = "Go to dashboard →",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const { role } = useAuth();
  return (
    <Link href={dashboardPathFor(role)} className={className ?? buttonVariants()}>
      {children}
    </Link>
  );
}
