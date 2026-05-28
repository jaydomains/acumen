/**
 * Me-domain query keys + hooks (FE-3 §B.5; FE-7 §B.1 §4, §B.2 §4; AC-CD21).
 *
 * Key roots locked at FE-3; hooks land as endpoints come online.
 * FE-7 wires the first-class consumers of `competence()` and
 * `attempts()`.
 *
 * Per AC-CD21 + the FE-3 §B.5 §7 reviewer rule: page files MUST consume
 * hooks + keys from this module; no inline key construction.
 */

import { useInfiniteQuery, useQuery, type InfiniteData } from "@tanstack/react-query";
import { client, unwrap } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

export const meQueryKeys = {
  all: ["me"] as const,
  competence: () => [...meQueryKeys.all, "competence"] as const,
  assignments: () => [...meQueryKeys.all, "assignments"] as const,
  attempts: () => [...meQueryKeys.all, "attempts"] as const,
};

export type MeCompetenceResponse = components["schemas"]["MeCompetenceResponse"];
export type MeCompetencePill = components["schemas"]["MeCompetencePill"];
export type AttemptListItem = components["schemas"]["AttemptListItem"];
export type AttemptsPage = components["schemas"]["Page_AttemptListItem_"];

const HISTORY_PAGE_SIZE = 50;
/** Profile-page sparkline ceiling: enough recent attempts to derive
 *  per-pill trails without paginating. ~6 months of typical activity. */
const PROFILE_ATTEMPTS_CAP = 200;

/**
 * Testee's per-pill competency snapshot — drives the constellation,
 * matrix, legend, hero pill-count, and the selected-pill detail card.
 *
 * Per LOCK-2, the wire excludes rows where `competence_estimate IS NULL`
 * (filtered at `app/domain/competence.py`), so render paths can read
 * `pill.competence_estimate` directly without null-guards.
 */
export function useMeCompetence() {
  return useQuery({
    queryKey: meQueryKeys.competence(),
    queryFn: () => unwrap(client.GET("/v1/me/competence")),
  });
}

/**
 * Cursor-paginated history — `useInfiniteQuery` consuming the canonical
 * `Page<AttemptListItem>` envelope per LOCK-1. The `"infinite"`
 * discriminator + `{limit}` sub-key keep this entry distinct from the
 * one-shot capped entry below regardless of what `limit` either caller
 * passes — TanStack stores InfiniteData under one key and a flat page
 * under another, so a discriminator-only collision would be a runtime
 * type mismatch.
 */
export function useMeAttemptsInfinite(limit: number = HISTORY_PAGE_SIZE) {
  return useInfiniteQuery({
    queryKey: [...meQueryKeys.attempts(), "infinite", { limit }],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      unwrap(
        client.GET("/v1/attempts", {
          params: { query: { cursor: pageParam ?? null, limit } },
        }),
      ),
    // `?? undefined` so a null next_cursor stops the paginator cleanly;
    // returning `null` would re-trigger with literal null and 422.
    getNextPageParam: (last) => last.meta.next_cursor ?? undefined,
  });
}

/**
 * Cap-only fetch for the profile-page sparkline derivation
 * (`derive-sparkline.ts` consumes the cached row array). One page; no
 * pagination affordance on `/profile`. `"capped"` discriminator keeps
 * this entry from colliding with the paginator above regardless of the
 * limit value either caller passes.
 */
export function useMeAttemptsCapped(limit: number = PROFILE_ATTEMPTS_CAP) {
  return useQuery({
    queryKey: [...meQueryKeys.attempts(), "capped", { limit }],
    queryFn: () =>
      unwrap(
        client.GET("/v1/attempts", {
          params: { query: { cursor: null, limit } },
        }),
      ),
  });
}

/** Flatten infinite pages → single row array. */
export function flattenAttempts(
  data: InfiniteData<AttemptsPage> | undefined,
): AttemptListItem[] {
  if (!data) return [];
  return data.pages.flatMap((p) => p.data);
}
