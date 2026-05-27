"use client";

/**
 * Attempt result placeholder (FE-4 §E #10).
 *
 * FE-6 builds the actual result UI (score / competence delta / per-Q
 * breakdown / weakness card / loop card). This page exists so the
 * GradingOverlay has a real route to push to on completion. Once the
 * FE-6 PR opens, this file gets replaced with the real component.
 */

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function AttemptResultPlaceholder() {
  const router = useRouter();
  const params = useParams<{ attemptId: string }>();
  const attemptId = params?.attemptId ?? "";
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4 px-8 py-16 text-ink">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-3">
          Result
        </span>
        <h1 className="font-serif text-[28px] leading-tight tracking-[-0.01em]">
          Your result has landed.
        </h1>
        <p className="text-[14px] leading-6 text-ink-2">
          The full result UI — score, competence delta, per-question breakdown, and the
          adaptive-loop card — lands with FE-6. For now, this placeholder confirms the
          grading round-trip finished for attempt{" "}
          <code className="font-mono text-[12px] text-ink-3">
            {attemptId.slice(0, 7)}…
          </code>
          .
        </p>
        <div className="flex gap-2 pt-2">
          <Button onClick={() => router.push("/")}>Back to dashboard</Button>
          <Button variant="outline" onClick={() => router.push("/catalogue")}>
            Browse catalogue
          </Button>
        </div>
      </div>
    </div>
  );
}
