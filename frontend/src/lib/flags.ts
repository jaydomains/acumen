/**
 * Project feature flags (FE-3 §F.4, §C.8).
 *
 * Tiny in-process flag map. Reading a flag is a synchronous property
 * access — no provider, no runtime config dependency. New flags land
 * here, not scattered through `process.env` lookups.
 *
 * `recentAttemptsWidget` ships off in v1 because `GET /v1/me/attempts`
 * is not in the schema yet (FE_ROADMAP FE-3 done-when). Flip when the
 * endpoint lands.
 */

export const flags = {
  recentAttemptsWidget: false,
} as const;

export type FeatureFlag = keyof typeof flags;
