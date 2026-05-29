/**
 * derive-display-status — LOCKED v1 helper per FE-8 admin-tests §C.10
 * (`fe-specs/FE-8-admin-tests.md:793–795`). Slice 11 ships this as
 * the first consumer (`TestsTable`); Slice 12 reuses it unchanged
 * for `StatusBar`, `PublishControls`, and `WarnBanner`.
 *
 * Wire status is `draft | published`; the `locked` display status is
 * derived from `status === "published" && lock_mode === "campaign-locked"`
 * (per SPEC §5 + AC-D24, surfaced in spec §B.1 §4).
 *
 * `lock_mode` is unconstrained `string` on the wire per Slice 11 drift
 * Finding #7. Spec body locks the two expected values; this helper
 * matches against the literal `"campaign-locked"`.
 */

export type DisplayStatus = "draft" | "published" | "locked";

export type TestLike = {
  status: string;
  lock_mode: string;
};

export function deriveDisplayStatus(test: TestLike): DisplayStatus {
  if (test.status === "draft") return "draft";
  if (test.status === "published" && test.lock_mode === "campaign-locked") {
    return "locked";
  }
  return "published";
}
