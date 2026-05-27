"use client";

/**
 * FrozenRunner (FE-4 §B.1) — orchestrator for frozen + hand_authored
 * mode attempts. Owns the question carousel + autosave wiring +
 * realism-flag wiring + pause overlay + submit confirm + grading
 * overlay + integrity surface composition.
 *
 * Slice 1 lit up: load + render + autosave + flag-realism + integrity.
 * Slice 2 lights up: pause / resume / submit / grading overlay.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { AttemptHeaderBand } from "./AttemptHeaderBand";
import { AttemptShell } from "./AttemptShell";
import { AutosaveBanner } from "./AutosaveIndicator";
import { FlagRealismButton } from "./FlagRealismButton";
import { GradingOverlay } from "./GradingOverlay";
import { PauseOverlay } from "./PauseOverlay";
import { QuestionView } from "./QuestionView";
import { SubmitConfirmModal } from "./SubmitConfirmModal";
import { useAttempt } from "@/lib/attempts/use-attempt";
import { useIntegrity } from "@/lib/attempts/use-integrity";
import { useNow } from "@/lib/attempts/use-now";
import {
  isAnswered,
  toServerPayload,
  type AnswerPayload,
} from "@/lib/attempts/answer-payloads";
import {
  attemptQueryKeys,
  useAutosaveAttempt,
  useFlagRealism,
  usePauseAttempt,
  useResumeAttempt,
  useSubmitAttempt,
  type AttemptView,
  type TestResponse,
} from "@/lib/queries/attempts";
import type { AnyPresentedQuestion } from "./questions/types";
import type { AutosaveState } from "@/lib/attempts/use-attempt";

export type FrozenRunnerProps = {
  attempt: AttemptView;
  test: TestResponse;
  presentedQuestions: AnyPresentedQuestion[];
  userName: string;
  pillName: string;
  difficulty: number | null;
};

export function FrozenRunner({
  attempt,
  test,
  presentedQuestions,
  userName,
  pillName,
  difficulty,
}: FrozenRunnerProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const attemptId = attempt.id;

  const questionIds = useMemo(
    () => presentedQuestions.map((q) => q.id),
    [presentedQuestions],
  );

  const autosaveMutation = useAutosaveAttempt(attemptId);
  const flagMutation = useFlagRealism(attemptId);
  const pauseMutation = usePauseAttempt(attemptId);
  const resumeMutation = useResumeAttempt(attemptId);
  const submitMutation = useSubmitAttempt(attemptId);

  // React Query's `useMutation` returns a fresh object on every
  // render — the unstable reference defeats `useCallback`
  // memoisation if we list the mutation in deps. Stash each in a
  // ref so the handlers below + `useAttempt`'s `executeAutosave`
  // stay referentially stable across re-renders, sparing the per-
  // type question renderers an unnecessary re-render on every
  // parent render. (Per Gitar review.)
  const autosaveRef = useRef(autosaveMutation);
  autosaveRef.current = autosaveMutation;
  const flagRef = useRef(flagMutation);
  flagRef.current = flagMutation;
  const pauseRef = useRef(pauseMutation);
  pauseRef.current = pauseMutation;
  const resumeRef = useRef(resumeMutation);
  resumeRef.current = resumeMutation;
  const submitRef = useRef(submitMutation);
  submitRef.current = submitMutation;

  const executeAutosave = useCallback(
    async (input: { questionId: string; payload: AnswerPayload; timeMs: number }) => {
      await autosaveRef.current.mutateAsync({
        question_id: input.questionId,
        answer_payload: toServerPayload(input.payload),
        time_ms: input.timeMs,
      });
    },
    [],
  );

  const runner = useAttempt({
    attemptId,
    questionIds,
    executeAutosave,
    initiallyPaused: attempt.paused,
  });

  const paused = runner.state.pauseState !== "active";
  const integrity = useIntegrity({ paused });
  const nowMs = useNow({ paused });
  const [flagInFlight, setFlagInFlight] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [graded, setGraded] = useState(false);

  const currentQuestion = presentedQuestions[runner.state.currentIndex];

  const answeredIds = useMemo(() => {
    const set = new Set<string>();
    for (const [qid, payload] of runner.state.answers) {
      if (isAnswered(payload)) set.add(qid);
    }
    return set;
  }, [runner.state.answers]);

  const autosaveState: AutosaveState = currentQuestion
    ? (runner.state.autosaveStates.get(currentQuestion.id) ?? "idle")
    : "idle";
  const autosaveAt = currentQuestion
    ? (runner.state.autosaveAt.get(currentQuestion.id) ?? null)
    : null;
  const autosaveRetries = currentQuestion
    ? (runner.state.autosaveRetries.get(currentQuestion.id) ?? 0)
    : 0;

  const handleAnswer = useCallback(
    (payload: AnswerPayload) => {
      if (!currentQuestion) return;
      runner.setAnswer(currentQuestion.id, payload);
    },
    [currentQuestion, runner],
  );

  const handleExit = useCallback(() => {
    router.push("/");
  }, [router]);

  const handleFlag = useCallback(() => {
    if (!currentQuestion) return;
    const questionId = currentQuestion.id;
    if (flagInFlight === questionId) return;
    setFlagInFlight(questionId);
    flagRef.current.mutate(questionId, {
      onSuccess: () => {
        runner.flagRealism(questionId);
      },
      onError: () => {
        toast.error("Couldn't flag — try again", {
          description:
            "Your save is unaffected; this only marks the question for review.",
        });
      },
      onSettled: () => {
        setFlagInFlight((curr) => (curr === questionId ? null : curr));
      },
    });
  }, [currentQuestion, flagInFlight, runner]);

  const handlePause = useCallback(() => {
    if (paused) return;
    runner.pauseStart();
    pauseRef.current.mutate(undefined, {
      onSuccess: () => {
        runner.pauseSuccess();
      },
      onError: (err) => {
        const code = err instanceof ApiError ? err.code : null;
        toast.error("Couldn't pause — try again", {
          ...(code ? { description: `(${code})` } : {}),
        });
        runner.resumeSuccess();
      },
    });
  }, [paused, runner]);

  const handleResume = useCallback(() => {
    if (!paused) return;
    runner.resumeStart();
    resumeRef.current.mutate(undefined, {
      onSuccess: () => {
        runner.resumeSuccess();
        // Refresh the attempt view so `pause_seconds_remaining` and
        // `paused` reflect the post-resume server state.
        queryClient.invalidateQueries({
          queryKey: attemptQueryKeys.detail(attemptId),
        });
      },
      onError: (err) => {
        const code = err instanceof ApiError ? err.code : null;
        toast.error("Couldn't resume — try again", {
          ...(code ? { description: `(${code})` } : {}),
        });
        runner.pauseSuccess();
      },
    });
  }, [paused, runner, queryClient, attemptId]);

  const handleOpenSubmit = useCallback(() => {
    setSubmitOpen(true);
  }, []);

  const handleConfirmSubmit = useCallback(() => {
    submitRef.current.mutate(undefined, {
      onSuccess: () => {
        setSubmitOpen(false);
        setGraded(true);
        runner.clearAfterSubmit();
      },
      onError: (err) => {
        const code = err instanceof ApiError ? err.code : null;
        toast.error("Submit failed — try again", {
          ...(code ? { description: `(${code})` } : {}),
        });
      },
    });
  }, [runner]);

  const goPrev = useCallback(() => {
    if (runner.state.currentIndex > 0) {
      runner.advanceTo(runner.state.currentIndex - 1);
    }
  }, [runner]);

  const goNext = useCallback(() => {
    if (runner.state.currentIndex < presentedQuestions.length - 1) {
      runner.advanceTo(runner.state.currentIndex + 1);
    }
  }, [runner, presentedQuestions.length]);

  const remainingMinutes =
    attempt.pause_seconds_remaining != null
      ? Math.max(0, Math.ceil(attempt.pause_seconds_remaining / 60))
      : (test.max_pause_duration_minutes ?? null);

  const answeredCount = answeredIds.size;
  const totalCount = presentedQuestions.length;

  return (
    <AttemptShell userName={userName} attemptId={attemptId}>
      <AttemptHeaderBand
        pillName={pillName}
        difficulty={difficulty}
        questionCount={totalCount}
        timed={test.timed}
        startedAtIso={attempt.started_at}
        durationMinutes={test.duration_minutes ?? null}
        paused={paused}
        nowMs={nowMs}
        tabSwitches={integrity.tabSwitches}
        autosaveState={autosaveState}
        autosaveAt={autosaveAt}
        autosaveRetries={autosaveRetries}
        questionIds={questionIds}
        currentIndex={runner.state.currentIndex}
        answeredQuestionIds={answeredIds}
        jumpEnabled
        onJump={(idx) => runner.advanceTo(idx)}
        onExit={handleExit}
        onPause={handlePause}
        onResume={handleResume}
        pausePending={pauseMutation.isPending || resumeMutation.isPending}
      />
      <AutosaveBanner visible={runner.state.autosaveBannerVisible} />
      {currentQuestion ? (
        <div style={{ visibility: paused ? "hidden" : "visible" }}>
          <QuestionView
            question={currentQuestion}
            positionDisplay={runner.state.currentIndex + 1}
            total={totalCount}
            answer={runner.state.answers.get(currentQuestion.id) ?? null}
            onAnswer={handleAnswer}
            disabled={paused}
            footer={
              <FlagRealismButton
                flagged={runner.state.flaggedQuestions.has(currentQuestion.id)}
                pending={flagInFlight === currentQuestion.id}
                onFlag={handleFlag}
              />
            }
          />
        </div>
      ) : (
        <div className="border border-line bg-bg-raised p-6 text-[14px] text-ink-3">
          No questions to display.
        </div>
      )}
      <nav
        data-testid="attempt-nav"
        className="flex items-center justify-between border border-line bg-bg-raised p-3"
      >
        <Button
          variant="outline"
          size="sm"
          data-testid="attempt-prev"
          disabled={runner.state.currentIndex === 0 || paused}
          onClick={goPrev}
        >
          ← Previous
        </Button>
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3">
          Question {runner.state.currentIndex + 1} / {totalCount}
        </span>
        {runner.state.currentIndex >= totalCount - 1 ? (
          <Button
            size="sm"
            data-testid="attempt-submit"
            disabled={paused || submitMutation.isPending}
            onClick={handleOpenSubmit}
          >
            Submit attempt →
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            data-testid="attempt-next"
            disabled={paused}
            onClick={goNext}
          >
            Next →
          </Button>
        )}
      </nav>
      {paused && (
        <PauseOverlay
          remainingMinutes={remainingMinutes}
          onResume={handleResume}
          resumePending={resumeMutation.isPending}
        />
      )}
      <SubmitConfirmModal
        open={submitOpen}
        onOpenChange={(open) => {
          if (submitMutation.isPending) return;
          setSubmitOpen(open);
        }}
        mode="frozen"
        answeredCount={answeredCount}
        totalCount={totalCount}
        onConfirm={handleConfirmSubmit}
        submitting={submitMutation.isPending}
      />
      {graded && <GradingOverlay attemptId={attemptId} mode="frozen" />}
    </AttemptShell>
  );
}
