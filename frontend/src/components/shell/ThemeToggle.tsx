"use client";

/**
 * ThemeToggle — small icon button beside the avatar. Flips between paper
 * and carbon themes, mutating `<html data-theme>` and writing
 * `localStorage["acumen.theme"]`. Bootstrap of the stored value happens
 * synchronously in the FOUC script (see lib/theme/bootstrap.ts); this
 * component is the only post-hydration affordance that mutates either.
 *
 * Server / hydration safety: the `useState` initializer reads
 * `document.documentElement.getAttribute("data-theme")` only when
 * `document` is defined. SSR sees the server-set default "paper"; the
 * post-mount effect re-syncs from the actual DOM attribute in case the
 * FOUC script overrode to "carbon" before hydration.
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/primitives/Icon";
import { THEME_STORAGE_KEY } from "@/lib/theme/bootstrap";

type Theme = "paper" | "carbon";

function readCurrentTheme(): Theme {
  if (typeof document === "undefined") return "paper";
  const t = document.documentElement.getAttribute("data-theme");
  return t === "carbon" ? "carbon" : "paper";
}

export type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>(readCurrentTheme);

  useEffect(() => {
    // Re-sync after hydration in case the FOUC script applied carbon
    // before React mounted.
    setTheme(readCurrentTheme());
  }, []);

  const next: Theme = theme === "paper" ? "carbon" : "paper";

  const onClick = () => {
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // private browsing — silently no-op; the DOM attribute still
      // updates so the user sees the switch this session.
    }
    setTheme(next);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Switch to ${next} theme`}
      data-theme-current={theme}
      className={cn(
        "inline-flex items-center justify-center w-9 h-9",
        "text-ink-2 hover:text-ink transition-colors",
        className,
      )}
    >
      <Icon name={theme === "paper" ? "sun" : "moon"} size={16} />
    </button>
  );
}
