"use client";

/**
 * Attempt runner page (FE-4 §B.1, §B.2).
 *
 * Branches on `test.mode`:
 *   - `frozen` / `hand_authored` → `<FrozenRunner />` (slice 1)
 *   - `benchmark` → slice 2 will mount `<BenchmarkRunner />`; slice 1
 *     shows a "lands in next slice" placeholder so the route is
 *     reachable but the UI doesn't half-render.
 *   - `per_testee` → FE-5-pending placeholder (no streaming runner
 *     in v1.x yet).
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
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { useAttemptView } from "@/lib/queries/attempts";
import { narrowPresentedList } from "@/lib/attempts/presented-question";
import { FrozenRunner } from "@/components/attempt/FrozenRunner";
import { Skeleton } from "@/components/ui/skeleton";
import { BoundaryFrame } from "@/components/shell/BoundaryFrame";
import { Icon } from "@/components/primitives/Icon";
import { Button } from "@/components/ui/button";

export default function AttemptRunnerPage() {
  const params = useParams<{ attemptId: string }>();
  const attemptId = params?.attemptId ?? "";
  const router = useRouter();
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

  if (test.mode === "per_testee") {
    return <PerTesteeModePlaceholder />;
  }

  if (test.mode === "benchmark") {
    return (
      <BenchmarkSlicePlaceholder attemptId={attemptId} onExit={() => router.push("/")} />
    );
  }

  // frozen + hand_authored share the same runner.
  const userName = user?.name?.trim() || user?.email || "Testee";
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

function PerTesteeModePlaceholder() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-bg">
      <BoundaryFrame
        glyph={<Icon name="flag" size={24} />}
        eyebrow="MODE"
        title="Streaming mode coming soon"
        body="Per-Testee tests stream Q1..N over time and land with FE-5. For now, contact your admin if this attempt was assigned to you."
        actions={
          <Button variant="outline" onClick={() => router.push("/")}>
            Back to dashboard
          </Button>
        }
      />
    </div>
  );
}

function BenchmarkSlicePlaceholder({
  attemptId,
  onExit,
}: {
  attemptId: string;
  onExit: () => void;
}) {
  return (
    <div className="min-h-screen bg-bg">
      <BoundaryFrame
        glyph={<Icon name="flag" size={24} />}
        eyebrow="ATTEMPT"
        title="Benchmark runner lands in slice 2"
        body={`This deep-link (${attemptId.slice(0, 7)}…) routes to the benchmark sequential walker — it's wired in the next slice of FE-4.`}
        actions={
          <Button variant="outline" onClick={onExit}>
            Back to dashboard
          </Button>
        }
      />
    </div>
  );
}
