"use client";

/**
 * SafetyTab — pills with `safety_relevant=true` + override toggle per
 * FE-8 §B.5 (`fe-specs/FE-8-admin-catalogue.md:680–807`).
 *
 * Cache discipline: reuses `useAdminPills()` (same `adminKeys.pills.list({})`
 * key) so the cache stays unified with the Pills tab — toggling a pill's
 * safety status here invalidates the shared key and the Pills tab sees
 * the same state on next visit. Drift Finding #9 (server has no
 * `safety_relevant` query param) absorbed under §E.7: filter
 * `pills.filter(p => p.safety_relevant)` client-side.
 *
 * URL state: `?q={search}&subject={subjectId}`. No status filter
 * (every row is safety-tagged). `writeParam` ensures `?tab=safety`
 * survives query writes (Slice 4 Gitar precedent).
 *
 * Override-source badge per spec §B.5:
 *   - `safety_relevant_overridden_at === null` → "Auto" (default tone)
 *   - `safety_relevant_overridden_at !== null` → "Admin · {relative date}"
 *
 * "Remove safety tag" row action opens `SafetyOverrideConfirmModal`
 * before firing `useSetPillSafety({safety_relevant: false})`. Spec §B.5
 * §5 mandates confirmation on toggle-OFF (the only direction available
 * since every row is already on). Toast surfaced at the component
 * boundary (Slice 4 pattern).
 *
 * Edit row action mounts `PillModal` in edit mode — same primitive
 * Pills tab uses; field set is identical because safety pills are pills.
 *
 * No "+ Add safety pill" affordance per drift Finding #8 — spec §B.5 §2
 * doesn't list it; safety tagging happens via auto-tagging on create or
 * the proposals queue.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Modal, ModalActions, ModalHeader } from "@/components/admin/modal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  flattenPills,
  useAdminPills,
  useSetPillSafety,
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
  | { kind: "edit"; pill: PillResponse }
  | { kind: "confirm-untag"; pill: PillResponse };

export function SafetyTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams?.get("q") ?? "";
  const subjectFilter = searchParams?.get("subject") ?? "";

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

  const safetyPills = useMemo(
    () => allPills.filter((p) => p.safety_relevant),
    [allPills],
  );
  const filtered = useMemo(
    () => filterPills(safetyPills, { q, subjectFilter }),
    [safetyPills, q, subjectFilter],
  );

  const writeParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (!params.get("tab")) params.set("tab", "safety");
    if (value === null || value === "") params.delete(key);
    else params.set(key, value);
    router.replace(`/admin/catalogue?${params.toString()}`);
  };

  return (
    <div data-testid="safety-tab">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="search"
          value={q}
          onChange={(e) => writeParam("q", e.target.value)}
          placeholder="Search safety pills…"
          aria-label="Search safety pills"
          data-testid="safety-search"
          className={cn(
            "h-10 max-w-[280px] border border-line bg-bg-raised px-3 text-[13px]",
            "focus:outline-none focus:ring-2 focus:ring-accent",
          )}
        />
        <select
          value={subjectFilter}
          onChange={(e) => writeParam("subject", e.target.value || null)}
          data-testid="safety-subject-filter"
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
      </div>

      <div className="mt-3 text-[12px] text-ink-3 max-w-[64ch]">
        Safety-tagged pills serve curated industry sources only — Acumen does not generate
        AI teaching material for these. Removing the tag re-enables AI explainer
        generation per AC-D21.
      </div>

      <SafetyBody
        list={pillsList}
        pills={filtered}
        subjectById={subjectById}
        hasFilter={q.length > 0 || subjectFilter.length > 0}
        onEdit={(pill) => setModal({ kind: "edit", pill })}
        onUntag={(pill) => setModal({ kind: "confirm-untag", pill })}
      />

      {modal.kind === "edit" ? (
        <PillModal
          mode="edit"
          pill={modal.pill}
          subjects={subjects}
          onClose={() => setModal({ kind: "closed" })}
        />
      ) : null}

      {modal.kind === "confirm-untag" ? (
        <SafetyOverrideConfirmModal
          pill={modal.pill}
          onClose={() => setModal({ kind: "closed" })}
        />
      ) : null}
    </div>
  );
}

function filterPills(
  pills: PillResponse[],
  filters: { q: string; subjectFilter: string },
): PillResponse[] {
  const needle = filters.q.trim().toLowerCase();
  return pills.filter((p) => {
    if (needle) {
      const inName = p.name.toLowerCase().includes(needle);
      const inDescription = (p.description ?? "").toLowerCase().includes(needle);
      if (!inName && !inDescription) return false;
    }
    if (filters.subjectFilter && p.subject_id !== filters.subjectFilter) return false;
    return true;
  });
}

type SafetyBodyProps = {
  list: ReturnType<typeof useAdminPills>;
  pills: PillResponse[];
  subjectById: Map<string, SubjectResponse>;
  hasFilter: boolean;
  onEdit: (pill: PillResponse) => void;
  onUntag: (pill: PillResponse) => void;
};

function SafetyBody({
  list,
  pills,
  subjectById,
  hasFilter,
  onEdit,
  onUntag,
}: SafetyBodyProps) {
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
      <div className="mt-5" data-testid="safety-loading">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-full mb-2" />
        ))}
      </div>
    );
  }

  if (pills.length === 0) {
    return (
      <div
        className="mt-5 border border-line bg-bg-raised p-10 text-center"
        data-testid="safety-empty"
      >
        <div className="font-serif text-[20px] text-ink mb-2">
          {hasFilter
            ? "No safety pills match your filters."
            : "No safety-tagged pills yet."}
        </div>
        <div className="text-[13px] text-ink-3">
          {hasFilter
            ? "Try clearing a filter or searching for a different term."
            : "Pills get the safety tag at create time, via the Pills tab safety toggle, or via approved proposals."}
        </div>
      </div>
    );
  }

  return (
    <table className="mt-5 w-full text-[13px]" data-testid="safety-table">
      <thead>
        <tr className="border-b border-line text-ink-3 text-left">
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2">
            Pill
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[18%]">
            Subject
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[20%]">
            Override source
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[24%] text-right">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {pills.map((pill) => {
          const subjectName = subjectById.get(pill.subject_id)?.name ?? "—";
          const retired = pill.retired_at !== null;
          return (
            <tr
              key={pill.id}
              className={cn("border-b border-line", retired && "opacity-60")}
              data-testid={`safety-row-${pill.id}`}
            >
              <td className="py-2.5 px-2 font-medium text-ink">{pill.name}</td>
              <td className="py-2.5 px-2 text-ink-2">{subjectName}</td>
              <td className="py-2.5 px-2">
                <OverrideSourceBadge overriddenAt={pill.safety_relevant_overridden_at} />
              </td>
              <td className="py-2.5 px-2 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(pill)}
                  disabled={retired}
                  data-testid={`safety-edit-${pill.id}`}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onUntag(pill)}
                  disabled={retired}
                  data-testid={`safety-untag-${pill.id}`}
                >
                  Remove safety tag
                </Button>
              </td>
            </tr>
          );
        })}
        {list.hasNextPage ? (
          <tr ref={sentinelRef} data-testid="safety-sentinel" aria-hidden="true">
            <td colSpan={4} className="py-3 text-center text-ink-3 text-[12px]">
              {list.isFetchingNextPage ? "Loading more…" : ""}
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

function OverrideSourceBadge({ overriddenAt }: { overriddenAt: string | null }) {
  if (overriddenAt === null) {
    return (
      <span
        className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-3"
        data-testid="override-source-auto"
      >
        Auto
      </span>
    );
  }
  return (
    <span
      className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-warn"
      data-testid="override-source-admin"
    >
      Admin · {formatRelative(overriddenAt)}
    </span>
  );
}

function SafetyOverrideConfirmModal({
  pill,
  onClose,
}: {
  pill: PillResponse;
  onClose: () => void;
}) {
  const mutation = useSetPillSafety();

  const onConfirm = async () => {
    try {
      await mutation.mutateAsync({ pillId: pill.id, safety_relevant: false });
      toast("Safety tag removed — AI explainer re-enabled");
      onClose();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Couldn't update — try again";
      toast.error(msg);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(o) => (o ? null : onClose())}
      ariaTitle="Remove safety tag"
      ariaDescription="Confirm removal of the safety tag for this pill."
    >
      <ModalHeader
        eyebrow="Remove safety tag"
        title={
          <>
            Remove <span className="serif-it">safety</span> from {pill.name}?
          </>
        }
      />
      <p className="text-[13px] text-ink-2">
        Acumen will resume generating AI teaching material for this pill per AC-D21.
        Curated industry sources will no longer be served from the safety-pill viewer.
      </p>
      <ModalActions>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={mutation.isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={onConfirm}
          disabled={mutation.isPending}
          data-testid="safety-untag-confirm"
        >
          {mutation.isPending ? "Removing…" : "Remove safety tag"}
        </Button>
      </ModalActions>
    </Modal>
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
