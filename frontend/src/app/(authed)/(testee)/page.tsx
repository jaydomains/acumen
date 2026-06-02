"use client";

/**
 * Testee dashboard at `/` (FE-3 §B.1).
 *
 * URL stays `/` because both route groups `(authed)` and `(testee)`
 * are parenthesised — Next.js strips them from the URL.
 *
 * Widgets consume live `/v1/me/*` endpoints: `HeroStats` (container) wires
 * `GET /v1/me/competence` + `GET /v1/attempts`; `AssignmentsCard` wires
 * `GET /v1/me/assignments`; `RecentAttemptsCard` wires `GET /v1/attempts`
 * via `useMeAttemptsCapped(5)`. Failures surface honestly per component
 * (empty != error); no placeholder/pending copy.
 */

import { useMemo } from "react";
import { useAuth } from "@/lib/auth/context";
import { HeroStats } from "@/components/dashboard/HeroStats";
import { ResumePrompt } from "@/components/dashboard/ResumePrompt";
import { AssignmentsCard } from "@/components/dashboard/AssignmentsCard";
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
      <ResumePrompt />
      <HeroStats displayName={displayName} dateLabel={dateLabel} />
      <div className="flex flex-col gap-6">
        <AssignmentsCard />
        <RecentAttemptsCard />
      </div>
    </>
  );
}
