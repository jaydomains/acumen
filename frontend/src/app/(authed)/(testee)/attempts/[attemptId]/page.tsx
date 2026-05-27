"use client";

/**
 * Attempt runner page (FE-4 §B.1, §B.2 + FE-5 §B.1, §C.1).
 *
 * Branches on `test.mode`:
 *   - `frozen` / `hand_authored` → `<FrozenRunner />`.
 *   - `benchmark` → `<BenchmarkRunner />`.
 *   - `per_testee` → `<StreamingRunner />` (FE-5 slice 2).
 *
 * Reads `attemptId` via `useParams()` (the FE-3 pill-detail
 * precedent — `useParams` returns the path-params object directly in
 * client components; the `use(params)` idiom is the server-component
 * pattern). Spec §H(b)#16 wanted `use(params)` but the page is
 * client-only (interaction-driven), so `useParams` is the matching
 * client-side API.
 *
 * Pill name is sourced from `GET /v1/catalogue/pills/{pill_id}` if a
 * pill_id is recoverable from the attempt/test; otherwise the header
 * shows the test's `name` field as a fallback. The attempt fixture
 * does not surface pill_id directly, so v1 falls back to the test
 * name + the difficulty derived from `test.target_difficulty`.
 */

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { useAttemptView } from "@/lib/queries/attempts";
import { narrowPresentedList } from "@/lib/attempts/presented-question";
import { BenchmarkRunner } from "@/components/attempt/BenchmarkRunner";
import { FrozenRunner } from "@/components/attempt/FrozenRunner";
import { StreamingRunner } from "@/components/attempt/StreamingRunner";
import { Skeleton } from "@/components/ui/skeleton";

export default function AttemptRunnerPage() {
  const params = useParams<{ attemptId: string }>();
  const attemptId = params?.attemptId ?? "";
  const { user } = useAuth();
  const { attempt, test, status, error } = useAttemptView(attemptId);

  // Memoise the narrowed question list before any conditional return
  // so the hook count is stable across renders (React rules-of-hooks).
  const presentedQuestions = useMemo(() => {
    if (!attempt?.questions) return [];
    return narrowPresentedList(attempt.questions as unknown[]);
  }, [attempt?.questions]);

  if (status === "pending" || !attempt || !test) {
    return (
      <div className="min-h-screen bg-bg">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-8 py-8">
          <Skeleton className="h-[88px] w-full" />
          <Skeleton className="h-[320px] w-full" />
        </div>
      </div>
    );
  }

  if (status === "error") {
    // Rethrow so Next.js Pattern C boundary takes over (error.tsx
    // in this segment renders the user-facing card).
    throw error ?? new Error("Failed to load attempt");
  }

  const userName = user?.name?.trim() || user?.email || "Testee";

  if (test.mode === "per_testee") {
    return (
      <StreamingRunner
        attempt={attempt}
        test={test}
        presentedQuestions={presentedQuestions}
        userName={userName}
        pillName={test.name}
        difficulty={test.target_difficulty ?? null}
      />
    );
  }

  if (test.mode === "benchmark") {
    return (
      <BenchmarkRunner
        attempt={attempt}
        test={test}
        initialQuestion={presentedQuestions[0] ?? null}
        userName={userName}
        pillName={test.name}
        difficulty={test.target_difficulty ?? null}
      />
    );
  }

  // frozen + hand_authored share the same runner.
  return (
    <FrozenRunner
      attempt={attempt}
      test={test}
      presentedQuestions={presentedQuestions}
      userName={userName}
      pillName={test.name}
      difficulty={test.target_difficulty ?? null}
    />
  );
}
