"use client";

/**
 * BenchmarkRunner (FE-4 §B.2).
 *
 * Sequential walker for benchmark-mode attempts. POST /next steps to
 * the next question; backend caps at `P4_BENCHMARK_STEP_CAP=5`
 * (drift item §H(b)#9 — we render whatever `next.done` says).
 *
 * Benchmark-specific deltas vs frozen:
 *   - no AutosaveIndicator (saves on `next` only)
 *   - no FlagRealismButton (per design; AC-D22 is per-Testee feedback
 *     on AI-generated content; benchmarks pull from a pool)
 *   - ProgressDots are non-interactive (sequential only)
 *   - pause control hidden (v1 default per AC-D13 untimed)
 *   - SubmitConfirmModal + GradingOverlay use benchmark-mode copy
 *
 * The reducer is reused for `answers` + `pauseState` (kept active
 * throughout — there's no debounce queue here since the answer
 * commits with the next /next call).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { AttemptHeaderBand } from "./AttemptHeaderBand";
import { AttemptShell } from "./AttemptShell";
import { GradingOverlay } from "./GradingOverlay";
import { QuestionView } from "./QuestionView";
import { SubmitConfirmModal } from "./SubmitConfirmModal";
import { useIntegrity } from "@/lib/attempts/use-integrity";
import { useNow } from "@/lib/attempts/use-now";
import {
  isAnswered,
  toServerPayload,
  type AnswerPayload,
} from "@/lib/attempts/answer-payloads";
import {
  useAutosaveAttempt,
  useBenchmarkNext,
  useSubmitAttempt,
  type AttemptView,
  type TestResponse,
} from "@/lib/queries/attempts";
import { narrowPresented } from "@/lib/attempts/presented-question";
import type { AnyPresentedQuestion } from "./questions/types";

export type BenchmarkRunnerProps = {
  attempt: AttemptView;
  test: TestResponse;
  /** Initial Q1 from GET /v1/attempts/{id}.questions[0]. May be empty
   * on the first /next call's response when the backend defers Q1
   * to the first walk. */
  initialQuestion: AnyPresentedQuestion | null;
  userName: string;
  pillName: string;
  difficulty: number | null;
};

export function BenchmarkRunner({
  attempt,
  test,
  initialQuestion,
  userName,
  pillName,
  difficulty,
}: BenchmarkRunnerProps) {
  const router = useRouter();
  const attemptId = attempt.id;

  const [current, setCurrent] = useState<AnyPresentedQuestion | null>(initialQuestion);
  const [step, setStep] = useState<number>(initialQuestion ? 1 : 0);
  const [asked, setAsked] = useState<number>(initialQuestion ? 1 : 0);
  const [answers, setAnswers] = useState<Map<string, AnswerPayload>>(new Map());
  const [done, setDone] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [graded, setGraded] = useState(false);

  const nextMutation = useBenchmarkNext(attemptId);
  const submitMutation = useSubmitAttempt(attemptId);
  // Benchmark "saves on /next only" — but `/next` itself accepts no
  // body (verified against api.d.ts — `requestBody?: never` on the
  // next-question operation). So we persist the current answer via
  // /autosave BEFORE calling /next (and again before submit). Without
  // this, answers exist only in ephemeral component state and the
  // backend grades nothing.
  const autosaveMutation = useAutosaveAttempt(attemptId);
  const integrity = useIntegrity({ paused: false });
  const nowMs = useNow();

  // If we don't have Q1 from the snapshot, kick the first /next on
  // mount so the testee lands on a question.
  useEffect(() => {
    if (initialQuestion) return;
    nextMutation.mutate(undefined, {
      onSuccess: (data) => {
        if (data.done) {
          setDone(true);
          setSubmitOpen(true);
          return;
        }
        const narrowed = data.question ? narrowPresented(data.question) : null;
        if (narrowed) {
          setCurrent(narrowed);
          setStep(data.step ?? 1);
          setAsked(data.asked ?? 1);
        }
      },
      onError: () => {
        toast.error("Couldn't load the first question — try refreshing.");
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAnswer = useCallback(
    (payload: AnswerPayload) => {
      if (!current) return;
      setAnswers((prev) => {
        const next = new Map(prev);
        next.set(current.id, payload);
        return next;
      });
    },
    [current],
  );

  // Save the current question's answer (if any) before advancing or
  // submitting. /next + /submit both treat the persisted Response
  // rows as the source of truth; without this round-trip benchmark
  // answers are lost.
  const persistCurrentAnswer = useCallback(async () => {
    if (!current) return;
    const payload = answers.get(current.id);
    if (!payload || !isAnswered(payload)) return;
    try {
      await autosaveMutation.mutateAsync({
        question_id: current.id,
        answer_payload: toServerPayload(payload),
        time_ms: null,
      });
    } catch (err) {
      // Surface the failure but let the caller decide whether to
      // proceed — for benchmark we don't proceed (the answer would
      // be silently dropped). handleNext / handleConfirmSubmit catch
      // and toast.
      throw err;
    }
  }, [autosaveMutation, answers, current]);

  const handleNext = useCallback(() => {
    persistCurrentAnswer()
      .then(() =>
        nextMutation.mutate(undefined, {
          onSuccess: (data) => {
            if (data.done) {
              setDone(true);
              setSubmitOpen(true);
              return;
            }
            const narrowed = data.question ? narrowPresented(data.question) : null;
            if (narrowed) {
              setCurrent(narrowed);
              setStep(data.step ?? step + 1);
              setAsked(data.asked ?? asked + 1);
            }
          },
          onError: (err) => {
            const code = err instanceof ApiError ? err.code : null;
            toast.error("Couldn't load the next question — try again", {
              ...(code ? { description: `(${code})` } : {}),
            });
          },
        }),
      )
      .catch((err) => {
        const code = err instanceof ApiError ? err.code : null;
        toast.error("Couldn't save your answer — try again", {
          ...(code ? { description: `(${code})` } : {}),
        });
      });
  }, [persistCurrentAnswer, nextMutation, step, asked]);

  const handleConfirmSubmit = useCallback(() => {
    persistCurrentAnswer()
      .then(() =>
        submitMutation.mutate(undefined, {
          onSuccess: () => {
            setSubmitOpen(false);
            setGraded(true);
          },
          onError: (err) => {
            const code = err instanceof ApiError ? err.code : null;
            toast.error("Submit failed — try again", {
              ...(code ? { description: `(${code})` } : {}),
            });
          },
        }),
      )
      .catch((err) => {
        const code = err instanceof ApiError ? err.code : null;
        toast.error("Couldn't save your final answer — try again", {
          ...(code ? { description: `(${code})` } : {}),
        });
      });
  }, [persistCurrentAnswer, submitMutation]);

  const handleExit = useCallback(() => {
    router.push("/");
  }, [router]);

  // For ProgressDots: we don't know N in advance for benchmark (cap
  // is server-side). Show a strip equal to `asked` so far with the
  // current step marked active. After `done`, the strip equals `step`.
  const questionIds = useMemo(() => {
    const count = Math.max(asked, 1);
    return Array.from({ length: count }, (_, i) => `bench-${i + 1}`);
  }, [asked]);
  const answeredIds = useMemo(() => {
    const set = new Set<string>();
    // Mark every prior step as "answered" (we've moved past them).
    for (let i = 0; i < step - 1; i++) set.add(`bench-${i + 1}`);
    // Mark the current step answered if the testee has set a payload.
    if (current && answers.has(current.id) && isAnswered(answers.get(current.id)!)) {
      set.add(`bench-${step}`);
    }
    return set;
  }, [step, current, answers]);

  const answeredCount = answers.size;

  return (
    <AttemptShell userName={userName} attemptId={attemptId}>
      <AttemptHeaderBand
        pillName={pillName}
        difficulty={difficulty}
        questionCount={asked}
        timed={test.timed}
        startedAtIso={attempt.started_at}
        durationMinutes={test.duration_minutes ?? null}
        paused={false}
        nowMs={nowMs}
        tabSwitches={integrity.tabSwitches}
        autosaveState="idle"
        autosaveAt={null}
        autosaveRetries={0}
        questionIds={questionIds}
        currentIndex={Math.max(0, step - 1)}
        answeredQuestionIds={answeredIds}
        jumpEnabled={false}
        onExit={handleExit}
        hidePause
      />
      {current ? (
        <QuestionView
          question={current}
          positionDisplay={step}
          total={asked}
          answer={answers.get(current.id) ?? null}
          onAnswer={handleAnswer}
        />
      ) : (
        <div
          data-testid="benchmark-loading"
          className="border border-line bg-bg-raised p-6 text-[14px] text-ink-3"
        >
          Loading next question…
        </div>
      )}
      <nav
        data-testid="attempt-nav"
        className="flex items-center justify-between border border-line bg-bg-raised p-3"
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3">
          Benchmark · Q{step}
        </span>
        {done ? (
          <Button
            data-testid="benchmark-submit"
            onClick={() => setSubmitOpen(true)}
            disabled={submitMutation.isPending}
          >
            Submit benchmark →
          </Button>
        ) : (
          <Button
            data-testid="benchmark-next"
            onClick={handleNext}
            disabled={nextMutation.isPending || !current}
          >
            {nextMutation.isPending ? "Loading…" : "Next →"}
          </Button>
        )}
      </nav>
      <SubmitConfirmModal
        open={submitOpen}
        onOpenChange={(open) => {
          if (submitMutation.isPending) return;
          setSubmitOpen(open);
        }}
        mode="benchmark"
        answeredCount={answeredCount}
        totalCount={asked}
        onConfirm={handleConfirmSubmit}
        submitting={submitMutation.isPending}
      />
      {graded && <GradingOverlay attemptId={attemptId} mode="benchmark" />}
    </AttemptShell>
  );
}
