"use client";

/**
 * StatusBar — status display per FE-8 admin-tests §B.2 §2
 * (`fe-specs/FE-8-admin-tests.md:247`). Renders status pill + mode pill
 * + last-edited meta line. Reuses `deriveDisplayStatus` (Slice 11
 * LOCKED helper).
 *
 * WarnBanner is co-located here as a sub-component per Slice 12 drift
 * Finding #9 (inline subcomponent rather than its own file).
 */

import { Icon } from "@/components/primitives/Icon";
import { cn } from "@/lib/utils";
import {
  deriveDisplayStatus,
  type DisplayStatus,
} from "@/lib/tests/derive-display-status";
import type { TestResponse } from "@/lib/queries/admin-tests";

type StatusBarProps = {
  test: TestResponse | null;
};

export function StatusBar({ test }: StatusBarProps) {
  if (!test) {
    return (
      <div
        className="flex items-center gap-3 text-[12px] text-ink-3"
        data-testid="status-bar"
      >
        <StatusBadge status="draft" />
        <span className="text-ink-4">·</span>
        <span
          className="font-mono uppercase tracking-[0.08em] text-[10.5px]"
          data-testid="status-bar-empty"
        >
          Not saved yet
        </span>
      </div>
    );
  }
  const ds = deriveDisplayStatus(test);
  return (
    <div
      className="flex items-center gap-3 text-[12px] text-ink-3"
      data-testid="status-bar"
    >
      <StatusBadge status={ds} />
      <span className="text-ink-4">·</span>
      <span
        className="font-mono uppercase tracking-[0.08em] text-[10.5px]"
        data-testid="status-bar-mode"
      >
        {test.mode}
      </span>
      <span className="text-ink-4">·</span>
      <span className="text-[11.5px]">last edited {formatRelative(test.updated_at)}</span>
    </div>
  );
}

export function WarnBanner({ status }: { status: DisplayStatus }) {
  if (status === "draft") return null;
  const copy =
    status === "locked"
      ? "This test is locked — content is fully immutable. Unlock to edit."
      : "This test is published — mode + pill + question pool are locked. Title and a few options remain editable.";
  return (
    <div
      className="border border-warn bg-warn-soft px-4 py-2.5 text-[12.5px] text-warn flex items-start gap-2"
      data-testid={`warn-banner-${status}`}
    >
      <Icon name="lock" size={12} className="mt-0.5 shrink-0" />
      <span>{copy}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: DisplayStatus }) {
  const map: Record<DisplayStatus, { label: string; tone: string }> = {
    draft: { label: "Draft", tone: "text-warn" },
    published: { label: "Published", tone: "text-success" },
    locked: { label: "Locked", tone: "text-ink-3" },
  };
  const m = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.08em]",
        m.tone,
      )}
      data-testid={`status-bar-status-${status}`}
    >
      {status === "locked" ? <Icon name="lock" size={10} /> : null}
      {m.label}
    </span>
  );
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const delta = Date.now() - t;
  if (delta < 0) return new Date(iso).toLocaleDateString();
  const sec = Math.round(delta / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}
