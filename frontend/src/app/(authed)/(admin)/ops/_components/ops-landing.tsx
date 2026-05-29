"use client";

/**
 * Ops landing client surface (FE-9 admin-ops §B.1) at /ops — the FE-9
 * close-out. Composes five read-only summary cards over the queues built
 * in the prior slices, all via shared cache keys, plus a defensive hero
 * subtitle. Each card fires its own query and renders its own
 * loading/error/empty state independently (card-level error isolation —
 * the route boundary catches render throws only, §B.1 §7).
 */

import Link from "next/link";
import { Pill } from "@/components/primitives/Pill";
import { Stat } from "@/components/primitives/Stat";
import { Icon } from "@/components/primitives/Icon";
import { PageHeader } from "@/components/shell/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useFlaggedGradeReviews,
  type FlaggedGradeReviewItem,
} from "@/lib/queries/admin-grade-reviews";
import {
  useEngagementPending,
  type EngagementWidgetItem,
} from "@/lib/queries/admin-engagement";
import { useCostSummary } from "@/lib/queries/admin-cost";
import { useDriveIndex } from "@/lib/queries/admin-system";
import { flattenProposals, useAdminPillProposals } from "@/lib/queries/admin-proposals";

function relativeAge(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "—";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return mins <= 1 ? "now" : `${mins}m`;
  const hours = Math.floor(mins / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

export function OpsLanding() {
  const flagged = useFlaggedGradeReviews("flagged");
  const engagement = useEngagementPending();
  const cost = useCostSummary();
  const drive = useDriveIndex();
  const proposals = useAdminPillProposals();

  const flaggedRows = flagged.data?.data ?? [];
  const escalatedRows = (engagement.data?.data ?? []).filter((r) => r.escalated);
  const proposalRows = flattenProposals(proposals.data);

  return (
    <>
      <PageHeader
        eyebrow="OPERATIONS"
        title="Acumen, at a glance."
        subtitle={
          <HeroSubtitle
            flaggedReady={flagged.isSuccess}
            flaggedCount={flaggedRows.length}
            engagementReady={engagement.isSuccess}
            escalatedCount={escalatedRows.length}
            costReady={cost.isSuccess}
            overBudget={
              cost.data?.percent_of_budget != null && cost.data.percent_of_budget >= 100
            }
          />
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FlaggedReviewCard query={flagged} rows={flaggedRows} />
        <EngagementPreviewCard query={engagement} rows={escalatedRows} />
        <CostSummaryCard query={cost} />
        <BootstrapStatusCard query={drive} />
        <PillProposalsTeaserCard query={proposals} count={proposalRows.length} />
      </div>
    </>
  );
}

function HeroSubtitle({
  flaggedReady,
  flaggedCount,
  engagementReady,
  escalatedCount,
  costReady,
  overBudget,
}: {
  flaggedReady: boolean;
  flaggedCount: number;
  engagementReady: boolean;
  escalatedCount: number;
  costReady: boolean;
  overBudget: boolean;
}) {
  const clauses: string[] = [];
  if (flaggedReady && flaggedCount > 0) {
    clauses.push(
      `${flaggedCount} grade review${flaggedCount === 1 ? "" : "s"} need your attention.`,
    );
  }
  if (engagementReady && escalatedCount > 0) {
    clauses.push(
      `${escalatedCount} mandatory assignment${escalatedCount === 1 ? "" : "s"} escalated past the 2nd reminder.`,
    );
  }
  if (costReady) {
    clauses.push(
      overBudget ? "AI spend is over budget." : "AI spend is on pace within budget.",
    );
  }
  if (clauses.length === 0) return <span>You&rsquo;re all caught up.</span>;
  return <span>{clauses.join(" ")}</span>;
}

/** Shared card shell with header, count, and a footer CTA link. */
function Card({
  eyebrow,
  title,
  count,
  children,
  cta,
  testId,
}: {
  eyebrow: string;
  title: string;
  count?: number | undefined;
  children: React.ReactNode;
  cta?: { label: string; href: string } | null;
  testId: string;
}) {
  return (
    <div
      className="flex flex-col border border-line bg-bg-raised p-5"
      data-testid={testId}
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="eyebrow mb-1">{eyebrow}</div>
          <h3 className="font-serif text-[17px] text-ink">{title}</h3>
        </div>
        {count !== undefined ? (
          <span className="font-mono text-[18px] text-ink">{count}</span>
        ) : null}
      </div>
      <div className="flex-1">{children}</div>
      {cta ? (
        <Link
          href={cta.href}
          className="mt-4 text-[12.5px] text-accent hover:underline"
          data-testid={`${testId}-cta`}
        >
          {cta.label} →
        </Link>
      ) : null}
    </div>
  );
}

function CardError({ onRetry, testId }: { onRetry: () => void; testId: string }) {
  return (
    <div className="py-2 text-[12.5px] text-ink-3" data-testid={`${testId}-error`}>
      Couldn&rsquo;t load.{" "}
      <button type="button" className="underline" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-6 w-full" />
      ))}
    </div>
  );
}

function FlaggedReviewCard({
  query,
  rows,
}: {
  query: ReturnType<typeof useFlaggedGradeReviews>;
  rows: FlaggedGradeReviewItem[];
}) {
  return (
    <Card
      testId="ops-flagged-card"
      eyebrow="Cross-family grade review · flagged"
      title="Adjudicate AI grades"
      count={query.isSuccess ? rows.length : undefined}
      cta={
        query.isSuccess && rows.length > 0
          ? { label: "View all flagged", href: "/review?verdict=flagged" }
          : null
      }
    >
      {query.isError ? (
        <CardError onRetry={() => query.refetch()} testId="ops-flagged-card" />
      ) : query.isPending ? (
        <CardSkeleton />
      ) : rows.length === 0 ? (
        <div className="flex items-center gap-2 py-2 text-[13px] text-ink-3">
          <Icon name="check" size={16} /> No flagged grades waiting
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.slice(0, 3).map((r) => (
            <li key={r.grade_review_id}>
              <Link
                href={`/review?selected=${r.grade_review_id}`}
                className="flex items-center justify-between gap-2 text-[12.5px] hover:bg-bg-deep"
                data-testid={`ops-flagged-row-${r.grade_review_id}`}
              >
                <span className="min-w-0 truncate text-ink-2">
                  {r.testee_name} · {r.pill_name}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="font-mono text-ink-3">
                    {relativeAge(r.created_at)}
                  </span>
                  <Pill mono tone="warn">
                    {r.ai_verdict}
                  </Pill>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function EngagementPreviewCard({
  query,
  rows,
}: {
  query: ReturnType<typeof useEngagementPending>;
  rows: EngagementWidgetItem[];
}) {
  return (
    <Card
      testId="ops-engagement-card"
      eyebrow="Pending mandatory assignments"
      title="Who's not engaging"
      count={query.isSuccess ? rows.length : undefined}
      cta={query.isSuccess ? { label: "View all", href: "/engagement" } : null}
    >
      {query.isError ? (
        <CardError onRetry={() => query.refetch()} testId="ops-engagement-card" />
      ) : query.isPending ? (
        <CardSkeleton />
      ) : rows.length === 0 ? (
        <div className="flex items-center gap-2 py-2 text-[13px] text-ink-3">
          <Icon name="check" size={16} /> All caught up — no escalations
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.slice(0, 4).map((r) => (
            <li
              key={r.assignment_id}
              className="flex items-center justify-between gap-2 text-[12.5px]"
            >
              <span className="min-w-0 truncate text-ink-2">
                {r.testee_name} · {r.pill_or_test_name}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="font-mono text-ink-3">{r.days_stale}d</span>
                <Pill mono tone="warn">
                  Escalated
                </Pill>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function CostSummaryCard({ query }: { query: ReturnType<typeof useCostSummary> }) {
  const data = query.data;
  const alerts = data
    ? [...new Set(data.alerts_fired_this_month)].sort((a, b) => a - b)
    : [];
  return (
    <Card
      testId="ops-cost-card"
      eyebrow="AI spend · this month"
      title="Cost summary"
      cta={query.isSuccess ? { label: "View cost dashboard", href: "/cost" } : null}
    >
      {query.isError ? (
        <CardError onRetry={() => query.refetch()} testId="ops-cost-card" />
      ) : query.isPending ? (
        <CardSkeleton />
      ) : data ? (
        <div>
          <div className="flex gap-6">
            <Stat value={`$${data.total_usd.toFixed(2)}`} label="Spent" />
            <Stat
              value={
                data.monthly_budget != null && data.percent_of_budget != null
                  ? `${Math.round(data.percent_of_budget)}%`
                  : "—"
              }
              label="Of budget"
            />
          </div>
          {alerts.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5" data-testid="ops-cost-alerts">
              {alerts.map((t) => (
                <Pill key={t} mono tone={t >= 100 ? "danger" : "warn"}>
                  {t}% alert
                </Pill>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function BootstrapStatusCard({ query }: { query: ReturnType<typeof useDriveIndex> }) {
  const data = query.data;
  return (
    <Card
      testId="ops-bootstrap-card"
      eyebrow="Bootstrap status · Drive index"
      title="Corpus health"
      cta={{ label: "Open system page", href: "/system" }}
    >
      {query.isError ? (
        <CardError onRetry={() => query.refetch()} testId="ops-bootstrap-card" />
      ) : query.isPending ? (
        <CardSkeleton />
      ) : data ? (
        <div className="flex gap-6">
          <Stat value={String(data.files)} label="Indexed docs" />
          <Stat value={String(data.chunks)} label="Chunks" />
          <Stat value={relativeAge(data.last_indexed_at)} label="Last indexed" />
        </div>
      ) : null}
    </Card>
  );
}

function PillProposalsTeaserCard({
  query,
  count,
}: {
  query: ReturnType<typeof useAdminPillProposals>;
  count: number;
}) {
  return (
    <Card
      testId="ops-proposals-card"
      eyebrow="Pill proposals"
      title="Awaiting review"
      count={query.isSuccess ? count : undefined}
      cta={
        query.isSuccess
          ? { label: "Review proposals", href: "/admin/catalogue?tab=proposals" }
          : null
      }
    >
      {query.isError ? (
        <CardError onRetry={() => query.refetch()} testId="ops-proposals-card" />
      ) : query.isPending ? (
        <CardSkeleton />
      ) : count === 0 ? (
        <div className="flex items-center gap-2 py-2 text-[13px] text-ink-3">
          <Icon name="check" size={16} /> No proposals waiting
        </div>
      ) : (
        <div className="py-2 text-[13px] text-ink-2">
          {count} pending pill proposal{count === 1 ? "" : "s"} ready for review.
        </div>
      )}
    </Card>
  );
}
