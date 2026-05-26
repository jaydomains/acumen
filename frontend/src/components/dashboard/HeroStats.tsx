/**
 * HeroStats — dashboard hero (FE-3 §B.1, §E item 1).
 *
 * Greeting + 3 Stats. In v1 ALL stat values render as "—" with a
 * "v1.x · pending" hint because the backend competence router is
 * unmounted; we DO NOT construct the query (no `enabled: false`
 * with placeholder, no fetch — just no hook at all). When
 * `GET /v1/me/competence` lands, wire useCompetence() here and feed
 * value + hint from real data.
 *
 * Greeting copy: "Welcome back, {name}" (per spec §B.1 — name from
 * AuthContext, fall back to email).
 */

import { Stat } from "@/components/primitives/Stat";

export type HeroStatsProps = {
  displayName: string;
  dateLabel: string;
};

export function HeroStats({ displayName, dateLabel }: HeroStatsProps) {
  return (
    <div
      data-testid="dashboard-hero"
      className="mb-8 flex flex-wrap items-baseline justify-between gap-6"
    >
      <div className="min-w-0">
        <div className="eyebrow mb-2">{dateLabel}</div>
        <h1 className="font-serif text-[48px] leading-[1.05] tracking-[-0.025em] text-ink">
          Welcome back, {displayName}.
        </h1>
        <p className="mt-3 max-w-[56ch] text-[14px] text-ink-3">
          Per-Testee competence, assignments, and recent attempts arrive once the backend
          `/v1/me/*` endpoints land. Until then, the catalogue is fully browsable and pill
          detail is live.
        </p>
      </div>
      <div className="flex flex-wrap items-baseline gap-8">
        <Stat
          value="—"
          label="OVERALL COMPETENCE"
          hint="v1.x · pending /v1/me/competence"
        />
        <Stat value="—" label="PILLS AT WORKING+" hint="v1.x · pending" />
        <Stat value="—" label="DAY STREAK" tone="accent" hint="v1.x · pending" />
      </div>
    </div>
  );
}
