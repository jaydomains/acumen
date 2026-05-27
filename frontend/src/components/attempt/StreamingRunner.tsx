"use client";

/**
 * StreamingRunner (FE-5 §B.1) — orchestrator for ``per_testee`` mode.
 *
 * Mirrors ``FrozenRunner``'s shape (same composition of
 * ``AttemptShell`` + ``AttemptHeaderBand`` + ``QuestionView`` +
 * ``SubmitConfirmModal`` + ``GradingOverlay``) and layers in:
 *
 *   - ``useStreamingQueue`` running alongside ``useAttempt``; the two
 *     hooks don't share a reducer, they coordinate via the cached
 *     ``AttemptView``'s ``paused`` / ``pause_reason`` flags (FE-5 §C.3).
 *   - The JIT queue sidebar (right rail, desktop-only via
 *     ``hidden md:flex``).
 *   - Pause-reason-branched overlay: ``pause_reason === null`` →
 *     FE-4's ``<PauseOverlay>``; non-null → ``<SystemGlitchOverlay>``.
 *     Server-side signal so a tab reload that lands on a system-paused
 *     attempt picks the right overlay without FE-side state.
 *
 * Slice-2 deviations from spec text (per build-session decisions):
 *
 *   - Total-question-count gap: spec assumes the FE knows N. Neither
 *     ``AttemptView`` nor ``TestResponse`` carries it in v1, so the
 *     runner derives the queue length from
 *     ``presentedQuestions.length`` and grows dynamically as SSE
 *     events trigger refetches. The "Q2..N generating" cards are
 *     compressed into a single "streaming…" pulse row at the foot of
 *     the queue while ``status === "streaming"``. Documented for
 *     handover.
 *   - Consequently ``ProgressDots`` is NOT extended with a
 *     ``generatingPastIdx`` prop in this slice — there's no
 *     known-ahead position set to mark as ``generating``.
 *   - ``streaming-bar`` ``@keyframes`` not added to ``globals.css``;
 *     the queue's pulse indicator uses Tailwind's built-in
 *     ``animate-pulse``.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AttemptHeaderBand } from "./AttemptHeaderBand";
import { AttemptShell } from "./AttemptShell";
import { AutosaveBanner } from "./AutosaveIndicator";
import { FlagRealismButton } from "./FlagRealismButton";
import { GradingOverlay } from "./GradingOverlay";
import { JITQueue } from "./JITQueue";
import { PauseOverlay } from "./PauseOverlay";
import { QuestionView } from "./QuestionView";
import { SubmitConfirmModal } from "./SubmitConfirmModal";
import { SystemGlitchOverlay } from "./SystemGlitchOverlay";
import { useAttempt } from "@/lib/attempts/use-attempt";
import { useIntegrity } from "@/lib/attempts/use-integrity";
import { useNow } from "@/lib/attempts/use-now";
import { useStreamingQueue } from "@/lib/attempts/use-streaming-queue";
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
import type { AutosaveState } from "@/lib/attempts/use-attempt";
import type { AnyPresentedQuestion } from "./questions/types";

export type StreamingRunnerProps = {
  attempt: AttemptView;
  test: TestResponse;
  presentedQuestions: AnyPresentedQuestion[];
  userName: string;
  pillName: string;
  difficulty: number | null;
};

const PAUSE_REASON_SYSTEM: ReadonlySet<string> = new Set(["generation_failed"]);

function isSystemPaused(attempt: AttemptView): boolean {
  return (
    attempt.paused === true &&
    typeof attempt.pause_reason === "string" &&
    PAUSE_REASON_SYSTEM.has(attempt.pause_reason)
  );
}

export function StreamingRunner({
  attempt,
  test,
  presentedQuestions,
  userName,
  pillName,
  difficulty,
}: StreamingRunnerProps) {
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

  // Stable refs so handler closures don't re-create on every render
  // (FrozenRunner precedent).
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

  const localPaused = runner.state.pauseState !== "active";
  const serverPaused = attempt.paused === true;
  const submitted = attempt.submitted_at !== null;
  // SSE is open only while the attempt is actively running — no
  // server-pause, no user-pause, not submitted.
  const streamEnabled = !serverPaused && !submitted && !localPaused;

  const stream = useStreamingQueue({
    attemptId,
    enabled: streamEnabled,
    initialArrivedIdx: Math.max(1, presentedQuestions.length),
  });

  const integrity = useIntegrity({ paused: localPaused });
  const nowMs = useNow({ paused: localPaused });
  const [flagInFlight, setFlagInFlight] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [graded, setGraded] = useState(false);

  const currentQuestion = presentedQuestions[runner.state.currentIndex];
  const outrunBuffer =
    runner.state.currentIndex >= presentedQuestions.length && stream.status !== "done";

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
    if (localPaused) return;
    runner.pauseStart();
    pauseRef.current.mutate(undefined, {
      onSuccess: () => {
        runner.pauseSuccess();
        // Refresh view so ``paused: true`` flips, which in turn flips
        // ``streamEnabled`` to false on the next render and closes the
        // SSE adapter via the hook's cleanup.
        queryClient.invalidateQueries({
          queryKey: attemptQueryKeys.detail(attemptId),
        });
      },
      onError: (err) => {
        const code = err instanceof ApiError ? err.code : null;
        toast.error("Couldn't pause — try again", {
          ...(code ? { description: `(${code})` } : {}),
        });
        runner.resumeSuccess();
      },
    });
  }, [localPaused, runner, queryClient, attemptId]);

  const handleUserResume = useCallback(() => {
    if (!localPaused) return;
    runner.resumeStart();
    resumeRef.current.mutate(undefined, {
      onSuccess: () => {
        runner.resumeSuccess();
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
  }, [localPaused, runner, queryClient, attemptId]);

  // System-glitch resume — branches by reason. ``generation_failed``
  // calls POST /resume (backend marked the attempt paused);
  // ``reconnect_exhausted`` is FE-synthetic, so we only re-open the
  // SSE stream (the attempt was never server-paused).
  const handleSystemResume = useCallback(() => {
    if (stream.pausedReason === "generation_failed") {
      resumeRef.current.mutate(undefined, {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: attemptQueryKeys.detail(attemptId),
          });
          stream.reconnect();
        },
        onError: (err) => {
          const code = err instanceof ApiError ? err.code : null;
          toast.error("Couldn't resume — try again", {
            ...(code ? { description: `(${code})` } : {}),
          });
        },
      });
    } else if (stream.pausedReason === "reconnect_exhausted") {
      stream.reconnect();
    }
  }, [stream, queryClient, attemptId]);

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
    if (runner.state.currentIndex < presentedQuestions.length - 1 && !outrunBuffer) {
      runner.advanceTo(runner.state.currentIndex + 1);
    }
  }, [runner, presentedQuestions.length, outrunBuffer]);

  // ``stream.status === "error"`` (e.g. 409 ``not_per_testee`` on a
  // routing bug) surfaces as a sonner toast once; the runner falls
  // back to non-streaming (questions[] is still rendered). No second
  // connect — the adapter already exhausted its retry budget.
  const surfacedErrorRef = useRef(false);
  useEffect(() => {
    if (stream.status === "error" && !surfacedErrorRef.current) {
      surfacedErrorRef.current = true;
      const code = stream.error instanceof ApiError ? stream.error.code : "unknown";
      toast.error("Streaming unavailable for this attempt", {
        description: `(${code})`,
      });
    }
  }, [stream.status, stream.error]);

  const remainingMinutes =
    attempt.pause_seconds_remaining != null
      ? Math.max(0, Math.ceil(attempt.pause_seconds_remaining / 60))
      : (test.max_pause_duration_minutes ?? null);

  const answeredCount = answeredIds.size;
  const totalCount = presentedQuestions.length;

  const showSystemOverlay = isSystemPaused(attempt) || stream.status === "paused";

  // Pause overlay choice: server-side ``pause_reason`` wins over the
  // FE-synthetic. If both fire (e.g. backend paused + adapter died),
  // the server signal takes precedence.
  const systemReason = isSystemPaused(attempt)
    ? "generation_failed"
    : stream.pausedReason;

  return (
    <AttemptShell userName={userName} attemptId={attemptId}>
      <AttemptHeaderBand
        pillName={pillName}
        difficulty={difficulty}
        questionCount={totalCount}
        timed={test.timed}
        startedAtIso={attempt.started_at}
        durationMinutes={test.duration_minutes ?? null}
        paused={localPaused}
        nowMs={nowMs}
        tabSwitches={integrity.tabSwitches}
        autosaveState={autosaveState}
        autosaveAt={autosaveAt}
        autosaveRetries={autosaveRetries}
        questionIds={questionIds}
        currentIndex={runner.state.currentIndex}
        answeredQuestionIds={answeredIds}
        jumpEnabled
        onJump={(idx) => {
          if (idx < presentedQuestions.length) runner.advanceTo(idx);
        }}
        onExit={handleExit}
        onPause={handlePause}
        onResume={handleUserResume}
        pausePending={pauseMutation.isPending || resumeMutation.isPending}
      />
      <AutosaveBanner visible={runner.state.autosaveBannerVisible} />
      <div className="flex gap-6">
        <div className="flex flex-1 flex-col gap-4">
          {outrunBuffer ? (
            <div
              data-testid="streaming-outrun-buffer"
              className="flex flex-col gap-3 border border-line bg-bg-raised p-6"
            >
              <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-3">
                Preparing next question…
              </span>
              <Skeleton className="h-[180px] w-full" />
              <p className="text-[13px] leading-5 text-ink-3">
                Your next question is still being generated. Sit tight — it arrives as
                soon as the buffer catches up.
              </p>
            </div>
          ) : currentQuestion ? (
            <div style={{ visibility: localPaused ? "hidden" : "visible" }}>
              <QuestionView
                question={currentQuestion}
                positionDisplay={runner.state.currentIndex + 1}
                total={totalCount}
                answer={runner.state.answers.get(currentQuestion.id) ?? null}
                onAnswer={handleAnswer}
                disabled={localPaused}
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
              disabled={runner.state.currentIndex === 0 || localPaused}
              onClick={goPrev}
            >
              ← Previous
            </Button>
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3">
              Question {runner.state.currentIndex + 1} / {totalCount}
            </span>
            {stream.status === "done" && runner.state.currentIndex >= totalCount - 1 ? (
              <Button
                size="sm"
                data-testid="attempt-submit"
                disabled={localPaused || submitMutation.isPending}
                onClick={handleOpenSubmit}
              >
                Submit attempt →
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                data-testid="attempt-next"
                disabled={
                  localPaused ||
                  outrunBuffer ||
                  runner.state.currentIndex >= presentedQuestions.length - 1
                }
                onClick={goNext}
              >
                Next →
              </Button>
            )}
          </nav>
        </div>
        <JITQueue
          questionIds={questionIds}
          currentIndex={runner.state.currentIndex}
          arrivedIdx={stream.arrivedIdx}
          answeredQuestionIds={answeredIds}
          status={stream.status}
          onPick={(idx) => {
            if (idx < presentedQuestions.length) runner.advanceTo(idx);
          }}
        />
      </div>
      {/* Pause overlays: system-glitch wins precedence over user-pause
          when both signals are live (a backend pause_reason persists
          across a route reload; the FE-synthetic only lives in the
          hook's state). */}
      {showSystemOverlay && systemReason !== null ? (
        <SystemGlitchOverlay
          reason={systemReason}
          failedPosition={stream.failedPosition}
          completedPositions={[]}
          resuming={resumeMutation.isPending}
          onResume={handleSystemResume}
        />
      ) : localPaused ? (
        <PauseOverlay
          remainingMinutes={remainingMinutes}
          onResume={handleUserResume}
          resumePending={resumeMutation.isPending}
        />
      ) : null}
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
