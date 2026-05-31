"use client";

/**
 * NavDrawer — mobile/tablet nav surface for the responsive shell.
 *
 * Below `lg`, the desktop sidebar Rail is hidden and navigation lives
 * behind a TopBar hamburger that opens this left-anchored drawer. Built
 * on the shared `Sheet` (Radix Dialog), so backdrop tap, Esc, and
 * outside-tap dismiss come for free; route-change dismiss is handled by
 * the layout via a `usePathname()` effect that flips `open` to false.
 *
 * Shared by both authed shells — (testee) and (admin) — to keep the
 * drawer chrome (close affordance, width, a11y title) identical.
 */

import { Sheet } from "@/components/ui/sheet";
import { Icon } from "@/components/primitives/Icon";
import { Rail, type RailRole } from "./Rail";

export type NavDrawerProps = {
  role: RailRole;
  activeRoute: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function NavDrawer({ role, activeRoute, open, onOpenChange }: NavDrawerProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      side="left"
      width={288}
      ariaTitle="Navigation"
      ariaDescription="Primary navigation"
      className="p-0"
    >
      <button
        type="button"
        onClick={() => onOpenChange(false)}
        aria-label="Close navigation"
        data-testid="nav-drawer-close"
        className="absolute right-2 top-3 z-10 grid h-11 w-11 place-items-center text-ink-3 hover:text-ink transition-colors"
      >
        <Icon name="x" size={20} />
      </button>
      <Rail role={role} activeRoute={activeRoute} variant="drawer" />
    </Sheet>
  );
}
