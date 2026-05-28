"use client";

/**
 * PillsTab — list + create/edit per FE-8 §B.2
 * (`fe-specs/FE-8-admin-catalogue.md:196–423`).
 *
 * URL state: `?q={search}&subject={subjectId}&status={draft|published|all}`.
 * `GET /v1/pills` carries only `cursor + limit` server-side (drift
 * Finding #3) — `q`, `subject_id`, and `status` filter the cached page
 * array client-side per §E.7. URL still carries them for deep-links
 * + back-button.
 *
 * `difficulty` filter is deferred to v1.x under §E pattern — lowest-
 * priority filter, keeps Slice 3 tight.
 *
 * Modal state is ephemeral (NOT in URL) per §B.2 §1 + §B.1 §7.
 *
 * Sentinel-driven pagination follows FE-3 §C.5 with destructured
 * props per the IntersectionObserver-dep-array discipline absorbed
 * in Slice 2 (`CatalogueGrid.tsx:30–44`).
 *
 * Used-in column renders em-dash placeholder per §E.8 + drift
 * Finding #4 (used_in_count absent from `PillResponse`). Locked-mode
 * banner in `PillModal` is deferred to v1.x for the same reason.
 *
 * Retired pills (per §E.4 + drift Finding #7): rendered with a
 * Retired badge in the Status column, Edit action disabled. Server
 * may or may not filter them; either way the list copes.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FilterBar } from "@/components/admin/filter-bar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  flattenPills,
  useAdminPills,
  type PillResponse,
} from "@/lib/queries/admin-pills";
import {
  flattenSubjects,
  useAdminSubjects,
  type SubjectResponse,
} from "@/lib/queries/admin-subjects";
import { PillModal } from "./pill-modal";

type ModalState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; pill: PillResponse };

type StatusFilter = "all" | "draft" | "published";

export function PillsTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams?.get("q") ?? "";
  const subjectFilter = searchParams?.get("subject") ?? "";
  const statusRaw = searchParams?.get("status") ?? "all";
  const status: StatusFilter =
    statusRaw === "draft" || statusRaw === "published" ? statusRaw : "all";

  const [modal, setModal] = useState<ModalState>({ kind: "closed" });

  const pillsList = useAdminPills();
  const subjectsList = useAdminSubjects();
  const allPills = useMemo(() => flattenPills(pillsList.data), [pillsList.data]);
  const subjects = useMemo(() => flattenSubjects(subjectsList.data), [subjectsList.data]);
  const subjectById = useMemo(() => {
    const m = new Map<string, SubjectResponse>();
    for (const s of subjects) m.set(s.id, s);
    return m;
  }, [subjects]);

  const filtered = useMemo(
    () => filterPills(allPills, { q, subjectFilter, status }),
    [allPills, q, subjectFilter, status],
  );

  const writeParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (!params.get("tab")) params.set("tab", "pills");
    if (value === null || value === "") params.delete(key);
    else params.set(key, value);
    router.replace(`/admin/catalogue?${params.toString()}`);
  };

  return (
    <div data-testid="pills-tab">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <FilterBar
          searchValue={q}
          onSearchChange={(v) => writeParam("q", v)}
          searchPlaceholder="Search pills…"
          segments={[
            {
              label: "Status",
              value: status,
              options: [
                { label: "All", value: "all" },
                { label: "Draft", value: "draft" },
                { label: "Published", value: "published" },
              ],
              onChange: (next) => writeParam("status", next === "all" ? null : next),
            },
          ]}
        />
        <div className="flex items-center gap-2">
          <select
            value={subjectFilter}
            onChange={(e) => writeParam("subject", e.target.value || null)}
            data-testid="pills-subject-filter"
            aria-label="Filter by subject"
            className={cn(
              "h-10 w-[200px] border border-line bg-bg-raised px-3 text-[13px]",
              "focus:outline-none focus:ring-2 focus:ring-accent",
            )}
          >
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Button
            onClick={() => setModal({ kind: "create" })}
            data-testid="pills-add-button"
          >
            + Add pill
          </Button>
        </div>
      </div>

      <PillsBody
        list={pillsList}
        pills={filtered}
        subjectById={subjectById}
        hasFilter={q.length > 0 || subjectFilter.length > 0 || status !== "all"}
        onEdit={(pill) => setModal({ kind: "edit", pill })}
      />

      {modal.kind === "create" || modal.kind === "edit" ? (
        <PillModal
          mode={modal.kind}
          pill={modal.kind === "edit" ? modal.pill : null}
          subjects={subjects}
          onClose={() => setModal({ kind: "closed" })}
        />
      ) : null}
    </div>
  );
}

function filterPills(
  pills: PillResponse[],
  filters: { q: string; subjectFilter: string; status: StatusFilter },
): PillResponse[] {
  const needle = filters.q.trim().toLowerCase();
  return pills.filter((p) => {
    if (needle) {
      const inName = p.name.toLowerCase().includes(needle);
      const inDescription = (p.description ?? "").toLowerCase().includes(needle);
      if (!inName && !inDescription) return false;
    }
    if (filters.subjectFilter && p.subject_id !== filters.subjectFilter) return false;
    if (filters.status === "draft" && p.discoverable) return false;
    if (filters.status === "published" && !p.discoverable) return false;
    return true;
  });
}

type PillsBodyProps = {
  list: ReturnType<typeof useAdminPills>;
  pills: PillResponse[];
  subjectById: Map<string, SubjectResponse>;
  hasFilter: boolean;
  onEdit: (pill: PillResponse) => void;
};

function PillsBody({ list, pills, subjectById, hasFilter, onEdit }: PillsBodyProps) {
  const sentinelRef = useRef<HTMLTableRowElement | null>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    if (typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (list.isPending) {
    return (
      <div className="mt-5" data-testid="pills-loading">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-9 w-full mb-2" />
        ))}
      </div>
    );
  }

  if (pills.length === 0) {
    return (
      <div
        className="mt-5 border border-line bg-bg-raised p-10 text-center"
        data-testid="pills-empty"
      >
        <div className="font-serif text-[20px] text-ink mb-2">
          {hasFilter ? "No pills match your filters." : "No pills yet."}
        </div>
        <div className="text-[13px] text-ink-3">
          {hasFilter
            ? "Try clearing a filter or searching for a different term."
            : 'Add your first pill with "+ Add pill" above to start building the catalogue.'}
        </div>
      </div>
    );
  }

  return (
    <table className="mt-5 w-full text-[13px]" data-testid="pills-table">
      <thead>
        <tr className="border-b border-line text-ink-3 text-left">
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2">
            Pill
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[16%]">
            Subject
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[12%]">
            Difficulty
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[8%]">
            Safety
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[8%]">
            Used in
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[10%]">
            Status
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[10%] text-right">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {pills.map((pill) => {
          const retired = pill.retired_at !== null;
          const subjectName = subjectById.get(pill.subject_id)?.name ?? "—";
          return (
            <tr
              key={pill.id}
              className={cn("border-b border-line", retired && "opacity-60")}
              data-testid={`pills-row-${pill.id}`}
            >
              <td className="py-2.5 px-2 font-medium text-ink">{pill.name}</td>
              <td className="py-2.5 px-2 text-ink-2">{subjectName}</td>
              <td className="py-2.5 px-2 font-mono text-ink-2 text-[12px]">
                D{pill.available_difficulty_min}–D{pill.available_difficulty_max}
              </td>
              <td className="py-2.5 px-2">
                {pill.safety_relevant ? (
                  <span
                    className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-danger"
                    data-testid={`pills-safety-badge-${pill.id}`}
                  >
                    Safety
                  </span>
                ) : (
                  <span className="text-ink-3">—</span>
                )}
              </td>
              <td className="py-2.5 px-2 text-ink-3" data-testid="derived-count-pending">
                —
              </td>
              <td className="py-2.5 px-2">
                {retired ? (
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-3">
                    Retired
                  </span>
                ) : (
                  <span
                    className={cn(
                      "font-mono text-[10.5px] uppercase tracking-[0.08em]",
                      pill.discoverable ? "text-success" : "text-warn",
                    )}
                  >
                    {pill.discoverable ? "Published" : "Draft"}
                  </span>
                )}
              </td>
              <td className="py-2.5 px-2 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(pill)}
                  disabled={retired}
                  data-testid={`pills-edit-${pill.id}`}
                >
                  Edit
                </Button>
              </td>
            </tr>
          );
        })}
        {list.hasNextPage ? (
          <tr ref={sentinelRef} data-testid="pills-sentinel" aria-hidden="true">
            <td colSpan={7} className="py-3 text-center text-ink-3 text-[12px]">
              {list.isFetchingNextPage ? "Loading more…" : ""}
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}
