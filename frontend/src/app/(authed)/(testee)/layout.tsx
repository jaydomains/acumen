"use client";

/**
 * (testee) route group — role-gated layer nested inside (authed). The
 * outer (authed) layout handles authed + privacy postures; this layer
 * adds the role check (else /403) and mounts the shell chrome around
 * children.
 *
 * Layout: 2-column grid — Rail (fixed width) on the left, main column
 * (TopBar + content) on the right. Rail's active route is derived from
 * usePathname() so future testee pages light up the correct item.
 */

import { Suspense, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Gate } from "@/lib/auth/guards";
import { AuthSkeleton } from "@/components/auth/AuthSkeleton";
import { Rail } from "@/components/shell/Rail";
import { TopBar } from "@/components/shell/TopBar";

export default function TesteeLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <Gate posture="authed" role="testee">
        <TesteeShell>{children}</TesteeShell>
      </Gate>
    </Suspense>
  );
}

function TesteeShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr] bg-bg">
      <Rail role="testee" activeRoute={pathname} />
      <div className="flex flex-col min-w-0">
        <TopBar />
        <main className="px-12 py-9 max-w-[1340px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
