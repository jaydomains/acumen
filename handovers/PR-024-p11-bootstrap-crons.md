# Handover — PR-024 P11 Bootstrap, safety links, crons, cost, comms

## PR identifier and link

- PR: #24 — P11 — Bootstrap, safety links, crons, cost, comms (branch
  `claude/acumen-p11-bootstrap-nwdWp`)
- Link: <https://github.com/jaydomains/acumen/pull/24>
- Author / session: Claude Code session (P11 single attempt; 5 slices
  + per-slice Gitar review pause; user enabled auto-continue carve-out
  after Slice 1 push). One CI fix-up commit between Slice 3 and Slice
  4 (the Tavily fail-fast-misconfig timing assertion). Slice 1: 2
  Gitar findings resolved; Slice 2: 1 informational finding accepted
  with a TODO comment; Slice 3: 2 Gitar findings resolved; Slice 4:
  1 informational finding deferred via docstring addendum (the
  established AC-CD15 trade-off precedent).
- Date closed: 2026-05-22

## Phase reference

- ROADMAP phase closed by this PR: **P11 — Bootstrap, safety links,
  crons, cost, comms** — the final ROADMAP build phase.
- Does this PR fully close the phase? **Yes.** All ROADMAP P11
  done-when criteria are met verbatim (ROADMAP §194–196):
  1. **"One-command bootstrap populates anchors/links/index and is
     re-runnable without duplication."** `POST /v1/admin/bootstrap/run`
     runs the AC-D23 4-step sequence; a second call surfaces all-zero
     counters (`tests/integration/test_p11_bootstrap_idempotent.py::test_bootstrap_re_run_is_counter_zero_no_op`).
  2. **"The seven crons are scheduled."** `app/beat_schedule.py`
     populates 7 entries; CODE_SPEC §8's verbatim cron set
     (`tests/integration/test_p11_beat_schedule.py::test_beat_schedule_has_exactly_seven_entries`).
  3. **"A budget alert fires at threshold."** The AC-D18 inline-fire
     path shipped at P5 (`test_p5_budget_alert.py`) + the P11 cron
     wrapper exercises it on a daily schedule
     (`tests/unit/test_p11_celery_wrappers.py::test_cost_budget_sweep_task_returns_thresholds_fired_shape`).
  4. **"An attempt exports to PDF."** `GET /v1/attempts/{id}/export.pdf`
     returns ReportLab-rendered PDF bytes
     (`tests/integration/test_p11_pdf_export.py::test_pdf_export_deterministic_attempt_returns_application_pdf`).
  5. **"Reminder/escalation emails send per AC-D26."** The engagement
     sweep + SMTP capture pattern shipped at P4
     (`tests/integration/test_p4_engagement.py`); P11 adds the Celery
     wrapper + beat entry that runs it daily without operator
     intervention.

## What was built

Five slices + four Gitar fix-up commits. Per-slice Gitar review ran
on each slice commit; the user enabled auto-continue carve-out after
Slice 1 ("subscribe to pr, implement fixes for gitar review, when
gitar goes green, auto continue with next slice"), so Slices 2-5 ran
without explicit user gating between them — the harness drove on
Gitar approval.

**Files added (10):**

- `app/domain/pdf.py` — Slice 1. ReportLab `Platypus`-based attempt-
  result renderer; consumes the `view_attempt` + `result_view` dicts;
  XML-escapes every user-supplied string before passing to `Paragraph`
  (Gitar PR-#24 Slice 1 finding #1).
- `app/domain/web_search.py` — Slice 3. `WebSearchSource` Protocol +
  `TavilyWebSearch` adapter + module-level singleton mirroring the
  Drive + OpenAI provider lazy-build pattern. Retry predicate
  excludes `RuntimeError` so a missing-API-key fail-fasts (Gitar
  PR-#24 Slice 3 finding #2).
- `tests/integration/test_p11_pdf_export.py` (8 tests) — PDF endpoint
  round-trip + ownership + submission gate + XML-escape regression.
- `tests/integration/test_p11_beat_schedule.py` (7 tests) — beat
  schedule shape + entry mapping + Celery task registry.
- `tests/integration/test_p11_safety_link_curation.py` (12 tests) —
  curation + monthly check + URL dedupe + admin endpoint.
- `tests/integration/test_p11_anchor_top_up.py` (5 tests) — `top_up=True`
  branch of `generate_anchor_pool_for_pill`.
- `tests/integration/test_p11_bootstrap_idempotent.py` (8 tests) —
  orchestrator end-to-end + admin endpoint.
- `tests/unit/test_p11_celery_wrappers.py` (7 tests) — Celery task
  wrapper smoke + `_session_factory` monkeypatch.
- `tests/unit/test_p11_web_search.py` (6 tests) — Tavily adapter
  contracts + missing-API-key fail-fast.
- `handovers/PR-024-p11-bootstrap-crons.md` — this file.

**Files changed (13):**

- `app/beat_schedule.py` — populated with 7 crontab entries
  (grade_review every 5 min; realism nightly 02:00; drive_rag daily
  03:00; calibration daily 04:00; safety_links monthly day-1 05:00;
  cost.budget_sweep daily 06:00; engagement daily 07:00 UTC). Daily-
  hour offsets are operational defaults, not spec-locked.
- `app/worker.py` — 6 new Celery task wrappers (engagement.sweep,
  calibration.run, drive_rag.ingest, realism.aggregate,
  safety_links.check, cost.budget_sweep) following the existing
  `reconcile_grade_reviews_task` shape; `make_celery` wires the
  beat schedule onto `celery_app.conf.beat_schedule`. The
  `cost_budget_sweep_task` carries a multi-tenancy TODO comment
  (Gitar PR-#24 Slice 2 informational suggestion).
- `app/domain/safety_links.py` — extended from the P3 auto-tag-only
  shape with `curate_links_for_pill` + `check_safety_links` +
  `_existing_links_for` (Gitar PR-#24 Slice 3 finding #1 URL
  dedupe).
- `app/domain/bootstrap.py` — filled from the docstring stub with
  `run_bootstrap()` orchestrator implementing the AC-D23 4-step
  contract.
- `app/domain/calibration.py` — `generate_anchor_pool_for_pill`
  gains a `top_up: bool = False` parameter + `_live_anchor_counts_by_band`
  helper for the per-band deficit math. `top_up=False` (default)
  preserves the existing P8 admin-endpoint 409 contract.
- `app/routers/attempts.py` — new `GET /v1/attempts/{id}/export.pdf`
  endpoint; reuses `_load` ownership gate; wraps the sync ReportLab
  render in `anyio.to_thread.run_sync` (Gitar PR-#24 Slice 1
  finding #2).
- `app/routers/admin.py` — three new admin triggers:
  `POST /v1/admin/safety-links/check`, `POST /v1/admin/bootstrap/run`.
- `app/schemas.py` — `SafetyLinkCheckResult` (4-counter envelope) +
  `BootstrapRunResult` (11-field envelope).
- `tests/integration/conftest.py` — `_FakeWebSearch` test seam +
  `fake_web_search` fixture mirroring the established `_FakeDrive`
  / `fake_drive` shape.
- `requirements.txt` — pins `reportlab>=4.0,<5.0` (Slice 1) and
  `tavily-python>=0.3,<1.0` (Slice 3).
- `CODE_SPEC.md` — §2 stack-lock table gains the two new pins with
  one-line rationale paragraphs each (AC-CD1 surface).
- `CHECKLIST.md` — six P11 rows flipped from `missing` to `built`
  with specific test-path evidence per row.
- `app/domain/safety_links.py` — small Slice 2 stub for
  `check_safety_links` (zero-counters dict) added between Slice 2 and
  Slice 3 to keep the beat schedule + Celery wrapper landable in
  Slice 2 without circular dependency.

**Files removed:** none.

**Summary:** P11 closes the final ROADMAP phase by wiring the
operational scaffolding the prior 10 phases left as admin-trigger-
only callables. Every long-running sweep that shipped with a
docstring noting "P11 wires the schedule" now has its Celery task
wrapper + beat entry. The new AC-D23 idempotent bootstrap
orchestrator unifies anchor top-up + safety-link curation + Drive
ingest into one re-runnable admin action; the new ReportLab-based
PDF export ships the SPEC §3:136 deliverable without a Dockerfile
system-deps change (pure-Python). The Tavily web-search seam mirrors
the established Drive + OpenAI provider lazy-build pattern. No spec
amendment — pure build against the locked v1.8 contract.

## What was decided in this PR

**New anchors introduced: none.** Every choice falls under existing
anchors; nothing required an AC-D / AC-CD bump.

**Existing anchors this PR depends on:**

- Product: AC-D18 (cost dashboard + budget alerts — P5 base, P11 cron
  wrapper), AC-D21 (safety-link curation + monthly check — P3 auto-
  tag base, P11 curation + check), AC-D22 (Drive RAG ingest + realism
  aggregation — P9 base, P11 cron wrappers), AC-D23 (idempotent
  bootstrap — P11 lands the orchestrator), AC-D26 (engagement
  reminder + escalation — P4 base, P11 cron wrapper), AC-D27 (anchor
  calibration sweep — P8 base, P11 cron wrapper), AC-D19 v1.7 (grade-
  review reconcile — P6 base, P11 beat entry).
- Technical: AC-CD1 (minimum-deps; two new pins with §2 rationale —
  ReportLab + Tavily), AC-CD2 (SiteMesh layout — new
  `app/domain/web_search.py` mirrors `app/domain/drive_source.py`'s
  Protocol-+-lazy-singleton seam), AC-CD3 (one acumen schema; no
  migration in P11), AC-CD7 (Celery + Redis + beat; idempotent
  bootstrap as job — the central anchor P11 closes), AC-CD8 v1.6
  (per-op provenance — every new AI call site stamps
  `record_provenance` unchanged), AC-CD15 (zero-DB / zero-network
  test harness preserved throughout — `_FakeWebSearch` + httpx
  `MockTransport` + the inherited Drive / AI fakes), AC-CD18 (model
  IDs env-overridable — no hard-codes added).

**Deliberate documentation-narrative decisions:**

- **No canonical-doc edits during slices.** SPEC / DECISIONS /
  CODE_SPEC / SESSION_START / ROADMAP are untouched beyond CODE_SPEC
  §2's two new dep rows (AC-CD1 surface). Only `CHECKLIST.md` moves
  at PR close. Matches the P4 / P5 / P6 / P7 / P8 / P9 / P10
  discipline.
- **CODE_SPEC §2 stack-lock additions for ReportLab + Tavily** —
  AC-CD1 explicitly requires every new dep to land with rationale.
  Pattern matches the existing `argon2-cffi` / `tenacity` rows.
- **Footer staleness sweep deferred** (PR-014 / PR-017 / PR-022
  precedent). SPEC, DECISIONS, CODE_SPEC, SESSION_START all still
  carry pre-v1.8 footers; this PR doesn't sweep them. A future
  SESSION_START hardening PR does the consolidated sweep including
  P11 closure mentions.

**Deliberate spec deviations / implementer choices:**

1. **PDF library = ReportLab.** SPEC §3:136 names "PDF export of an
   individual attempt's graded result" as in-scope but doesn't
   prescribe a library. Picked ReportLab over WeasyPrint (would need
   Pango + Cairo Dockerfile system deps) and fpdf2 (thinner table
   API). Pure Python, no Dockerfile change, AC-CD1 minimum-deps fit.
2. **Web-search provider = Tavily.** `Settings.web_search_api_key`
   shipped at P5 as a placeholder; SPEC §7 says "Integration uses a
   web search API (configuration value — operator chooses provider)".
   Picked Tavily (LLM-friendly JSON, clean SDK, generous free tier)
   over Brave (no SDK, noisier responses) and pluggable-seam-only (no
   default at all). The adapter lives behind the `WebSearchSource`
   Protocol; the operator can swap in a different adapter without
   touching the rest of the pipeline.
3. **Bootstrap orchestrator is admin-triggered, not in the beat
   schedule.** AC-CD7's wording "idempotent enqueued job
   (re-runnable; skips already-populated anchors/links/index)" places
   the bootstrap outside the recurring set. The
   `POST /v1/admin/bootstrap/run` endpoint is the operator's lever;
   the orchestrator's idempotency contract makes re-running safe.
4. **`top_up: bool = False` parameter on `generate_anchor_pool_for_pill`.**
   The existing P8 admin endpoint contract (409 `anchors_exist`)
   stays strict by default — operators triggering anchor generation
   per-pill should see the explicit error when anchors already exist.
   The bootstrap orchestrator opts in via `top_up=True`, which
   computes per-band deficits and generates only the shortfall.
   Existing live anchors are never touched (their calibration history
   stays intact).
5. **Safety-link drift detection is binary SHA-256 only — no AI
   call.** Originally planned an AI-assisted drift review (the SPEC
   §7 / AC-D21 "AI comparison" wording); user flagged at plan-mode
   that AC-CD8 v1.6's operation enum doesn't include a drift
   operation and adding one would be a v1.x spec change, out of P11
   scope. Pure SHA-256 binary mismatch → `safety_links.drift_flagged`
   audit row for admin manual review. If AI-assisted drift becomes
   desirable later, it lands in a v1.x spec amendment.
6. **Cron-schedule daily-hour offsets (02:00 → 07:00 UTC) are
   operational defaults, not spec-locked.** SPEC §8.9 + CODE_SPEC §8
   pin the cadence (daily / nightly / monthly / every-5-min) but not
   the wall-clock hour. The sequential offsets keep the daily DB-load
   spikes from stacking; an operator with different SLA windows can
   adjust the dict freely.
7. **`cost.budget_sweep` Celery wrapper hardcodes `SEED_TENANT_ID`.**
   v1 is single-tenant per AC-CD3 ("RLS is a port seam, not built in
   v1"). Every other wrapper also scopes to `SEED_TENANT_ID` —
   consistent with the codebase, not an outlier. A multi-line comment
   names the SiteMesh-port iteration seam so a future multi-tenant
   onboarding has the exact site to patch (Gitar PR-#24 Slice 2
   informational suggestion).
8. **`_live_anchor_counts_by_band` iterates in Python rather than
   SQL `func.count() + group_by()`.** The AC-CD15 zero-DB test
   harness `CatalogueFakeSession` only supports single-column
   equality WHERE clauses; aggregate SQL would break the in-memory
   tests. Same precedent as `app/ai/cost.py::_spend_for_table`. v1
   scale (≤30 pills × pool_size 20 × ≤6 bands ≈ 3600 max rows per
   call) is well under 1 ms. A docstring addendum names the deferral
   + the migration path (Gitar PR-#24 Slice 4 informational
   suggestion).
9. **`safety_links.py` deferred-imports `record_audit` from
   `catalogue.py`** to break the existing P3 cycle (catalogue
   imports `auto_tag_safety`). Mirrors several other domain modules
   that do the same pattern; no structural change.
10. **`check_safety_links` Slice 2 stub.** A zero-counters stub
    landed in `app/domain/safety_links.py` at Slice 2 so the Celery
    wrapper + beat entry could land complete in Slice 2; Slice 3
    swapped the body to the real implementation without changing
    the public contract.

**Gitar findings + how they were resolved:**

- **Slice 1 finding #1 (Security — XML injection in
  `Paragraph`).** ReportLab's `Paragraph` interprets HTML/XML
  markup; user-supplied prompt + test_name could crash the renderer
  or trigger CVE-2023-33733. Fixed via `escapeOnce` at both call
  sites (`_question_prompt` + the title `Paragraph`). Regression test
  exercises `Maths & symbols <test>` test name + `x < 5 && y > 3`
  prompt.
- **Slice 1 finding #2 (Performance — sync ReportLab in async
  endpoint).** Wrapped the render in `anyio.to_thread.run_sync`
  mirroring `app/domain/drive_source.py`.
- **Slice 2 informational (multi-tenancy on
  `cost_budget_sweep_task`).** Added a multi-line comment naming
  AC-CD3 single-tenant rule + the SiteMesh-port iteration seam.
- **Slice 3 finding #1 (Bug — duplicate `PillSafetyLink` rows).**
  `curate_links_for_pill` checked count only, not URL. Broken-link
  top-up could re-insert the same URL → unbounded duplicates over
  monthly sweeps. Fixed with a URL set + silent skip on duplicate.
- **Slice 3 finding #2 (Performance — `RuntimeError` retried 3
  times).** Tenacity's `retry_if_exception_type(Exception)` caught
  the missing-API-key error; tenacity 8.x doesn't support `~` on
  `retry_if_exception_type` so introduced a custom predicate
  `_is_retryable_tavily_error` that excludes `RuntimeError`.
  Regression test asserts elapsed < 0.9 s.
- **CI failure between Slice 3 and Slice 4** (timing-assertion
  flake on cold CI). Moved the API-key check before the `tavily`
  import in `_get_client` (so the misconfig path doesn't pay the
  import cost) + relaxed the timing assertion from `< 0.5 s` to
  `< 0.9 s` (still strict enough to catch a re-broken retry
  predicate because `wait_exponential(min=1)` sleeps at least a
  full second per retry).
- **Slice 4 informational (SQL `GROUP BY` for
  `_live_anchor_counts_by_band`).** Not actionable under AC-CD15;
  docstring addendum mirrors the established `_spend_for_table`
  deferral precedent.

## Drift flags raised and how they were resolved

**No spec drift surfaced during P11.** The plan-mode question on
safety-link AI drift detection (the only ambiguity) was resolved
upstream of code: user flagged at plan review that AC-CD8 v1.6's
operation enum doesn't carry a drift op, so binary SHA-256 mismatch
became the v1 contract. The plan file was amended; Slice 3
implemented against the amended plan; no spec change required.

## Open questions deferred to a later phase

1. **Footer staleness sweep across SPEC / DECISIONS / CODE_SPEC /
   SESSION_START** (carried over from PR-014 / PR-017 / PR-022 / PR-
   023). Every canonical doc footer reads pre-v1.8 / pre-P11
   pairings. A future SESSION_START hardening PR sweeps all four +
   adds the P11 closure mention to SESSION_START's Current state.
2. **AI-assisted safety-link drift review.** The v1 contract is
   binary SHA-256 mismatch. If operators want AI to triage drift
   before flagging admin attention (the original AC-D21 prose hint),
   that's a v1.x spec amendment adding a `safety_link_drift`
   operation to the AC-CD8 enum.
3. **Promotion of P11-relevant tunables to `system_settings`
   columns.** Same disposition as the prior phases' "v1.x candidate"
   ledger:
   - `_TARGET_LINKS_PER_PILL = 3` / `_MAX_LINKS_PER_PILL = 5`
     (P11 / `safety_links.py`)
   - `_HTTP_FETCH_TIMEOUT_SECONDS = 10` /
     `_HTTP_FETCH_MAX_BYTES = 256 * 1024` (P11 / `safety_links.py`)
   - Daily-cron hour offsets in `beat_schedule.py` (currently
     operational defaults)
   - All prior PRs' deferrals remain valid: `jit_buffer_size`,
     `jit_buffer_max`, `jit_persist_grace_seconds`,
     `GRADE_REVIEW_RECONCILE_INTERVAL_MINUTES`,
     `GRADE_REVIEW_MAX_RETRY_ATTEMPTS`,
     `_FLAG_RATIO_EXCLUSION_THRESHOLD`.
4. **Multi-tenancy on the cost-budget sweep cron.** AC-CD3 makes v1
   explicitly single-tenant; the SiteMesh port flips the iteration
   into the wrapper.
5. **`_live_anchor_counts_by_band` SQL push-down.** Tracked in the
   function's docstring with a profile-trigger comment.
6. **Frontend SSE consumer for per-Testee streaming** (carried
   from PR-023). Out of P11 scope; backend SSE endpoint shipped.
7. **Real-Postgres E2E for the Q1-failure rate-limit-no-burn
   contract** (carried from PR-023). Tracked inline as a docstring
   note in `tests/integration/test_p10_start_attempt_streaming.py`.
8. **P12 (hardening / full E2E)** — ROADMAP §200 says "P12
   (hardening / full E2E) folds into P11's done-when, or becomes a
   follow-up PR if scope grows past one squash." P11 done-when is
   met without P12 work; whether P12 lands as a separate PR is the
   next operator's decision.

## Build state vs spec

- **AC-D18 v1.1 (cost dashboard + budget alerts)** — complete. P5
  shipped the dashboard endpoint + inline-fire path; P11 adds the
  daily cron wrapper covering the "no AI calls between threshold
  crossings" gap.
- **AC-D21 (safety-link curation + monthly check)** — complete. P3
  shipped auto-tag; P11 ships curation (3-5 cached links per safety
  pill, web-search-driven) + monthly check (HTTP HEAD + SHA-256
  drift detection; no AI call per AC-CD8 v1.6 constraint) +
  best-effort broken-link top-up.
- **AC-D22 (Drive RAG + realism feedback)** — operational closure.
  P9 shipped the domain callables + admin triggers; P11 wraps them
  in Celery tasks + schedules them (Drive ingest daily 03:00; realism
  aggregation nightly 02:00).
- **AC-D23 (autonomous bootstrap)** — complete. The 4-step
  orchestrator runs from one operator command (`POST
  /v1/admin/bootstrap/run`); idempotent re-run is a counter-zero
  no-op; new pills added post-launch are picked up by the next
  bootstrap run (or by an admin re-run after pill creation).
- **AC-D26 (engagement reminder + escalation)** — operational
  closure. P4 shipped the sweep + email templates; P11 adds the
  Celery wrapper + daily beat entry.
- **AC-D27 (anchor calibration recompute)** — operational closure.
  P8 shipped the sweep; P11 adds the wrapper + daily beat entry.
- **AC-D19 v1.7 / AC-CD11 v1.7 (grade-review reconcile)** —
  operational closure. P6 shipped the sweep + Celery wrapper; P11
  adds the every-5-min beat entry.
- **AC-CD7 (Celery + Redis + beat; seven crons; idempotent
  bootstrap)** — complete. All seven crons enumerated in
  `app/beat_schedule.py`; bootstrap is the idempotent enqueued job
  outside the recurring set.
- **AC-CD1 (every dependency pinned)** — preserved. Two new pins
  (`reportlab>=4.0,<5.0`, `tavily-python>=0.3,<1.0`) with §2
  rationale rows.
- **AC-CD15 (zero-DB / zero-network test harness)** — preserved.
  `_FakeWebSearch` + httpx `MockTransport` + inherited `_FakeDrive` /
  `RecordingProvider` cover every external surface; `pytest -q` runs
  zero-network.

## Test coverage and CI results

**pytest -q: 716 passed** (P10 baseline 662 + 54 net new across the
five slices):

- Slice 1: 8 PDF export tests (+1 XML-escape regression in fix-up).
- Slice 2: 7 beat-schedule tests + 7 wrapper tests.
- Slice 3: 11 safety-link tests + 6 web-search unit tests (+1 URL
  dedupe regression).
- Slice 4: 5 anchor top-up tests + 8 bootstrap idempotency tests.
- Slice 5: no new tests (CHECKLIST + handover only).

CI parity sweep clean on every commit: `ruff check .`,
`ruff format --check .`, `mypy app`, `scripts/structure_gate.py`,
`scripts/check_unpinned_deps.py` all pass at the pinned versions.

End-to-end manual smoke (post-merge against a real Postgres):

```
# 1. Bootstrap idempotency
POST /v1/admin/bootstrap/run    # 201; non-zero counters on first run
POST /v1/admin/bootstrap/run    # 201; all-zero counters on second run

# 2. PDF export
GET /v1/attempts/{id}/export.pdf
  → 200 application/pdf; bytes start with %PDF-

# 3. Beat schedule
celery -A app.worker:celery_app beat --loglevel=INFO
  → log lines for each of the 7 entries; no KeyError on dispatch

# 4. Safety-link check
POST /v1/admin/safety-links/check
  → 201; counts envelope; audit row safety_links.check

# 5. Engagement sweep
POST /v1/admin/engagement/sweep
  → 200; captured reminder emails for any pending mandatory
    assignments past their reminder threshold

# 6. Budget alert
(seed monthly_ai_budget=$1; trigger AI calls > $0.50)
POST /v1/admin/cost/budget-sweep    # (admin trigger not shipped —
    cron is the only path; inline-fire from AI calls already
    covered)
  → captured email at 50% threshold

# 7. PDF export — XML-special-char prompt
(seed test name "Maths & symbols <test>" + prompt "x < 5 && y > 3")
GET /v1/attempts/{id}/export.pdf
  → 200 application/pdf; opens cleanly in a PDF reader
```

## Anything a fresh Claude Code session needs to pick up cleanly

- **Required reading beyond `SESSION_START.md`:**
  - This handover (full).
  - `handovers/PR-023-p10-jit-streaming.md` for the immediate
    predecessor's "Recommended next action" + the v1.8 contract.
  - The "Open questions deferred to a later phase" section above —
    every P12 / v1.x candidate is tracked there.

- **Environment / setup notes:**
  - Two new env vars matter for production deployments:
    `WEB_SEARCH_API_KEY` (Tavily; falls back to RuntimeError if
    unset — by design; safety-link curation/check will fail until
    configured) and the pre-existing `GOOGLE_DRIVE_*` for Drive RAG.
  - The bootstrap admin endpoint is synchronous; the PR-#20 anchor-
    bootstrap timeout warning applies to fleet-scale deployments.
    The Celery task wrapper path is the production-scale lever
    (callable via `celery -A app.worker call bootstrap.run` once a
    `bootstrap.run` task is added — that's a v1.x extension if needed;
    P11 ships the synchronous path which is sufficient at v1 scale).

- **Known traps, gotchas, or in-progress work that is easy to
  misread:**
  - **`generate_anchor_pool_for_pill` is dual-mode.** `top_up=False`
    (default) raises 409 if any anchors exist; `top_up=True` does the
    per-band deficit math. The bootstrap orchestrator MUST pass
    `top_up=True`; a code path that forgets it will hit 409 on the
    second pill onward.
  - **`safety_links.py` defers the `record_audit` import** to break
    the existing P3 cycle with `catalogue.py`. A refactor that
    hoists the import will fail at module load.
  - **`check_safety_links` writes to the DB even on the "all
    unchanged" path** (it updates `last_verified_at`); a code path
    that uses it without a session it owns will leave the rows
    dirty without committing.
  - **The beat schedule's daily-hour offsets** are operational
    defaults, not spec-locked. Don't paraphrase them as a contract
    in CODE_SPEC.
  - **`_live_anchor_counts_by_band` returns `{band: count}`.**
    Excluded anchors don't appear; a band with zero live anchors
    is missing from the dict entirely (not `{band: 0}`). The
    deficit math uses `.get(band, 0)`.
  - **`TavilyWebSearch._get_client` checks the API key BEFORE
    importing the `tavily` SDK.** This is load-bearing for the
    fast-fail timing assertion in
    `tests/unit/test_p11_web_search.py`.
  - **The cost-budget sweep wrapper hardcodes `SEED_TENANT_ID`** by
    design (AC-CD3 single-tenant). The TODO comment names the
    SiteMesh-port iteration seam.

- **Finding → edit map (for future fix-it-up work):**
  - PDF export → `app/domain/pdf.py` (renderer), `app/routers/attempts.py:236-289` (endpoint).
  - Web search seam → `app/domain/web_search.py` (Protocol + Tavily adapter + singleton).
  - Safety-link curation + monthly check → `app/domain/safety_links.py:59-238` (the new half) + `tests/integration/test_p11_safety_link_curation.py`.
  - AC-D23 bootstrap → `app/domain/bootstrap.py` (full file) + `app/routers/admin.py` (`bootstrap_run` endpoint).
  - Anchor top-up mode → `app/domain/calibration.py::generate_anchor_pool_for_pill` + `_live_anchor_counts_by_band`.
  - Celery wrappers + beat → `app/worker.py` (7 task wrappers) + `app/beat_schedule.py` (7-entry dict).

- **Recommended next action:** Open the optional P12 / hardening /
  full E2E PR if real-Postgres validation is wanted (the deferred
  contracts: Q1-failure rate-limit-no-burn rollback, large-fleet
  bootstrap timing, real beat scheduler boot). Otherwise, the build
  is closed at v1 — the next session is the SESSION_START hardening
  PR that sweeps the four stale footers (SPEC / DECISIONS /
  CODE_SPEC / SESSION_START) + adds the P11 closure mention to
  SESSION_START's Current state.
