"use client";

/**
 * (admin) route group — symmetric with (testee)/layout.tsx. Role gate
 * to "admin" (else /403), shell chrome with the admin rail variant.
 */

import { Suspense, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Gate } from "@/lib/auth/guards";
import { AuthSkeleton } from "@/components/auth/AuthSkeleton";
import { Rail } from "@/components/shell/Rail";
import { TopBar } from "@/components/shell/TopBar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <Gate posture="authed" role="admin">
        <AdminShell>{children}</AdminShell>
      </Gate>
    </Suspense>
  );
}

function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/ops";
  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr] bg-bg">
      <Rail role="admin" activeRoute={pathname} />
      <div className="flex flex-col min-w-0">
        <TopBar />
        <main className="px-12 py-9 max-w-[1340px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
