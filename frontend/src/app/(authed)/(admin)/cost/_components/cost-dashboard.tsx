"use client";

/**
 * Cost dashboard client surface (FE-9 admin-systems §B.1) at /cost.
 * Read-only: a summary strip, budget-alert pills, a provider split bar,
 * a per-model breakdown table, and a deferred daily-history placeholder.
 *
 * v1 deferrals (§E.1 / §B.1 §7): the range selector renders 7d / month /
 * YTD but only "this month" is selectable; daily history is a placeholder
 * card pending the backend `daily_history` field.
 */

import { Pill, type PillTone } from "@/components/primitives/Pill";
import { Stat } from "@/components/primitives/Stat";
import { Icon } from "@/components/primitives/Icon";
import { PageHeader } from "@/components/shell/PageHeader";
import { BoundaryFrame } from "@/components/shell/BoundaryFrame";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCostSummary, type CostSummaryResponse } from "@/lib/queries/admin-cost";

const usd = (n: number) => `$${n.toFixed(2)}`;

/** Map a raw model ID to a display provider (§B.1 §7 — TODO AC-CD18). */
function providerForModel(modelId: string): string {
  if (modelId.startsWith("claude-")) return "Anthropic";
  if (modelId.startsWith("gpt-") || modelId.startsWith("text-embedding-"))
    return "OpenAI";
  return "Other";
}

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  stub: "Stub",
  "(unknown)": "Unknown",
};

export function CostDashboard() {
  const query = useCostSummary();

  return (
    <>
      <PageHeader
        eyebrow="AC-D18 · cost visibility · alerts at 50/80/100% · no hard enforcement in v1"
        title="AI spend."
        subtitle="Rolling current-month spend across providers. Budget alerts are advisory — nothing is hard-capped in v1."
        actions={<RangeSelector />}
      />

      {query.isError ? (
        <BoundaryFrame
          glyph={<Icon name="wave" size={24} />}
          eyebrow="AI COST"
          title="We couldn't load the cost dashboard."
          body="The cost-summary request failed. Try again, and if it keeps failing, let your administrator know."
          actions={
            <Button onClick={() => query.refetch()} variant="outline" size="sm">
              Try again
            </Button>
          }
        />
      ) : query.isPending ? (
        <CostSkeleton />
      ) : query.data ? (
        <CostBody data={query.data} />
      ) : null}
    </>
  );
}

function RangeSelector() {
  const segments: Array<{ id: string; label: string; enabled: boolean }> = [
    { id: "7d", label: "7d", enabled: false },
    { id: "month", label: "This month", enabled: true },
    { id: "ytd", label: "YTD", enabled: false },
  ];
  return (
    <div className="inline-flex border border-line" role="tablist" aria-label="Range">
      {segments.map((s) => (
        <button
          key={s.id}
          type="button"
          role="tab"
          aria-selected={s.enabled}
          disabled={!s.enabled}
          title={s.enabled ? undefined : "Coming in v1.x"}
          data-testid={`cost-range-${s.id}`}
          className={cn(
            "px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em]",
            s.enabled
              ? "bg-ink text-bg-raised"
              : "cursor-not-allowed text-ink-3 opacity-60",
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

function CostSkeleton() {
  return (
    <div data-testid="cost-loading">
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

function CostBody({ data }: { data: CostSummaryResponse }) {
  const hasBudget = data.monthly_budget !== null;
  const alerts = [...new Set(data.alerts_fired_this_month)].sort((a, b) => a - b);

  return (
    <div data-testid="cost-body">
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat value={usd(data.total_usd)} label="Total spent" />
        <Stat
          value={hasBudget ? usd(data.monthly_budget as number) : "Not set"}
          label="Monthly budget"
        />
        <Stat
          value={
            hasBudget && data.percent_of_budget !== null
              ? `${Math.round(data.percent_of_budget)}%`
              : "—"
          }
          label="Budget used"
          tone={alerts.includes(100) ? "accent" : "default"}
        />
        <Stat
          value={alerts.length > 0 ? String(alerts.length) : "—"}
          label="Alerts fired"
        />
      </div>

      {!hasBudget ? (
        <p className="mb-6 text-[13px] text-ink-3" data-testid="cost-no-budget-copy">
          Set a budget in system settings to enable alerts.
        </p>
      ) : null}

      {alerts.length > 0 ? (
        <div className="mb-6 flex flex-wrap gap-2" data-testid="cost-alert-pills">
          {alerts.map((threshold) => (
            <Pill
              key={threshold}
              mono
              tone={(threshold >= 100 ? "danger" : "warn") as PillTone}
            >
              {threshold}% threshold passed
            </Pill>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ProviderBars byProvider={data.by_provider} total={data.total_usd} />
        <ModelBreakdownTable byModel={data.by_model} />
      </div>

      <DailyBarsPlaceholder />
    </div>
  );
}

function ProviderBars({
  byProvider,
  total,
}: {
  byProvider: CostSummaryResponse["by_provider"];
  total: number;
}) {
  const entries = Object.entries(byProvider).filter(([, v]) => (v ?? 0) > 0) as Array<
    [string, number]
  >;
  return (
    <div className="border border-line bg-bg-raised p-4" data-testid="cost-provider-bars">
      <div className="eyebrow mb-3">By provider</div>
      {entries.length === 0 ? (
        <div className="text-[13px] text-ink-3">No spend recorded yet.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map(([provider, amount]) => {
            const pct = total > 0 ? (amount / total) * 100 : 0;
            return (
              <div key={provider}>
                <div className="mb-1 flex items-center justify-between text-[12px]">
                  <span className="text-ink-2">
                    {PROVIDER_LABEL[provider] ?? provider}
                  </span>
                  <span className="font-mono text-ink-3">
                    {usd(amount)} · {Math.round(pct)}%
                  </span>
                </div>
                <div className="h-2 w-full bg-bg-sunk">
                  <div
                    className="h-2 bg-accent"
                    style={{ width: `${Math.max(2, Math.round(pct))}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ModelBreakdownTable({ byModel }: { byModel: Record<string, number> }) {
  const rows = Object.entries(byModel).sort(([, a], [, b]) => b - a);
  return (
    <div className="border border-line bg-bg-raised p-4" data-testid="cost-model-table">
      <div className="eyebrow mb-3">By model</div>
      {rows.length === 0 ? (
        <div className="text-[13px] text-ink-3">No model spend recorded yet.</div>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-ink-3">
              <th className="py-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em]">
                Model
              </th>
              <th className="py-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em]">
                Provider
              </th>
              <th className="py-1.5 text-right font-mono text-[10.5px] uppercase tracking-[0.12em]">
                Spend
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([modelId, amount]) => (
              <tr key={modelId} className="border-b border-line">
                <td className="py-1.5 font-mono text-[12px] text-ink">{modelId}</td>
                <td className="py-1.5 text-ink-3">{providerForModel(modelId)}</td>
                <td className="py-1.5 text-right font-mono text-ink-2">{usd(amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function DailyBarsPlaceholder() {
  return (
    <div
      className="mt-4 border border-line bg-bg-sunk p-4"
      data-testid="cost-daily-placeholder"
    >
      <div className="eyebrow mb-3">Daily history</div>
      <div className="flex h-24 items-end gap-1 opacity-40">
        {Array.from({ length: 28 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-line"
            style={{ height: `${20 + ((i * 7) % 60)}%` }}
            aria-hidden
          />
        ))}
      </div>
      <div className="mt-3 text-[12px] text-ink-3">
        Daily history coming in v1.x · backend extension required (
        <code>daily_history</code> field on <code>cost/summary</code>).
      </div>
    </div>
  );
}
