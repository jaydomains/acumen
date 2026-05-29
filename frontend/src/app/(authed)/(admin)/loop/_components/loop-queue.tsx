"use client";

/**
 * Loop-queue client surface (FE-9 admin-ops §B.3) at /loop. Segmented
 * `?status=` filter (server-side, default `review`) + LoopTable +
 * Approve/Reject modals.
 *
 * The queue endpoint returns admin-reviewed rows only (autonomous loops
 * self-progress and never enter the queue), so the Mode column reads
 * "Admin · review" in practice; Approve/Reject render only for
 * status=review + loop_mode=admin_reviewed rows.
 *
 * Route note: ships at top-level `/loop` (singular) per the shipped nav
 * rail (`Rail.tsx:67`), not `/admin/loops` as the spec prose writes.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/errors";
import { applyApiErrorToForm } from "@/lib/api/form-errors";
import { adminKeys } from "@/lib/queries/admin-keys";
import { PageHeader } from "@/components/shell/PageHeader";
import { BoundaryFrame } from "@/components/shell/BoundaryFrame";
import { Icon } from "@/components/primitives/Icon";
import { Pill, type PillTone } from "@/components/primitives/Pill";
import { Modal, ModalActions, ModalHeader } from "@/components/admin/modal";
import { Field, FieldError } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useApproveLoop,
  useLoopQueue,
  useRejectLoop,
  type LoopQueueItem,
  type LoopStatus,
  type LoopStatusFilter,
} from "@/lib/queries/admin-loops";

const STATUSES: LoopStatusFilter[] = [
  "review",
  "queued",
  "step-down",
  "material-served",
  "closed",
  "all",
];
const STATUS_LABEL: Record<LoopStatusFilter, string> = {
  review: "Review",
  queued: "Queued",
  "step-down": "Step-down",
  "material-served": "Material served",
  closed: "Closed",
  all: "All",
};
const STATUS_TONE: Record<LoopStatus, PillTone> = {
  review: "warn",
  queued: "info",
  "step-down": "default",
  "material-served": "accent",
  closed: "ok",
};

function isStatusFilter(v: string | null): v is LoopStatusFilter {
  return v !== null && (STATUSES as string[]).includes(v);
}

/** Short relative-age string ("3d ago" / "5h ago" / "—"). */
function relativeAge(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "—";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return mins <= 1 ? "just now" : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

type ModalState =
  | { kind: "closed" }
  | { kind: "approve"; row: LoopQueueItem }
  | { kind: "reject"; row: LoopQueueItem };

export function LoopQueue() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusParam = searchParams?.get("status") ?? null;
  const status: LoopStatusFilter = isStatusFilter(statusParam) ? statusParam : "review";

  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  const query = useLoopQueue(status);
  const rows = query.data?.data ?? [];

  const writeStatus = useCallback(
    (next: string | null) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (next === null || next === "") params.delete("status");
      else params.set("status", next);
      const qs = params.toString();
      router.replace(qs ? `/loop?${qs}` : "/loop");
    },
    [router, searchParams],
  );

  // Normalise a missing/invalid status param to the default `review`.
  useEffect(() => {
    if (!isStatusFilter(statusParam)) writeStatus("review");
  }, [statusParam, writeStatus]);

  return (
    <>
      <PageHeader
        eyebrow="AC-D6 · adaptive learning loops · 2 modes per test"
        title="Active loops."
        subtitle="Weakness reports routed to you for review. Approve to spin up follow-up attempts, or reject with a reason for the audit trail."
      />

      <div className="mb-4 inline-flex flex-wrap border border-line" role="tablist">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={s === status}
            onClick={() => writeStatus(s === "all" ? null : s)}
            data-testid={`loop-status-${s}`}
            className={
              s === status
                ? "bg-ink px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-bg-raised"
                : "px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-3 hover:bg-bg-deep"
            }
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {query.isError ? (
        <BoundaryFrame
          glyph={<Icon name="wave" size={24} />}
          eyebrow="LOOPS"
          title="We couldn't load the loop queue."
          body="The loop-queue request failed. Try again, and if it keeps failing, let your administrator know."
          actions={
            <Button onClick={() => query.refetch()} variant="outline" size="sm">
              Try again
            </Button>
          }
        />
      ) : (
        <LoopTable
          rows={rows}
          isPending={query.isPending}
          status={status}
          onApprove={(row) => setModal({ kind: "approve", row })}
          onReject={(row) => setModal({ kind: "reject", row })}
        />
      )}

      {modal.kind === "approve" ? (
        <ApproveModal row={modal.row} onClose={() => setModal({ kind: "closed" })} />
      ) : null}
      {modal.kind === "reject" ? (
        <RejectModal row={modal.row} onClose={() => setModal({ kind: "closed" })} />
      ) : null}
    </>
  );
}

function LoopTable({
  rows,
  isPending,
  status,
  onApprove,
  onReject,
}: {
  rows: LoopQueueItem[];
  isPending: boolean;
  status: LoopStatusFilter;
  onApprove: (row: LoopQueueItem) => void;
  onReject: (row: LoopQueueItem) => void;
}) {
  if (isPending) {
    return (
      <div className="mt-1" data-testid="loop-loading">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="mb-2 h-9 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div
        className="border border-line bg-bg-raised p-10 text-center"
        data-testid="loop-empty"
      >
        <div className="font-serif text-[18px] text-ink mb-1">
          {status === "review" ? "No loops waiting for your review" : "Nothing here"}
        </div>
        <div className="text-[13px] text-ink-3">
          {status === "review"
            ? "Autonomous loops are self-progressing — nothing needs your sign-off."
            : `No ${status === "all" ? "" : STATUS_LABEL[status].toLowerCase() + " "}loops on the current window.`}
        </div>
      </div>
    );
  }

  return (
    <table className="w-full text-[13px]" data-testid="loop-table">
      <thead>
        <tr className="border-b border-line text-left text-ink-3">
          {["Testee", "Pill", "Mode", "Iteration", "Last attempt", "Status", ""].map(
            (h, i) => (
              <th
                key={h || `actions-${i}`}
                className="px-2 py-2 font-mono text-[10.5px] uppercase tracking-[0.12em]"
              >
                {h}
              </th>
            ),
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const actionable =
            row.status === "review" && row.loop_mode === "admin_reviewed";
          return (
            <tr
              key={row.weakness_report_id}
              className="border-b border-line"
              data-testid={`loop-row-${row.weakness_report_id}`}
            >
              <td className="px-2 py-2.5 font-medium text-ink">{row.testee_name}</td>
              <td className="px-2 py-2.5 text-ink-2">{row.pill_name}</td>
              <td className="px-2 py-2.5">
                <Pill
                  mono
                  tone={row.loop_mode === "admin_reviewed" ? "accent" : "default"}
                >
                  {row.loop_mode === "admin_reviewed" ? "Admin · review" : "Autonomous"}
                </Pill>
              </td>
              <td className="px-2 py-2.5 font-mono text-ink-2">{row.iteration}</td>
              <td className="px-2 py-2.5 text-ink-3">
                {relativeAge(row.last_attempt_at)}
              </td>
              <td className="px-2 py-2.5">
                <Pill mono tone={STATUS_TONE[row.status]}>
                  {row.status}
                </Pill>
              </td>
              <td className="px-2 py-2.5 text-right">
                {actionable ? (
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      onClick={() => onApprove(row)}
                      data-testid={`loop-approve-${row.weakness_report_id}`}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onReject(row)}
                      data-testid={`loop-reject-${row.weakness_report_id}`}
                    >
                      Reject
                    </Button>
                  </div>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Shared 409 / generic handler — surfaces, refreshes the queue, closes. */
function useResolvedConflict(onClose: () => void) {
  const queryClient = useQueryClient();
  return (err: unknown): boolean => {
    if (
      err instanceof ApiError &&
      (err.status === 409 || err.code === "LOOP_ALREADY_RESOLVED")
    ) {
      toast.error(err.message || "This loop was already resolved — refreshing list");
      queryClient.invalidateQueries({ queryKey: adminKeys.loops.all() });
      onClose();
      return true;
    }
    return false;
  };
}

function ApproveModal({ row, onClose }: { row: LoopQueueItem; onClose: () => void }) {
  const mutation = useApproveLoop();
  const handleConflict = useResolvedConflict(onClose);

  const onConfirm = async () => {
    try {
      const result = await mutation.mutateAsync(row.weakness_report_id);
      toast.info(
        `Follow-up approved · ${result.follow_up_count} attempt${
          result.follow_up_count !== 1 ? "s" : ""
        } created`,
      );
      onClose();
    } catch (err) {
      if (handleConflict(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Couldn't approve follow-up");
    }
  };

  return (
    <Modal
      open
      onOpenChange={(o) => (o ? null : onClose())}
      ariaTitle="Approve follow-up"
      ariaDescription={`Approve the follow-up loop for ${row.testee_name}.`}
    >
      <ModalHeader
        eyebrow="Approve follow-up"
        title={
          <>
            Approve the <span className="serif-it">{row.pill_name}</span> follow-up for{" "}
            {row.testee_name}?
          </>
        }
      />
      <p className="text-[13px] text-ink-2">
        This creates a follow-up attempt for each weak pill in the report
        {row.weak_pill_ids.length > 0 ? ` (${row.weak_pill_ids.length})` : ""}.
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
          onClick={onConfirm}
          disabled={mutation.isPending}
          data-testid="loop-approve-confirm"
        >
          {mutation.isPending ? "Approving…" : "Approve"}
        </Button>
      </ModalActions>
    </Modal>
  );
}

const rejectSchema = z.object({
  reason: z.string().min(1, "Reason is required for audit.").max(1000),
});
type RejectInput = z.infer<typeof rejectSchema>;

function RejectModal({ row, onClose }: { row: LoopQueueItem; onClose: () => void }) {
  const mutation = useRejectLoop();
  const handleConflict = useResolvedConflict(onClose);
  const form = useForm<RejectInput>({
    resolver: zodResolver(rejectSchema),
    mode: "onSubmit",
    defaultValues: { reason: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({
        reportId: row.weakness_report_id,
        reason: values.reason,
      });
      toast.info("Follow-up rejected");
      onClose();
    } catch (err) {
      if (handleConflict(err)) return;
      applyApiErrorToForm(err, form);
    }
  });

  return (
    <Modal
      open
      onOpenChange={(o) => (o ? null : onClose())}
      ariaTitle="Reject follow-up"
      ariaDescription={`Reject the follow-up loop for ${row.testee_name}.`}
    >
      <ModalHeader
        eyebrow="Reject follow-up"
        title={
          <>
            Reject the <span className="serif-it">{row.pill_name}</span> follow-up for{" "}
            {row.testee_name}?
          </>
        }
      />
      <form onSubmit={onSubmit} noValidate data-testid="loop-reject-form">
        <Field
          label="Reason — recorded in the audit log"
          error={form.formState.errors.reason?.message ?? null}
        >
          <textarea
            {...form.register("reason")}
            rows={3}
            autoFocus
            disabled={mutation.isPending}
            data-testid="loop-reject-reason"
            className="w-full border border-line bg-bg-raised px-3 py-2 text-[13px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </Field>
        {form.formState.errors.root?.message ? (
          <FieldError msg={form.formState.errors.root.message} />
        ) : null}
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
            type="submit"
            variant="destructive"
            disabled={mutation.isPending}
            data-testid="loop-reject-confirm"
          >
            {mutation.isPending ? "Rejecting…" : "Reject"}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
