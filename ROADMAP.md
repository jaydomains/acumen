# ROADMAP — Acumen phased build plan (canonical, one PR closes one phase)

> **Companion to** `CODE_SPEC.md` (technical) / `SPEC.md` v1.2 /
> `DECISIONS.md` v1.2. Foundation-first; complex AI mechanics layered
> last. **One prompt -> one branch -> one squash PR -> one phase.** Each
> PR closes with a handover from `HANDOVER_TEMPLATE.md`.
>
> Each phase lists **Deliverables**, **Done-when** (objective gate),
> **Anchors** (AC-D product / AC-CD technical), and **Risks**.
>
> **Scope:** backend only. The Next.js frontend is a separate later
> document; CODE_SPEC §5 defines the API contract it will consume.

---

## P0 — Scaffold & stack lock

**Deliverables:** repo layout per CODE_SPEC §3; multi-stage `Dockerfile`;
`docker-compose.yml` skeleton (`acumen`, `postgres`+pgvector, `redis`);
Alembic bootstrap with `env.py` schema-create; `app/main.py` with
`/healthz` `/readyz` only; `app/config.py` (all env + defaults);
structure-verify gate script; `.env.example`.
**Done-when:** `docker compose up` is healthy; an empty migration applies
up and down cleanly; structure-gate passes.
**Anchors:** AC-CD1, AC-CD2, AC-CD3, AC-CD16, AC-CD17.
**Risks:** pgvector base image choice; keep `main.py` setup-only (gate
enforces).

## P1 — Data model & migrations

**Deliverables:** every SPEC §5 entity + supporting tables (CODE_SPEC §4
mapping) as SQLAlchemy 2.0 models; first real migration; `init.sql`
extension; `system_settings` row with v1.2 defaults.
**Done-when:** migration up/down clean; a test asserts the full table set
and the `system_settings` defaults (incl. `competence_sensitivity` 2.0,
`anchor_calibration_prior_weight` 20).
**Anchors:** AC-CD4; data shape for AC-D2/7/9/15/20/21/22/26.
**Risks:** pgvector column dimension lock (1536); `tenant_id` present but
unused — document the seam.

## P2 — Auth & user management

**Deliverables:** admin-creates-user; account-setup + password-reset
token flows; login (argon2id + JWT); role-check dependency; deactivation
gate; privacy-notice acknowledgement gate.
**Done-when:** admin creates a user -> setup link -> login -> role-gated
route reached; a deactivated user is rejected; an unacknowledged-privacy
user is blocked from protected routes.
**Anchors:** AC-D2, AC-D10, AC-D16; AC-CD5.
**Risks:** the Auth Hub seam — keep all of it in `permissions.py` +
`auth.py` so the port is one swap.

## P3 — Catalogue

**Deliverables:** Subjects, Pills (with difficulty range), Learning
Paths, Groups; discovery/filter; safety-keyword auto-tag (AC-D21);
AI-pill-proposal queue (AI stubbed).
**Done-when:** CRUD + safety auto-tag + discovery filter pass tests;
proposal queue persists with stubbed AI.
**Anchors:** AC-D7, AC-D8, AC-D15, AC-D21 (tagging).
**Risks:** safety keyword list lives in System Settings — load from
there, not hard-coded.

## P4 — Tests, assignments, attempts (deterministic)

**Deliverables:** four test modes' data path; frozen attempt snapshot;
presentation shuffle from `attempt_id` seed (AC-D24); deterministic
grading (MCQ/TF/matching); derived `engagement_status` (AC-D26); pause
blanks content (amended AC-D11).
**Done-when:** a frozen attempt auto-grades MCQ/TF/matching; shuffle seed
is stable across resume; `engagement_status` derives correctly; pause
blanks and restores; deterministic grades compute immediately but the
result page display is gated on an "all grading + review done" flag
(forward-compatible with P6 — mixed tests withhold the result page until
review completes).
**Anchors:** AC-D3, AC-D5, AC-D11, AC-D17, AC-D24, AC-D26.
**Risks:** seed determinism under resume — covered by a unit test.

## P5 — AI provider layer + 5 Anthropic ops (non-streaming)

**Deliverables:** `AIProvider` abstraction; resolution order; VCS prompt
registry with persisted version; cost capture; the five Anthropic ops
(generation, grading, weakness, learning-material, pill-proposal),
non-streaming.
**Done-when:** a spec produces a generated set; an AI grade persists with
captured cost + prompt version; model resolution order unit-tested.
**Anchors:** AC-D12, AC-D18; AC-CD8, AC-CD18.
**Risks:** prompt-version persistence must be on the row, not global.

## P6 — Cross-family review

**Gate closed at v1.7** (AC-CD11 — see `CODE_SPEC.md` §18): mode =
batched per attempt, hard latency ceiling = 60 s, over-ceiling routes
to the v1.6 grade-review reconcile cron. Build against the locked
contract; no further user gate.
**Deliverables:** synchronous batched-per-attempt OpenAI review before
band stamp (one call per submit) with a 60-s submit-path timeout;
fail-soft `pending` + the §8.9 grade-review reconcile cron (already
scheduled in v1.6); admin flag queue. P6 build must emit observability
on every `review()` call — at minimum `latency_ms`, `success` (bool),
`batched_payload_size` (count), `ceiling_breached` (bool) — so the
60-s ceiling is empirically tunable.
**Done-when:** an AI-graded response carries confirmed/flagged before
the result displays for the within-60-s batched path; over-ceiling or
provider-down yields a preliminary result page with `pending` rows;
the reconcile cron picks them up; `app/domain/grade_review.py`
enforces the 60-s submit deadline via
`GRADE_REVIEW_SUBMIT_CEILING_SECONDS = 60.0` (line 85) wrapped in
`asyncio.wait_for` (line 324, inside `_review_ai_grades`).
**Anchors:** AC-D19; AC-CD11.
**Risks:** the 60-s ceiling is a single tunable — instrument it so a
future tuning pass has the data to widen or tighten. Partial-batch
parsing errors (review returns malformed structured output) must fall
through to the same `pending` branch as a provider error, never crash
the submit path.

## P7 — Adaptive loop, competence, integrity

**Deliverables:** weakness -> material -> retest loop; `competence_
estimate` with IRT-style per-response value + recency decay (AC-D9 v1.2);
n-gram overlap (AC-D4 #5).
**Done-when:** a failed pill serves material then queues a follow-up
(loop-driven, rate-limit-exempt); the competence float recomputes with
decay against worked fixtures; the overlap flag fires at the threshold;
null competence handled as "no data yet".
**Anchors:** AC-D6, AC-D9, AC-D4 #5; AC-CD13, AC-CD14.
**Risks:** the statistical core — near-full unit/branch coverage from
DECISIONS-derived fixtures (CODE_SPEC §17).

## P8 — Anchor calibration

**Deliverables:** anchor pool generation per band; per-attempt anchor
draw record; daily Bayesian-shrinkage `effective_difficulty` recompute;
fresh-question delta; calibration-confidence display.
**Done-when:** anchors are drawn indistinguishably from fresh; the
shrinkage estimate updates as attempts accrue and equals
`assigned_difficulty` at n=0; the `preliminary -> confident` flip occurs
at the n threshold; fresh-question delta computed per attempt.
**Anchors:** AC-D20, AC-D27; AC-CD12.
**Risks:** estimator correctness — worked fixtures from the AC-D27
formula; `k=20` trade-off documented in AC-D27.

## P9 — Drive RAG + realism feedback

**Deliverables:** pgvector IVFFlat index; daily diff-based ingest
(hash/changed/deleted); chunk + embed (OpenAI `text-embedding-3-small`);
RAG injection at generation; realism flag + nightly aggregation; flagged
anchors dropped from pool.
**Done-when:** a folder document is indexed and retrieved into a
generation prompt; the realism-flag pool weights generation as negative
examples; embedding spend appears against OpenAI in cost.
**Anchors:** AC-D22; AC-CD9.
**Risks:** Drive external reliability — `tenacity` backoff; ingest is a
cron, not request-path.

## P10 — JIT streaming generation (per-Testee)

**Gate closed at v1.8** (AC-CD10 — see `CODE_SPEC.md` §10 / §18):
execution model = in-process `asyncio.gather` + `asyncio.Semaphore`
(size = `jit_buffer_size`, env-default 3; ceiling = `jit_buffer_max`,
env-default 5; not Celery on the user-facing path); streamed-arrival
order anchored by `question.attempt_position` (unique
`(attempt_id, attempt_position)`, additive migration is a P10 build
deliverable); single-Q-N-generation-failure retries once at the
orchestration layer then pauses via the existing AC-D11 mechanism.
AC-D25 Implications realigned in the same change. Build against the
locked contract; no further user gate.
**Deliverables:** SSE stream endpoint; Q1 synchronous; Q2…N concurrent
in-process `asyncio` tasks under a bounded `Semaphore` per AC-CD10
v1.8; additive migration adding `question.attempt_position` + unique
`(attempt_id, attempt_position)`; per-question generation call
pattern (question_count=1, shared RAG context computed once per
attempt — SPEC §6.1 v1.8); configurable buffer (3 / max 5);
autosave/resume snapshot-replay ordered by `attempt_position` with
`Last-Event-ID`; orchestration-layer single-retry-then-AC-D11-pause
on Q-N failure. **Benchmark stays sequential** (`POST .../next`), per
amended AC-D25.
**Done-when:** Q1 renders < ~3s; the buffer is maintained ahead of
position; a mid-stream failure pauses with retry/abandon; resume replays
the snapshot with stable order and no regeneration; the benchmark path
is verified sequential.
**Anchors:** AC-D25, AC-D13; AC-CD10 (execution model + ordering
column + single-failure policy locked at v1.8).
**Risks:** async concurrency on the user path — explicit buffer state
machine; E2E buffer tests. Worker-death-mid-attempt mitigated by the
DB-backed `attempt_position` + `Last-Event-ID` resume semantics (see
CODE_SPEC §17 risk #2 v1.8).

## P11 — Bootstrap, safety links, crons, cost, comms

**Deliverables:** AC-D23 idempotent bootstrap job (anchor self-review via
OpenAI); AC-D21 web-search safety-link curation + monthly link-check; all
seven P11 crons scheduled in beat (the canonical cron set grows to **nine**
via the autonomous-content-generation workstream below — AC-CD7 v1.9); cost
dashboard + budget alerts; SMTP (setup/reset/reminder/escalation); attempt
PDF export.
**Done-when:** one-command bootstrap populates anchors/links/index and is
re-runnable without duplication; the seven P11 crons are scheduled (nine
canonical post-workstream); a budget alert fires at threshold; an attempt
exports to PDF; reminder/escalation emails send per AC-D26.
**Anchors:** AC-D18, AC-D21, AC-D23, AC-D26; AC-CD7.
**Risks:** bootstrap idempotency — assert re-run is a no-op in E2E.

> **P12 (hardening / full E2E)** folds into P11's done-when, or becomes a
> follow-up PR if scope grows past one squash.

---

## Autonomous content generation + retroactive oversight (named non-phase workstream)

> **Established v1.9** (NS-5 ruled: a **named non-phase workstream**, not a P12+ phase). This is the build home for the four-PR amendment cycle's new capability; each execution slice records its CHECKLIST/ROADMAP row against this workstream rather than a numbered phase.

**Capability:** a fully-autonomous AI content-generation pipeline with retroactive admin oversight (no human pre-publish gate) — reference corpus builder → corpus-grounded generation with provenance → auto-publish gate with confidence + cross-model self-review → signal-driven gap detection → retroactive oversight dashboard + rollback. Parent plan PR #107 (`2110a56`); detail plan PR #108 (`bedd84c`); amendment-cycle extraction PR #109.

**Amendment cycle (ratification-class, sequenced):**
- **PR-A — corpus & authority foundation (this link):** mints **AC-D28** (source-authority allowlist + scoring) + **AC-CD25** (reference corpus builder); retires Drive RAG → reference corpus (amended AC-D22); amends AC-D21/AC-D23; cron count seven → **nine** (AC-CD7 / §8.9, `corpus.refresh` + the two D4 crons authored complete).
- **PR-B — generation + provenance + ops-count;** **PR-C — auto-publish gate + self-review + governance prose;** **PR-D — signal spine + oversight** (each ratified per-PR through its own triage as the chain progresses).

**Execution slices (post-amendment, build state tracked in CHECKLIST):** A1 source-authority registry · A2 corpus builder · A3 refresh cron + retrieval · B1–B3 generation · C1–C2 self-review + auto-publish gate · D1–D4 signals + gap-detection/health crons · E1–E2 oversight read + rollback · F1 bootstrap-on-publish. **Not yet built** — gated on the amendment merges + per-slice execution.

**Sequencing guard (ratified coordination):** **D1–D2 execution is blocked until PR-C merges** — §6.5 (authored in PR-C) is what the D1–D2 signal stores feed, so D1–D2 must not execute ahead of it. (Recorded durably here + in the CHECKLIST D-row, not only in the PR-A body.)

**New crons (this workstream, part of the canonical nine):** `corpus.refresh` (weekly; A3 — replaces Drive ingest), `gap_detection.sweep` (D4), `catalogue_health.check` (D4).

---

## Anchor coverage

Every AC-D1–AC-D28 and every AC-CD1–AC-CD25 is referenced by at least one
phase or workstream above and one CHECKLIST row (AC-D28 + AC-CD25 minted in
v1.9 are owned by the autonomous-content-generation workstream). AC-CD11's pre-build gate at P6 was
**closed at v1.7**; AC-CD10's residual §10 ambiguity surfaced at the
P10 plan-mode gate and was **closed at v1.8**; no anchor now carries
an unresolved pre-build gate.

*End of Acumen ROADMAP. Paired with `CODE_SPEC.md`, `SPEC.md` v1.9,
`DECISIONS.md` v1.9 (pairing footer brought current in v1.9 from a long-stale v1.2 marker — noted, not a content change).*
