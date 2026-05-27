"use client";

/**
 * FrozenRunner (FE-4 §B.1) — orchestrator for frozen + hand_authored
 * mode attempts. Owns the question carousel + autosave wiring +
 * realism-flag wiring + integrity surface composition.
 *
 * Slice 1 ships:
 *   - load + render Q1 + navigate
 *   - debounced autosave per question
 *   - realism flag idempotent
 *   - integrity surface (watermark via AttemptShell, deterrents via
 *     useIntegrity, IntegrityBadge in the header band)
 *   - persistent autosave-failure banner
 *
 * Slice 2 will plug in pause / resume / submit overlays through the
 * `onPause` / `onResume` / `onSubmit` props (left undefined in
 * slice 1 so the chrome stays consistent).
 */

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AttemptHeaderBand } from "./AttemptHeaderBand";
import { AttemptShell } from "./AttemptShell";
import { AutosaveBanner } from "./AutosaveIndicator";
import { FlagRealismButton } from "./FlagRealismButton";
import { QuestionView } from "./QuestionView";
import { useAttempt } from "@/lib/attempts/use-attempt";
import { useIntegrity } from "@/lib/attempts/use-integrity";
import { useNow } from "@/lib/attempts/use-now";
import { toServerPayload } from "@/lib/attempts/answer-payloads";
import {
  useAutosaveAttempt,
  useFlagRealism,
  type AttemptView,
  type TestResponse,
} from "@/lib/queries/attempts";
import { isAnswered } from "@/lib/attempts/answer-payloads";
import type { AnyPresentedQuestion } from "./questions/types";
import type { AnswerPayload } from "@/lib/attempts/answer-payloads";
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
  const attemptId = attempt.id;

  const questionIds = useMemo(
    () => presentedQuestions.map((q) => q.id),
    [presentedQuestions],
  );

  const autosaveMutation = useAutosaveAttempt(attemptId);
  const flagMutation = useFlagRealism(attemptId);

  const executeAutosave = useCallback(
    async (input: { questionId: string; payload: AnswerPayload; timeMs: number }) => {
      await autosaveMutation.mutateAsync({
        question_id: input.questionId,
        answer_payload: toServerPayload(input.payload),
        time_ms: input.timeMs,
      });
    },
    [autosaveMutation],
  );

  const runner = useAttempt({
    attemptId,
    questionIds,
    executeAutosave,
    initiallyPaused: attempt.paused,
  });

  const integrity = useIntegrity({ paused: runner.state.pauseState !== "active" });
  const nowMs = useNow({ paused: runner.state.pauseState !== "active" });
  const [flagInFlight, setFlagInFlight] = useState<string | null>(null);

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
    flagMutation.mutate(questionId, {
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
  }, [currentQuestion, flagInFlight, flagMutation, runner]);

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

  return (
    <AttemptShell userName={userName} attemptId={attemptId}>
      <AttemptHeaderBand
        pillName={pillName}
        difficulty={difficulty}
        questionCount={presentedQuestions.length}
        timed={test.timed}
        startedAtIso={attempt.started_at}
        durationMinutes={test.duration_minutes ?? null}
        paused={runner.state.pauseState !== "active"}
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
      />
      <AutosaveBanner visible={runner.state.autosaveBannerVisible} />
      {currentQuestion ? (
        <QuestionView
          question={currentQuestion}
          positionDisplay={runner.state.currentIndex + 1}
          total={presentedQuestions.length}
          answer={runner.state.answers.get(currentQuestion.id) ?? null}
          onAnswer={handleAnswer}
          disabled={runner.state.pauseState !== "active"}
          footer={
            <FlagRealismButton
              flagged={runner.state.flaggedQuestions.has(currentQuestion.id)}
              pending={flagInFlight === currentQuestion.id}
              onFlag={handleFlag}
            />
          }
        />
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
          disabled={runner.state.currentIndex === 0}
          onClick={goPrev}
        >
          ← Previous
        </Button>
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3">
          Question {runner.state.currentIndex + 1} / {presentedQuestions.length}
        </span>
        <Button
          variant="outline"
          size="sm"
          data-testid="attempt-next"
          disabled={runner.state.currentIndex >= presentedQuestions.length - 1}
          onClick={goNext}
        >
          Next →
        </Button>
      </nav>
    </AttemptShell>
  );
}
