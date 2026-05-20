# Handover — PR-015 P4 Tests, assignments, attempts (deterministic)

## PR identifier and link

- PR: #15 — P4 — Tests, assignments, attempts (deterministic) (branch
  `claude/acumen-p4-deterministic-dWEzN`)
- Link: <https://github.com/jaydomains/acumen/pull/15>
- Author / session: Claude Code session (P4 third attempt; PRs #10 and
  #12 closed unmerged after spec drift surfaced mid-build and required
  separate clarification PRs — v1.4 (AC-D26 Attempt→Assignment FK),
  v1.5 (AC-D3 sequence_number scope), v1.6 (consolidated audit) — to
  land first)
- Date closed: 2026-05-20 (PR opened; **left open for morning review**
  per the auto-continue carve-out below — not merged by Claude)

## Phase reference

- ROADMAP phase closed by this PR: **P4 — Tests, assignments, attempts
  (deterministic)**
- Does this PR fully close the phase? **Yes.** All P4 done-when criteria
  are met: (1) a frozen attempt auto-grades MCQ / true_false / matching;
  (2) `shuffle_seed` is stable across pause + resume + reload; (3)
  `engagement_status` derives correctly per (assignment, Testee); (4)
  pause blanks question content and restores on resume; (5) the v1.6 F14
  display-gate clause is in place — deterministic grades compute
  immediately on submit, the result endpoint returns
  `status = "review_pending"` for any attempt containing an AI-graded
  question type (forward-compatible with P6).

## What was built

Three slices, all gated by per-slice Gitar review (auto-fix loop +
auto-continue carve-out, see below).

**Files added (10):**
- `alembic/versions/0004_p4_attempt_assignment_fk.py` — nullable FK
  `attempt.assignment_id` + index; reversible (AC-D26 v1.4).
- `alembic/versions/0005_p4_attempt_sequence_unique.py` —
  `uq_attempt_test_testee_sequence` on `(test_id, testee_id,
  sequence_number)`; reversible (AC-D3 v1.5).
- `app/domain/tests.py` — Test + Question CRUD; campaign lock / publish
  gate / forward-only edit / config validation (AC-D5/D17/D24).
- `app/domain/assignments.py` — Assignment CRUD + assignee snapshot
  (AC-D15 v1.6).
- `app/domain/attempts.py` — start / view / autosave / pause / resume /
  next / submit / **auto-grade** / `result_view`; pure shuffle helpers
  (AC-D3/D4/D5/D11/D13/D17/D18/D24/D26).
- `tests/integration/test_p4_tests.py` (22 tests).
- `tests/integration/test_p4_assignments.py` (15 tests).
- `tests/integration/test_p4_attempts.py` (28 tests).
- `tests/integration/test_p4_grading.py` (10 tests).
- `tests/integration/test_p4_engagement.py` (14 tests).
- `tests/unit/test_p4_shuffle.py` (7 tests).
- `tests/unit/test_p4_schema.py` (4 tests, incl. offline alembic
  round-trip for 0004 + 0005).

**Files changed:**
- `app/models.py` — Attempt gains `assignment_id` FK column and
  `__table_args__ = (UniqueConstraint(...),)`; class docstring updated.
- `app/main.py` — wires the four new routers (tests, assignments,
  attempts, admin).
- `app/routers/tests.py` — replaces the 6-line P3 stub; full admin CRUD.
- `app/routers/assignments.py` — replaces the 6-line P3 stub.
- `app/routers/attempts.py` — replaces the 7-line P3 stub; adds the F14
  `/result` endpoint.
- `app/routers/admin.py` — replaces the 6-line P3 stub; adds engagement
  sweep + pending widget endpoints (admin-only).
- `app/domain/engagement.py` — replaces the 7-line P3 stub; full status
  derivation + sweep, refactored to pre-fetched indices to kill the
  N+1 (Gitar finding #3).
- `app/schemas.py` — Slice 1: TestCreate/Update/Response,
  QuestionCreate/Update/Response, CampaignLockRequest,
  AssignmentCreate/Response. Slice 2: AttemptStartRequest, AutosaveRequest,
  AttemptView, BenchmarkNextResponse. Slice 3: AttemptResultResponse,
  EngagementWidgetItem, EngagementWidgetResponse, SweepResult.
- `tests/integration/conftest.py` — `CatalogueFakeSession` gains a no-op
  `rollback` for the IntegrityError-retry path.
- `pyproject.toml` — pytest `filterwarnings` to silence the harmless
  `PytestCollectionWarning` against SPEC §5 `Test*` model classes.
- `CHECKLIST.md` — P4 rows ticked with real Evidence (test paths).

**Files removed:** none.

**Summary:** P4 lands the deterministic-execution spine — admin CRUD on
tests + assignments, the four `TestMode` paths through start/autosave/
pause/resume/submit, lazy max-duration auto-resume, the 64-bit
attempt-seeded shuffle with block-internal preservation, deterministic
auto-grading of MCQ / TF / matching on submit, the F14 mixed-test
display gate, per-(assignment, Testee) engagement status, and the
reminder/escalation sweep with the SMTP send seam wired. No
canonical-doc edits during the slices (the cause of the two prior P4
failures); only `CHECKLIST.md` updates at PR close, per SESSION_START.

## What was decided in this PR

**New anchors introduced:** none. Implementation lands against the
v1.6 audited spec.

**Existing anchors this PR depends on:**

- Product: AC-D2 (two roles), AC-D3 v1.5 (sequence_number scope),
  AC-D4 #5 / #3 (focus events), AC-D5 (four modes), AC-D6 (loop_mode
  carried on assignment), AC-D9 v1.6 (difficulty range honoured per
  pill), AC-D11 v1.6 (lazy pause, content blanking, max-duration
  auto-resume on next interaction), AC-D13 (benchmark sequential stub),
  AC-D15 v1.6 (assignee snapshot with `via_group_id`), AC-D17 (frozen
  snapshot at attempt start), AC-D18 (rate limit + exempt set —
  assignment_driven + loop_driven), AC-D19 v1.6 (no grade/grade_review
  for deterministic in P4 — AI-graded items get neither row in P4; F14
  mixed-test gate), AC-D24 (lock_mode, shuffle from attempt id,
  block-internal preservation), AC-D26 v1.6 (per-(assignment, Testee)
  engagement, assignment-scoped reminder history with per-Testee cease
  derivation, escalation cap via `escalation_sent_at`).
- Technical: AC-CD2 (thin routers; main.py setup-only), AC-CD5 (auth
  seam via `permissions.py`), AC-CD7 (cron-as-callable now; beat is
  P11), AC-CD15 (zero-DB / zero-network test harness intact).

**Decisions recorded with the user (plan-mode questions):**

1. **AI-graded items in P4:** when an attempt contains short_answer /
   scenario, ship the gate without writing placeholder grade rows. The
   absence of a row IS the canonical "not-yet" signal (AC-D19 v1.6); P5
   adds the AI grade and P6 the grade_review. The result endpoint
   returns `status = "review_pending"` — no scores leak.
2. **Engagement sweep surface in P4:** callable
   (`run_engagement_sweep`) **plus** an admin-only trigger endpoint
   `POST /v1/admin/engagement/sweep`. Not registered in
   `beat_schedule.py` (P11 wires the seventh cron).
3. **Reminder/escalation email send in P4:** send through the P2
   `SMTPClient` / `captured_emails` seam now (fail-soft, captured in
   tests). P11 only adds the beat schedule.

**Deliberate documentation-narrative decisions:**

- **No canonical-doc edits during the slices.** SPEC / DECISIONS /
  CODE_SPEC / SESSION_START / ROADMAP are untouched. Only
  `CHECKLIST.md` moves, at PR close. This is the operational rule that
  follows from the two prior P4 failures: mid-build spec drift requires
  a separate clarification PR (the user authors it, a fresh session
  implements against the corrected text). v1.4 / v1.5 / v1.6 were
  exactly those clarification PRs; P4 was the implementation-only
  follow-on, and stayed implementation-only.
- **Auto-continue carve-out (this session only, prominently flagged).**
  SESSION_START's default rule is to pause at each slice boundary for
  explicit user confirmation that Gitar is clean. The user explicitly
  carved out this session — they were away overnight, PR review next
  morning is the quality gate. The carve-out: after each slice, commit
  → push → subscribe; on Gitar review, auto-fix in up to 2 attempts;
  when Gitar clean + CI green, auto-proceed to the next slice; after
  Slice 3 clean, update `CHECKLIST.md` + author this handover, leave
  the PR open. Halting conditions: spec drift, irresolvable Gitar
  finding (>2 fix attempts), unrelated CI failure, migration revision
  conflict, structural addition (new domain module beyond
  tests/assignments/attempts/engagement). None of these fired.
- **Structure-gate change scope.** The `tests` / `assignments` /
  `attempts` / `engagement` domain modules and the `admin` router were
  already declared in the CODE_SPEC §3 layout (P0 stubs); replacing
  them is in-scope. No new module names introduced.

## Drift flags raised and how they were resolved

No spec drift surfaced. The v1.6 pre-build audit (PR-014, handovers/
PR-014-v1.6-spec-audit-consolidation.md) had already reconciled the
P4/P5/P6 spec prose with the shipped P1 schema, so P4 ran as a pure
code phase with no doc edits required.

**Pattern conflict surfaced (not drift):** the existing `0002_p1_data_
model.py` compiles DDL from `Base.metadata.sorted_tables` dynamically,
so adding `attempt.assignment_id` and the new UniqueConstraint to
`models.py` means a fresh `alembic upgrade base:head` would (a) emit
the column at 0002 (because metadata has it) and (b) emit `ALTER TABLE
ADD COLUMN` again at 0004. In real PG this would raise "column already
exists"; in `--sql` offline mode (the only mode CI runs) it's
emit-only and the round-trip test passes. Resolution: followed the
**explicit project convention established by 0003** (`pill.safety_
relevant_overridden_at` exhibits the same shape — added to the model
**and** added by a raw-ALTER migration). The convention treats 0002's
dynamic emission as the canonical fresh-install path and the later
additive migrations as the upgrade-existing-DBs path. No deviation; no
canonical-doc change needed.

**Four Gitar findings on this PR, all resolved on-branch:**

1. **`publish_test` re-publish guard** (`app/domain/tests.py`) — added a
   409 `already_published` short-circuit at the top of `publish_test`
   so a no-op repeat does not write a misleading `test.publish` audit
   entry. Regression test:
   `test_publish_rejected_when_already_published`.
2. **Rate-limit `or` falsy-coercion** (`app/domain/attempts.py::
   _enforce_rate_limit`) — `or _DEFAULT_*` silently coerced an
   admin-configured `0` to the default. Replaced with explicit
   `is None` checks across all three rate-limit and max-pause fallback
   spots. Regression test:
   `test_explicit_zero_rate_limit_is_honoured_not_silently_defaulted`.
3. **Engagement sweep N+1** (`app/domain/engagement.py`) — refactored to
   four pre-fetched tenant-scoped indices (assignees by assignment,
   attempts by `(assignment, testee)`, reminders by assignment, users
   by id); downstream lookups are in-memory.
   `_status_from_attempts` is the shared pure derivation; the public
   `derive_engagement_status` keeps its one-shot signature.
4. **Reminder steps ordering** (`app/domain/engagement.py::
   _reminder_steps`) — return value now `sorted()` chronologically so
   a non-ascending admin config (e.g. `[30, 14]`) doesn't trip the
   `break`-on-future loop early. Regression test:
   `test_sweep_steps_chronologically_regardless_of_input_order`.

## Open questions deferred to a later phase

- **Real AI grading (P5):** AI-graded responses (short_answer /
  scenario) produce no `grade` row in P4 — the absence is the
  not-yet signal. P5's Anthropic grading layer fills it.
- **Cross-family review + AC-CD11 gate (P6):** the F14 result-display
  gate widens from "any AI-graded type = pending" to "all
  `grade_review` confirmed/flagged-resolved" at P6. The deferred F10
  in CODE_SPEC §18 also amends AC-D19's "10–30 second" wording at the
  same time.
- **Beat-schedule wiring of the engagement sweep (P11):** the sweep
  is callable + admin-trigger now; the seventh cron in
  `app/beat_schedule.py` (per SPEC §8.9 / CODE_SPEC §8) lands in P11.
- **Path-level engagement aggregation:** AC-D9 v1.6 specifies "path
  completion = all in-scope pills attempted and submitted by the
  assignee". P4 derives `engagement_status` per (assignment, Testee)
  for any assignment row (pill OR path target). The per-pill drill-
  down for path assignments is a P7 concern (it composes with
  weakness/loop logic).
- **Display-side answer encoding for shuffled MCQ / matching.** P4
  grades against the canonical snapshot indices; the autosave payload
  is documented as carrying canonical indices (`{"choice": int}`,
  `{"answer": bool}`, `{"matches": [int]}`). The frontend (separate
  doc, post-P10) handles the display→canonical mapping for shuffled
  questions.

## Build state vs spec

- **Complete:** Admin CRUD on tests (four modes), publish gate
  (AC-D17), campaign lock + question authoring (AC-D24); admin CRUD on
  assignments with snapshotted assignee set (AC-D15 v1.6) including
  system-group expansion (All Users / Testees / Admins) and
  deactivated-user exclusion (AC-D16); attempt lifecycle (start /
  view / autosave / pause / resume / submit / benchmark next) per
  AC-D3/D11/D13/D17/D18/D24; `attempt.assignment_id` populated and
  validated against the snapshot for assignment_driven and
  loop_driven origins (AC-D26 v1.4); `(test_id, testee_id,
  sequence_number)` unique + `IntegrityError`-retry (AC-D3 v1.5);
  64-bit shuffle seed from the low 8 bytes of the attempt UUID with
  block-internal preservation (AC-D24); lazy max-duration
  auto-resume (AC-D11 v1.6); deterministic auto-grading on submit
  with grade rows and overall_score + outcome; F14 mixed-test result
  gate; per-(assignment, Testee) engagement_status derivation;
  reminder/escalation sweep with assignment-scoped history,
  per-Testee cease, escalation cap, and SMTP send (AC-D26 v1.6);
  admin endpoints for sweep + pending widget.

- **Partial:** none for P4. (Path-level engagement aggregation is P7
  scope, not P4.)

- **Stubbed:** per-Testee question generation in `start_attempt`
  produces a tiny deterministic placeholder set so the path is
  exercised; P5 replaces it with real Anthropic generation behind
  `resolve_provider`. P10 replaces the synchronous foreground call
  with JIT SSE streaming. The `next_question` benchmark stub is
  capped at `P4_BENCHMARK_STEP_CAP = 5` with a deterministic ±1
  ladder; P5/P10 land real pass/partial/fail-driven adaptive
  convergence.

## Test coverage and CI results

- **Tests added / changed:** 100 new tests across seven files (see
  "Files added" above). Plus `tests/integration/conftest.py` gains a
  no-op `rollback` on `CatalogueFakeSession`. Total suite now 177
  tests (up from 68 on `origin/main` at branch base) — all green.
- **Coverage delta:** new domain code (`app/domain/tests.py`,
  `assignments.py`, `attempts.py`, `engagement.py`) covered by the
  integration tests above. Pure deterministic shuffle covered by
  `tests/unit/test_p4_shuffle.py`. Schema / migration round-trip
  covered by `tests/unit/test_p4_schema.py`.
- **CI result at merge:** PR `claude/acumen-p4-deterministic-dWEzN`
  → main. Final commit `66fe000` (Slice 3 Gitar fixes). Three checks
  all green on this head: GitHub Actions `checks` (twice) +
  Gitar `✅ Approved (4 resolved / 4 findings)`. PR **left open** for
  morning review (auto-continue carve-out).
- **Manual verification performed:** local CI parity sweep (`ruff
  check`, `ruff format --check`, `mypy app`,
  `python scripts/structure_gate.py`,
  `python scripts/check_unpinned_deps.py`, `pytest -q`) clean at every
  commit boundary. Two prior P4 branches (`claude/acumen-p4-tests-
  LeM0M`) read against this branch's structure to confirm the
  carry-forward is faithful and the spec-edit failure-mode is not
  reintroduced.

## Anything a fresh Claude Code session needs to pick up cleanly

- **Required reading beyond SESSION_START.md:** this handover, then
  ROADMAP **P5 — AI provider layer + 5 Anthropic ops**. CODE_SPEC §7
  (AC-CD8 operation enum → 4-method routing) is the immediate spec
  reference for P5.
- **Environment / setup notes:** no env changes. P4 ships no new
  dependencies, no new environment variables, no structure-gate
  changes. `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` already exist
  in `.env.example` as P0 placeholders.
- **Known traps / gotchas:**
  - **Migration-pattern double-add:** `0002` emits CREATE TABLE
    dynamically from `Base.metadata.sorted_tables`. Subsequent
    migrations that ADD columns/constraints already in the model
    (0003, 0004, 0005) would clash on fresh PG installs in real
    apply mode. The project convention treats this as expected; CI
    runs alembic in `--sql` mode only. When P5 (or any later phase)
    needs to add a model column, follow the 0003/0004/0005 pattern
    (raw `ALTER` + reversible `downgrade`).
  - **FakeSession is equality-only.** The shipped harness parses
    `where` clauses as `(col == value)` tuples and does not support
    `IS NOT NULL`, `IN`, joins, or boolean clauses. P4's `_attempts_
    by_assignment_testee` pulls all tenant attempts in one query and
    filters nulls in Python on purpose — the alternative
    (`Attempt.assignment_id.isnot(None)` per Gitar's literal
    suggestion) would crash the harness. Same shape applies to any
    later P5+ batch fetch.
  - **AI-graded answer payload encoding is a frontend contract.**
    P4 grades against canonical snapshot indices. The shuffled
    presentation in `view_attempt` is display-only; clients are
    expected to map the Testee's display choice back to the
    canonical index before autosave.
  - **`SMTPClient.send` is a method, not a constructor.** Engagement
    instantiates `SMTPClient()` (no args) and calls `.send(to,
    subject, body)`. SMTP env config is read inside `.send` each
    call; fail-soft capture (`captured_emails`) is automatic when
    `smtp_host` is unset, so tests just call
    `p.captured_emails()` / `p.clear_captured_emails()`.
- **Recommended next action:** start a fresh session for **P5 —
  AI provider layer + 5 Anthropic ops** (non-streaming). Branch
  name should follow the `claude/acumen-p5-*` convention. P5's pre-
  work is choosing the model IDs that surface as the `.env.example`
  defaults (AC-CD18; Sonnet for the five Anthropic ops, OpenAI for
  the two cross-family ops); the operation enum routing already has
  its spec home in CODE_SPEC §7 (AC-CD8 v1.6).
