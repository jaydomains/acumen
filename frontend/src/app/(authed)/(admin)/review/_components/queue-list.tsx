"use client";

/**
 * QueueList — the left-rail list of grade-review rows (FE-9 admin-ops
 * §B.2 §2). Card-style rows (not a table) per design `admin.jsx:180–202`:
 * testee + pill + age + AI-verdict pill. The selected row is highlighted
 * with a trailing arrow.
 */

import { Pill } from "@/components/primitives/Pill";
import { Icon } from "@/components/primitives/Icon";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  FlaggedGradeReviewItem,
  VerdictFilter,
} from "@/lib/queries/admin-grade-reviews";

/** Compact age string from an ISO timestamp ("3d" / "5h" / "just now"). */
function ageLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "—";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return mins <= 1 ? "just now" : `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

const EMPTY_COPY: Record<VerdictFilter, { title: string; body: string }> = {
  flagged: {
    title: "No flagged grades waiting",
    body: "Every AI grade on the current sweep window agrees with its reviewer.",
  },
  confirmed: {
    title: "No confirmed reviews on the current sweep window",
    body: "Confirmed resolutions appear here after you adjudicate flagged grades.",
  },
  all: {
    title: "No grade reviews on the current sweep window",
    body: "Nothing has been graded for review yet.",
  },
};

export function QueueList({
  reviews,
  isPending,
  verdict,
  selectedId,
  onSelect,
}: {
  reviews: FlaggedGradeReviewItem[];
  isPending: boolean;
  verdict: VerdictFilter;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (isPending) {
    return (
      <div className="flex flex-col gap-2" data-testid="review-list-loading">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    const copy = EMPTY_COPY[verdict];
    return (
      <div
        className="border border-line bg-bg-raised p-6 text-center"
        data-testid="review-list-empty"
      >
        <div className="mb-2 flex justify-center text-ok">
          <Icon name="check" size={22} />
        </div>
        <div className="font-serif text-[16px] text-ink mb-1">{copy.title}</div>
        <div className="text-[12px] text-ink-3">{copy.body}</div>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2" data-testid="review-list">
      {reviews.map((row) => {
        const active = row.grade_review_id === selectedId;
        return (
          <li key={row.grade_review_id}>
            <button
              type="button"
              onClick={() => onSelect(row.grade_review_id)}
              data-testid={`review-row-${row.grade_review_id}`}
              aria-current={active}
              className={cn(
                "flex w-full items-center gap-3 border px-3 py-2.5 text-left transition-colors",
                active
                  ? "border-ink bg-bg-deep"
                  : "border-line bg-bg-raised hover:bg-bg-deep",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-ink">
                  {row.testee_name}
                </div>
                <div className="truncate text-[12px] text-ink-3">{row.pill_name}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-mono text-[11px] text-ink-3">
                  {ageLabel(row.created_at)}
                </span>
                <Pill mono tone="warn">
                  {row.ai_verdict}
                </Pill>
                {active ? <Icon name="external" size={12} /> : null}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
