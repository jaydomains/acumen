"use client";

/**
 * TopBar — sticky header. Crumb on the left, search-stub in the middle,
 * theme toggle + avatar on the right. Per FE-2-shell.md §B.3:
 *
 *  - No `role` / `onRole` props (the prototype's segmented role-switch is
 *    a dev affordance, NOT ported to production — §H decision 3).
 *  - No `user` prop — reads `useAuth().user` directly.
 *  - Default crumb derived from `usePathname()` ("/" → "Dashboard",
 *    "/ops" → "Operations"); caller can override via `crumb` prop.
 *  - Search stub is a read-only input with role-aware placeholder.
 *    Click is a no-op in FE-2; a future v1.x phase wires the palette.
 */

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/context";
import { Icon } from "@/components/primitives/Icon";
import { ThemeToggle } from "./ThemeToggle";
import { AvatarMenu } from "./AvatarMenu";

export type CrumbItem = {
  label: string;
  href?: string;
};

const ROUTE_TITLE: Record<string, string> = {
  "/": "Dashboard",
  "/ops": "Operations",
};

function deriveTitle(pathname: string | null | undefined): string {
  if (!pathname) return "";
  return ROUTE_TITLE[pathname] ?? "";
}

export type TopBarProps = {
  crumb?: CrumbItem[];
  rightSlot?: ReactNode;
  /**
   * When provided, renders a mobile-only hamburger (lg:hidden) as the
   * leading control that opens the nav drawer. Omitted on surfaces with
   * no drawer (keeps existing consumers/tests unchanged).
   */
  onMenuClick?: () => void;
  className?: string;
};

export function TopBar({ crumb, rightSlot, onMenuClick, className }: TopBarProps) {
  const pathname = usePathname();
  const { role } = useAuth();

  const placeholder =
    role === "admin" ? "Search pills, testees, attempts…" : "Search pills…";

  const trail: CrumbItem[] = crumb ?? [
    { label: "SiteMesh" },
    { label: "Acumen" },
    { label: deriveTitle(pathname) },
  ];

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex items-center gap-3.5",
        "px-7 py-3.5 bg-bg border-b border-line",
        className,
      )}
      data-testid="topbar"
    >
      {onMenuClick ? (
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          data-testid="topbar-menu"
          className={cn(
            "lg:hidden -ml-1.5 grid place-items-center shrink-0",
            "h-11 w-11 text-ink-2 hover:text-ink transition-colors",
          )}
        >
          <Icon name="menu" size={20} />
        </button>
      ) : null}

      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-[13px] min-w-0"
        data-testid="topbar-crumbs"
      >
        {trail.map((c, i) => {
          const isLast = i === trail.length - 1;
          return (
            <span
              key={`${i}-${c.label}`}
              className={cn("shrink-0", isLast ? "font-semibold text-ink" : "text-ink-3")}
            >
              {c.label}
              {!isLast && <span className="text-ink-4 mx-2">/</span>}
            </span>
          );
        })}
      </nav>

      <div
        className={cn(
          "ml-3 flex-1 max-w-[420px] hidden md:flex items-center gap-2",
          "bg-bg-raised border border-line px-3.5 py-1.5",
          "text-ink-3 text-[12.5px]",
        )}
        data-testid="topbar-search"
      >
        <Icon name="search" size={14} />
        <input
          type="text"
          placeholder={placeholder}
          readOnly
          className="bg-transparent outline-none flex-1 text-[12.5px] placeholder:text-ink-3"
          // TODO(v1.x): wire search palette
        />
        <kbd className="font-mono text-[10px] bg-bg-deep border border-line px-1.5 py-px">
          ⌘K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {rightSlot}
        <ThemeToggle />
        <AvatarMenu />
      </div>
    </header>
  );
}
