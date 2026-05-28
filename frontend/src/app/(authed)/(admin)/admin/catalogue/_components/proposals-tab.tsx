"use client";

/**
 * ProposalsTab — AI-proposed pills queue per FE-8 §B.4
 * (`fe-specs/FE-8-admin-catalogue.md:537–679`).
 *
 * URL state: `?status={pending|approved|rejected|failed|all}` (default
 * `pending`). `GET /v1/pill-proposals` only takes `cursor + limit` —
 * absorbed under §E.7 (Slice 3 precedent), filter happens client-side
 * over derived status (`parse-proposal-payload.ts:deriveProposalStatus`).
 *
 * Wire status enum (`pending|running|done|failed`) and decision (stored
 * on `payload.decision`) get mapped to a 4-value derived enum per
 * drift Finding #2 — derivation lives in
 * `frontend/src/lib/proposals/parse-proposal-payload.ts`.
 *
 * Reject uses single-click row action (no reason capture) per §B.4 §1
 * + §F.2 "no edit-then-approve, reject is final, no undo" + drift
 * Finding #4 (reason query param ignored in v1).
 *
 * Sentinel-driven pagination follows FE-3 §C.5 with destructured
 * props per the IntersectionObserver-dep-array discipline absorbed
 * in Slice 2.
 *
 * Approve creates a pill; mutation invalidates BOTH `proposals.all()`
 * AND `pills.all()` per §C.1 cross-resource invalidation lock.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetBody, SheetFooter, SheetHeader } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  flattenProposals,
  useAdminPillProposals,
  useApproveProposal,
  useRejectProposal,
  type PillProposalResponse,
} from "@/lib/queries/admin-proposals";
import {
  deriveProposalStatus,
  parseProposalPayload,
  type ProposalDerivedStatus,
} from "@/lib/proposals/parse-proposal-payload";

type StatusFilter = ProposalDerivedStatus | "all";
const STATUS_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Failed", value: "failed" },
  { label: "All", value: "all" },
];

function isStatusFilter(v: string | null): v is StatusFilter {
  return (
    v === "pending" ||
    v === "approved" ||
    v === "rejected" ||
    v === "failed" ||
    v === "all"
  );
}

export function ProposalsTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams?.get("status") ?? null;
  const status: StatusFilter = isStatusFilter(raw) ? raw : "pending";

  // Silent recovery + default hydration: if `?status=` is missing or
  // invalid, replace with `?status=pending` per §B.4 §6 first scenario.
  useEffect(() => {
    if (raw === null || !isStatusFilter(raw)) {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (!params.get("tab")) params.set("tab", "proposals");
      params.set("status", "pending");
      router.replace(`/admin/catalogue?${params.toString()}`);
    }
  }, [raw, router, searchParams]);

  const [drawerProposal, setDrawerProposal] = useState<PillProposalResponse | null>(null);

  const list = useAdminPillProposals();
  const allProposals = useMemo(() => flattenProposals(list.data), [list.data]);
  const filtered = useMemo(() => {
    if (status === "all") return allProposals;
    return allProposals.filter((p) => deriveProposalStatus(p) === status);
  }, [allProposals, status]);

  const writeStatus = (next: StatusFilter) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (!params.get("tab")) params.set("tab", "proposals");
    params.set("status", next);
    router.replace(`/admin/catalogue?${params.toString()}`);
  };

  return (
    <div data-testid="proposals-tab">
      <div
        role="tablist"
        aria-label="Proposal status filter"
        className="flex items-center gap-1"
        data-testid="proposals-status-filter"
      >
        {STATUS_OPTIONS.map((opt) => {
          const active = opt.value === status;
          return (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`proposals-status-${opt.value}`}
              onClick={() => writeStatus(opt.value)}
              className={cn(
                "px-3 py-1.5 text-[12px] font-medium border border-line",
                active
                  ? "bg-ink text-bg-raised border-ink"
                  : "bg-bg-raised text-ink-2 hover:bg-bg-deep",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <ProposalsBody
        list={list}
        proposals={filtered}
        status={status}
        onOpenDrawer={setDrawerProposal}
      />

      {drawerProposal ? (
        <ProposalDrawer
          proposal={drawerProposal}
          onClose={() => setDrawerProposal(null)}
        />
      ) : null}
    </div>
  );
}

type ProposalsBodyProps = {
  list: ReturnType<typeof useAdminPillProposals>;
  proposals: PillProposalResponse[];
  status: StatusFilter;
  onOpenDrawer: (p: PillProposalResponse) => void;
};

function ProposalsBody({ list, proposals, status, onOpenDrawer }: ProposalsBodyProps) {
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
      <div className="mt-5" data-testid="proposals-loading">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full mb-2" />
        ))}
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <div
        className="mt-5 border border-line bg-bg-raised p-10 text-center"
        data-testid="proposals-empty"
      >
        <div className="font-serif text-[20px] text-ink mb-2">
          {status === "pending"
            ? "No proposals waiting for review."
            : "No proposals match this filter."}
        </div>
        <div className="text-[13px] text-ink-3">
          {status === "pending"
            ? "AI-proposed pills will appear here as the catalogue evolves."
            : "Try a different status filter."}
        </div>
      </div>
    );
  }

  return (
    <table className="mt-5 w-full text-[13px]" data-testid="proposals-table">
      <thead>
        <tr className="border-b border-line text-ink-3 text-left">
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[14%]">
            Created
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2">
            Proposal
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[12%]">
            Status
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[18%] text-right">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {proposals.map((proposal) => (
          <ProposalRow
            key={proposal.id}
            proposal={proposal}
            onOpenDrawer={() => onOpenDrawer(proposal)}
          />
        ))}
        {list.hasNextPage ? (
          <tr ref={sentinelRef} data-testid="proposals-sentinel" aria-hidden="true">
            <td colSpan={4} className="py-3 text-center text-ink-3 text-[12px]">
              {list.isFetchingNextPage ? "Loading more…" : ""}
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

function ProposalRow({
  proposal,
  onOpenDrawer,
}: {
  proposal: PillProposalResponse;
  onOpenDrawer: () => void;
}) {
  const derived = deriveProposalStatus(proposal);
  const parsed = useMemo(
    () => parseProposalPayload(proposal.payload),
    [proposal.payload],
  );
  const preview = useMemo(() => {
    if (parsed.kind === "raw") return "(non-structured payload)";
    const nameRow = parsed.rows.find((r) => r.key === "name");
    return nameRow?.value ?? "(unnamed proposal)";
  }, [parsed]);
  return (
    <tr
      className="border-b border-line hover:bg-bg-sunk cursor-pointer"
      data-testid={`proposals-row-${proposal.id}`}
      onClick={onOpenDrawer}
    >
      <td className="py-2.5 px-2 font-mono text-ink-3 text-[11.5px]">
        {formatRelative(proposal.created_at)}
      </td>
      <td className="py-2.5 px-2 text-ink">
        <span className="font-medium">{preview}</span>
        <span className="text-ink-3 ml-2 text-[11.5px]">Proposed by AI</span>
      </td>
      <td className="py-2.5 px-2">
        <StatusBadge status={derived} />
      </td>
      <td
        className="py-2.5 px-2 text-right"
        onClick={(e) => {
          // Don't bubble row-click open-drawer when admin actually
          // clicked Approve/Reject inside this cell.
          e.stopPropagation();
        }}
      >
        {derived === "pending" ? <RowActions proposalId={proposal.id} /> : null}
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: ProposalDerivedStatus }) {
  const map: Record<ProposalDerivedStatus, string> = {
    pending: "text-warn",
    approved: "text-success",
    rejected: "text-ink-3",
    failed: "text-danger",
  };
  return (
    <span
      className={cn("font-mono text-[10.5px] uppercase tracking-[0.08em]", map[status])}
      data-testid={`proposals-status-badge-${status}`}
    >
      {status}
    </span>
  );
}

function RowActions({ proposalId }: { proposalId: string }) {
  const approve = useApproveProposal();
  const reject = useRejectProposal();
  const pending = approve.isPending || reject.isPending;

  const onApprove = async () => {
    try {
      await approve.mutateAsync(proposalId);
      toast("Proposal approved — pill created in catalogue");
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Couldn't approve proposal — try again";
      toast.error(msg);
    }
  };

  const onReject = async () => {
    try {
      await reject.mutateAsync(proposalId);
      toast("Proposal rejected");
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Couldn't reject proposal — try again";
      toast.error(msg);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={onApprove}
        disabled={pending}
        data-testid={`proposals-approve-${proposalId}`}
      >
        {approve.isPending ? "Approving…" : "Approve"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onReject}
        disabled={pending}
        data-testid={`proposals-reject-${proposalId}`}
      >
        {reject.isPending ? "Rejecting…" : "Reject"}
      </Button>
    </>
  );
}

function ProposalDrawer({
  proposal,
  onClose,
}: {
  proposal: PillProposalResponse;
  onClose: () => void;
}) {
  const derived = deriveProposalStatus(proposal);
  const parsed = useMemo(
    () => parseProposalPayload(proposal.payload),
    [proposal.payload],
  );
  const approve = useApproveProposal();
  const reject = useRejectProposal();
  const pending = approve.isPending || reject.isPending;
  const titlePreview =
    parsed.kind === "structured"
      ? (parsed.rows.find((r) => r.key === "name")?.value ?? "Untitled proposal")
      : "Untitled proposal";

  const onApprove = async () => {
    try {
      await approve.mutateAsync(proposal.id);
      toast("Proposal approved — pill created in catalogue");
      onClose();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Couldn't approve proposal — try again";
      toast.error(msg);
    }
  };

  const onReject = async () => {
    try {
      await reject.mutateAsync(proposal.id);
      toast("Proposal rejected");
      onClose();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Couldn't reject proposal — try again";
      toast.error(msg);
    }
  };

  return (
    <Sheet
      open
      onOpenChange={(o) => (o ? null : onClose())}
      ariaTitle={titlePreview}
      ariaDescription="Inspect the proposal payload, then approve or reject."
      width={520}
    >
      <SheetHeader>{titlePreview}</SheetHeader>
      <SheetBody>
        <div className="mb-4 flex items-center gap-3">
          <StatusBadge status={derived} />
          <span className="font-mono text-[11.5px] text-ink-3">
            {formatRelative(proposal.created_at)} · Proposed by AI
          </span>
        </div>

        {parsed.kind === "structured" ? (
          <dl
            className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 text-[13px]"
            data-testid="proposal-drawer-rows"
          >
            {parsed.rows.map((row) => (
              <div key={row.key} className="contents">
                <dt className="font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-3 self-start pt-0.5">
                  {row.label}
                </dt>
                <dd className="text-ink-2 whitespace-pre-wrap break-words">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <pre
            className="bg-bg-sunk border border-line p-3 font-mono text-[11.5px] text-ink-2 whitespace-pre-wrap break-all"
            data-testid="proposal-drawer-raw"
          >
            {parsed.json}
          </pre>
        )}
      </SheetBody>
      <SheetFooter>
        <Button variant="outline" onClick={onClose} disabled={pending}>
          Close
        </Button>
        {derived === "pending" ? (
          <>
            <Button
              variant="outline"
              onClick={onReject}
              disabled={pending}
              data-testid="proposal-drawer-reject"
            >
              {reject.isPending ? "Rejecting…" : "Reject"}
            </Button>
            <Button
              onClick={onApprove}
              disabled={pending}
              data-testid="proposal-drawer-approve"
            >
              {approve.isPending ? "Approving…" : "Approve"}
            </Button>
          </>
        ) : null}
      </SheetFooter>
    </Sheet>
  );
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const delta = Date.now() - t;
  // Future dates (clock skew or server timezone mismatch) would
  // render as "-5s ago" without a guard — fall back to absolute date.
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
