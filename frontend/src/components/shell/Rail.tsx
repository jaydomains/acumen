/**
 * Rail — role-aware sidebar nav. Mounted by `(authed)/(testee)/layout.tsx`
 * and `(authed)/(admin)/layout.tsx` in Slice 4. Not used inside `(auth)`
 * or `/privacy`.
 *
 * The nav arrays (TESTEE_NAV / ADMIN_NAV) lock here per FE-2-shell.md §B.2.
 * Several href targets are placeholders that will 404 until later phases
 * land them — the Rail does not check route existence; it lists what the
 * role can navigate to.
 *
 * Active-route matching is exact equality per spec edge case. Badge
 * counts default 0 (chip hidden); FE-4 wires in-progress, FE-6 wires
 * review queue, FE-9 wires engagement.
 */

import Link from "next/link";
import { cn } from "@/lib/utils";
import { AcumenMark } from "./AcumenMark";
import { Icon, type IconName } from "@/components/primitives/Icon";

export type RailRole = "testee" | "admin";

export type NavItem = {
  id: string;
  label: string;
  icon: IconName;
  href: string;
  count?: number;
};

export const TESTEE_NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard", href: "/" },
  { id: "attempt", label: "In Progress", icon: "attempt", href: "/attempts", count: 0 },
  { id: "catalogue", label: "Discover", icon: "compass", href: "/catalogue" },
  { id: "results", label: "Latest Result", icon: "graph", href: "/results" },
  { id: "profile", label: "Competency", icon: "constellation", href: "/profile" },
  { id: "history", label: "History", icon: "history", href: "/history" },
];

export const ADMIN_NAV: NavItem[] = [
  { id: "ops", label: "Operations", icon: "dashboard", href: "/ops" },
  { id: "review", label: "Grade Review", icon: "review", href: "/review", count: 0 },
  { id: "engagement", label: "Engagement", icon: "inbox", href: "/engagement", count: 0 },
  {
    id: "catalogue-admin",
    label: "Catalogue",
    icon: "catalogue",
    href: "/admin/catalogue",
  },
  { id: "users", label: "Users & Groups", icon: "users", href: "/admin/users" },
  { id: "cost", label: "AI Cost", icon: "cost", href: "/cost" },
  { id: "loop", label: "Loops", icon: "loop", href: "/loop" },
];

export type RailProps = {
  role: RailRole;
  activeRoute: string;
  className?: string;
};

export function Rail({ role, activeRoute, className }: RailProps) {
  const nav = role === "admin" ? ADMIN_NAV : TESTEE_NAV;
  const sectionLabel = role === "admin" ? "Operate" : "Learn";
  const tag = role === "admin" ? "Administrator" : "Testee";

  return (
    <aside
      className={cn(
        "bg-bg-sunk border-r border-line px-3.5 py-[18px]",
        "flex flex-col gap-1",
        "sticky top-0 h-screen overflow-y-auto",
        className,
      )}
      data-role={role}
      aria-label={`${tag} navigation`}
    >
      <div className="flex items-center gap-2.5 px-2 pb-[18px] mb-3.5 border-b border-line">
        <div className="w-8 h-8 grid place-items-center text-ink shrink-0">
          <AcumenMark size={30} />
        </div>
        <div>
          <div className="font-serif text-[22px] font-semibold tracking-[-0.022em]">
            Acumen
          </div>
          <div className="font-mono text-[9.5px] tracking-[0.12em] uppercase text-ink-3 mt-0.5">
            {tag}
          </div>
        </div>
      </div>

      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-4 px-2.5 pt-3.5 pb-1.5">
        {sectionLabel}
      </div>

      {nav.map((item) => {
        const active = activeRoute === item.href;
        return (
          <Link
            key={item.id}
            href={item.href}
            data-active={active}
            className={cn(
              "flex items-center gap-2.5 px-2.5 py-2 rounded-none",
              "text-[13px] font-medium",
              "transition-colors duration-150",
              active
                ? "bg-ink text-bg-raised"
                : "text-ink-2 hover:bg-bg-deep hover:text-ink",
            )}
          >
            <Icon name={item.icon} size={16} className="shrink-0 opacity-75" />
            <span className="flex-1">{item.label}</span>
            {typeof item.count === "number" && item.count > 0 ? (
              <span
                className={cn(
                  "font-mono text-[10px] px-1.5 py-px",
                  active
                    ? "bg-bg-raised/15 text-bg-raised"
                    : "bg-accent-soft text-accent-ink",
                )}
                data-testid={`rail-badge-${item.id}`}
              >
                {item.count}
              </span>
            ) : null}
          </Link>
        );
      })}

      <div className="mt-auto pt-3.5 border-t border-line">
        <div className="flex items-center gap-2.5 px-2.5 py-2 text-ink-3">
          <Icon name="settings" size={16} className="opacity-75 shrink-0" />
          <span className="flex-1 text-[13px]">SiteMesh · v1.8</span>
        </div>
      </div>
    </aside>
  );
}
