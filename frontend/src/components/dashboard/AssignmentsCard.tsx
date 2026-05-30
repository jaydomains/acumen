/**
 * AssignmentsCard — dashboard "Assigned to you" surface
 * (FE-3 §B.1, §E item 2; wired in N4).
 *
 * Consumes `GET /v1/me/assignments` via `useMeAssignments` and renders
 * each assignment as a row. Pill names are resolved client-side from the
 * testee catalogue (`useCataloguePills` first page); a pill_id missing
 * from that page falls back to `Pill {id8}…` so a row is never blank.
 * Learning-path assignments render a generic label — `/v1/learning-paths`
 * is admin-only, so no testee-facing path-name source exists (v1.x: add
 * pill_name + learning_path_name to the /v1/me/assignments response so
 * name resolution no longer depends on catalogue pagination).
 *
 * The segmented control filters in-memory: All / Mandatory. The
 * "Follow-ups" tab was dropped in N4 — follow-ups are an attempt-level
 * concept (app/domain/loop.py) with no AssignmentResponse field to filter
 * on; it returns when attempt-level follow-up data is exposed.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMeAssignments, type AssignmentResponse } from "@/lib/queries/me";
import { useCataloguePills, flattenPills } from "@/lib/queries/catalogue";

type Tab = "all" | "mandatory";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mandatory", label: "Mandatory" },
];

function formatDeadline(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function targetName(
  assignment: AssignmentResponse,
  pillNameById: Map<string, string>,
): string {
  if (assignment.pill_id) {
    return (
      pillNameById.get(assignment.pill_id) ?? `Pill ${assignment.pill_id.slice(0, 8)}…`
    );
  }
  return "Learning path";
}

function Row({
  assignment,
  pillNameById,
}: {
  assignment: AssignmentResponse;
  pillNameById: Map<string, string>;
}) {
  const name = targetName(assignment, pillNameById);
  const deadline = formatDeadline(assignment.deadline);
  const href = assignment.pill_id
    ? `/pills/${encodeURIComponent(assignment.pill_id)}`
    : null;

  return (
    <div
      data-testid="assignment-row"
      data-assignment-id={assignment.id}
      className={cn(
        "flex items-center justify-between gap-3 border-b border-line pb-3",
        "last:border-b-0 last:pb-0",
      )}
    >
      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium text-ink">{name}</div>
        <div className="mt-2 text-[11px] font-mono uppercase tracking-[0.04em] text-ink-3">
          Difficulty {assignment.difficulty}
          {deadline ? ` · Due ${deadline}` : ""}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {assignment.is_mandatory && (
          <span data-testid="assignment-mandatory-tag">
            <Badge tone="warn">Mandatory</Badge>
          </span>
        )}
        {href && (
          <Link
            href={href}
            data-testid="assignment-start"
            className="border border-line px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-bg-deep"
          >
            Start
          </Link>
        )}
      </div>
    </div>
  );
}

export function AssignmentsCard() {
  const [tab, setTab] = useState<Tab>("all");
  const queryClient = useQueryClient();
  const catalogueParams = useMemo(() => ({}), []);
  const { data: pillsData } = useCataloguePills(catalogueParams, queryClient);
  const pillNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const pill of flattenPills(pillsData)) map.set(pill.id, pill.name);
    return map;
  }, [pillsData]);

  const { data, isLoading, isError } = useMeAssignments();
  const all = data?.data ?? [];
  const rows = tab === "mandatory" ? all.filter((a) => a.is_mandatory) : all;

  return (
    <Card data-testid="assignments-card" className="flex flex-col gap-5 p-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="eyebrow">Up next</div>
          <h2 className="mt-1 font-serif text-[22px] tracking-[-0.015em]">
            Assigned to you
          </h2>
        </div>
        <div
          role="group"
          aria-label="Filter assignments"
          className="inline-flex border border-line bg-bg-raised"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              data-active={tab === t.id}
              data-testid={`assignments-tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cn(
                "border-r border-line px-3 py-2 text-[12.5px] font-medium last:border-r-0",
                "transition-colors duration-150",
                tab === t.id
                  ? "bg-ink text-bg-raised"
                  : "text-ink-2 hover:bg-bg-deep hover:text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div data-testid="assignments-loading" className="text-[13px] text-ink-3">
          Loading…
        </div>
      )}
      {isError && (
        <div data-testid="assignments-error" className="text-[13px] text-danger">
          Couldn’t load your assignments.
        </div>
      )}
      {!isLoading && !isError && rows.length === 0 && (
        <div
          data-testid="assignments-empty"
          className="border border-dashed border-line bg-bg-deep p-8 text-center text-[13px] text-ink-3"
        >
          Nothing assigned right now — self-directed practice is available via the
          catalogue.
        </div>
      )}
      {!isLoading && !isError && rows.length > 0 && (
        <div className="flex flex-col gap-3">
          {rows.map((a) => (
            <Row key={a.id} assignment={a} pillNameById={pillNameById} />
          ))}
        </div>
      )}
    </Card>
  );
}
