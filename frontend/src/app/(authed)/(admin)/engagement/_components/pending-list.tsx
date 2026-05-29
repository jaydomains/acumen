"use client";

/**
 * Engagement client surface (FE-9 admin-ops §B.4). Renders the page
 * header with the sweep affordance, plus the pending-assignments
 * table. v1 is sweep-only — NO per-row Nudge / Reassign actions
 * (`FE_ROADMAP.md:188` + `admin-ops.jsx:277–284` removal callout).
 *
 * Wire shape: built against the enriched `EngagementWidgetItem` /
 * `SweepResult` (the §H(a) item 1 row-enrichment contract has landed
 * in the backend schema — see `admin-engagement.ts` header note).
 */

import { useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { PageHeader } from "@/components/shell/PageHeader";
import { Pill } from "@/components/primitives/Pill";
import { Icon } from "@/components/primitives/Icon";
import { Skeleton } from "@/components/ui/skeleton";
import { SweepButton } from "@/components/admin/sweep-button";
import {
  useEngagementPending,
  useSweepEngagement,
  type EngagementWidgetItem,
  type SweepResult,
} from "@/lib/queries/admin-engagement";

const plural = (n: number) => (n === 1 ? "" : "s");

/** Pattern B success copy composed from the enriched SweepResult. */
function sweepMessage(r: SweepResult): string {
  return (
    `Swept ${r.assignments_processed} stale assignment${plural(r.assignments_processed)} · ` +
    `${r.first_reminders_sent} first reminder${plural(r.first_reminders_sent)} · ` +
    `${r.second_reminders_sent} second reminder${plural(r.second_reminders_sent)} · ` +
    `${r.escalations_sent} escalated`
  );
}

export function PendingList() {
  const query = useEngagementPending();
  const sweep = useSweepEngagement();
  const [lastSweptAt, setLastSweptAt] = useState<string | null>(null);

  const onRun = async () => {
    try {
      const result = await sweep.mutateAsync();
      setLastSweptAt(result.last_swept_at);
      toast.success(sweepMessage(result));
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Couldn't run sweep — try again";
      toast.error(msg);
      // Rethrow so SweepButton reverts to idle (no done-flash on failure).
      throw err;
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="AC-D26 · derived engagement_status · 7-day default threshold"
        title="Who's not engaging."
        subtitle="Mandatory assignments pending past your configured threshold. Auto-reminders fire on schedule; non-engagement after the second reminder escalates to you."
        actions={
          <div className="flex flex-col items-end gap-1">
            <SweepButton label="Run sweep now" runningLabel="Sweeping…" onRun={onRun} />
            {lastSweptAt ? (
              <span
                className="text-ink-3 text-[11.5px]"
                data-testid="engagement-last-swept"
              >
                Last swept{" "}
                {new Date(lastSweptAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            ) : null}
          </div>
        }
      />

      <PendingTable query={query} />
    </>
  );
}

function PendingTable({ query }: { query: ReturnType<typeof useEngagementPending> }) {
  if (query.isPending) {
    return (
      <div className="mt-5" data-testid="engagement-loading">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="mb-2 h-9 w-full" />
        ))}
      </div>
    );
  }

  const rows: EngagementWidgetItem[] = query.data?.data ?? [];

  if (rows.length === 0) {
    return (
      <div
        className="mt-5 border border-line bg-bg-raised p-10 text-center"
        data-testid="engagement-empty"
      >
        <div className="mb-2 flex justify-center text-ok">
          <Icon name="check" size={26} />
        </div>
        <div className="font-serif text-[20px] text-ink mb-2">All caught up</div>
        <div className="text-[13px] text-ink-3">
          No stale mandatory assignments past the 7-day threshold.
        </div>
      </div>
    );
  }

  return (
    <table className="mt-5 w-full text-[13px]" data-testid="engagement-table">
      <thead>
        <tr className="border-b border-line text-ink-3 text-left">
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2">
            Testee
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2">
            Assignment
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[16%]">
            Assigner
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[10%]">
            Days stale
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[12%]">
            Reminders
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[14%]">
            Escalated
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.assignment_id}
            className="border-b border-line"
            data-testid={`engagement-row-${row.assignment_id}`}
          >
            <td className="py-2.5 px-2 font-medium text-ink">{row.testee_name}</td>
            <td className="py-2.5 px-2 text-ink-2">{row.pill_or_test_name}</td>
            <td className="py-2.5 px-2 text-ink-2">{row.assigner_name}</td>
            <td className="py-2.5 px-2 font-mono text-ink-2">{row.days_stale}d</td>
            <td className="py-2.5 px-2">
              <Pill mono>R{row.reminders_sent}</Pill>
            </td>
            <td className="py-2.5 px-2">
              {row.escalated ? (
                <Pill tone="warn" mono>
                  Escalated
                </Pill>
              ) : (
                <span className="text-ink-3">—</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
