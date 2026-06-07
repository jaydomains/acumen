/**
 * Rail — role-aware sidebar nav. Mounted by `(authed)/(testee)/layout.tsx`
 * and `(authed)/(admin)/layout.tsx` in Slice 4. Not used inside `(auth)`
 * or `/privacy`.
 *
 * The nav arrays (TESTEE_NAV / ADMIN_NAV) lock here per FE-2-shell.md §B.2.
 * Every TESTEE_NAV target resolves to a real route (the v1 nav model — D3
 * ruling — drops the dead In-Progress item; "Latest Result" is a thin
 * redirect page to the most-recent submitted attempt's result). The Rail
 * does not check route existence; it lists what the role can navigate to.
 *
 * Active-route matching is exact equality per spec edge case. Badge counts
 * default 0 (chip hidden); admin review (FE-6) + engagement (FE-9) carry
 * counts.
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
  { id: "catalogue", label: "Discover", icon: "compass", href: "/catalogue" },
  { id: "results", label: "Latest Result", icon: "graph", href: "/results" },
  { id: "profile", label: "Competency", icon: "constellation", href: "/profile" },
  { id: "history", label: "History", icon: "history", href: "/history" },
];

// 11-item ADMIN_NAV per FE-8 catalogue spec §C.2 lock (`:1162–1170`).
// FE-8 unbundles the historic "Users & Groups" row into `users` +
// `groups`, and adds `paths`, `tests`, `assignments` as top-level rail
// entries. Build session performs the update-in-place per the
// SESSION_START.md AC-CD-structural-additions carve-out; this is the
// final shape that FE-8 + FE-9 build against.
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
  { id: "paths", label: "Paths", icon: "paths", href: "/admin/paths" },
  { id: "tests", label: "Tests", icon: "tests", href: "/admin/tests" },
  { id: "users", label: "Users", icon: "users", href: "/admin/users" },
  { id: "groups", label: "Groups", icon: "groups", href: "/admin/groups" },
  {
    id: "assignments",
    label: "Assignments",
    icon: "clipboard",
    href: "/admin/assignments",
  },
  { id: "cost", label: "AI Cost", icon: "cost", href: "/cost" },
  { id: "loop", label: "Loops", icon: "loop", href: "/loop" },
  // FE-9 systems surfaces (§H(b) item 14 / §F.4): the calibration +
  // system pages shipped URL-only during their slices; the close-out
  // adds their rail entries here.
  { id: "calibration", label: "Calibration", icon: "sliders", href: "/calibration" },
  { id: "system", label: "System", icon: "settings", href: "/system" },
];

export type RailProps = {
  role: RailRole;
  activeRoute: string;
  /**
   * "sidebar" (default) — sticky full-height desktop sidebar.
   * "drawer" — fills a mobile nav Sheet (which supplies its own
   * full-height frame); sticky/h-screen are dropped and tap targets
   * grow to ≥44px for touch.
   */
  variant?: "sidebar" | "drawer";
  className?: string;
};

export function Rail({ role, activeRoute, variant = "sidebar", className }: RailProps) {
  const nav = role === "admin" ? ADMIN_NAV : TESTEE_NAV;
  const sectionLabel = role === "admin" ? "Operate" : "Learn";
  const tag = role === "admin" ? "Administrator" : "Testee";
  const isDrawer = variant === "drawer";

  return (
    <aside
      className={cn(
        "bg-bg-sunk px-3.5 py-[18px]",
        "flex flex-col gap-1",
        isDrawer
          ? "h-full overflow-y-auto"
          : "border-r border-line sticky top-0 h-screen overflow-y-auto",
        className,
      )}
      data-role={role}
      data-variant={variant}
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
              "flex items-center gap-2.5 pl-2 pr-2.5 rounded-none",
              // ≥44px touch target in the mobile drawer; denser on desktop.
              isDrawer ? "py-3 min-h-11" : "py-2",
              "text-[13px] font-medium",
              "transition-colors duration-150",
              // border-l-2 on both states so active/inactive share the same
              // total left inset (2px border + pl-2) — no horizontal shift.
              "border-l-2",
              active
                ? "bg-accent-soft text-accent-ink border-accent"
                : "text-ink-2 hover:bg-bg-deep hover:text-ink border-transparent",
            )}
          >
            <Icon name={item.icon} size={16} className="shrink-0 opacity-75" />
            <span className="flex-1">{item.label}</span>
            {typeof item.count === "number" && item.count > 0 ? (
              <span
                className={cn(
                  "font-mono text-[10px] px-1.5 py-px",
                  active ? "bg-accent text-bg-raised" : "bg-accent-soft text-accent-ink",
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
