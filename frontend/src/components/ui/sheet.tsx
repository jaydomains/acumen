"use client";

/**
 * Sheet — slide-in side drawer, AC-CD-structural addition fold per
 * FE-8 catalogue §F.3 (`fe-specs/FE-8-admin-catalogue.md:552`).
 *
 * Minimal wrapper around Radix Dialog with a slide-in transform.
 * Consumers control open state externally. First consumer is the FE-8
 * proposals drawer (right-anchored, the default); the responsive-shell
 * mobile nav drawer reuses it left-anchored via `side="left"`. Radix
 * supplies backdrop + Esc + outside-tap dismiss for both sides.
 *
 * Built on the already-installed `@radix-ui/react-dialog` (used by
 * Modal) so the dependency surface doesn't grow.
 */

import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

export type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  ariaTitle: string;
  ariaDescription?: string;
  width?: number;
  /** Anchor edge. Defaults to "right" so existing consumers are unchanged. */
  side?: "left" | "right";
  className?: string;
};

export function Sheet({
  open,
  onOpenChange,
  children,
  ariaTitle,
  ariaDescription,
  width = 480,
  side = "right",
  className,
}: SheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-ink/40 backdrop-blur-[1px]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-y-0 z-50 h-full",
            "bg-bg-raised shadow-[var(--shadow-2)]",
            "flex flex-col",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "duration-200",
            side === "left"
              ? "left-0 border-r border-line data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left"
              : "right-0 border-l border-line data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
            className,
          )}
          style={{ width: `min(100vw, ${width}px)` }}
        >
          <DialogPrimitive.Title className="sr-only">{ariaTitle}</DialogPrimitive.Title>
          {ariaDescription ? (
            <DialogPrimitive.Description className="sr-only">
              {ariaDescription}
            </DialogPrimitive.Description>
          ) : null}
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function SheetHeader({
  children,
  eyebrow = "Proposal",
}: {
  children: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="px-6 py-5 border-b border-line shrink-0">
      <div className="eyebrow mb-2">{eyebrow}</div>
      <div className="serif text-[22px] leading-[1.2] tracking-[-0.01em]">{children}</div>
    </div>
  );
}

export function SheetBody({ children }: { children: ReactNode }) {
  return <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>;
}

export function SheetFooter({ children }: { children: ReactNode }) {
  return (
    <div className="px-6 py-4 border-t border-line shrink-0 flex items-center justify-end gap-2.5">
      {children}
    </div>
  );
}
