# Handover — PR-059-fe6-results

## PR identifier and link

- PR: #59 · FE-6: results page + adaptive loop + grade-review surface
- Link: https://github.com/jaydomains/acumen/pull/59
- Author / session: Claude Code session `claude/fe-6-results-page-NT3Vs`
- Date closed: 2026-05-27

## Phase reference

- ROADMAP phase closed by this PR: **FE-6 — Results + adaptive loop + grade-review surface** (`FE_ROADMAP.md` lines 120–135).
- Does this PR fully close the phase? **Yes.** Done-when criteria from `FE_ROADMAP.md` lines 128–131, verbatim:

  > *Submitted attempt → result page renders → AI-graded responses show "under review" until the reconcile cron resolves them → loop card surfaces follow-up CTAs that route to learning material or re-test entry point.*

  Cross-check against the diff:

  - **Submitted attempt → result page renders:** `frontend/src/app/(authed)/(testee)/attempts/[attemptId]/result/page.tsx` replaces the FE-4 placeholder with the full composition. `useQuery` wired to `attemptQueryKeys.result(id)` with 5 s `refetchInterval` while `status !== "ready"`. Covered by `frontend/tests/pages/result-page.test.tsx` (exists on disk, verified). Evidence: yes.
  - **AI-graded responses show "under review" until reconcile cron resolves:** `frontend/src/components/result/ai-review-chip.tsx` renders `pending` state with a pulse-dot when `grade.review_verdict === "pending"`; flips to `confirmed` on the next poll tick. `frontend/src/components/result/review-banner.tsx` shows REVIEW PENDING until `result.status === "ready"`. Covered by `frontend/tests/components/result/by-question-card.test.tsx` and `frontend/tests/components/result/result-hero.test.tsx` (both verified on disk). Evidence: yes.
  - **Loop card surfaces follow-up CTAs:** `frontend/src/components/result/adaptive-loop-card.tsx` + `frontend/src/components/result/loop-step-row.tsx` render three step types — `explainer` (in-app `/pills/{id}` route), `external_link_set` (external link per AC-D21), `retest_queued` (Defer v1 no-op + tooltip). Covered by `frontend/tests/components/result/adaptive-loop-card.test.tsx` (verified on disk). Evidence: yes.
  - **PDF export (AC-CD6 Blob URL pattern):** `frontend/src/components/result/pdf-export-button.tsx` — five states; raw `fetch` → Blob → object-URL → synthetic `<a download>` → revoke; `Content-Disposition` filename parsing. Covered by `frontend/tests/components/result/pdf-export-button.test.tsx` (verified on disk). Evidence: yes.
  - **Realism feedback (AC-D22):** `frontend/src/components/result/realism-aggregate-card.tsx` + `frontend/src/components/result/realism-flag-row.tsx` surface flagged-Q aggregate from `AttemptView.questions[].realism_flagged_by_me`. Covered by `frontend/tests/components/result/realism-aggregate-card.test.tsx` (verified on disk). Evidence: yes.
  - **Playwright E2E:** `frontend/e2e/result-page-fe6.spec.ts` (verified on disk) — full result-page render + PDF download flow; both scenarios green in CI (check run `e2e` at commit `3246c31`). Evidence: yes.
  - **FE_CHECKLIST.md FE-6 rows:** All 5 rows ticked at `FE_CHECKLIST.md` lines 91–95 (verified on disk). Evidence: yes.

## What was built

Files added:

- **Result page and error boundary:**
  - `frontend/src/app/(authed)/(testee)/attempts/[attemptId]/result/page.tsx` — full result page composition (replaces FE-4 placeholder); `useQuery` with `refetchInterval` + `refetchOnWindowFocus` per AC-CD21
  - `frontend/src/app/(authed)/(testee)/attempts/[attemptId]/result/error.tsx` — Pattern C error boundary

- **Result components (14 new files under `frontend/src/components/result/`):**
  - `result-hero.tsx` — hero stat row + ReviewBanner composer
  - `review-banner.tsx` — pending / pending-overdue / complete / deterministic variants
  - `review-status-dot.tsx` — shared pulse-dot primitive
  - `by-question-card.tsx` — Q-by-Q composer with PdfExportButton header slot
  - `question-grade-row.tsx` — single Q row with expand-on-click reveal
  - `ai-review-chip.tsx` — pending / confirmed / flagged chip
  - `by-pill-card.tsx` — weakness-breakdown composer (hides when empty)
  - `pill-weakness-row.tsx` — per-pill row + calibration confidence
  - `adaptive-loop-card.tsx` — loop step composer
  - `loop-step-row.tsx` — explainer / external_link_set / retest_queued step types
  - `transparency-block.tsx` — sunk card + flagged-Q anchor links
  - `realism-aggregate-card.tsx` — flagged-Q aggregate composer
  - `realism-flag-row.tsx` — per-flagged-Q row + anchor click
  - `pdf-export-button.tsx` — five-state Blob-URL export

- **shadcn/ui install:**
  - `frontend/src/components/ui/tooltip.tsx` — shadcn Tooltip install with FE-2 post-install token sweep

- **Result helper functions (7 new files under `frontend/src/lib/result/`):**
  - `format-delta.ts`, `format-relative.ts`, `parse-content-disposition.ts`, `scroll-to-question.ts`, `derive-status.ts`, `adaptive-loop-format.ts`, `format-answer-payload.ts`

- **E2E:**
  - `frontend/e2e/result-page-fe6.spec.ts` — Playwright E2E (2 scenarios: full render + PDF download)

- **Tests (14 new test files):**
  - `frontend/tests/lib/result/` — 6 files: `derive-status.test.ts`, `format-answer-payload.test.ts`, `format-delta.test.ts`, `format-relative.test.ts`, `parse-content-disposition.test.ts`, `scroll-to-question.test.ts`
  - `frontend/tests/components/result/` — 7 files: `result-hero.test.tsx`, `by-question-card.test.tsx`, `by-pill-card.test.tsx`, `adaptive-loop-card.test.tsx`, `transparency-block.test.tsx`, `realism-aggregate-card.test.tsx`, `pdf-export-button.test.tsx`
  - `frontend/tests/pages/result-page.test.tsx` — 1 page-integration test

- **Backend — `handovers/PR-059-fe6-results.md`** (committed as part of PR squash)

Files changed:

- **Backend:**
  - `app/schemas.py` — new nested Pydantic models (`ResultGrade`, `ResultQuestion`, `ResultPill`, `ReviewSummary`, `LoopStep`); `AttemptResultResponse` widened to full §B contract; `Field(default_factory=list, json_schema_extra={"default": []})` on list fields per Gitar findings 3+4
  - `app/domain/attempts.py` — `result_view`: per-Q migrated to nested `grade` sub-object; `_result_pills`: bulk-loaded Pills + CompetencyProfiles (N+1 eliminated); `_testee_observation_counts`: bulk-load-once helper (N+1+1 eliminated); `view_attempt`: realism triple joined from `RealismFlag`
  - `app/domain/pdf.py` — `_grade_row_text` reads new `grade` sub-object; `under_admin_review` no-score-leak preserved
  - `tests/integration/test_p6_result_view_gate.py` — migrated to new per-Q `grade` sub-object shape
  - `tests/integration/test_p4_grading.py` — migrated to new per-Q `grade` sub-object shape

- **Frontend:**
  - `frontend/src/app/(authed)/(testee)/attempts/[attemptId]/result/page.tsx` — full replacement of FE-4 placeholder
  - `frontend/src/app/globals.css` — `@keyframes flash` + `@keyframes pulse-dot` added
  - `frontend/openapi/schema.json` — regenerated from updated Pydantic models (in-process `app.openapi()` dump)
  - `frontend/src/types/api.d.ts` — regenerated via `pnpm codegen`
  - `frontend/src/mocks/handlers.ts` — `defaultResult` extended with new required fields; `makeRichResult` builder added (append-only)
  - `frontend/tests/components/attempt/GradingOverlay.test.tsx` — fixtures updated for new required `pills` + `adaptive_loop` arrays
  - `frontend/e2e/attempt-frozen-roundtrip.spec.ts` — `/result` mock body updated for new shape
  - `frontend/e2e/attempt-per-testee-roundtrip.spec.ts` — `/result` mock body updated for new shape
  - `frontend/package.json` + `frontend/pnpm-lock.yaml` — `@radix-ui/react-tooltip@1.1.8`
  - `FE_CHECKLIST.md` — FE-6 rows ticked (5/5)

Files removed: none.

Summary: FE-6 ships the full testee results page at `/attempts/[attemptId]/result`, replacing the FE-4 placeholder with a complete eight-card composition driven by a widened backend `AttemptResultResponse` contract. The PR is a co-authored backend + frontend build across 5 slices: Slice 1 amended the backend payload to the full FE-6 §B contract (with N+1 query elimination and OpenAPI/TypeScript regen); Slices 2–5 built the full result-page component tree including hero stats, Q-by-Q breakdown, weakness card, adaptive-loop CTAs, cross-family transparency, realism aggregate, and PDF export. 55 files changed, 5 555 insertions, 84 deletions; 95 net-new Vitest tests (466 → 561) and 1 new Playwright spec (2 scenarios).

## What was decided in this PR

Plan file: `/root/.claude/plans/fe-6-build-session-joyful-sunset.md` — noted in the existing committed handover but not found on disk at `/root/.claude/plans/` at handover-draft time (no files present under that directory). Decisions below are reconstructed from commit messages, PR body user-locked items, Gitar review thread resolutions, and the committed handover file.

- **Co-authored backend + frontend in one FE-6 PR (user-locked, Option A).** FE-6 `fe-specs/FE-6-results.md` §H (a) calls for a spec-clarification PR to land on `main` before the build session. The user locked Option A at session opener: co-author the backend payload amendment as Slice 1 of the FE-6 PR. This deviates from the "spec-clarification PR first" framing. Captured here as the approved deviation for future sessions.

- **Status enum stays `"ready"` in code; spec body rename to `"complete"` is deferred housekeeping.** The backend's `AttemptResultResponse.status` value is `"ready"`. All FE-6 code, MSW fixtures, and TypeScript types use `"ready"`. User-locked.

- **`refetchInterval` policy: 5 s while `status !== "ready"`, stop on `"ready"`; `refetchOnWindowFocus: true`.** Locked at plan close. `refetchIntervalInBackground: false` (TanStack v5 default) is a documented deliberate choice — backgrounded-tab polling pauses; `refetchOnWindowFocus` fires on tab return. Call-site options live on the page-level `useQuery` per AC-CD21.

- **`competence_estimate_after` / `competence_estimate_delta` and `median_time_seconds` return `null` in v1.** Neither has a per-attempt snapshot column on the `Attempt` model. Both nullable on `AttemptResultResponse`; FE handles `null` via `frontend/src/lib/result/format-delta.ts` ("—" + "first attempt" hint per AC-D9). Filed for a follow-up backend PR.

- **`RealismFlag.realism_flag_note` always null in v1.** The existing `RealismFlag` model does not capture a user-typed note. `view_attempt` adds the field; `frontend/src/components/result/realism-flag-row.tsx` renders it only when non-null. Surface deferred.

- **`Tooltip` shadcn install + `@keyframes flash` / `@keyframes pulse-dot` folded into Slice 2.** Both absent from FE-2's install set. Added with the full FE-2-discipline post-install token sweep (no hex / no shadcn default tokens).

- **Result route lives under `(authed)/(testee)/`, not `(testee)/`.** The spec body assumed `(testee)/`; the actual route group is `(authed)/(testee)/` (FE-1 establishment). Doc-drift only, not runtime drift.

- **Gitar finding #4 cascade: `json_schema_extra={"default": []}` required alongside `default_factory`.** After fixing finding #3 (mutable default → `Field(default_factory=list)`), finding #4 identified that Pydantic v2 no longer emits `"default": []` in JSON Schema when `default_factory` is used alone, causing `openapi-typescript` to generate the three list fields as optional (`pills?:`, `adaptive_loop?:`, `flagged_question_positions?:`). Resolution: all three fields carry `Field(default_factory=list, json_schema_extra={"default": []})`. This is a load-bearing invariant — see section 9 traps.

- **`PdfExportButton isGated` literal `false` at render site (Gitar finding #5, Slice 5, commit `bf0e2b8`).** Inside the `result.status === "ready"` guard, `isGated={result.status !== "ready"}` evaluated tautologically false. Cleaned to `isGated={false}` per Gitar's recommendation. Moving the button outside the guard to surface the gated tooltip during `review_pending` is a separate FE-6.x design call.

- **N+1 elimination uses bulk-load pattern, not JOIN+COUNT.** Gitar's two N+1 findings (see section 5) suggested JOIN+COUNT fixes. Resolution used bulk-load-then-Python-walk instead, consistent with AC-CD15 (the FakeSession integration-test harness supports single-model equality WHERE only; JOIN queries break it). This is a load-bearing invariant — see section 9 traps.

- New anchors introduced: none. The existing anchor set covers FE-6 entirely.

- Existing anchors this PR depends on: AC-D6 (adaptive loop), AC-D9 (competence display + null handling), AC-D19 (grade-review pending state), AC-D20 (calibration confidence), AC-D21 (safety pill external-link branch), AC-D22 (realism feedback), AC-CD6 (PDF export Blob URL), AC-CD15 (zero-DB FakeSession harness), AC-CD18 (AI provenance model IDs from backend, never hardcoded on FE), AC-CD19 (frontend stack), AC-CD20 (route guards), AC-CD21 (TanStack Query patterns + `refetchInterval`), AC-CD24 (image stubs — FIG badge renders, no body in v1).

## Drift flags raised and how they were resolved

No standalone drift-sweep artefact was authored for this PR. The following surfaced and were resolved during the build:

1. **Co-authored backend amendment in a frontend-phase PR.** FE-6 §H (a) calls for "spec-clarification PR first." User-locked Option A — co-author as Slice 1. No separate spec-clarification PR was authored. Resolution: absorbed with user lock.

2. **Status enum mismatch: backend `"ready"` vs spec body `"complete"`.** User-locked — code stays `"ready"`; spec body rename is deferred housekeeping. Resolution: deferred (tracked in section 6).

3. **`Tooltip` shadcn component absent from FE-2's install set.** Added in Slice 2 with full FE-2 post-install token sweep. Resolution: absorbed.

4. **`@keyframes flash` and `@keyframes pulse-dot` not in `globals.css`.** Added in Slice 2 after verifying absent. Resolution: absorbed.

5. **Result route group `(authed)/(testee)/` vs spec body `(testee)/`.** Doc-drift only; runtime routing unaffected. Spec body to be updated in a housekeeping commit. Resolution: deferred (tracked in section 6).

6. **`competence_estimate_after` / `_delta` and `median_time_seconds` return null in v1.** Backend lacks per-attempt snapshot column and cross-attempt median query. FE handles null via `format-delta.ts`. Resolution: forwarded to section 6.

7. **`RealismFlag.realism_flag_note` always null in v1.** Model lacks note column. FE renders only when non-null. Resolution: forwarded to section 6.

8. **N+1+1 query loop in `_testee_pill_observation_count` (Gitar finding #1, `app/domain/attempts.py`, Slice 1, resolved in commit `4efe15a`).** `_testee_pill_observation_count` loaded all `Response` rows for the tenant, then for each issued separate `Question` and `Attempt` queries in Python — O(R × 2) round-trips, called once per pill row making total cost O(P × R × 2). Resolution: replaced with `_testee_observation_counts(db, testee_id) -> dict[pill_id, int]` bulk-loading all pill-keyed counts in O(3) equality WHERE queries. Note: Gitar's suggested JOIN+COUNT approach was not used because it would break the AC-CD15 FakeSession harness; the bulk-load pattern matches the `grade_review.py::_pills_by_id` precedent.

9. **N+1 queries for Pill + CompetencyProfile in `_result_pills` loop (Gitar finding #2, `app/domain/attempts.py`, Slice 1, resolved in commit `4efe15a`).** `_result_pills` issued individual `SELECT Pill` and `SELECT CompetencyProfile` queries inside a loop over `pill_rows` (2N+N round-trips). Resolution: bulk-fetched both with `Pill.id.in_(pill_ids)` and `CompetencyProfile.pill_id.in_(pill_ids)` before the loop, indexed in Python.

10. **Mutable default list in `ReviewSummary.flagged_question_positions` (Gitar finding #3, `app/schemas.py`, Slice 1, resolved in commit `4efe15a`).** `flagged_question_positions: list[int] = []` used a mutable default. Resolution: changed to `Field(default_factory=list)`.

11. **`default_factory` drops `"default"` from OpenAPI schema, making TS types optional (Gitar finding #4, `app/schemas.py`, Slice 1, resolved in commit `4efe15a`).** After finding #3's fix, Pydantic v2 no longer emits `"default": []` for `default_factory` fields. `openapi-typescript` consequently generated `pills?:`, `adaptive_loop?:`, and `flagged_question_positions?:` as optional — future FE slices would have required unnecessary `?.`/`?? []` guards. Resolution: added `json_schema_extra={"default": []}` to all three list fields. TypeScript types regenerated; consumer code stays with required-field syntax.

12. **`PdfExportButton isGated` prop tautologically false (Gitar finding #5, `frontend/src/app/(authed)/(testee)/attempts/[attemptId]/result/page.tsx` line 120, Slice 5, resolved in commit `bf0e2b8`).** The button rendered inside `result && result.status === "ready"` guard, but `isGated={result.status !== "ready"}` was always `false`. Replaced with `isGated={false}`; the gated state remains unreachable at this call site (see section 6).

13. **Playwright E2E: strict-mode locator violation + cross-origin `Content-Disposition` exposure (resolved in commit `3246c31`).** Two CI-only failures on first Slice 5 push: (a) `getByText("Antifouling")` matched both the by-pill row and the loop step title — strict mode rejected the non-unique match; scoped the assertion to `getByTestId("by-pill-card").getByText("Antifouling")`. (b) The PDF download test compared `download.suggestedFilename()` against the `Content-Disposition` value, but the cross-origin dev setup (`localhost:3000` → `localhost:8000`) does not expose non-safelisted response headers without `Access-Control-Expose-Headers`; added `"Content-Disposition"` to the Playwright route fixture mock headers. The production FastAPI `CORSMiddleware` already exposes `Content-Disposition` — this was a test-fixture-only fix.

## Open questions deferred to a later phase

Carried forward from `handovers/PR-056-fe5-streaming-runner.md`:

- **`POST /v1/attempts/{id}/focus-events` backend endpoint.** Inherited from FE-4 open question 1. When added, wire `useIntegrity` to POST tab-switch + visibility events. Not affected by FE-6.

- **`response_payload` on `AttemptView.questions[]`.** Inherited from FE-4 open question 2. When added, swap the localStorage rehydration cache for the wire-driven version (cross-device durable). Not affected by FE-6.

- **Pill → test find-or-generate (`POST /v1/tests/generate`).** Inherited from FE-4 open question 3. When unblocked, the `LoopStepRow` `retest_queued` CTA route may be updated; the card itself requires no change.

- **Cross-device resume / attempt history list.** Inherited from FE-4; FE-7 territory.

- **`live` mode routing.** Inherited from FE-4 and FE-5; the `mode === "live"` branch in `attempts/[attemptId]/page.tsx` remains an unchanged FE-4 placeholder. Unblocked only when a user-authored spec-clarification PR anchors `live` mode in DECISIONS.md.

- **`SubmitMode` / `GradingOverlay` copy for `per_testee` mode.** Inherited from FE-5. The modal and overlay use `frozen`-mode copy for per-testee attempts. FE-9 is the natural owner; revisit there.

- **`traceId` threading into `SystemGlitchOverlay`.** Inherited from FE-5 as unverified post-merge. File as v1.x hardening.

- **`reconnect_exhausted` local-timer-hold in `StreamingRunner.tsx`.** Inherited from FE-5 as unverified post-merge. File as v1.x hardening.

New from FE-6:

- **`competence_estimate_after` / `competence_estimate_delta` / `median_time_seconds` null in v1.** A per-attempt snapshot column on `Attempt` (or post-hoc derivation query) is required to populate these. Hero renders "—" + "first attempt" hint per AC-D9 for all v1 attempts. Requires a follow-up backend PR.

- **`RealismFlag.realism_flag_note` always null in v1.** When the model is extended to capture notes, `frontend/src/components/result/realism-flag-row.tsx` requires no change — the field is already wired; the backend `view_attempt` already joins it.

- **`AdaptiveLoopCard` Defer CTA is a v1 no-op.** Tooltip explains the deferral mechanism; backend implementation lives in FE-9 admin operations territory.

- **Spec body rename `"complete"` → `"ready"`.** Deferred housekeeping commit; not blocking.

- **`PdfExportButton` gated-state reachability.** Currently mounted inside the `status === "ready"` guard; the `gated` state with its tooltip is unreachable. Moving the button outside the guard is a separate FE-6.x design call requiring its own spec clarification.

## Build state vs spec

### Complete

- `result/page.tsx` composition: role guard (AC-CD20), loading skeleton, `useQuery` with 5 s `refetchInterval` while pending + `refetchOnWindowFocus`, error boundary (Pattern C at `error.tsx`).
- `ResultHero` (`frontend/src/components/result/result-hero.tsx`): all states — pending / pending-overdue (60 s ceiling) / complete / deterministic-only / first-attempt / benchmark. Delta colour-mapping and "—" null handling per AC-D9.
- `ReviewBanner` + `ReviewStatusDot`: all copy variants; pulse-dot tone shifts amber on overdue.
- `ByQuestionCard` + `QuestionGradeRow`: all row states — deterministic correct / incorrect, AI pending / confirmed / flagged, partial credit, expand-reveal; FIG badge stub per AC-CD24; `data-question-id` anchor attributes.
- `AiReviewChip`: three states + n/a for deterministic.
- `ByPillCard` + `PillWeaknessRow`: empty-hide; per-row severity colour + calibration confidence label (AC-D20) + AC-D21 safety badge.
- `AdaptiveLoopCard` + `LoopStepRow`: three step types; `step_down_hint` sub-line; external link `rel="noopener noreferrer"`; pending / empty hide; Defer CTA v1 no-op with tooltip.
- `TransparencyBlock`: all five states; model IDs from response per AC-CD18; anchor links to `#question-{n}`.
- `RealismAggregateCard` + `RealismFlagRow`: with-flags / empty-hide; click-to-anchor; note rendered when non-null.
- `PdfExportButton`: five states; `useMutation` raw-fetch → Blob → object-URL → synthetic download → revoke; `Content-Disposition` filename parsing; Sonner toasts per AC-CD6.
- `Tooltip` shadcn install with FE-2 token sweep.
- `@keyframes flash` + `@keyframes pulse-dot` in `frontend/src/app/globals.css`.
- Seven helper functions (`frontend/src/lib/result/`), all with unit-test coverage.
- Backend `AttemptResultResponse` full §B contract; N+1 and N+1+1 patterns eliminated; `json_schema_extra` defaults preserved on list fields.
- `view_attempt` realism-flag triple joined from `RealismFlag`.
- `FE_CHECKLIST.md` FE-6 rows ticked (5/5).
- Playwright E2E `frontend/e2e/result-page-fe6.spec.ts` — 2 scenarios (render + PDF), both green in CI.

Each anchor this PR depends on maps to:
- AC-D6: `AdaptiveLoopCard` + `LoopStepRow` — complete.
- AC-D9: `ResultHero` delta/null handling + band derivation — partial (null in v1; see Partial).
- AC-D19: `AiReviewChip` + `ReviewBanner` pending states + `refetchInterval` — complete.
- AC-D20: `PillWeaknessRow` calibration confidence label — complete.
- AC-D21: Safety pill external-link branch in `LoopStepRow` — complete.
- AC-D22: `RealismAggregateCard` + `RealismFlagRow` — complete.
- AC-CD6: `PdfExportButton` Blob URL pattern — complete.
- AC-CD15: Bulk-load query pattern preserved (FakeSession harness safe) — complete.
- AC-CD18: Model IDs sourced from `TransparencyBlock` response payload, never hardcoded — complete.
- AC-CD24: FIG badge renders when `has_figure === true`; no image body — stubbed (correct for v1).

### Partial

- **Hero competence-delta stat card:** renders "—" for all v1 attempts (backend fields null). Layout + null-handling code complete; live data path awaits the follow-up backend PR (`competence_estimate_after` + `_delta` require a per-attempt snapshot column).
- **Hero median-time hint:** hidden in v1 (`median_time_seconds` null). Code guards present.
- **`PdfExportButton` gated state:** component supports it; the `gated` state is not reachable at the current call site (inside the `status === "ready"` guard with `isGated={false}`).

### Stubbed

- **Image rendering (AC-CD24):** `has_figure` drives the FIG badge in `QuestionGradeRow`; no figure image body in v1.
- **`RealismFlagRow` note text:** always null in v1; `RealismFlag` model lacks the note column.
- **`AdaptiveLoopCard` Defer CTA:** button renders; `onClick` is a v1 no-op.
- **`live` mode branch in attempt runner:** FE-4/FE-5 placeholder unchanged; no FE-6 edit.

## Test coverage and CI results

Tests added:

- **New — lib unit tests (6 files under `frontend/tests/lib/result/`):**
  - `format-delta.test.ts` — null/first-attempt/positive/negative delta formatting
  - `format-relative.test.ts` — relative time string variants
  - `parse-content-disposition.test.ts` — filename extraction from header
  - `scroll-to-question.test.ts` — `data-question-id` anchor targeting
  - `derive-status.test.ts` — status derivation from `AttemptResultResponse`
  - `format-answer-payload.test.ts` — MCQ / true-false / matching / short-answer / scenario payload formatting

- **New — component tests (7 files under `frontend/tests/components/result/`):**
  - `result-hero.test.tsx` — all hero states including pending / pending-overdue / deterministic / null-delta
  - `by-question-card.test.tsx` — row states + expand-reveal + AI chip states
  - `by-pill-card.test.tsx` — empty-hide + populated + severity + safety badge
  - `adaptive-loop-card.test.tsx` — three step types + Defer no-op + empty-hide
  - `transparency-block.test.tsx` — all five states + anchor links
  - `realism-aggregate-card.test.tsx` — with-flags / empty-hide + click-to-anchor
  - `pdf-export-button.test.tsx` — five states + Blob URL flow + Sonner toasts + `Content-Disposition` parsing

- **New — page integration test:**
  - `frontend/tests/pages/result-page.test.tsx`

- **New — Playwright E2E:**
  - `frontend/e2e/result-page-fe6.spec.ts` — 2 scenarios: full result-page render; PDF export download with filename assertion

- **Changed — backend test migrations:**
  - `tests/integration/test_p6_result_view_gate.py` — migrated to new per-Q `grade` sub-object shape
  - `tests/integration/test_p4_grading.py` — migrated to new per-Q `grade` sub-object shape

- **Changed — frontend test fixtures:**
  - `frontend/tests/components/attempt/GradingOverlay.test.tsx` — `defaultResult` fixture updated for new required `pills` + `adaptive_loop` arrays

Coverage delta: 95 net-new Vitest tests across 14 new test files (466 → 561 passing). 1 new Playwright spec / 2 new scenarios (full suite: 6 Playwright tests, all green).

CI result at merge: all 11 check runs succeeded on merge commit `a38941a`:
- `checks` (codegen / typecheck / eslint / prettier / vitest / next build) — success (4 workflow runs)
- `docker-build` — success (2 workflow runs)
- `migration-chain` — success (2 workflow runs)
- `e2e` (Playwright) — success (2 workflow runs; first run at `3246c31` was the fix commit for the strict-mode + Content-Disposition-expose issues)
- `Gitar` — success (all 5 findings resolved across slices 1, 2, and 5)

Manual verification performed (from PR body):
- `pytest tests/integration/` — 488 passed
- `pnpm typecheck` — clean
- `pnpm test --run` — 561 passed
- `pnpm format:check` — clean
- `pnpm lint` — clean
- `pnpm e2e` — 6 passed
- `mypy app` — clean
- `ruff check .` + `ruff format --check .` — clean

## Post-merge validation considerations

Both the backend service (`acumen-backend`) and the frontend service (`acumen-frontend`) are affected by this PR. The stale-image trap from `SESSION_START.md` applies to both. Post-merge local validation requires:

```
docker compose build --no-cache acumen-backend
docker compose build --no-cache acumen-frontend
docker compose up
```

before re-running. Using a cached image after this PR will mask both the backend payload widening (new Pydantic models + result builder) and all new frontend components.

Local verify sequence:

```
# Backend
pytest tests/integration/test_p6_result_view_gate.py -v
pytest tests/integration/test_p4_grading.py -v
pytest tests/integration/   # full 488

# Frontend
cd frontend
pnpm install --frozen-lockfile
pnpm codegen:check
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test --run            # 561 tests
pnpm build
pnpm e2e                   # 6 specs, ~25 s
```

Smoke against a real backend: spin up Docker Compose; log in as a testee; start and submit an attempt containing at least one AI-graded question and one deterministic question; verify: (a) REVIEW PENDING banner with pulse-dot on the result page; (b) banner flips to REVIEW COMPLETE within ~5 s (refetchInterval); (c) ByPillCard, AdaptiveLoopCard, and TransparencyBlock mount if the attempt has weakness data; (d) PdfExportButton is idle — clicking triggers a Blob download with the backend-provided filename; (e) accessing `/attempts/{id}/result` as an admin role redirects to `/403` (role guard).

## Anything a fresh Claude Code session needs to pick up cleanly

**Required reading beyond `SESSION_START.md`:**
- `fe-specs/FE-6-results.md` — per-phase detail spec for FE-6. Pay particular attention to §B.1 §4 (TanStack Query `refetchInterval` policy and `refetchIntervalInBackground: false` rationale), §B.4 §7 (per-Q chip dependency on `review_verdict` — the biggest drift candidate from Slice 1 exploration), §B.7 (PDF export Blob URL contract), and §E.1 (Defer CTA v1 no-op).
- `handovers/PR-056-fe5-streaming-runner.md` — defines the `streamRef` / mutation-refs pattern, MSW handler-order trap, and `cancelled`-guard-after-every-await pattern that FE-6 inherits unchanged.
- `handovers/PR-055-fe4-attempt-runner.md` — defines the `GradingOverlay` → router-push → result-page entry path; FE-6 is the destination of that path.
- This handover for the locked drift decisions, Gitar fix-round root causes, and section 9 traps below.

**Environment / setup notes:**
- No new environment variables introduced by FE-6.
- No new `package.json` scripts. The existing `e2e`, `e2e:ui`, `e2e:install` scripts run the new FE-6 spec alongside the FE-4 and FE-5 specs.
- `frontend/src/components/ui/tooltip.tsx` was added. shadcn/ui components now installed: Button, Card, Input, Select, Dialog, DropdownMenu, Tabs, Toast, Skeleton, Tooltip, AlertDialog, Checkbox, Label, RadioGroup, Textarea. The full list is in `components.json`.
- `@radix-ui/react-tooltip@1.1.8` is the one new Radix dependency pinned in `frontend/package.json`.

**Post-merge stale-image check:** Both `acumen-backend` and `acumen-frontend` must be rebuilt (`docker compose build --no-cache acumen-backend && docker compose build --no-cache acumen-frontend`) before any local smoke test — see section 8 for the full sequence.

**Known traps, gotchas, or in-progress work that is easy to misread:**

- `result.status` is `"ready"`, not `"complete"`. Every conditional in `page.tsx`, `result-hero.tsx`, `review-banner.tsx`, and all test fixtures uses `"ready"`. The spec document says `"complete"` — this is documented doc-drift, not a bug. Do not "fix" the code to match the spec; the spec body rename is the deferred housekeeping commit (section 6). If a future session sees `"complete"` in the spec and `"ready"` in code, the code is correct.

- `json_schema_extra={"default": []}` on Pydantic list fields is load-bearing for TypeScript types (Gitar finding #4 root cause, commit `4efe15a`). `ReviewSummary.flagged_question_positions`, `AttemptResultResponse.pills`, and `AttemptResultResponse.adaptive_loop` all carry `Field(default_factory=list, json_schema_extra={"default": []})`. If `json_schema_extra` is removed (e.g. in a routine "simplification" of the schema), `openapi-typescript` generates these three fields as optional and downstream FE code will require `?.`/`?? []` guards everywhere they are consumed. Always regenerate and inspect `frontend/src/types/api.d.ts` after editing these fields.

- N+1 query elimination in `app/domain/attempts.py` uses bulk-load, NOT JOIN+COUNT (Gitar finding #1 and #2 root cause, commit `4efe15a`). Gitar suggested a JOIN+COUNT approach; it was not used because the AC-CD15 FakeSession integration-test harness supports single-model equality WHERE queries only — a JOIN would cause the harness to raise. The correct pattern for all new query helpers in `attempts.py` is: one `SELECT model WHERE id.in_(ids)` call per model, indexed into a Python dict, walked in a loop. See `_testee_observation_counts` and the `pills_by_id` + `profiles_by_pill` dicts in `_result_pills` for the canonical examples. Do not convert these to JOIN queries even if the generated SQL would be more efficient — the harness will break.

- `PdfExportButton` gated state is unreachable at the current call site. The button mounts inside the `result && result.status === "ready"` guard in `page.tsx` with `isGated={false}`. The gated state (greyed-out button + tooltip "Report in review — PDF available when review is complete") is never reached in production. If a future spec change wants the tooltip surfaced during `review_pending`, move `<PdfExportButton>` outside the `status === "ready"` guard and pass `isGated={result?.status !== "ready"}`. This is a deliberate FE-6.x design deferral, not a bug.

- Cross-origin `Content-Disposition` header exposure is a Playwright-fixture-only concern. The FE-6 Playwright spec mocks the PDF export endpoint with `"Access-Control-Expose-Headers": "Content-Disposition"` because the dev server at `localhost:3000` and the mocked API at `localhost:8000` are cross-origin. The production FastAPI `CORSMiddleware` already exposes `Content-Disposition`. Any future Playwright test that reads a response header from a cross-origin mock must add the expose-header to the route fixture — the browser will otherwise silently return an empty string for the header value.

- Anchor scroll to `#question-{n}` is deferred until after the result query resolves. `frontend/src/lib/result/scroll-to-question.ts` targets `[data-question-id="..."]` DOM nodes. If `#question-{n}` is in the URL on first paint, the scroll must wait until result data and `ByQuestionCard` rows have mounted. The scroll is triggered inside a `useEffect` that depends on the `data` flag from `useQuery`. Do not call `scrollToQuestion` before the query has returned data.

- MSW handler-order trap inherited from FE-4. `resolveTestHandler` MUST come before `getTestHandler` in `frontend/src/mocks/handlers.ts`'s export array. This invariant was preserved unchanged through FE-5 and FE-6. An inline comment in `handlers.ts` documents it; preserve the ordering when appending new handlers in FE-7+.

- `response: dict[str, Any]` on `ResultQuestion` carries `additionalProperties: true` in the OpenAPI schema. Without this, `openapi-typescript` generates `Record<string, never>` for unconstrained dict fields (a type that forbids all properties). The FE narrows the wire payload via `frontend/src/lib/result/format-answer-payload.ts`. Do not add a typed Pydantic model for `response` unless you also update `format-answer-payload.ts` and its test suite.

**Recommended next action:** **FE-7 — Competency constellation + history** (`FE_ROADMAP.md` lines 137–154). Two backend spec-drift PRs are hard prerequisites and must merge on `main` before the FE-7 build session opens (`FE_ROADMAP.md` lines 149–154):
- `GET /v1/attempts` (testee own-scope)
- `GET /v1/me/competence` (per-pill competence_estimate × band × n × confidence)

Confirm both are merged on `main` before opening the FE-7 session. The result page's `LoopStepRow` `retest_queued` CTA and the `AdaptiveLoopCard` Defer CTA both reference navigation targets that FE-7 will build out; those CTAs are no-ops in v1 but should be wired once FE-7's routes exist.

---

**Inputs inaccessible or reconstructed:**

- **Plan file** (`/root/.claude/plans/fe-6-build-session-joyful-sunset.md`, referenced in the committed handover): directory `/root/.claude/plans/` contained no files at handover-draft time. Section 4 decisions reconstructed from the PR body user-locked items, commit messages, Gitar review thread resolutions, and the committed `handovers/PR-059-fe6-results.md` file.
- **`mcp__github__list_commits` on the PR branch** (`claude/fe-6-results-page-NT3Vs`): the branch was deleted after merge. Commit list obtained instead by running `git log` on the squash-merge commit `a38941a` from `main`, which embeds all 10 constituent commits in its message. All 10 commits confirmed from the log output.
- **`mcp__github__pull_request_read` get_files**: response exceeded token limit; file list reconstructed from `git show a38941a --name-status` (55 files, 5 555 insertions, 84 deletions — verified equivalent to the PR's reported totals).
- **No drift-sweep artefact** was passed in from the parent session and none was found committed under `handovers/` or `docs/`. Drift section is populated from PR body plan-mode notes, Gitar review threads, commit messages, and the committed `handovers/PR-059-fe6-results.md`.
- **Prior handover** (`handovers/PR-056-fe5-streaming-runner.md`): present on disk and fully read for chain inheritance (section 6).
