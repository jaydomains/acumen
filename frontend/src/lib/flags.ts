/**
 * Project feature flags.
 *
 * Tiny in-process flag map. Reading a flag is a synchronous property
 * access — no provider, no runtime config dependency. New flags land
 * here, not scattered through `process.env` lookups.
 *
 * The map is empty: `recentAttemptsWidget` (FE-3 ship-off gate) was
 * flipped and removed once `GET /v1/attempts` landed in FE-7. Future
 * flags add new keys here.
 */

export const flags = {} as const;

export type FeatureFlag = keyof typeof flags;
