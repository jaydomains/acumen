"use client";

/**
 * GradeReviewQueue — client root for /review (FE-9 admin-ops §B.2).
 * Two-column layout: left rail = `?verdict=` segmented filter +
 * `QueueList`; right pane = `DetailPane` for the `?selected=` row, with
 * the `OverrideDrawer` opened from its CTA.
 *
 * URL state (both via `router.replace`, no history accumulation):
 *   - `?verdict=` flagged (default) | confirmed | all
 *   - `?selected=` grade_review_id — deep-linkable from the ops landing
 *
 * Auto-select: with no `?selected=`, the first row of the current result
 * is selected. Deep-link fallback: a selected row that isn't in the
 * current verdict view is recovered from the `verdict=all` list (there is
 * no single-row endpoint — §H(b) item 3).
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shell/PageHeader";
import { BoundaryFrame } from "@/components/shell/BoundaryFrame";
import { Icon } from "@/components/primitives/Icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useFlaggedGradeReviews,
  type VerdictFilter,
} from "@/lib/queries/admin-grade-reviews";
import { QueueList } from "./queue-list";
import { DetailPane } from "./detail-pane";
import { OverrideDrawer } from "./override-drawer";

const VERDICTS: VerdictFilter[] = ["flagged", "confirmed", "all"];
const VERDICT_LABEL: Record<VerdictFilter, string> = {
  flagged: "Flagged",
  confirmed: "Confirmed",
  all: "All",
};

function isVerdict(v: string | null): v is VerdictFilter {
  return v === "flagged" || v === "confirmed" || v === "all";
}

export function GradeReviewQueue() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verdictParam = searchParams?.get("verdict") ?? null;
  const verdict: VerdictFilter = isVerdict(verdictParam) ? verdictParam : "flagged";
  const selected = searchParams?.get("selected") ?? null;

  const [drawerOpen, setDrawerOpen] = useState(false);

  const primary = useFlaggedGradeReviews(verdict);
  const rows = primary.data?.data ?? [];
  const inList = rows.find((r) => r.grade_review_id === selected) ?? null;

  // Deep-linked row that isn't in the current view — recover from `all`.
  const needFallback = !!selected && !inList && verdict !== "all";
  const fallback = useFlaggedGradeReviews("all", { enabled: needFallback });
  const fallbackRow = needFallback
    ? (fallback.data?.data.find((r) => r.grade_review_id === selected) ?? null)
    : null;
  const selectedRow = inList ?? fallbackRow;

  const writeParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();
      router.replace(qs ? `/review?${qs}` : "/review");
    },
    [router, searchParams],
  );

  // Normalise a missing/invalid verdict param to the default. The
  // `isVerdict` guard makes this idempotent — re-running after the
  // replace lands (and `writeParams` re-identifies) is a no-op.
  useEffect(() => {
    if (!isVerdict(verdictParam)) writeParams({ verdict: "flagged" });
  }, [verdictParam, writeParams]);

  // Auto-select the first row when nothing is selected. The `!selected`
  // guard makes this idempotent across `writeParams`/`rows` re-identity.
  const firstRowId = rows[0]?.grade_review_id ?? null;
  useEffect(() => {
    if (!primary.isPending && !selected && firstRowId) {
      writeParams({ selected: firstRowId });
    }
  }, [primary.isPending, selected, firstRowId, writeParams]);

  const onResolved = () => {
    setDrawerOpen(false);
    // The resolved row leaves the list; drop the selection and let
    // auto-select pick the next first row after the refetch.
    writeParams({ selected: null });
  };

  return (
    <>
      <PageHeader
        eyebrow="Cross-family review · AC-D19 · batched per attempt · 60s ceiling"
        title="Adjudicate AI grades."
        subtitle="Flagged grades are where the AI grader and its reviewer disagree. Keep the AI grade, accept the reviewer, or substitute your own."
      />

      {primary.isError ? (
        <BoundaryFrame
          glyph={<Icon name="wave" size={24} />}
          eyebrow="GRADE REVIEW"
          title="We couldn't load the review queue."
          body="The grade-review request failed. Try again, and if it keeps failing, let your administrator know."
          actions={
            <Button onClick={() => primary.refetch()} variant="outline" size="sm">
              Try again
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div
              className="mb-3 inline-flex border border-line"
              role="tablist"
              aria-label="Verdict filter"
            >
              {VERDICTS.map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={v === verdict}
                  onClick={() => writeParams({ verdict: v, selected: null })}
                  data-testid={`review-verdict-${v}`}
                  className={cn(
                    "px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em]",
                    v === verdict
                      ? "bg-ink text-bg-raised"
                      : "text-ink-3 hover:bg-bg-deep",
                  )}
                >
                  {VERDICT_LABEL[v]}
                </button>
              ))}
            </div>

            <QueueList
              reviews={rows}
              isPending={primary.isPending}
              verdict={verdict}
              selectedId={selected}
              onSelect={(id) => writeParams({ selected: id })}
            />
          </div>

          <div className="lg:col-span-8">
            <DetailPane
              review={selectedRow}
              onApplyOverride={() => setDrawerOpen(true)}
            />
          </div>
        </div>
      )}

      {drawerOpen && selectedRow ? (
        <OverrideDrawer
          review={selectedRow}
          onResolved={onResolved}
          onClose={() => setDrawerOpen(false)}
        />
      ) : null}
    </>
  );
}
