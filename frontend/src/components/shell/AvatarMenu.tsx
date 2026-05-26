"use client";

/**
 * AvatarMenu — circular avatar trigger + dropdown with a single "Sign out"
 * item. Per FE-2-shell.md §H decision 3, this is the FINAL FE-2 dropdown
 * set: no role-switch / "View as testee" affordance. A v1.x feature may
 * add such an affordance if pilot feedback warrants.
 *
 * Three visual states per spec §B.3:
 *  - `closed`        : avatar circle with initial; menu not visible.
 *  - `open`          : DropdownMenu rendered, anchored to avatar.
 *  - `logging-out`   : Sign-out item shows a pulse-dot + "Signing out…";
 *                      trigger disabled while logout() is in flight.
 *
 * Replaces the FE-1 logout button (which lived inline in the placeholder
 * dashboard at (authed)/page.tsx — that page goes away in Slice 4 when
 * the dashboard relocates to (authed)/(testee)/page.tsx).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/primitives/Icon";

function getInitial(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  const source = (name ?? "").trim() || (email ?? "").trim();
  return source.charAt(0).toUpperCase() || "?";
}

export type AvatarMenuProps = {
  className?: string;
};

export function AvatarMenu({ className }: AvatarMenuProps) {
  const { user, status, logout } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const onSignOut = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    // Navigate to /login regardless of whether the backend logout call
    // resolves cleanly — a failed POST /v1/auth/logout still leaves the
    // local AuthContext logged out (FE-1's `logout()` clears tokens
    // before the network call). Swallowing the rejection here keeps
    // the UI flow deterministic; the error is already surfaced to the
    // user as a sonner toast if FE-1's logout wires one.
    try {
      await logout();
    } catch {
      // intentionally swallowed
    }
    router.push("/login");
  };

  // Skeleton circle while the auth context resolves — avoids `.name[0]`
  // throwing on a transient null user during the (authed) guard's
  // loading state.
  if (status === "loading" || !user) {
    return (
      <div
        data-testid="avatar-skeleton"
        className={cn(
          "w-8 h-8 rounded-full bg-bg-deep border border-line shrink-0",
          className,
        )}
        aria-hidden="true"
      />
    );
  }

  const initial = getInitial(user.name, user.email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={loggingOut}
        data-state-logging-out={loggingOut || undefined}
        className={cn(
          "w-8 h-8 rounded-full bg-accent text-bg-raised",
          "grid place-items-center font-serif text-[14px]",
          "shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          className,
        )}
        aria-label="Account menu"
      >
        {initial}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[180px] bg-bg-raised border border-line"
      >
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            void onSignOut();
          }}
          disabled={loggingOut}
          data-testid="avatar-signout"
        >
          {loggingOut ? (
            <>
              <span
                aria-hidden="true"
                className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse"
              />
              <span>Signing out…</span>
            </>
          ) : (
            <>
              <Icon name="logout" size={14} />
              <span>Sign out</span>
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
