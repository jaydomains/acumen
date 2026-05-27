"use client";

/**
 * Resume-prompt detection (FE-4 §B.3).
 *
 * v1 single-device only: reads `localStorage["acumen.attempts.inflight"]`
 * which the pill-CTA writes on a successful `POST /v1/attempts`. If
 * present, fetches `GET /v1/attempts/<uuid>`; surfaces "resumable"
 * when `submitted_at === null` and the test is not the FE-5-pending
 * per_testee mode (per_testee streams are out of scope for the
 * non-streaming resume prompt). Cleared silently on stale / error /
 * unsupported-mode.
 *
 * Cross-device durable resume waits on `GET /v1/attempts` consumption
 * (FE-7 territory; the endpoint exists but the resume-prompt design
 * stays single-device per spec §E #4).
 */

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { client, unwrap } from "@/lib/api/client";
import { attemptQueryKeys, type AttemptView } from "@/lib/queries/attempts";

const INFLIGHT_KEY = "acumen.attempts.inflight";

export function setInflightAttemptId(attemptId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INFLIGHT_KEY, attemptId);
  } catch {
    // ignore (private browsing / quota)
  }
}

export function clearInflightAttemptId(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(INFLIGHT_KEY);
  } catch {
    // ignore
  }
}

export function readInflightAttemptId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(INFLIGHT_KEY);
  } catch {
    return null;
  }
}

export type ResumeDetectionResult =
  | { status: "none"; discard: () => void }
  | { status: "loading"; discard: () => void }
  | { status: "resumable"; attempt: AttemptView; discard: () => void };

export function useResumeDetection(): ResumeDetectionResult {
  // Track the inflightId in React state so callers can clear it
  // (Discard click) and see the prompt unmount in the same render
  // cycle. Localstorage is the source of truth; this state is the
  // React mirror.
  const [inflightId, setInflightId] = useState<string | null>(() =>
    readInflightAttemptId(),
  );

  const discard = useCallback(() => {
    clearInflightAttemptId();
    setInflightId(null);
  }, []);

  const query = useQuery({
    queryKey: inflightId
      ? attemptQueryKeys.detail(inflightId)
      : (["attempts", "__noop"] as const),
    queryFn: async () => {
      if (!inflightId) throw new Error("inflightId required");
      return unwrap(
        client.GET("/v1/attempts/{attempt_id}", {
          params: { path: { attempt_id: inflightId } },
        }),
      );
    },
    enabled: Boolean(inflightId),
    retry: false,
    staleTime: 30_000,
  });

  // Stale / error → silently clear so the modal doesn't re-trigger on
  // the next dashboard mount. This effect intentionally runs on every
  // settle (not just isError) because a submitted attempt is the same
  // "stale" signal — both should drop the key.
  useEffect(() => {
    if (!inflightId) return;
    if (query.isError) {
      discard();
      return;
    }
    if (query.isSuccess && query.data?.submitted_at != null) {
      discard();
    }
  }, [inflightId, query.isError, query.isSuccess, query.data?.submitted_at, discard]);

  if (!inflightId) return { status: "none", discard };
  if (query.isPending) return { status: "loading", discard };
  if (query.isError) return { status: "none", discard };
  const attempt = query.data;
  if (!attempt || attempt.submitted_at != null) {
    return { status: "none", discard };
  }
  return { status: "resumable", attempt, discard };
}
