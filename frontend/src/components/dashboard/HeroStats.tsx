/**
 * HeroStats — dashboard hero (FE-3 §B.1, §C.1, §5).
 *
 * Container component: owns its data hooks and derives its stats internally
 * (the F3 clarification — PR #85 comment `4596639182` — locked the container
 * pattern, matching sibling `AssignmentsCard` / `RecentAttemptsCard`). Props
 * stay `{ displayName, dateLabel }`; there are no data props and no
 * `page.tsx`<->HeroStats coordination point.
 *
 * `GET /v1/me/competence` (LIVE) drives OVERALL COMPETENCE + PILLS AT WORKING+;
 * `GET /v1/attempts` (LIVE) drives the client-derived DAY STREAK. Loading /
 * empty / error / populated state is managed per-query inside this component:
 * empty (no assessed pills / no attempts) is rendered as an honest empty state,
 * never as "v1.x-pending"; a fetch error is rendered distinctly from empty so a
 * transient failure never masquerades as a true zero/empty state.
 *
 * Greeting copy: "Welcome back, {displayName}." (name resolved by the caller
 * from AuthContext, fall back to email).
 */

import { Stat } from "@/components/primitives/Stat";
import { type Band } from "@/components/primitives/bands";
import { useMeCompetence, useMeAttemptsCapped } from "@/lib/queries/me";
import { deriveDayStreak } from "@/lib/competence/derive-streak";

export type HeroStatsProps = {
  displayName: string;
  dateLabel: string;
};

/** "Working+" = band >= working on the AC-D20 axis (competence_estimate >= 5). */
const WORKING_PLUS = new Set<Band>(["working", "advanced", "expert"]);

const LOADING = "…";

export function HeroStats({ displayName, dateLabel }: HeroStatsProps) {
  const competence = useMeCompetence();
  // Default (200) cap — shares the cache key with `/profile`'s capped fetch, so
  // one request serves both; the streak only needs `submitted_at`.
  const attempts = useMeAttemptsCapped();

  // Competence-derived. `pillCount` counts ASSESSED pills only: per LOCK-2 the
  // wire excludes `competence_estimate IS NULL` rows, so a testee assigned 10
  // pills but assessed on 3 shows "across 3 pills" (intended — do not "fix" to
  // total-assigned).
  const pills = competence.data?.pills ?? [];
  const pillCount = pills.length;
  const workingPlusCount = pills.filter((p) => WORKING_PLUS.has(p.band)).length;
  const overallCompetence = pillCount
    ? pills.reduce((sum, p) => sum + p.competence_estimate, 0) / pillCount
    : null;

  // Streak is derived independently from attempts (may be non-zero even when the
  // competence profile is empty — a self-initiated attempt creates no profile row).
  const streakDays = deriveDayStreak(
    (attempts.data?.data ?? []).map((a) => a.submitted_at),
  );

  // OVERALL COMPETENCE + PILLS AT WORKING+ (competence query).
  let overallValue: string;
  let overallHint: string;
  let workingPlusValue: string;
  if (competence.isPending) {
    overallValue = LOADING;
    overallHint = "";
    workingPlusValue = LOADING;
  } else if (competence.isError) {
    overallValue = "—";
    overallHint = "Unavailable";
    workingPlusValue = "—";
  } else if (pillCount === 0) {
    overallValue = "—";
    overallHint = "No attempts yet";
    workingPlusValue = "0/0";
  } else {
    overallValue = overallCompetence!.toFixed(1);
    overallHint = `across ${pillCount} pill${pillCount === 1 ? "" : "s"}`;
    workingPlusValue = `${workingPlusCount}/${pillCount}`;
  }

  // DAY STREAK (attempts query) — own error/loading branches.
  const streakValue = attempts.isPending
    ? LOADING
    : attempts.isError
      ? "—"
      : String(streakDays);

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
      </div>
      <div className="flex flex-wrap items-baseline gap-8">
        <Stat value={overallValue} label="OVERALL COMPETENCE" hint={overallHint || undefined} />
        <Stat value={workingPlusValue} label="PILLS AT WORKING+" />
        <Stat value={streakValue} label="DAY STREAK" tone="accent" />
      </div>
    </div>
  );
}
