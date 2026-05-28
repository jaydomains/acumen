/**
 * Modal primitives — Modal, ModalHeader, ModalActions (FE-8 §C.5 in
 * `fe-specs/FE-8-admin-catalogue.md:1201–1203`). Shared across all
 * three FE-8 sibling files. Wraps shadcn `Dialog` for keyboard /
 * focus-trap handling; styles to match paper-card chrome per
 * `admin-authoring.jsx:49–88`.
 *
 * Consumers control open state externally — Modal is a controlled
 * wrapper. Pass `width` to override the default 560px max-width
 * (matches prototype default).
 */
"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  width?: number;
  /** Accessible title used for screen readers when no visible title is
   *  set via `ModalHeader.title`. Required by Radix Dialog a11y. */
  ariaTitle: string;
  ariaDescription?: string;
};

export function Modal({
  open,
  onOpenChange,
  children,
  width = 560,
  ariaTitle,
  ariaDescription,
}: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "bg-bg-raised border border-line shadow-[var(--shadow-2)]",
          "px-[30px] py-7 max-h-[88vh] overflow-y-auto",
          "sm:rounded-none",
        )}
        style={{ maxWidth: width, width: "100%" }}
      >
        <DialogTitle className="sr-only">{ariaTitle}</DialogTitle>
        {ariaDescription ? (
          <DialogDescription className="sr-only">{ariaDescription}</DialogDescription>
        ) : null}
        {children}
      </DialogContent>
    </Dialog>
  );
}

export type ModalHeaderProps = {
  eyebrow: string;
  title: ReactNode;
  className?: string;
};

export function ModalHeader({ eyebrow, title, className }: ModalHeaderProps) {
  return (
    <div className={className}>
      <div className="eyebrow mb-2">{eyebrow}</div>
      <div className="serif text-[24px] leading-[1.25] tracking-[-0.01em] mb-[18px]">
        {title}
      </div>
    </div>
  );
}

export type ModalActionsProps = {
  children: ReactNode;
  className?: string;
};

export function ModalActions({ children, className }: ModalActionsProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2.5 mt-[22px] pt-[18px]",
        "border-t border-line flex-wrap",
        className,
      )}
    >
      {children}
    </div>
  );
}
