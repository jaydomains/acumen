# Handover — PR-031 AC-D8 self-directed learning material

## PR identifier and link

- PR: TBD-on-open / `POST /v1/pills/{pill_id}/learning-material`
- Link: TBD-on-open
- Author / session: Claude Code on the web (claude/self-directed-learning-endpoint-EzQrR)
- Date closed: 2026-05-23

## Phase reference

- ROADMAP phase closed by this PR: none — interstitial AC-D8 implementation gap
- Does this PR fully close the phase? n/a (not a ROADMAP phase). Closes the learning-material half of AC-D8; the test-generation half was wired in earlier phases via self-initiated attempts.

## What was built

- Files added:
  - `app/ai/prompts/learning_material_self_initiated.py` — second prompt variant for the `learning_material` op (`VERSION = "1.0.0"`), reframed as a self-contained overview for someone studying a pill without a prior weakness signal.
  - `tests/integration/test_p5_self_initiated_material.py` — 13 cases covering happy path, 30-day cohort cache, stale-cache regen, `?regenerate=true` gesture, 3 permission gates, 404 missing/retired pill, curated_safety_links branch (AC-D21), 422 `curation_pending` deficit, and both directions of the safety-toggle cache self-heal.
  - `handovers/PR-031-ac-d8-self-directed-learning-material.md` — this file.
- Files changed:
  - `app/ai/prompts/__init__.py` — added `_VARIANT_REGISTRY` and `variant` kwarg on `get_prompt`. Default variant preserves the pre-existing single-prompt-per-op contract; `(Operation.learning_material, "self_initiated")` is the first registered named variant. The `registered_operations()` snapshot is unchanged so `tests/unit/test_p5_prompts.py` keeps holding the seven-op floor.
  - `app/ai/anthropic.py::_call` — pops `_prompt_variant` from the payload before render and forwards it to `get_prompt`. Default is `"default"` so every existing caller picks the same template it always has.
  - `app/domain/learning_material.py` — added `generate_self_initiated(db, *, pill_id, testee_user, regenerate, test_override) -> (LearningMaterial, cached: bool, safety_links: list[PillSafetyLink])`, helpers `_expected_source_for`, `_recent_self_initiated_material`, `_safety_links_for_pill`, `_record_audit`, and `CACHE_WINDOW_DAYS = 30`. The weakness-driven `generate_for_weakness` and the P7 loop wiring are untouched.
  - `app/routers/catalogue.py` — added `POST /v1/pills/{pill_id}/learning-material` (privacy-acked Testee dep). Router-thin: delegates to the domain function, serialises the response polymorphically (`content` for AI rows, `safety_links` for curated rows), commits once at the end.
  - `app/schemas.py` — added `LearningMaterialResponse` and `SafetyLinkResponse`.
  - `CODE_SPEC.md` §7 — one paragraph noting the `learning_material` op now carries two prompt variants (`default` weakness-driven, `self_initiated` AC-D8) routed through the `_prompt_variant` payload key.
  - `CHECKLIST.md` P3 block — new row "Testee self-directed learning material" (AC-D8; AC-D21) status `built`, Evidence pointer to the new test file.
- Files removed: none.
- Summary: AC-D8 says Testees can self-select a pill to drive their own learning and that "selected pills generate AI tests **and learning material** targeted at those pills." The test-generation half has been wired since the self-initiated attempt path landed; the learning-material half has had no entry point until this PR. The new endpoint reuses the existing `Operation.learning_material` provider op with a distinct prompt template and persists rows with `weakness_report_id=None`, caching by pill across the cohort for 30 days so the steady-state cost shape stays benign. Safety-tagged pills mirror the P7 loop's fallback exactly — no AI call, serve the pill's curated `PillSafetyLink` set.

## What was decided in this PR

- **AC-D8 implementation, not amendment.** AC-D8 (DECISIONS.md:213-223) verbatim authorises this surface. The test-generation half landed earlier; this PR closes the learning-material half. No new AC-D anchor and no AC-D6 amendment — citing the existing anchor is the correct framing.
- **Endpoint at `POST /v1/pills/{pill_id}/learning-material`** (Testee-facing on the catalogue router, alongside admin pill CRUD on the same prefix). The auth dependency disambiguates Testee/admin at the route level.
- **Retired pill → 404 not_found** (matches the existing `list_discoverable_pills` convention: retired pills are invisible to Testees, indistinguishable from missing).
- **Safety pills (AC-D21) → curated_safety_links branch.** Mirror P7's fallback exactly: no AI call, pull live `PillSafetyLink` rows, persist a `LearningMaterial` row with `source=curated_safety_links`, `content=None`, `ai_provider=None`, `ai_cost_usd=None`. Edge case: a safety pill with zero curated links → 422 `curation_pending` (rare in steady state — P11's monthly cron + bootstrap curate every safety pill).
- **30-day cohort cache, keyed by pill.** The cohort sharing the row is the cost win. The cache lookup filters by `source` matching the pill's current `safety_relevant` state, so an admin toggle that flips a pill from non-safety to safety (or vice versa) is self-healing without an explicit invalidation step. Stale rows from the old branch remain in the DB (audit history) but are never served.
- **Prompt: separate file.** `learning_material_self_initiated.py` lives next to the weakness-driven `learning_material.py`. Same `Operation.learning_material` op, distinct template + VERSION that persists independently on the produced row's `ai_prompt_version` column. The two prompts can evolve on their own cadence.
- **AC-D18 rate limit: deferred.** AC-D18's existing 5/hr-20/day self-initiated limit scopes to "new test generations", not learning-material ops. The cache window handles steady-state cost; the `?regenerate=true` path is an explicit audit-logged user gesture. If telemetry surfaces abuse, the existing `_enforce_rate_limit` helper in `app/domain/attempts.py:847` can be layered on top with a one-sentence AC-D18 amendment.
- **Audit actions:** `learning_material.self_request` (cache hit or fresh) and `learning_material.self_regenerate` (regenerate=true). Detail carries `pill_id`, `cached`, `regenerate`, and `source`.
- New anchors introduced by this PR: none.
- Existing anchors this PR depends on: **AC-D8** (Testee self-directed learning, the primary citation), **AC-D21** (safety-tagged pills → curated external links), **AC-D14** (retired pills hidden from Testees), **AC-D6** (the weakness-driven path stays untouched), **AC-D18** (rate-limit infrastructure unchanged, deferred amendment), **AC-CD8** (provenance + prompt registry).

## Drift flags raised and how they were resolved

- The user's original framing positioned this PR as introducing a "new product capability not covered by AC-D6". On exploration, AC-D8 was found to already authorise self-directed learning material verbatim. **Resolved during plan-mode**: re-framed as an AC-D8 implementation gap, no spec amendment needed. The plan file and the handover both cite AC-D8 directly.
- The user's original spec called for "410 or 409 if retired — match existing convention". The existing Testee convention turned out to be **404** (discoverable list filters retired pills out; admin endpoints are the only surface that distinguish). **Resolved during planning**: use 404, matches `list_discoverable_pills`, doesn't leak retired-pill existence to the Testee surface.
- The user's original spec also suggested a 422 error for safety pills. The user revised this during planning to mirror P7's curated-links fallback. **Resolved before implementation**: safety pills return 200 with `source=curated_safety_links`. The 422 is reserved for the `curation_pending` edge.
- During implementation, the cache-source-mismatch edge case was raised by the user (a pill toggled from non-safety → safety with a stale AI row in the cache would serve AI content for a now-safety pill, violating AC-D21). **Resolved before merge**: cache lookup filters by `source` matching current pill safety state; stale rows are treated as misses; covered by two new tests (both directions of the toggle).

## Open questions deferred to a later phase

- **Rate-limiting self-initiated learning material.** Deferred per the AC-D18 deferral above. If pilot telemetry surfaces abuse on the `?regenerate=true` path, the follow-up is: small helper to count `learning_material.self_regenerate` audit rows in the last 24h for the requesting Testee, cap at 3 per user per pill per day, one-sentence AC-D18 amendment citing the new op. Out of scope here.
- **Visual content in learning material** — separate v1.x work per the original prompt.
- **Progress tracking / marked-as-read / recommended-next-pill** — v1.x learning-centre surface.
- **Polymorphic browse endpoint for safety-pill links.** This PR returns the curated set inside a `LearningMaterialResponse`. A dedicated Testee-facing safety-link browse endpoint could be useful for a "study the safety material" UX path that doesn't go through `POST .../learning-material`. Not built; not pressing.

## Build state vs spec

- Complete: The endpoint exists, is privacy-acked, returns either AI-generated overview or curated safety links depending on pill type, caches by pill for 30 days across the cohort, self-heals across admin safety toggles, audit-logs every serve event with both cache-hit and regenerate paths distinguished, and is covered by 13 integration tests.
- Partial: nothing in scope is partial. The endpoint is fully wired through the prompt registry, provider, domain, and router; the response shape is documented in `app/schemas.py`; the spec touch is in `CODE_SPEC.md` §7.
- Stubbed: nothing.

## Test coverage and CI results

- Tests added: `tests/integration/test_p5_self_initiated_material.py` — 13 cases.
- Tests changed: none (existing weakness-driven tests in `test_p5_material.py` continue to pass unchanged).
- Coverage delta: not measured numerically — every new branch (happy / cached / stale / regenerate / 3 perm gates / 404 missing / 404 retired / 200 safety / 422 curation_pending / 2 toggle self-heals) has an explicit test. The recording-provider fixture asserts provider-NOT-called on the cache and safety paths so the cost story is regression-guarded.
- CI result at merge: locally green — `pytest` 773 passed; `ruff check` clean; `ruff format --check` clean; `mypy app/` clean across 62 files.
- Manual verification performed: none with a live AI provider; the recording-provider end-to-end coverage gives sufficient confidence at this slice. The cohort-cache savings claim is asserted by `test_self_initiated_within_window_returns_cached_row_no_ai_call` (provider call count == 0 on the second request).

## Post-merge validation considerations

- No Dockerfile change. No bind-mount-affected code. No `compose build --no-cache` needed.
- Local re-verify command sequence:
  - `python -m pytest tests/integration/test_p5_self_initiated_material.py -v`
  - `python -m pytest tests/integration/test_p5_material.py tests/integration/test_p7_loop.py tests/unit/test_p5_prompts.py -v` (regression floor)
  - `python -m ruff check app/ tests/ && python -m ruff format --check app/ tests/ && python -m mypy app/` (CI parity)
- No alembic migration. No new env var. No new system_settings column.

## Anything a fresh Claude Code session needs to pick up cleanly

- Required reading beyond `SESSION_START.md`: `DECISIONS.md` AC-D8 (the primary anchor), AC-D21 (safety-pill carve-out), AC-D14 (retired-pill hiding); `CODE_SPEC.md` §7 (the new paragraph on `learning_material` prompt variants).
- Environment / setup notes: none new.
- Known traps:
  - The cache self-heal across safety toggles is the **only** invalidation mechanism — there is no explicit cache-bust on a safety toggle from the admin endpoint. If a future PR adds a "force cache invalidation on toggle" path, audit the existing self-heal still applies (it does, because the cache lookup re-checks source on every read).
  - `_prompt_variant` is metadata, not a prompt placeholder. The Anthropic provider pops it before render. The `RecordingProvider` does not pop it, so tests asserting variant selection can read it from the recorded call payload (`calls[0][2]["_prompt_variant"]`). Don't add `_prompt_variant` to a prompt template's `{placeholder}` set — it's not data for the model.
  - The new endpoint sits on the same `/v1/pills/{pill_id}` prefix as admin pill CRUD. The auth dependency disambiguates. A future router refactor should keep that distinction explicit (e.g. moving Testee endpoints under `/v1/catalogue/pills/{pill_id}/...` is a possible v1.x cleanup but would be a breaking URL change).
- Recommended next action: open the PR non-draft, run Gitar review binding (per the v1.8 cadence), draft handover stays as-is unless review surfaces a finding that warrants an amendment ledger note.
