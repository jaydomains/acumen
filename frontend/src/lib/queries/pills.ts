/**
 * Pill query keys + hooks (FE-3 §B.5, §C.6; AC-CD21).
 *
 * `pillQueryKeys.detail(id)` produces `['pills', id]`;
 * `pillQueryKeys.learningMaterial(id)` produces
 * `['pills', id, 'learning-material']`. Invalidating
 * `detail(id)` prefix-matches both — desired (FE-3 §B.5 Gherkin).
 *
 * ## POST-as-page-load-fetch exception (FE-3 §C.6, §B.3.7)
 *
 * `useLearningMaterial` calls `POST /v1/pills/{id}/learning-material`
 * via `useQuery` (not `useMutation`). This is an INTENTIONAL deviation
 * from the project default ("GET = useQuery, POST = useMutation").
 *
 * Rationale: the backend treats this POST as cache-by-default + a
 * `cached: boolean` flag in the response; `regenerate=true` is the
 * explicit invalidation knob. Using `useQuery` gets TanStack's
 * dedupe + cache + retry semantics for free. Slice 2 will land the
 * actual hook; the keys land here in Slice 1 so MSW handlers and
 * other slices can reference the convention.
 *
 * NOTE: per AC-CD21 default `retry: false`. The learning-material
 * query overrides to `retry: 1` (a failing POST on first paint must
 * not leave a permanent loading state). Pattern-A inline retry stays.
 *
 * No other FE-3 endpoint uses POST-as-useQuery; FE-4+ defaults back
 * to GET-only `useQuery`. Surface as a spec-clarification if you
 * find yourself reaching for this exception elsewhere.
 */

import type { components } from "@/lib/api/types";

export type PillResponse = components["schemas"]["PillResponse"];
export type LearningMaterialResponse = components["schemas"]["LearningMaterialResponse"];
export type SafetyLinkResponse = components["schemas"]["SafetyLinkResponse"];

export const pillQueryKeys = {
  all: ["pills"] as const,
  detail: (id: string) => [...pillQueryKeys.all, id] as const,
  learningMaterial: (id: string) =>
    [...pillQueryKeys.detail(id), "learning-material"] as const,
};

/**
 * Narrow the polymorphic `LearningMaterialResponse` by `source`.
 *
 * The generated `source` type is plain `string` (FastAPI didn't emit
 * a discriminator), so openapi-typescript can't narrow on it. This
 * helper produces a proper discriminated union and throws on
 * contract violations (e.g. `ai_generated` without `content`) — we'd
 * rather fail loudly in dev/test than render a half-blank panel.
 */
export type NarrowedMaterial =
  | {
      kind: "ai";
      content: string;
      served_at: string | null;
      cached: boolean;
    }
  | {
      kind: "safety";
      links: SafetyLinkResponse[];
      served_at: string | null;
      cached: boolean;
    };

export function narrowMaterial(m: LearningMaterialResponse): NarrowedMaterial {
  const common = { served_at: m.served_at, cached: m.cached } as const;
  if (m.source === "ai_generated") {
    if (typeof m.content !== "string") {
      throw new Error(
        `LearningMaterialResponse: source='ai_generated' missing content (pill_id=${m.pill_id})`,
      );
    }
    return { kind: "ai", content: m.content, ...common };
  }
  if (m.source === "curated_safety_links") {
    return {
      kind: "safety",
      links: m.safety_links ?? [],
      ...common,
    };
  }
  throw new Error(
    `LearningMaterialResponse: unknown source='${m.source}' (pill_id=${m.pill_id})`,
  );
}
