/**
 * LoopStepRow — single step in the AdaptiveLoopCard list (FE-6 §B.5).
 *
 * Step types:
 *   explainer          → in-app route to /pills/{id} (FE-3 territory)
 *   external_link_set  → external `route_href` (AC-D21 safety pill);
 *                        opens in new tab with rel="noopener noreferrer"
 *   retest_queued      → re-test step; CTA is a v1 no-op "Defer"
 *                        (deferral mechanic lands in FE-9 admin ops)
 *
 * step_down_hint surfaces the AC-D6 "we've stepped down to D{n-1}"
 * sub-line so the testee knows the difficulty band shifted.
 */

import Link from "next/link";
import { Pill, type PillTone } from "@/components/primitives/Pill";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatQueuedFor } from "@/lib/result/adaptive-loop-format";
import type { components } from "@/lib/api/types";

type LoopStep = components["schemas"]["LoopStep"];

const STATUS_TONE: Record<string, PillTone> = {
  ready: "ok",
  optional: "default",
  queued: "info",
};

const STATUS_LABEL: Record<string, string> = {
  ready: "READY",
  optional: "OPTIONAL",
  queued: "QUEUED",
};

export type LoopStepRowProps = {
  step: LoopStep;
  index: number;
};

export function LoopStepRow({ step, index }: LoopStepRowProps) {
  const tone = STATUS_TONE[step.status] ?? "default";
  const statusLabel = STATUS_LABEL[step.status] ?? step.status.toUpperCase();
  const queuedCopy =
    step.type === "retest_queued" ? formatQueuedFor(step.queued_for) : null;

  return (
    <li
      data-testid="loop-step-row"
      data-step-type={step.type}
      className="border-t border-line py-4 first:border-t-0"
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="font-mono text-[11px] text-ink-3 tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="serif-it text-[15px] leading-tight text-ink">{step.title}</span>
        <Pill tone={tone} mono className="ml-auto">
          {statusLabel}
        </Pill>
      </div>
      {step.description ? (
        <p className="mb-2 text-[12px] leading-relaxed text-ink-2">{step.description}</p>
      ) : null}
      {queuedCopy ? (
        <p className="mb-2 font-mono text-[11px] text-ink-3">{queuedCopy}</p>
      ) : null}
      {step.step_down_hint ? (
        <p className="mb-2 font-mono text-[11px] text-warn">
          Stepped difficulty down · AC-D6 third-iteration rule
        </p>
      ) : null}
      <CtaButton step={step} />
    </li>
  );
}

function CtaButton({ step }: { step: LoopStep }) {
  const isExternal = step.type === "external_link_set";
  const isDefer = step.type === "retest_queued";

  if (isDefer) {
    // v1 no-op per FE-6 §E.1; FE-9 admin ops wires the deferral.
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              data-testid="loop-step-cta"
              data-step-type={step.type}
              className="font-mono text-[11px] tracking-[0.06em] uppercase text-ink-3 underline decoration-dotted underline-offset-2"
            >
              {step.cta_label}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            Deferral lands in a later release — admin ops surface (FE-9).
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (isExternal) {
    return (
      <a
        data-testid="loop-step-cta"
        data-step-type={step.type}
        href={step.route_href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-[11px] tracking-[0.06em] uppercase text-accent underline decoration-dotted underline-offset-2"
      >
        {step.cta_label} →
      </a>
    );
  }

  return (
    <Link
      data-testid="loop-step-cta"
      data-step-type={step.type}
      href={step.route_href}
      className="font-mono text-[11px] tracking-[0.06em] uppercase text-accent underline decoration-dotted underline-offset-2"
    >
      {step.cta_label} →
    </Link>
  );
}
