"use client";

/**
 * (admin) route group — symmetric with (testee)/layout.tsx. Role gate
 * to "admin" (else /403), shell chrome with the admin rail variant.
 */

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Gate } from "@/lib/auth/guards";
import { AuthSkeleton } from "@/components/auth/AuthSkeleton";
import { Rail } from "@/components/shell/Rail";
import { TopBar } from "@/components/shell/TopBar";
import { NavDrawer } from "@/components/shell/NavDrawer";

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
  const [navOpen, setNavOpen] = useState(false);

  // Dismiss the mobile drawer on any navigation (link tap or programmatic).
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[240px_1fr] bg-bg">
      <Rail role="admin" activeRoute={pathname} className="hidden lg:flex" />
      <NavDrawer
        role="admin"
        activeRoute={pathname}
        open={navOpen}
        onOpenChange={setNavOpen}
      />
      <div className="flex flex-col min-w-0">
        <TopBar onMenuClick={() => setNavOpen(true)} />
        <main className="px-4 py-6 sm:px-6 md:px-8 lg:px-12 lg:py-9 max-w-[1340px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
