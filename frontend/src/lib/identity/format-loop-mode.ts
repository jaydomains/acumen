/**
 * format-loop-mode — UI label helper for `LoopMode`
 * (FE-8 admin-identity §B.4 +
 * `fe-specs/FE-8-admin-identity.md:706–708`).
 *
 * Wire enum is `autonomous | admin_reviewed` (snake_case). Display
 * label flips to "admin-reviewed" (hyphen). Never send the hyphenated
 * form to the backend.
 */

export type LoopMode = "autonomous" | "admin_reviewed";

export function formatLoopMode(mode: LoopMode): string {
  if (mode === "admin_reviewed") return "admin-reviewed";
  return "autonomous";
}
