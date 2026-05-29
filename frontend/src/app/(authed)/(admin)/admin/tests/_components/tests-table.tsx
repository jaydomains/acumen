"use client";

/**
 * TestsTable — admin tests list per FE-8 admin-tests §B.1
 * (`fe-specs/FE-8-admin-tests.md:69–220`).
 *
 * URL state: `?mode={per_testee|frozen|hand_authored|benchmark|all}`
 * + `?status={draft|published|locked|all}` (defaults `all`).
 *
 * Drift Finding #1: `GET /v1/tests` carries only `cursor + limit` —
 * `mode` + `status` filter client-side over the flattened cache.
 *
 * Drift Finding #4: spec only mentions Edit row action; Slice 11
 * adds Delete per the paths-list precedent. Delete uses Modal-based
 * confirm.
 *
 * Drift Finding #5: pill name column shows `pill_id` joined against
 * `useAdminPills` cache; em-dash for null pill_id (frozen / hand_authored
 * / benchmark tests don't have a single bindable pill).
 *
 * Drift Finding #6: `deriveDisplayStatus` from
 * `frontend/src/lib/tests/derive-display-status.ts` — first consumer.
 *
 * Benchmark mode filter segment is disabled per §E.8 (benchmark
 * authoring deferred from v1).
 */

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { PageHeader } from "@/components/shell/PageHeader";
import { FilterBar } from "@/components/admin/filter-bar";
import { Modal, ModalActions, ModalHeader } from "@/components/admin/modal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/primitives/Icon";
import { cn } from "@/lib/utils";
import {
  flattenTests,
  useAdminTests,
  useDeleteTest,
  type TestResponse,
} from "@/lib/queries/admin-tests";
import { flattenPills, useAdminPills } from "@/lib/queries/admin-pills";
import {
  deriveDisplayStatus,
  type DisplayStatus,
} from "@/lib/tests/derive-display-status";

type ModeFilter = "per_testee" | "frozen" | "hand_authored" | "benchmark" | "all";
type StatusFilter = "draft" | "published" | "locked" | "all";

type ModalState = { kind: "closed" } | { kind: "delete"; test: TestResponse };

const MODE_META: Record<Exclude<ModeFilter, "all">, string> = {
  per_testee: "4–12 questions sampled per testee",
  frozen: "fixed pool · everyone sees the same questions",
  hand_authored: "manually written · no generation",
  benchmark: "sequential walk · cohort comparison",
};

function isModeFilter(v: string | null): v is ModeFilter {
  return (
    v === "per_testee" ||
    v === "frozen" ||
    v === "hand_authored" ||
    v === "benchmark" ||
    v === "all"
  );
}

function isStatusFilter(v: string | null): v is StatusFilter {
  return v === "draft" || v === "published" || v === "locked" || v === "all";
}

export function TestsTable() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode: ModeFilter = isModeFilter(searchParams?.get("mode") ?? null)
    ? (searchParams!.get("mode") as ModeFilter)
    : "all";
  const status: StatusFilter = isStatusFilter(searchParams?.get("status") ?? null)
    ? (searchParams!.get("status") as StatusFilter)
    : "all";

  const [modal, setModal] = useState<ModalState>({ kind: "closed" });

  const list = useAdminTests();
  const allTests = useMemo(() => flattenTests(list.data), [list.data]);
  const pillsList = useAdminPills();
  const pills = useMemo(() => flattenPills(pillsList.data), [pillsList.data]);
  const pillById = useMemo(() => new Map(pills.map((p) => [p.id, p])), [pills]);

  const filtered = useMemo(() => {
    return allTests.filter((t) => {
      if (mode !== "all" && t.mode !== mode) return false;
      if (status !== "all") {
        const ds = deriveDisplayStatus(t);
        if (ds !== status) return false;
      }
      return true;
    });
  }, [allTests, mode, status]);

  const stats = useMemo(() => {
    const all = allTests;
    let published = 0;
    let draft = 0;
    let locked = 0;
    for (const t of all) {
      const ds = deriveDisplayStatus(t);
      if (ds === "draft") draft += 1;
      else if (ds === "locked") locked += 1;
      else published += 1;
    }
    return { total: all.length, published, draft, locked };
  }, [allTests]);

  const writeParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (value === null || value === "" || value === "all") params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.replace(qs ? `/admin/tests?${qs}` : "/admin/tests");
  };

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Tests"
        subtitle="Author tests in any of four modes. Lock a published test to preserve historical comparability."
        actions={
          <Button
            onClick={() => router.push("/admin/tests/new/edit")}
            data-testid="tests-add-button"
          >
            + New test
          </Button>
        }
      />

      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5"
        data-testid="tests-stats"
      >
        <StatCard label="Tests" value={stats.total} />
        <StatCard label="Published" value={stats.published} />
        <StatCard label="Draft" value={stats.draft} />
        <StatCard label="Locked" value={stats.locked} />
      </div>

      <FilterBar
        segments={[
          {
            label: "Mode",
            value: mode,
            options: [
              { label: "All", value: "all" },
              { label: "per_testee", value: "per_testee" },
              { label: "frozen", value: "frozen" },
              { label: "hand_authored", value: "hand_authored" },
              { label: "benchmark (v1.x)", value: "benchmark" },
            ],
            onChange: (next) => {
              // Benchmark filter is disabled per §E.8 — ignore the click.
              if (next === "benchmark") return;
              writeParam("mode", next);
            },
          },
          {
            label: "Status",
            value: status,
            options: [
              { label: "All", value: "all" },
              { label: "Draft", value: "draft" },
              { label: "Published", value: "published" },
              { label: "Locked", value: "locked" },
            ],
            onChange: (next) => writeParam("status", next),
          },
        ]}
      />

      <TestsBody
        list={list}
        tests={filtered}
        pillById={pillById}
        onEdit={(t) => router.push(`/admin/tests/${t.id}/edit`)}
        onDelete={(t) => setModal({ kind: "delete", test: t })}
      />

      {modal.kind === "delete" ? (
        <DeleteTestModal test={modal.test} onClose={() => setModal({ kind: "closed" })} />
      ) : null}
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="border border-line bg-bg-sunk px-4 py-3"
      data-testid={`stat-${label.toLowerCase()}`}
    >
      <div className="eyebrow mb-1">{label}</div>
      <div className="font-serif text-[24px] tabular-nums text-ink">{value}</div>
    </div>
  );
}

type TestsBodyProps = {
  list: ReturnType<typeof useAdminTests>;
  tests: TestResponse[];
  pillById: Map<string, ReturnType<typeof flattenPills>[number]>;
  onEdit: (t: TestResponse) => void;
  onDelete: (t: TestResponse) => void;
};

function TestsBody({ list, tests, pillById, onEdit, onDelete }: TestsBodyProps) {
  if (list.isPending) {
    return (
      <div className="mt-5" data-testid="tests-loading">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-full mb-2" />
        ))}
      </div>
    );
  }

  if (tests.length === 0) {
    return (
      <div
        className="mt-5 border border-line bg-bg-raised p-10 text-center"
        data-testid="tests-empty"
      >
        <div className="font-serif text-[20px] text-ink mb-2">No tests yet.</div>
        <div className="text-[13px] text-ink-3">
          Author your first test to start binding to assignments.
        </div>
      </div>
    );
  }

  return (
    <table className="mt-5 w-full text-[13px]" data-testid="tests-table">
      <thead>
        <tr className="border-b border-line text-ink-3 text-left">
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2">
            Title
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[14%]">
            Mode
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[12%]">
            Status
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[18%]">
            Pill
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[14%]">
            Last edited
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[14%] text-right">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {tests.map((t) => {
          const displayStatus = deriveDisplayStatus(t);
          const meta = MODE_META[t.mode as Exclude<ModeFilter, "all">] ?? "";
          const pill = t.pill_id ? pillById.get(t.pill_id) : null;
          return (
            <tr
              key={t.id}
              className="border-b border-line"
              data-testid={`tests-row-${t.id}`}
            >
              <td className="py-2.5 px-2">
                <div className="font-medium text-ink">{t.name}</div>
                <div className="text-[11.5px] text-ink-3 mt-0.5">{meta}</div>
              </td>
              <td className="py-2.5 px-2">
                <ModePill mode={t.mode} />
              </td>
              <td className="py-2.5 px-2">
                <StatusPill status={displayStatus} testId={t.id} />
              </td>
              <td className="py-2.5 px-2 text-ink-2">{pill ? pill.name : "—"}</td>
              <td className="py-2.5 px-2 font-mono text-ink-3 text-[11.5px]">
                {formatRelative(t.updated_at)}
              </td>
              <td className="py-2.5 px-2 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(t)}
                  data-testid={`tests-edit-${t.id}`}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(t)}
                  data-testid={`tests-delete-${t.id}`}
                >
                  Delete
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ModePill({ mode }: { mode: string }) {
  const toneClass: Record<string, string> = {
    per_testee: "text-accent",
    frozen: "text-ink-3",
    hand_authored: "text-warn",
    benchmark: "text-info",
  };
  return (
    <span
      className={cn(
        "font-mono text-[10.5px] uppercase tracking-[0.08em]",
        toneClass[mode] ?? "text-ink-3",
      )}
      data-testid={`mode-pill-${mode}`}
    >
      {mode}
    </span>
  );
}

function StatusPill({ status, testId }: { status: DisplayStatus; testId: string }) {
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
      data-testid={`status-pill-${status}-${testId}`}
    >
      {status === "locked" ? <Icon name="lock" size={10} /> : null}
      {m.label}
    </span>
  );
}

function DeleteTestModal({ test, onClose }: { test: TestResponse; onClose: () => void }) {
  const mutation = useDeleteTest();
  const onConfirm = async () => {
    try {
      await mutation.mutateAsync(test.id);
      toast("Test deleted");
      onClose();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Couldn't delete test — try again";
      toast.error(msg);
    }
  };
  return (
    <Modal
      open
      onOpenChange={(o) => (o ? null : onClose())}
      ariaTitle="Delete test"
      ariaDescription="Confirm or cancel deletion of this test."
    >
      <ModalHeader
        eyebrow="Delete test"
        title={
          <>
            Delete <span className="serif-it">{test.name}</span>?
          </>
        }
      />
      <p className="text-[13px] text-ink-2">
        Bound assignments will lose their reference (attempt history is preserved). This
        action can&rsquo;t be undone.
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
          data-testid="tests-delete-confirm"
        >
          {mutation.isPending ? "Deleting…" : "Delete test"}
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
