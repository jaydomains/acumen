/**
 * confidence-qualifier — defensive fallback for the AC-D20 calibration
 * confidence enum (FE-7 §C.4, §E.4).
 *
 * The wire `GET /v1/me/competence` response carries the server-resolved
 * `confidence` enum (computed against
 * `system_settings.anchor_calibration_confidence_threshold`, default 20)
 * per FE-7-profile.md §B.1 §3. This helper is only invoked when a caller
 * has a raw `n` without the enum (e.g. a derived row from the attempt
 * cache used during deep-link prototypes, or a defensive recovery path).
 * In production against the live endpoint, the helper does not run.
 *
 * Threshold is hardcoded at 20 to match AC-D20 default per `DECISIONS.md`.
 * If System Settings ever exposes a different value via the response,
 * the call site should consume the enum directly instead of falling
 * through to this helper.
 */

export type Confidence = "preliminary" | "confident";

const AC_D20_DEFAULT_THRESHOLD = 20;

export function confidenceQualifier(n: number): Confidence {
  return n >= AC_D20_DEFAULT_THRESHOLD ? "confident" : "preliminary";
}
