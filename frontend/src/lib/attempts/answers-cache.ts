/**
 * Per-attempt localStorage answers cache (FE-4 R-a; plan-mode locked).
 *
 * Backend AttemptView omits `response.answer_payload` (verified
 * `app/domain/attempts.py:891` builds questions[] via _present_one()
 * without any per-question response surface). On a tab reload mid-
 * attempt the FE would otherwise lose the testee's prior answers.
 *
 * R-a fallback: cache answers in localStorage under
 *   acumen.attempts.<attemptId>.answers
 * Rehydrate on mount, write on every set-answer action, clear on
 * submit-success. Single-device, same posture as the
 * `acumen.attempts.inflight` resume-prompt bridge.
 *
 * Cross-device durable hydration is a v1.x backend follow-up
 * (`response_payload` on AttemptView.questions[]).
 *
 * Note: setItem can throw QuotaExceededError in private-browsing tabs
 * or when storage is full. Failures are swallowed so the FE never
 * crashes on a hostile storage environment — losing a save round-
 * trip is acceptable; crashing the attempt is not.
 */

import { isAnswerPayload, type AnswerPayload } from "./answer-payloads";

const KEY_PREFIX = "acumen.attempts.";
const KEY_SUFFIX = ".answers";

function keyFor(attemptId: string): string {
  return `${KEY_PREFIX}${attemptId}${KEY_SUFFIX}`;
}

function safeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Read the cached `Map<questionId, AnswerPayload>` for an attempt.
 * Returns an empty Map on miss / parse-error / type-guard failure.
 * Type-guard rejects rather than silently passing malformed entries
 * — a corrupted cache entry should not poison the reducer.
 */
export function loadAnswers(attemptId: string): Map<string, AnswerPayload> {
  const out = new Map<string, AnswerPayload>();
  const storage = safeStorage();
  if (!storage) return out;
  const raw = storage.getItem(keyFor(attemptId));
  if (!raw) return out;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return out;
  }
  if (!parsed || typeof parsed !== "object") return out;
  for (const [questionId, payload] of Object.entries(parsed)) {
    if (isAnswerPayload(payload)) {
      out.set(questionId, payload);
    }
  }
  return out;
}

/** Replace the cached answers for an attempt with the given Map. */
export function saveAnswers(
  attemptId: string,
  answers: Map<string, AnswerPayload>,
): void {
  const storage = safeStorage();
  if (!storage) return;
  const obj: Record<string, AnswerPayload> = {};
  for (const [questionId, payload] of answers) {
    obj[questionId] = payload;
  }
  try {
    storage.setItem(keyFor(attemptId), JSON.stringify(obj));
  } catch {
    // Quota / private-browsing failures swallowed (see header).
  }
}

/** Remove the cache key for the given attempt (post-submit). */
export function clearAnswers(attemptId: string): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(keyFor(attemptId));
  } catch {
    // ignore
  }
}
