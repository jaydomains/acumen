"use client";

/**
 * `useAttempt` — the runner reducer (FE-4 §B.1 §2 / §C.3).
 *
 * Owns interactive state that survives across question navigation:
 *   - `currentIndex` — which question is on screen
 *   - `answers` — `Map<questionId, AnswerPayload>`; reducer is the
 *     single source of truth, NOT the per-component local state
 *   - `flaggedQuestions` — `Set<questionId>`; write-only seed in v1
 *     (backend doesn't surface `realism_flagged_by_me` per drift item
 *     7; clicked-flagged is in-memory until reload)
 *   - `autosaveStates` — per-question status (idle / saving / saved /
 *     failed); UI subscribes for the AutosaveIndicator
 *   - `pauseState` — local mirror of the server-side paused flag
 *     (`pausing` / `paused` / `resuming` / `active`)
 *
 * Autosave queue + debounce:
 *   - On `set-answer`, the per-question timer resets (clearTimeout +
 *     setTimeout). The default debounce is 600 ms per `attempt-
 *     variants.jsx:382–389`.
 *   - When the timer fires, the mutation kicks. While in flight,
 *     subsequent `set-answer` actions for the same question queue
 *     the latest payload — on resolve, if the queue holds a newer
 *     payload, fire again immediately. (Last-write-wins.)
 *   - On failure, retry with exponential backoff (2s / 4s / 8s).
 *     After the 4th consecutive failure, the persistent banner
 *     fires (state: `failed`); the queue stays so the next manual
 *     interaction (any set-answer or pause/resume) starts a fresh
 *     attempt run.
 *
 * The reducer **does NOT own** the mutation — it owns the queue +
 * timers. The page wires the mutation through a callback the
 * reducer fires. Keeps the reducer pure(ish) and testable without
 * `QueryClientProvider`.
 *
 * On `set-answer`, the answers Map is also persisted to localStorage
 * via `answers-cache.ts` (plan-mode R-a). On submit-success or
 * explicit `clear`, the cache key is removed.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { clearAnswers, loadAnswers, saveAnswers } from "./answers-cache";
import type { AnswerPayload } from "./answer-payloads";

export type AutosaveState = "idle" | "saving" | "saved" | "failed";
export type PauseState = "active" | "pausing" | "paused" | "resuming";

export type AttemptReducerState = {
  currentIndex: number;
  answers: Map<string, AnswerPayload>;
  flaggedQuestions: Set<string>;
  autosaveStates: Map<string, AutosaveState>;
  /**
   * Wall-clock ms of last successful autosave per question. Used for
   * the "Saved Ns ago" copy in the AutosaveIndicator (slice 1 emits
   * the timestamp; the indicator's relative-time formatter ticks on
   * `useNow`).
   */
  autosaveAt: Map<string, number>;
  /**
   * Per-question consecutive-failure counter; resets on the next
   * successful autosave. 3 → exponential retry; 4 → persistent
   * banner via `autosaveBannerVisible`.
   */
  autosaveRetries: Map<string, number>;
  autosaveBannerVisible: boolean;
  pauseState: PauseState;
};

export type AttemptReducerAction =
  | { type: "hydrate"; questionIds: string[]; cachedAnswers: Map<string, AnswerPayload> }
  | { type: "advance-to"; index: number }
  | { type: "set-answer"; questionId: string; payload: AnswerPayload }
  | { type: "autosave-start"; questionId: string }
  | { type: "autosave-success"; questionId: string; at: number }
  | { type: "autosave-failure"; questionId: string }
  | { type: "pause-start" }
  | { type: "pause-success" }
  | { type: "resume-start" }
  | { type: "resume-success" }
  | { type: "flag-realism"; questionId: string }
  | { type: "clear" };

const RETRY_THRESHOLD = 3;

function copyMap<K, V>(m: Map<K, V>): Map<K, V> {
  return new Map(m);
}
function copySet<T>(s: Set<T>): Set<T> {
  return new Set(s);
}

export function attemptReducer(
  state: AttemptReducerState,
  action: AttemptReducerAction,
): AttemptReducerState {
  switch (action.type) {
    case "hydrate": {
      const answers = new Map<string, AnswerPayload>();
      for (const qid of action.questionIds) {
        const cached = action.cachedAnswers.get(qid);
        if (cached) answers.set(qid, cached);
      }
      return {
        ...state,
        answers,
        flaggedQuestions: new Set(),
        autosaveStates: new Map(),
        autosaveAt: new Map(),
        autosaveRetries: new Map(),
        autosaveBannerVisible: false,
      };
    }
    case "advance-to": {
      const next = Math.max(0, action.index);
      return { ...state, currentIndex: next };
    }
    case "set-answer": {
      const answers = copyMap(state.answers);
      answers.set(action.questionId, action.payload);
      return { ...state, answers };
    }
    case "autosave-start": {
      const autosaveStates = copyMap(state.autosaveStates);
      autosaveStates.set(action.questionId, "saving");
      return { ...state, autosaveStates };
    }
    case "autosave-success": {
      const autosaveStates = copyMap(state.autosaveStates);
      autosaveStates.set(action.questionId, "saved");
      const autosaveAt = copyMap(state.autosaveAt);
      autosaveAt.set(action.questionId, action.at);
      const autosaveRetries = copyMap(state.autosaveRetries);
      autosaveRetries.set(action.questionId, 0);
      return {
        ...state,
        autosaveStates,
        autosaveAt,
        autosaveRetries,
        autosaveBannerVisible: false,
      };
    }
    case "autosave-failure": {
      const autosaveStates = copyMap(state.autosaveStates);
      autosaveStates.set(action.questionId, "failed");
      const autosaveRetries = copyMap(state.autosaveRetries);
      const next = (autosaveRetries.get(action.questionId) ?? 0) + 1;
      autosaveRetries.set(action.questionId, next);
      return {
        ...state,
        autosaveStates,
        autosaveRetries,
        autosaveBannerVisible: next > RETRY_THRESHOLD,
      };
    }
    case "pause-start":
      return { ...state, pauseState: "pausing" };
    case "pause-success":
      return { ...state, pauseState: "paused" };
    case "resume-start":
      return { ...state, pauseState: "resuming" };
    case "resume-success":
      return { ...state, pauseState: "active" };
    case "flag-realism": {
      const flagged = copySet(state.flaggedQuestions);
      flagged.add(action.questionId);
      return { ...state, flaggedQuestions: flagged };
    }
    case "clear":
      return initialReducerState();
  }
}

export function initialReducerState(): AttemptReducerState {
  return {
    currentIndex: 0,
    answers: new Map(),
    flaggedQuestions: new Set(),
    autosaveStates: new Map(),
    autosaveAt: new Map(),
    autosaveRetries: new Map(),
    autosaveBannerVisible: false,
    pauseState: "active",
  };
}

export type AutosaveExecutor = (input: {
  questionId: string;
  payload: AnswerPayload;
  timeMs: number;
}) => Promise<void>;

export type UseAttemptOptions = {
  attemptId: string;
  questionIds: string[];
  /** Caller-supplied mutation runner; the reducer doesn't depend on
   * react-query. Must throw on backend failure so the queue can
   * recognise it. */
  executeAutosave: AutosaveExecutor;
  /** Override for tests. */
  debounceMs?: number;
  /** Override for tests; production uses 2000 / 4000 / 8000 ms. */
  retryDelaysMs?: number[];
  initiallyPaused?: boolean;
};

const DEFAULT_DEBOUNCE_MS = 600;
const DEFAULT_RETRY_DELAYS_MS = [2000, 4000, 8000];

export type UseAttemptApi = {
  state: AttemptReducerState;
  setAnswer: (questionId: string, payload: AnswerPayload) => void;
  advanceTo: (index: number) => void;
  flagRealism: (questionId: string) => void;
  pauseStart: () => void;
  pauseSuccess: () => void;
  resumeStart: () => void;
  resumeSuccess: () => void;
  /**
   * Clear reducer state + drop the localStorage answer cache.
   * Fires on submit-success.
   */
  clearAfterSubmit: () => void;
  /**
   * For tests only — drain any pending autosave timers synchronously.
   * Production callers should not depend on flushing; the reducer is
   * eventually-consistent.
   */
  flushAutosavesForTest: () => Promise<void>;
};

export function useAttempt(opts: UseAttemptOptions): UseAttemptApi {
  const {
    attemptId,
    questionIds,
    executeAutosave,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
    initiallyPaused = false,
  } = opts;

  const [state, dispatch] = useReducer(attemptReducer, undefined, () => {
    const seed = initialReducerState();
    seed.pauseState = initiallyPaused ? "paused" : "active";
    return seed;
  });

  // Per-question debounce timers + retry timers. Refs (not state) so
  // they don't trigger re-renders and survive React 18 strict-mode
  // double-invocation in effects.
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const retryTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const inFlight = useRef<Set<string>>(new Set());
  const pendingNext = useRef<Map<string, { payload: AnswerPayload; startedAt: number }>>(
    new Map(),
  );
  const answerStartedAt = useRef<Map<string, number>>(new Map());
  const hydratedRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Hydrate from cache on first mount when questionIds is non-empty.
  // Re-hydrate if `attemptId` changes (defensive — the runner page
  // doesn't change attempt mid-mount). Once `clearAfterSubmit` has
  // fired, never re-hydrate — the cache was deliberately dropped.
  useEffect(() => {
    if (hydratedRef.current || questionIds.length === 0 || cleared.current) return;
    const cached = loadAnswers(attemptId);
    dispatch({ type: "hydrate", questionIds, cachedAnswers: cached });
    hydratedRef.current = true;
  }, [attemptId, questionIds]);

  // Persist on every answers change. Skip the write when the reducer
  // was cleared by submit — the cache key was already removed.
  useEffect(() => {
    if (!hydratedRef.current || cleared.current) return;
    saveAnswers(attemptId, state.answers);
  }, [attemptId, state.answers]);

  // Cleanup all timers on unmount. Capture the ref maps inside the
  // effect so the lint's "ref will likely have changed" warning
  // doesn't fire — the maps are stable across renders, but it's good
  // discipline to capture them once on mount.
  useEffect(() => {
    const debounceMap = debounceTimers.current;
    const retryMap = retryTimers.current;
    return () => {
      for (const t of debounceMap.values()) clearTimeout(t);
      for (const t of retryMap.values()) clearTimeout(t);
      debounceMap.clear();
      retryMap.clear();
    };
  }, []);

  const runAutosave = useCallback(
    async (questionId: string, payload: AnswerPayload, startedAt: number) => {
      if (inFlight.current.has(questionId)) {
        pendingNext.current.set(questionId, { payload, startedAt });
        return;
      }
      inFlight.current.add(questionId);
      dispatch({ type: "autosave-start", questionId });
      const timeMs = Math.max(0, Date.now() - startedAt);
      try {
        await executeAutosave({ questionId, payload, timeMs });
        dispatch({ type: "autosave-success", questionId, at: Date.now() });
      } catch {
        const previousRetries = stateRef.current.autosaveRetries.get(questionId) ?? 0;
        dispatch({ type: "autosave-failure", questionId });
        const retryIndex = previousRetries;
        const delay = retryDelaysMs[retryIndex];
        if (typeof delay === "number") {
          const t = setTimeout(() => {
            retryTimers.current.delete(questionId);
            void runAutosave(questionId, payload, startedAt);
          }, delay);
          retryTimers.current.set(questionId, t);
        }
      } finally {
        inFlight.current.delete(questionId);
        const queued = pendingNext.current.get(questionId);
        if (queued) {
          pendingNext.current.delete(questionId);
          void runAutosave(questionId, queued.payload, queued.startedAt);
        }
      }
    },
    [executeAutosave, retryDelaysMs],
  );

  const scheduleAutosave = useCallback(
    (questionId: string, payload: AnswerPayload) => {
      const existing = debounceTimers.current.get(questionId);
      if (existing) clearTimeout(existing);
      if (!answerStartedAt.current.has(questionId)) {
        answerStartedAt.current.set(questionId, Date.now());
      }
      const t = setTimeout(() => {
        debounceTimers.current.delete(questionId);
        const startedAt = answerStartedAt.current.get(questionId) ?? Date.now();
        void runAutosave(questionId, payload, startedAt);
      }, debounceMs);
      debounceTimers.current.set(questionId, t);
    },
    [debounceMs, runAutosave],
  );

  const setAnswer = useCallback(
    (questionId: string, payload: AnswerPayload) => {
      dispatch({ type: "set-answer", questionId, payload });
      // Don't fire autosave while paused — server endpoint rejects
      // mutations on a paused attempt and the queue would just rot.
      if (stateRef.current.pauseState !== "active") return;
      scheduleAutosave(questionId, payload);
    },
    [scheduleAutosave],
  );

  const advanceTo = useCallback((index: number) => {
    dispatch({ type: "advance-to", index });
  }, []);

  const flagRealism = useCallback((questionId: string) => {
    dispatch({ type: "flag-realism", questionId });
  }, []);

  const pauseStart = useCallback(() => dispatch({ type: "pause-start" }), []);
  const pauseSuccess = useCallback(() => dispatch({ type: "pause-success" }), []);
  const resumeStart = useCallback(() => dispatch({ type: "resume-start" }), []);
  const resumeSuccess = useCallback(() => dispatch({ type: "resume-success" }), []);

  const cleared = useRef(false);

  const clearAfterSubmit = useCallback(() => {
    for (const t of debounceTimers.current.values()) clearTimeout(t);
    for (const t of retryTimers.current.values()) clearTimeout(t);
    debounceTimers.current.clear();
    retryTimers.current.clear();
    inFlight.current.clear();
    pendingNext.current.clear();
    answerStartedAt.current.clear();
    // `cleared` gates the saveAnswers effect — we don't re-write the
    // freshly-cleared key when the reducer drops back to empty state,
    // and we don't re-hydrate (which would resurrect the cache).
    cleared.current = true;
    clearAnswers(attemptId);
    dispatch({ type: "clear" });
  }, [attemptId]);

  const flushAutosavesForTest = useCallback(async () => {
    const timers = Array.from(debounceTimers.current.entries());
    for (const [, t] of timers) clearTimeout(t);
    debounceTimers.current.clear();
    for (const [questionId] of timers) {
      const payload = stateRef.current.answers.get(questionId);
      if (!payload) continue;
      const startedAt = answerStartedAt.current.get(questionId) ?? Date.now();
      await runAutosave(questionId, payload, startedAt);
    }
  }, [runAutosave]);

  return useMemo(
    () => ({
      state,
      setAnswer,
      advanceTo,
      flagRealism,
      pauseStart,
      pauseSuccess,
      resumeStart,
      resumeSuccess,
      clearAfterSubmit,
      flushAutosavesForTest,
    }),
    [
      state,
      setAnswer,
      advanceTo,
      flagRealism,
      pauseStart,
      pauseSuccess,
      resumeStart,
      resumeSuccess,
      clearAfterSubmit,
      flushAutosavesForTest,
    ],
  );
}
