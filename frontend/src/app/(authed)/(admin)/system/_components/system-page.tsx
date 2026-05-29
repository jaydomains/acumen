"use client";

/**
 * System-operations client surface (FE-9 admin-systems §B.3) at /system.
 * Five SystemOpCards in a responsive grid; each card's CTA reuses the
 * SweepButton primitive. Status stats come from two GETs (drive-index,
 * realism-status); bootstrap / drive-ingest / safety-link run results are
 * session-local (no status GET — mirrors the calibration lastRun pattern).
 *
 * Per-card status errors are isolated inline (the card shows a retry)
 * so one failing query doesn't blank the whole page (§B.3 §5/§7); the
 * route-level error.tsx is reserved for unexpected render throws.
 */

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { PageHeader } from "@/components/shell/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { SweepButton } from "@/components/admin/sweep-button";
import {
  useDriveIndex,
  useRealismStatus,
  useRunBootstrap,
  useRunDriveIngest,
  useRunRealismAggregate,
  useRunSafetyLinkCheck,
  type BootstrapRunResult,
  type DriveIngestResult,
  type SafetyLinkCheckResult,
} from "@/lib/queries/admin-system";

function relativeAge(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "—";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return mins <= 1 ? "just now" : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

const errMessage = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback;

export function SystemPage() {
  const driveIndex = useDriveIndex();
  const realismStatus = useRealismStatus();

  const bootstrap = useRunBootstrap();
  const driveIngest = useRunDriveIngest();
  const realismAggregate = useRunRealismAggregate();
  const safetyCheck = useRunSafetyLinkCheck();

  // Session-local run results for the cards without a status GET.
  const [lastBootstrap, setLastBootstrap] = useState<BootstrapRunResult | null>(null);
  const [lastIngest, setLastIngest] = useState<DriveIngestResult | null>(null);
  const [lastSafety, setLastSafety] = useState<{
    result: SafetyLinkCheckResult;
    at: number;
  } | null>(null);

  const di = driveIndex.data;
  const rs = realismStatus.data;

  return (
    <>
      <PageHeader
        eyebrow="/admin/system · consolidated operational controls"
        title="System operations."
        subtitle="Trigger the scheduled maintenance sweeps on demand. Each runs the same body as its cron and is safe to re-run (idempotent)."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 1 — Bootstrap (session-local stats) */}
        <SystemOpCard
          testId="system-card-bootstrap"
          eyebrow="AC-D2 · runs once per tenant · idempotent"
          title="Bootstrap"
          desc="Idempotent orchestrator — tops up anchors, self-review, safety links, and Drive ingest in one pass."
          stats={[
            ["Pills", lastBootstrap ? String(lastBootstrap.pills_processed) : "—"],
            ["Anchors", lastBootstrap ? String(lastBootstrap.anchors_generated) : "—"],
            [
              "Safety links",
              lastBootstrap ? String(lastBootstrap.safety_links_added) : "—",
            ],
            ["Drive files", lastBootstrap ? String(lastBootstrap.drive_files_seen) : "—"],
          ]}
          cta={{
            label: "Run bootstrap",
            runningLabel: "Running bootstrap…",
            testId: "system-bootstrap-run",
            onRun: async () => {
              try {
                const r = await bootstrap.mutateAsync();
                setLastBootstrap(r);
                toast.info(
                  `Bootstrap complete · ${r.pills_processed} pills · ${r.anchors_generated} anchors · ${r.safety_links_added} safety links`,
                );
              } catch (err) {
                toast.error(errMessage(err, "Couldn't run bootstrap"));
                throw err;
              }
            },
          }}
        />

        {/* 2 — Drive ingest (drive-index status + session run result) */}
        <SystemOpCard
          testId="system-card-drive-ingest"
          eyebrow="AC-D14 · every 6h · manual override"
          title="Drive ingest"
          desc="Pulls new and changed documents from the configured Drive folder and re-embeds them."
          isLoading={driveIndex.isPending}
          isError={driveIndex.isError}
          onRetry={() => driveIndex.refetch()}
          stats={[
            ["Last ingest", relativeAge(di?.last_indexed_at)],
            ["New docs", lastIngest ? String(lastIngest.files_added) : "—"],
            ["Updated", lastIngest ? String(lastIngest.files_changed) : "—"],
            ["Removed", lastIngest ? String(lastIngest.files_deleted) : "—"],
          ]}
          cta={{
            label: "Ingest now",
            runningLabel: "Ingesting…",
            testId: "system-drive-ingest-run",
            onRun: async () => {
              try {
                const r = await driveIngest.mutateAsync();
                setLastIngest(r);
                toast.info(
                  `Drive ingest complete · ${r.files_added} new · ${r.files_changed} updated · ${r.files_deleted} removed`,
                );
              } catch (err) {
                toast.error(errMessage(err, "Couldn't run Drive ingest"));
                throw err;
              }
            },
          }}
        />

        {/* 3 — Drive index status (read-only) */}
        <SystemOpCard
          testId="system-card-drive-index"
          eyebrow="derived · 24h cache"
          title="Drive index"
          desc="Current state of the indexed RAG corpus."
          isLoading={driveIndex.isPending}
          isError={driveIndex.isError}
          onRetry={() => driveIndex.refetch()}
          stats={[
            ["Indexed docs", di ? String(di.files) : "—"],
            ["Chunks", di ? String(di.chunks) : "—"],
            ["Last indexed", relativeAge(di?.last_indexed_at)],
            ["Status", di?.last_indexed_at ? "Indexed" : "Empty"],
          ]}
          cta={null}
        />

        {/* 4 — Realism aggregation (realism-status GET) */}
        <SystemOpCard
          testId="system-card-realism"
          eyebrow="AC-D24 · nightly"
          title="Realism aggregation"
          desc="Rolls up testee realism flags into the low-realism question pool."
          isLoading={realismStatus.isPending}
          isError={realismStatus.isError}
          onRetry={() => realismStatus.refetch()}
          stats={[
            ["Last run", relativeAge(rs?.last_aggregated_at)],
            ["Flags processed", rs ? String(rs.flags_processed_last_run) : "—"],
            ["Below threshold", rs ? String(rs.below_threshold_count) : "—"],
            ["Auto-suppressed", rs ? String(rs.auto_suppressed_count) : "—"],
          ]}
          cta={{
            label: "Aggregate now",
            runningLabel: "Aggregating…",
            testId: "system-realism-run",
            onRun: async () => {
              try {
                const r = await realismAggregate.mutateAsync();
                toast.info(
                  `Realism aggregation complete · ${r.flags_processed} processed · ${r.questions_updated} updated`,
                );
              } catch (err) {
                toast.error(errMessage(err, "Couldn't run realism aggregation"));
                throw err;
              }
            },
          }}
        />

        {/* 5 — Safety-link check (session-local stats) */}
        <SystemOpCard
          testId="system-card-safety-links"
          eyebrow="AC-D21 · monthly"
          title="Safety links"
          desc="Re-verifies the cached safety-pill links and flags drift or breakage."
          stats={[
            [
              "Last check",
              lastSafety ? relativeAge(new Date(lastSafety.at).toISOString()) : "—",
            ],
            ["Links checked", lastSafety ? String(lastSafety.result.links_checked) : "—"],
            [
              "Flagged drift",
              lastSafety ? String(lastSafety.result.links_drift_flagged) : "—",
            ],
            [
              "Broken",
              lastSafety ? String(lastSafety.result.links_broken_replaced) : "—",
            ],
          ]}
          cta={{
            label: "Run check",
            runningLabel: "Checking…",
            testId: "system-safety-links-run",
            onRun: async () => {
              try {
                const r = await safetyCheck.mutateAsync();
                setLastSafety({ result: r, at: Date.now() });
                toast.info(
                  `Safety links checked · ${r.links_checked} checked · ${r.links_drift_flagged} drift · ${r.links_broken_replaced} replaced`,
                );
              } catch (err) {
                toast.error(errMessage(err, "Couldn't run safety-link check"));
                throw err;
              }
            },
          }}
        />
      </div>
    </>
  );
}

type CardCta = {
  label: string;
  runningLabel: string;
  testId: string;
  onRun: () => Promise<void>;
};

function SystemOpCard({
  testId,
  eyebrow,
  title,
  desc,
  stats,
  isLoading,
  isError,
  onRetry,
  cta,
}: {
  testId: string;
  eyebrow: string;
  title: string;
  desc: string;
  stats: Array<[string, string]>;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  cta: CardCta | null;
}) {
  let body: ReactNode;
  if (isError) {
    body = (
      <div className="py-2 text-[12.5px] text-ink-3" data-testid={`${testId}-error`}>
        Couldn&rsquo;t load.{" "}
        <button type="button" className="underline" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  } else if (isLoading) {
    body = (
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  } else {
    body = (
      <dl className="grid grid-cols-2 gap-3">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-3">
              {label}
            </dt>
            <dd className="mt-0.5 text-[15px] text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <div
      className="flex flex-col border border-line bg-bg-raised p-5"
      data-testid={testId}
    >
      <div className="eyebrow mb-1">{eyebrow}</div>
      <h3 className="font-serif text-[18px] text-ink">{title}</h3>
      <p className="mt-1 mb-4 text-[12.5px] text-ink-3">{desc}</p>
      <div className="flex-1">{body}</div>
      {cta ? (
        <div className="mt-4">
          <SweepButton
            label={cta.label}
            runningLabel={cta.runningLabel}
            onRun={cta.onRun}
            testId={cta.testId}
          />
        </div>
      ) : null}
    </div>
  );
}
