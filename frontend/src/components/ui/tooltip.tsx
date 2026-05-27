/**
 * shadcn Tooltip primitive — Radix wrapper with the FE-2 post-install
 * sweep applied verbatim: every `rounded-*` collapses to `rounded-none`
 * (hard-corner discipline from globals.css), and shadcn's default
 * `bg-primary`/`text-primary-foreground` are remapped to project
 * ink/bg tokens so the rendered tooltip matches the FE-2 design
 * system without bg-background / text-foreground leaking into the
 * component.
 *
 * Consumed by FE-6 §B.3/§B.4/§B.7 (calibration confidence hover,
 * AI-review chip hover, PdfExportButton gated-state tooltip).
 */

"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-none border border-line bg-ink px-3 py-1.5 text-xs text-bg-raised",
      "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
