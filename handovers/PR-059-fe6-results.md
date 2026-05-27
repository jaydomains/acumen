# Handover — PR-059-fe6-results

## PR identifier and link

- PR: #59 · FE-6: results page + adaptive loop + grade-review surface
- Link: https://github.com/jaydomains/acumen/pull/59
- Author / session: Claude Code session `claude/fe-6-results-page-NT3Vs`
- Date closed: 2026-05-27

## Phase reference

- ROADMAP phase closed by this PR: **FE-6 — Results + adaptive loop + grade-review surface** (`FE_ROADMAP.md:120–135`).
- Does this PR fully close the phase? **Yes.** Done-when criteria from `FE_ROADMAP.md:128–131` verbatim:

  > *Submitted attempt → result page renders → AI-graded responses show "under review" until the reconcile cron resolves them → loop card surfaces follow-up CTAs that route to learning material or re-test entry point.*

  Cross-check against the diff:

  - **Submitted attempt → result page renders:** `frontend/src/app/(authed)/(testee)/attempts/[attemptId]/result/page.tsx` replaces the FE-4 placeholder with the full composition. `useQuery` wired to `attemptQueryKeys.result(id)`. Covered by `frontend/tests/pages/result-page.test.tsx`. Evidence: yes.
  - **AI-graded responses show "under review" until reconcile cron resolves:** `AiReviewChip` renders `pending` state with a pulse-dot when `grade.review_verdict === "pending"`; flips to `confirmed` on the next poll tick. `ReviewBanner` in `ResultHero` shows REVIEW PENDING until `result.status === "ready"`. Covered by `by-question-card.test.tsx` and `result-hero.test.tsx`. Evidence: yes.
  - **Loop card surfaces follow-up CTAs:** `AdaptiveLoopCard` + `LoopStepRow` render three step types — `explainer` (in-app `/pills/{id}` route), `external_link_set` (external link per AC-D21), `retest_queued` (Defer no-op + future pill-detail route). Covered by `adaptive-loop-card.test.tsx`. Evidence: yes.
  - **PDF export (AC-CD6 Blob URL pattern):** `PdfExportButton` with five states; raw `fetch` → Blob → object-URL → synthetic `<a download>` → revoke. Covered by `pdf-export-button.test.tsx`. Evidence: yes.
  - **Realism feedback (AC-D22):** `RealismAggregateCard` + `RealismFlagRow` surface flagged-Q aggregate from `AttemptView.questions[].realism_flagged_by_me`. Covered by `realism-aggregate-card.test.tsx`. Evidence: yes.
  - **Playwright E2E:** `frontend/e2e/result-page-fe6.spec.ts` — full result-page render + PDF download flow. Evidence: yes (6/6 specs green locally after commit `3246c31`).

## What was built

- Files added (FE-6 scope):
  - `frontend/src/app/(authed)/(testee)/attempts/[attemptId]/result/page.tsx` — full result page composition (replaces FE-4 placeholder); `useQuery` with `refetchInterval` per AC-CD21
  - `frontend/src/app/(authed)/(testee)/attempts/[attemptId]/result/error.tsx` — Pattern C boundary
  - `frontend/src/components/result/result-hero.tsx` — hero stat row + ReviewBanner composer
  - `frontend/src/components/result/review-banner.tsx` — pending / pending-overdue / complete / deterministic variants
  - `frontend/src/components/result/review-status-dot.tsx` — shared pulse-dot primitive
  - `frontend/src/components/result/by-question-card.tsx` — Q-by-Q composer with PdfExportButton header slot
  - `frontend/src/components/result/question-grade-row.tsx` — single Q row with expand-on-click reveal
  - `frontend/src/components/result/ai-review-chip.tsx` — pending / confirmed / flagged chip
  - `frontend/src/components/result/by-pill-card.tsx` — weakness-breakdown composer (hides when empty)
  - `frontend/src/components/result/pill-weakness-row.tsx` — per-pill row + calibration confidence
  - `frontend/src/components/result/adaptive-loop-card.tsx` — loop step composer
  - `frontend/src/components/result/loop-step-row.tsx` — explainer / external_link_set / retest_queued
  - `frontend/src/components/result/transparency-block.tsx` — sunk card + flagged-Q anchor links
  - `frontend/src/components/result/realism-aggregate-card.tsx` — flagged-Q aggregate composer
  - `frontend/src/components/result/realism-flag-row.tsx` — per-flagged-Q row + anchor click
  - `frontend/src/components/result/pdf-export-button.tsx` — five-state Blob-URL export
  - `frontend/src/components/ui/tooltip.tsx` — shadcn install with FE-2 post-install token sweep
  - `frontend/src/lib/result/format-delta.ts`
  - `frontend/src/lib/result/format-relative.ts`
  - `frontend/src/lib/result/parse-content-disposition.ts`
  - `frontend/src/lib/result/scroll-to-question.ts`
  - `frontend/src/lib/result/derive-status.ts`
  - `frontend/src/lib/result/adaptive-loop-format.ts`
  - `frontend/src/lib/result/format-answer-payload.ts`
  - `frontend/e2e/result-page-fe6.spec.ts` — Playwright E2E
  - 14 new test files under `frontend/tests/lib/result/*` and `frontend/tests/components/result/*` and `frontend/tests/pages/result-page.test.tsx`

- Files changed (FE-6 scope):
  - `app/schemas.py` — new nested Pydantic models (`ResultGrade`, `ResultQuestion`, `ResultPill`, `ReviewSummary`, `LoopStep`); `AttemptResultResponse` widened to the full §B contract with `Field(default_factory=list, json_schema_extra={"default": []})` on list fields
  - `app/domain/attempts.py` — `result_view`: per-Q migrated to nested `grade` sub-object; `_result_pills`: bulk-loaded Pills + CompetencyProfiles (N+1 eliminated); `_testee_observation_counts`: bulk-load-once helper replacing N+1+1; `view_attempt`: realism triple joined from `RealismFlag`
  - `app/domain/pdf.py` — `_grade_row_text` reads new `grade` sub-object; preserves `under_admin_review` no-leak
  - `frontend/src/app/globals.css` — `@keyframes flash` + `@keyframes pulse-dot`
  - `frontend/openapi/schema.json` — regenerated from updated Pydantic models
  - `frontend/src/types/api.d.ts` — regenerated via `pnpm codegen`
  - `frontend/src/mocks/handlers.ts` — `defaultResult` extended with new required fields; `makeRichResult` builder added (append-only)
  - `frontend/src/app/(authed)/(testee)/attempts/[attemptId]/result/page.tsx` — replaces FE-4 placeholder
  - `frontend/tests/components/attempt/GradingOverlay.test.tsx` — fixtures updated for new required arrays
  - `frontend/e2e/attempt-frozen-roundtrip.spec.ts` — `/result` mock body updated for new shape; assertions updated for new page text
  - `frontend/e2e/attempt-per-testee-roundtrip.spec.ts` — `/result` mock body updated for new shape
  - `frontend/package.json` + `pnpm-lock.yaml` — `@radix-ui/react-tooltip@1.1.8`
  - `tests/integration/test_p6_result_view_gate.py` — migrated to new per-Q `grade` sub-object
  - `tests/integration/test_p4_grading.py` — migrated to new per-Q `grade` sub-object
  - `FE_CHECKLIST.md` — FE-6 rows ticked (5/5)

- Files removed: none.

- Summary of the change: FE-6 ships the full testee results page at `/attempts/[attemptId]/result`, replacing the FE-4 placeholder with a complete eight-card composition (ResultHero, ByPillCard, ByQuestionCard, AdaptiveLoopCard, TransparencyBlock, RealismAggregateCard, PdfExportButton, plus per-row primitives and seven helpers). The PR is a backend + frontend co-authorship: Slice 1 widened `AttemptResultResponse` to the full FE-6 §B contract, migrated per-Q grade to a typed nested sub-object, joined realism-flag data onto `AttemptView`, and (via Gitar fix-round) eliminated two N+1 query patterns. Slices 2–5 built the full result-page component tree with 95 new frontend tests bringing the Vitest suite from 466 → 561, plus one new Playwright E2E spec.

## What was decided in this PR

Plan file: `/root/.claude/plans/fe-6-build-session-joyful-sunset.md`.

- **Co-author backend + frontend in one FE-6 PR (user-locked Option A at session opener).** FE-6 §H (a) calls for a spec-clarification PR to land on `main` before the build session. The user locked Option A: co-author the backend payload amendment as Slice 1 of the FE-6 PR itself. Recorded here as the approved deviation for future sessions to cite.

- **Status enum stays `"ready"` in code; spec body rename to `"complete"` is deferred housekeeping.** The backend's `AttemptResultResponse.status` value is `"ready"`. All FE-6 code, MSW fixtures, and TypeScript types use `"ready"`. The spec document rename is a non-blocking follow-up commit. User-locked.

- **`refetchInterval` policy: 5s while `status === "review_pending"`, stop on `"ready"`; `refetchOnWindowFocus: true`.** Locked at plan close. `refetchIntervalInBackground: false` (TanStack v5 default) is a documented choice — backgrounded-tab polling pauses; `refetchOnWindowFocus` fires on tab return. Call-site options live on the page-level `useQuery` per AC-CD21.

- **`competence_estimate_after` / `_delta` and `median_time_seconds` return `null` in v1.** Neither has a per-attempt snapshot column on the `Attempt` model. Both nullable on `AttemptResultResponse`; FE handles `null` via `format-delta.ts` ("—" + "first attempt" hint per AC-D9). Filed for a follow-up backend PR.

- **`RealismFlag.realism_flag_note` always null in v1.** The existing `RealismFlag` model does not capture a user-typed note. `view_attempt` adds the field; FE renders where non-null. Surface deferred.

- **`Tooltip` shadcn install + `@keyframes flash`/`pulse-dot` folded into Slice 2.** Both absent in FE-2. Added with the FE-2 post-install token sweep (no hex / shadcn default tokens).

- **Result route lives under `(authed)/(testee)/`** — the existing FE-1 route group, not `(testee)/` as the spec body assumed. Doc-drift, not runtime drift.

- **`PdfExportButton isGated` literal-false at render site (Gitar finding #5, Slice 5, resolved in commit `bf0e2b8`).** Inside the `result.status === "ready"` guard, `isGated={result.status !== "ready"}` evaluated tautologically false. Cleaned to `isGated={false}` per Gitar's recommended fix. Moving the button outside the ready guard to surface the gated tooltip during `review_pending` is a separate FE-6.x design call.

- New anchors introduced: none. Existing set covers FE-6: AC-D6, AC-D9, AC-D19, AC-D20, AC-D21, AC-D22, AC-CD6, AC-CD15, AC-CD18, AC-CD19, AC-CD20, AC-CD21, AC-CD24.

## Drift flags raised and how they were resolved

No standalone drift-sweep artefact was authored. The following surfaced and were resolved during the build:

1. **Co-authored backend amendment in a frontend-phase PR (§H (a) "spec-clarification PR first" framing).** User-locked Option A — co-author the amendment as Slice 1. No separate spec-clarification PR was authored.

2. **Status enum name mismatch: backend `"ready"` vs spec body `"complete"`.** User-locked — code stays `"ready"`; doc rename deferred.

3. **`Tooltip` shadcn component absent from FE-2's install set.** Installed in Slice 2 with full FE-2-discipline post-install token sweep.

4. **`@keyframes flash` and `@keyframes pulse-dot` not in `globals.css`.** Added in Slice 2 after verifying absent.

5. **Result route group is `(authed)/(testee)/` not `(testee)/`.** Doc-drift; absorbed. Spec body to be updated in a housekeeping commit.

6. **`competence_estimate_after`/`_delta` and `median_time_seconds` return null.** Backend lacks per-attempt snapshot column / cross-attempt median query. FE handles null. Forwarded to Section 6.

7. **`RealismFlag.realism_flag_note` always null in v1.** Model lacks note column. FE renders only when non-null. Forwarded to Section 6.

8. **N+1+1 query loop in `_testee_pill_observation_count` (Gitar finding #1, Slice 1, resolved in `4efe15a`).** Replaced with a bulk-load-once helper `_testee_observation_counts(db, testee_id) -> dict[pill_id, int]` returning the full pill-keyed map in O(3) equality WHERE queries. Note: Gitar's suggested JOIN + COUNT approach would break the AC-CD15 zero-DB harness (FakeSession supports single-model equality only); the bulk-load-then-Python-walk pattern matches the existing `grade_review.py::_pills_by_id` precedent.

9. **N+1 queries in `_result_pills` loop for Pill + CompetencyProfile (Gitar finding #2, Slice 1, resolved in `4efe15a`).** Bulk-loaded both before the loop, indexed in Python.

10. **Mutable default list in `ReviewSummary` (Gitar finding #3, Slice 1, resolved in `4efe15a`).** Changed to `Field(default_factory=list)`.

11. **`default_factory` drops default from OpenAPI schema, making TS types optional (Gitar finding #4, Slice 1, resolved in `4efe15a`).** Added `json_schema_extra={"default": []}` to all three list fields so the OpenAPI snapshot retains the default annotation while keeping `default_factory` for Python runtime safety. TypeScript types regenerated; consumers stay required-with-default.

12. **`PdfExportButton isGated` prop tautologically false (Gitar finding #5, Slice 5, resolved in `bf0e2b8`).** Replaced with `isGated={false}` per Gitar's recommendation; comment notes that moving the button outside the ready guard to surface the gated tooltip during `review_pending` is a separate FE-6.x design call.

13. **Playwright E2E: strict-mode `getByText("Antifouling")` match + cross-origin `Content-Disposition` exposure (resolved in `3246c31`).** Two CI-only failures surfaced on the first Slice 5 push: (a) Playwright's strict mode rejected `getByText("Antifouling")` because both the by-pill row and the loop step's title contained the string — scoped the assertion to `getByTestId("by-pill-card").getByText("Antifouling")`. (b) The PDF download test compared `download.suggestedFilename()` against the `Content-Disposition` value, but the cross-origin (`localhost:3000` → `localhost:8000`) `fetch()` doesn't expose non-safelisted response headers without `Access-Control-Expose-Headers` — added the expose-header to the Playwright route fixture. The production FastAPI `CORSMiddleware` config already exposes `Content-Disposition`, so this was a test-fixture-only fix.

## Open questions deferred to a later phase

Carried forward from PR-056:

- **`POST /v1/attempts/{id}/focus-events`.** Inherited from FE-4; not affected by FE-6.
- **`response_payload` on `AttemptView.questions[]`.** Inherited from FE-4; not affected by FE-6.
- **Pill→test find-or-generate (`POST /v1/tests/generate`).** When unblocked, the `LoopStepRow` `retest_queued` CTA route may be updated.
- **Cross-device resume / attempt history list.** Inherited; FE-7 territory.
- **`live` mode routing.** Inherited; placeholder unchanged.
- **`SubmitMode` / `GradingOverlay` copy for `per_testee` mode.** Inherited; FE-9 territory.
- **`traceId` threading into `SystemGlitchOverlay`.** Inherited from FE-5 as unverified.
- **`reconnect_exhausted` local-timer-hold in `StreamingRunner.tsx`.** Inherited from FE-5 as unverified.

New from FE-6:

- **`competence_estimate_after` / `competence_estimate_delta` / `median_time_seconds` — null in v1; deferred to a follow-up backend PR.** A per-attempt snapshot column on `Attempt` (or a post-hoc derivation) is required to populate these. The hero renders "—" + "first attempt" hint per AC-D9 for all attempts in v1.

- **`RealismFlag.realism_flag_note` always null in v1.** When the model is extended to capture notes, `RealismFlagRow` requires no FE change — the field is already wired.

- **`AdaptiveLoopCard` Defer CTA is a v1 no-op.** Tooltip explains the deferral mechanism lives in FE-9 admin operations.

- **Spec body rename `"complete"` → `"ready"`.** Housekeeping commit deferred.

- **`PdfExportButton` gated-state reachability.** Currently mounted inside the `status === "ready"` guard, so the `gated` state with its tooltip is never surfaced. Moving it outside the guard is a separate FE-6.x design call.

## Build state vs spec

### Complete

- `result/page.tsx` composition: role guard (AC-CD20), loading skeleton, `useQuery` with 5s `refetchInterval` while pending + `refetchOnWindowFocus`, error boundary (Pattern C).
- `ResultHero`: all states — pending / pending-overdue (60s ceiling) / complete / deterministic-only / first-attempt / benchmark. Delta colour-mapping and "—" null handling per AC-D9.
- `ReviewBanner` + `ReviewStatusDot`: all copy variants; pulse-dot tone shifts amber on overdue.
- `ByQuestionCard` + `QuestionGradeRow`: all row states — deterministic correct/incorrect, AI pending/confirmed/flagged, partial credit, expand-reveal; FIG badge stub per AC-CD24; `data-question-id` anchor attributes.
- `AiReviewChip`: three states + n/a for deterministic.
- `ByPillCard` + `PillWeaknessRow`: empty-hide; per-row severity colour + calibration confidence label (AC-D20) + AC-D21 safety badge.
- `AdaptiveLoopCard` + `LoopStepRow`: three step types; step_down_hint sub-line; external link `rel="noopener noreferrer"`; pending/empty hide; Defer CTA v1 no-op with tooltip.
- `TransparencyBlock`: all five states; model IDs from response per AC-CD18; anchor links to `#question-{n}`.
- `RealismAggregateCard` + `RealismFlagRow`: with-flags / empty-hide; click-to-anchor; note rendered when non-null.
- `PdfExportButton`: five states; `useMutation` raw-fetch → Blob → object-URL → synthetic download → revoke; `Content-Disposition` filename parsing; Sonner toasts per AC-CD6.
- `Tooltip` shadcn install with FE-2 token sweep.
- `@keyframes flash` + `@keyframes pulse-dot` in `globals.css`.
- Seven helper functions, all with unit-test coverage.
- Backend `AttemptResultResponse` full §B contract; N+1s eliminated; `json_schema_extra` defaults preserved on list fields.
- `view_attempt` realism-flag triple joined from `RealismFlag`.
- `FE_CHECKLIST.md` FE-6 rows ticked (5/5).
- Playwright E2E `result-page-fe6.spec.ts` (2 scenarios, both green locally + in CI after `3246c31`).

### Partial

- **Hero competence-delta stat card:** renders "—" for all attempts in v1 (backend fields null). Layout + null-handling code complete; live data path awaits the follow-up backend PR.
- **Hero median-time hint:** hidden in v1 (`median_time_seconds` null). Code guards present.
- **`PdfExportButton` gated state:** the component supports it; not reachable at the current call site (gated state would only matter if PdfExportButton moves outside the `status === "ready"` guard).

### Stubbed

- **Image rendering (AC-CD24):** `has_figure` drives the FIG badge; no figure image body in v1.
- **`RealismFlagRow` note text:** always null in v1; `RealismFlag` model lacks the note column.
- **`AdaptiveLoopCard` Defer CTA:** button renders; `onClick` is a v1 no-op.
- **`live` mode branch in attempt runner:** FE-4/FE-5 placeholder unchanged; no FE-6 edit.

## Test coverage and CI results

- Tests added:
  - **6 new lib unit tests** (`tests/lib/result/*`): format-delta, format-relative, parse-content-disposition, scroll-to-question, derive-status, format-answer-payload.
  - **7 new component tests** (`tests/components/result/*`): result-hero, by-question-card, by-pill-card, adaptive-loop-card, transparency-block, realism-aggregate-card, pdf-export-button.
  - **1 new page-integration test** (`tests/pages/result-page.test.tsx`).
  - **1 new Playwright E2E** (`e2e/result-page-fe6.spec.ts`) — 2 scenarios.
  - **2 backend test migrations** (`tests/integration/test_p6_result_view_gate.py`, `test_p4_grading.py`) — fixtures updated to new per-Q `grade` sub-object shape.
  - **1 frontend test fixture migration** (`tests/components/attempt/GradingOverlay.test.tsx`) — `defaultResult` fixture updated.

- Coverage delta: 95 net-new Vitest tests across 14 new test files (466 → 561 passing). 1 new Playwright spec (full suite: 6/6 green).

- CI result at merge: backend `checks` + `docker-build` + `migration-chain` green; frontend `checks` (codegen / typecheck / eslint / prettier / vitest / next build) + `docker-build` green; Playwright `e2e` green after `3246c31`. Gitar approved with all 5 findings resolved across slices 1, 2, and 5.

- Manual verification performed:
  - `pytest tests/integration/` (488 passed)
  - `pnpm typecheck` (clean)
  - `pnpm test --run` (561 passed)
  - `pnpm format:check` (clean)
  - `pnpm lint` (clean)
  - `pnpm e2e` (6 passed)
  - `mypy app` (clean)
  - `ruff check .` + `ruff format --check .` (clean)

## Post-merge validation considerations

- Both the backend service and the `acumen-frontend` Docker image are affected. Post-merge local validation requires:
  ```
  docker compose build --no-cache acumen-backend
  docker compose build --no-cache acumen-frontend
  docker compose up
  ```
  before re-running, or the stale-image trap from `SESSION_START.md` will mask both the backend payload widening and the new frontend components.

- Local verify sequence:
  ```
  # Backend
  pytest tests/integration/test_p6_result_view_gate.py -v
  pytest tests/integration/test_p4_grading.py -v
  pytest tests/integration/  # full 488

  # Frontend
  cd frontend
  pnpm install --frozen-lockfile
  pnpm codegen:check
  pnpm typecheck
  pnpm lint
  pnpm format:check
  pnpm test --run            # 561 tests
  pnpm build
  pnpm e2e                   # 6 specs, ~25s
  ```

- Smoke against a real backend: spin up Docker Compose; log in as a testee; start and submit an attempt with mixed deterministic + AI questions; verify (a) REVIEW PENDING banner with pulse-dot; (b) within ~5s flips to REVIEW COMPLETE; (c) ByPillCard + AdaptiveLoopCard + TransparencyBlock mount; (d) PdfExportButton is idle and clicking triggers a Blob download with the backend-provided filename; (e) admin role hitting `/attempts/{id}/result` redirects to `/403`.

## Anything a fresh Claude Code session needs to pick up cleanly

- **Required reading beyond `SESSION_START.md`:**
  - `fe-specs/FE-6-results.md` — per-phase detail spec. Pay particular attention to §B.1 §4 (TanStack Query `refetchInterval` policy and `refetchIntervalInBackground: false` rationale), §B.4 §7 (per-Q chip dependency on `review_verdict` — the biggest drift candidate from Slice 1 exploration), §B.7 (PDF export Blob URL contract), §E.1 (Defer CTA v1 no-op).
  - `handovers/PR-056-fe5-streaming-runner.md` — defines the `streamRef` / mutation-refs pattern, MSW handler-order trap, and `cancelled`-guard-after-every-await pattern that FE-6 inherits unchanged.
  - `handovers/PR-055-fe4-attempt-runner.md` — defines the `GradingOverlay` → router push → result page entry path that FE-6 is the destination of.

- **Environment / setup notes:**
  - No new environment variables.
  - No new `package.json` scripts. Existing `e2e`, `e2e:ui` scripts run the new FE-6 spec alongside the FE-4/FE-5 specs.
  - `frontend/src/components/ui/tooltip.tsx` was added. shadcn UI components now installed: Button, Card, Input, Select, Dialog, DropdownMenu, Tabs, Toast, Skeleton, Tooltip, AlertDialog, Checkbox, Label, RadioGroup, Textarea.
  - `@radix-ui/react-tooltip@1.1.8` is the new Radix dep pinned in `package.json`.

- **Known traps, gotchas, in-progress work that is easy to misread:**

  - **`result.status` is `"ready"`, not `"complete"`.** Every conditional uses `"ready"`. The spec doc says `"complete"` — documented doc-drift. Do not "fix" code to match the spec; the spec body rename is the deferred housekeeping commit.

  - **N+1 queries eliminated in `_result_pills` and `_testee_observation_counts` (Gitar fix-round 1, commit `4efe15a`).** Preserve the bulk-load-first pattern (consistent with AC-CD15 — equality WHERE only in the FakeSession harness). Gitar's suggested JOIN + COUNT would break the integration test harness.

  - **`json_schema_extra={"default": []}` on Pydantic list fields is load-bearing for TypeScript types.** `ReviewSummary.flagged_question_positions`, `AttemptResultResponse.pills`, and `AttemptResultResponse.adaptive_loop` all carry `Field(default_factory=list, json_schema_extra={"default": []})`. If removed, `openapi-typescript` generates these as optional fields and downstream FE code needs `?.`/`?? []` guards.

  - **`response: dict[str, Any]` on `ResultQuestion` carries `additionalProperties: true`.** Without this, `openapi-typescript` generates `Record<string, never>` (a forbidden-properties shape) for unconstrained dict fields. The FE narrows the wire payload via `formatAnswerPayload`.

  - **`PdfExportButton` gated state.** Currently the button mounts inside the `result.status === "ready"` guard with `isGated={false}`. The gated state with tooltip during `review_pending` is therefore unreachable. If a future spec change wants the gated tooltip surfaced during pending, move the button outside the guard and pass `isGated={result?.status !== "ready"}`.

  - **Anchor scroll deferred until after query resolves.** `scroll-to-question.ts` targets `[data-question-id="..."]` DOM nodes. If `#question-{n}` is in the URL on first paint, the scroll must wait until result data + card rows have mounted. Spec §B.4 §7 documents this.

  - **FIG badge (`has_figure`) vs figure body.** `QuestionGradeRow` renders a FIG mini-badge when `has_figure === true`; no image body. Correct per AC-CD24 — do not attempt to render image content in v1.

  - **MSW handler-order trap (inherited from FE-4).** `resolveTestHandler` must come before `getTestHandler` in `handlers.ts`'s export array. Preserved unchanged in FE-6.

  - **Cross-origin `Content-Disposition` exposure.** The Playwright E2E spec mocks the export endpoint with `Access-Control-Expose-Headers: Content-Disposition` because the dev server serves the frontend at `localhost:3000` and intercepts the API at `localhost:8000`. The production FastAPI `CORSMiddleware` already exposes Content-Disposition; this is a Playwright-fixture-only concern.

- **Recommended next action:** **FE-7 — Competency constellation + history.** Two backend spec-drift PRs must merge on `main` before FE-7 opens (hard dependency per `FE_ROADMAP.md:149–154`):
  - `GET /v1/attempts` (testee own-scope)
  - `GET /v1/me/competence` (per-pill competence_estimate × band × n × confidence)

  Confirm both land before opening the FE-7 build session. The result page already feeds the testee with adaptive-loop CTAs to weak pills, so the natural follow-up is to expose the cross-attempt competency profile and history view that those CTAs implicitly reference.
