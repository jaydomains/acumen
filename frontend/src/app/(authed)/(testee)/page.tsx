"use client";

/**
 * Testee dashboard at `/` (FE-3 §B.1).
 *
 * URL stays `/` because both route groups `(authed)` and `(testee)`
 * are parenthesised — Next.js strips them from the URL.
 *
 * Drift-mode rendering: `GET /v1/me/competence|assignments|attempts`
 * are unmounted/absent in v1, so the corresponding widgets render
 * placeholder copy and DO NOT construct queries (spec Gherkin "no
 * request fires" — satisfied by the absence of the hook call).
 *
 * RecentAttemptsCard is feature-flagged off by default.
 */

import { useMemo } from "react";
import { useAuth } from "@/lib/auth/context";
import { HeroStats } from "@/components/dashboard/HeroStats";
import { TodaysReading } from "@/components/dashboard/TodaysReading";
import { AssignmentsCard } from "@/components/dashboard/AssignmentsCard";
import { AdaptiveLoopCard } from "@/components/dashboard/AdaptiveLoopCard";
import { RecentAttemptsCard } from "@/components/dashboard/RecentAttemptsCard";

export default function TesteeDashboardPage() {
  const { user } = useAuth();
  const displayName = (user?.name?.trim() || user?.email?.split("@")[0]) ?? "there";

  const dateLabel = useMemo(
    () =>
      new Date().toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    [],
  );

  return (
    <>
      <HeroStats displayName={displayName} dateLabel={dateLabel} />
      <TodaysReading />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <div className="flex flex-col gap-6 min-w-0">
          <AssignmentsCard />
          <RecentAttemptsCard />
        </div>
        <div className="flex flex-col gap-6 min-w-0">
          <AdaptiveLoopCard />
        </div>
      </div>
    </>
  );
}
