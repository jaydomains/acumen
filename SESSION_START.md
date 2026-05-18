# SESSION_START — Acumen entry point & working discipline for every Claude Code session (canonical)

> Read this first, every session, before touching anything. The canonical
> documents are at the repo root: SESSION_START.md, SPEC.md, DECISIONS.md,
> CODE_SPEC.md, ROADMAP.md, CHECKLIST.md, HANDOVER_TEMPLATE.md. Anything
> under `docs/` is supplementary and is overridden by the canonical root
> documents.

## What Acumen is

A standalone AI-driven competency assessment and adaptive-learning app for
KBC: it generates competency tests on demand, grades them, identifies
per-pill knowledge gaps, serves targeted learning material, and re-tests
to confirm the gap closed — an autonomous closed loop. Built standalone-
first; it later folds into the SiteMesh platform as a peer Workflow
module. SiteMesh port seams (Auth Hub, MeshCore envelopes, workstream/RLS)
are *documented, not built* in v1.

## Reading order (every build session, in this order)

1. **This file.**
2. The **most recent handover** in `/handovers/` — the live state of the
   build, what the last PR closed, traps it flagged.
3. **`SPEC.md`** (functional, v1.2) — refresh the product.
4. **`CODE_SPEC.md`** (technical spec + stack lock, AC-CD1–AC-CD18) — the
   codebase is the source of truth; unbuilt items are `(pending P{n})`.
5. **`ROADMAP.md`** (phased plan P0–P11) — identify the phase you close.
6. **`CHECKLIST.md`** — what is `built`/`partial`/`missing`, and the open
   Drift questions.
7. **`DECISIONS.md`** (product anchors AC-D1–AC-D27, v1.2) — the AC-D
   anchors the phase cites.

## Working agreement (discipline — non-negotiable)

- **Plan mode first.** Show the plan, get explicit user approval, then
  write code. No code before approval.
- **Branch-per-PR.** One feature branch per ROADMAP phase, named for that
  phase. One prompt → one branch → one squash PR → one phase.
- **No commits to main.** Every change lands via PR.
- **One PR per phase.** Each ROADMAP phase closes with its own PR.
- **Per-slice review pauses are binding.** When a plan declares slices
  with a review pause (commit → push → wait for Gitar / explicit user
  go-ahead), that pause is non-negotiable: do **not** batch all slices
  through to the end "because it's faster". The pause exists to catch a
  wrong foundational decision before later slices build on it.
  Collapsing slices into one pass is a plan deviation requiring explicit
  user approval first, not an execution detail. (Reinforced after P3 /
  PR-008, where all three slices ran in one pass — clean by luck, not
  process.)
- **Multi-slice phases pause for Gitar review at each slice boundary.**
  After each slice commits and pushes, the session waits for explicit
  user confirmation that Gitar is clean before starting the next slice.
  No exceptions. The pause-for-Gitar pattern preserves slice-level
  review quality that the consolidated PR diff loses.
- **Handover at PR close.** Authored *before* merge, copied from
  `HANDOVER_TEMPLATE.md` into `handovers/PR-<id>-<slug>.md`. Handovers are
  immutable once written (except where confidentiality/privacy/legal
  compels an update, noted in the body).
- **Handovers follow `HANDOVER_TEMPLATE.md` sections strictly** — no
  abbreviation, no omissions, no editorial summary in place of structure.
  Every section is filled even if the answer is "none".
- **Fresh session per phase.** Start a new session for each new phase to
  prevent context drift across phase boundaries.
- **Spec drift is surfaced, never silently resolved.** When the build
  hits a gap or a spec/implementation divergence, stop and surface it. The
  *user* authors a spec-clarification PR amending the appropriate doc
  (SPEC / DECISIONS / CODE_SPEC / ROADMAP). A *fresh* session then
  implements against the corrected spec. The implementing session does not
  also author the clarification.
- **AC-CD-level structural additions may fold into the phase handover.**
  New files, new modules, or dependency additions outside the
  `CODE_SPEC.md` §3 locked layout may be folded into the phase handover
  when (a) the existing structure-gate continues to pass without
  modification, and (b) the addition is well-rationalised against
  existing AC-CDs. Document prominently in the handover under "What was
  decided". Larger structural changes — adding multiple modules,
  modifying the structure-gate script, changing the auth seam shape,
  altering the stack — still require a separate spec-clarification PR.
  (Codifies the `requirements-dev.txt` / PR-004 and `catalogue.py` /
  PR-008 pattern.)
- **Anchor discipline.** Product/functional decisions are `AC-D{n}` in
  `SPEC.md`/`DECISIONS.md`; code-shape/technical decisions are `AC-CD{n}`
  in `CODE_SPEC.md`. Anchor *identifiers are immutable*; an anchor body
  may be revised in place with the change explained inside the body — the
  v1.1 and v1.2 amendments (e.g. AC-D9, AC-D19, AC-D25) are the canonical
  examples of how to amend without renumbering.
- **Doc hygiene.** No `TBD`; no trailing "etc."; no "or"-framed
  requirements in `CODE_SPEC.md`. CHECKLIST rows tick only with real
  Evidence (a test path, command, or artifact).

## What is never silently resolved

Stop and surface (do not pick one and move on):

- A **spec gap** — the spec does not say, or says ambiguously.
- A **library or pattern choice not already in `CODE_SPEC.md`** — adding a
  dependency or a structural pattern is an AC-CD decision, not an
  implementation detail.
- An **ambiguous ROADMAP phase definition** — unclear scope or done-when.
- **Stack version drift** — any deviation from the §2 pins.

Each becomes a user-authored spec-clarification PR; a fresh session
implements against the corrected text.

## The stack (CODE_SPEC-locked — this is what the code looks like)

Exact pins (`CODE_SPEC.md` §2, AC-CD1). Pins live in `requirements.txt`
(HTTP) and `requirements-worker.txt` (worker superset); CI fails on an
unpinned add.

- **Python** 3.12-slim
- **`fastapi==0.115.0`**, **`uvicorn[standard]==0.30.6`**
- **`pydantic==2.8.2`**, `pydantic-settings==2.4.0`
- **`sqlalchemy[asyncio]==2.0.35`** — 2.0 `Mapped[]` style, not legacy
- **`asyncpg==0.29.0`** (async driver) + **`psycopg[binary]==3.2.1`**
  (migration driver)
- **`alembic==1.13.3`** — per-schema env, `file_template =
  %%(rev)s_%%(slug)s`, every `upgrade()` has a real `downgrade()`
- **`celery==5.4.0`** + **`redis[hiredis]==5.0.8`** (broker + result
  backend)
- **`anthropic>=0.39,<1.0`** — primary AI provider (AC-D12, AC-D18)
- **`openai>=1.30,<2.0`** — cross-family review (AC-D19) + embeddings
  (AC-D22)
- **`pgvector>=0.3,<0.4`** — SQLAlchemy column type
- **`google-api-python-client>=2.140`** + **`google-auth>=2.33`** — Drive
  read-only ingest
- **`argon2-cffi>=23.1`** (argon2id password hash), **`tenacity>=8.5,<9.0`**
  (retry/backoff on external AI + Drive)
- **`pytest>=8.0`** / **`pytest-asyncio>=0.23`** (dev/test)

Shape: a **single FastAPI service** + a **Celery worker** + a **Celery
beat** scheduler, on **PostgreSQL with pgvector** and **Redis**. One
Postgres schema, **`acumen`**. Layering is strict: thin routers
(`app/routers/*.py`, validation + authz + envelope only) → domain layer
(`app/domain/*.py`, the statistical/operational core) → SQLAlchemy 2.0
models (`app/models.py`) → Postgres. AI behind `app/ai/` (provider
abstraction). pgvector index is **IVFFlat** at v1 scale. Repo layout
mirrors the SiteMesh module anatomy (AC-CD2); `main.py` is setup-only.

## ROADMAP phases (P0–P11, one PR closes one phase)

Foundation-first; complex AI mechanics layered last. Name the phase you
are on by its ROADMAP name.

| Phase | Name | Done-when (summary) |
|---|---|---|
| **P0** | Scaffold & stack lock | `docker compose up` healthy; empty migration up/down clean; structure-gate passes |
| **P1** | Data model & migrations | All SPEC §5 entities + supporting tables; first migration up/down clean; test asserts table set + `system_settings` v1.2 defaults |
| **P2** | Auth & user management | Admin-creates-user → setup link → login → role-gated route; deactivated user rejected; unacknowledged-privacy user blocked |
| **P3** | Catalogue | Subjects/Pills/Paths/Groups CRUD + safety auto-tag + discovery filter; proposal queue persists (AI stubbed) |
| **P4** | Tests, assignments, attempts (deterministic) | Frozen attempt auto-grades MCQ/TF/matching; shuffle seed stable across resume; `engagement_status` derives; pause blanks/restores |
| **P5** | AI provider layer + 5 Anthropic ops (non-streaming) | Spec produces a generated set; AI grade persists with cost + prompt version; model-resolution order unit-tested |
| **P6** | Cross-family review | **AC-CD11 gate first.** AI-graded response carries confirmed/flagged before display; provider-down → preliminary + cron retry; latency rule recorded in AC-CD11 |
| **P7** | Adaptive loop, competence, integrity | Failed pill serves material then queues follow-up; competence float decays vs fixtures; n-gram flag fires; null competence = "no data yet" |
| **P8** | Anchor calibration | Anchors drawn indistinguishably; shrinkage updates, equals `assigned_difficulty` at n=0; preliminary→confident at n threshold; fresh delta per attempt |
| **P9** | Drive RAG + realism feedback | Folder doc indexed + retrieved into a generation prompt; realism pool weights generation; embedding spend on OpenAI |
| **P10** | JIT streaming generation (per-Testee) | Q1 < ~3s; buffer maintained; mid-stream failure pauses; resume replays snapshot, stable order; benchmark verified sequential |
| **P11** | Bootstrap, safety links, crons, cost, comms | One-command bootstrap is idempotent; six crons scheduled; budget alert fires; attempt PDF export; reminder/escalation emails send |

P12 (hardening / full E2E) folds into P11's done-when, or becomes a
follow-up PR if scope grows past one squash.

## How `CHECKLIST.md` works

One block per ROADMAP phase, columns: Capability · Phase · Anchors ·
Files to touch · Status · Evidence. Record progress **at PR close**:

- **Status legend:** `built` — implemented, matches spec, has evidence ·
  `partial` — started, incomplete (note what remains) · `missing` — not
  started.
- A row ticks **only** when its **Evidence** (a test path, command, or
  artifact that exists) is real. Status/Evidence stay blank until the
  phase lands.
- The **Drift questions** section holds open, unresolved items the build
  must close (currently only AC-CD11). Resolved spec/implementation
  divergences are recorded in the **per-PR handover**, not added here.

## CODE_SPEC decisions never to silently violate

A fresh session can quietly break any of these without intending to:

- **AC-CD8 — one `AIProvider` interface.** Every model call goes through
  the `AIProvider` protocol (`generate/grade/review/embed`) with the
  resolution order Test-override → system override → coded default. Never
  call a provider SDK directly from a router or domain module.
- **AC-CD8 — prompts are a VCS registry.** Prompts live in
  `app/ai/prompts/` with an embedded version; the version used is
  persisted **on the grade/question row**, never global.
- **AC-CD18 — model IDs are env defaults, never hard-coded.** Latest
  Claude Sonnet (primary), a current OpenAI model (review),
  `text-embedding-3-small` (embeddings) — all env-overridable.
- **AC-CD3 — one `acumen` Postgres schema.** `tenant_id` is on every
  scoped table from day one but v1 is single-tenant; **RLS is a port
  seam, not built in v1.** Do not add a second schema.
- **AC-CD2 — SiteMesh layout, `main.py` setup-only.** The port is a move,
  not a restructure. No business logic in `main.py`; no business logic in
  routers.
- **AC-CD5 — all auth in `permissions.py` + `auth.py`.** Role-check,
  deactivation gate, and privacy-ack gate are one dependency so the Auth
  Hub port is a one-file swap.
- **AC-CD1 — every dependency pinned.** Adding a dep is an AC-CD decision
  (surface it), not a free implementation choice.
- **AC-CD15 — `app/domain/*` carries near-full unit+branch coverage** with
  fixtures derived from the DECISIONS formulas; `conftest.py` forbids any
  network call in tests.

## High-complexity areas — slow down, surface drift early

These are the areas where a subtle error is silently wrong and not
cheaply caught in production. Working here: re-read the cited anchors,
work from the DECISIONS formulas, flag any ambiguity before coding.

- **Anchor calibration — AC-D20 / AC-D27 (AC-CD12),
  `app/domain/calibration.py`.** Bayesian shrinkage toward the AI-assigned
  band; `k = anchor_calibration_prior_weight = 20`; stable from n=0;
  fresh-question delta from same-attempt anchors. Cron-computed, not
  request-time.
- **Competence estimate — AC-D9 (AC-CD13), `app/domain/competence.py`.**
  IRT-style per-response value (`competence_sensitivity = 2.0`),
  recency-weighted (half-life 90 days), loop target
  `round(estimate + 0.5)`; null = "no data yet", not a failing score.
- **JIT streaming — AC-D25 (AC-CD10), `app/domain/streaming.py`.** Q1
  synchronous (~3s), Q2…N parallel Celery tasks, buffer default 3 / max 5,
  snapshot-replay on resume (no regeneration). **Benchmark is explicitly
  sequential** (`POST .../next`) — not JIT-streamed.
- **Drive RAG — AC-D22 (AC-CD9), `app/domain/drive_rag.py`.** IVFFlat,
  `text-embedding-3-small` (1536-dim), diff-based daily ingest, embedding
  spend tracked to **OpenAI**.
- **Cross-family review — AC-D19 (AC-CD11), `app/routers/review.py`.**
  Synchronous pre-stamp OpenAI review, fail-soft "review pending" +
  reconcile cron. **The open anchor — see below.**

## The one open item — AC-CD11 (P6 gate)

**AC-CD11** (cross-family review latency rule) is the single unresolved
technical anchor. The per-response-vs-batched mode and the hard latency
ceiling before the fail-soft path triggers are **unresolved**. There is a
**pre-build gate at P6**: resolve it *with the user* before building the
blocking submit path; record the resolution in `CODE_SPEC.md` AC-CD11.
Tracked as the only live CHECKLIST Drift question.

## Paste-ready session-start script

Copy this verbatim at the start of every session:

> Read SESSION_START.md and the most recent handover in /handovers/. Then
> read SPEC.md and CODE_SPEC.md to refresh context. Open ROADMAP.md and
> tell me which phase we're on and what the done-when criteria are. Plan
> mode ON. Show me the plan before any code.

## Session-end checklist

- [ ] All work committed on the feature branch (nothing on main).
- [ ] Handover authored in `/handovers/` from `HANDOVER_TEMPLATE.md`,
      every section filled, structure intact.
- [ ] PR opened with the handover linked.
- [ ] Gitar review run (or equivalent) and addressed.
- [ ] User merges the PR after review.
- [ ] Next session starts **fresh** against the new `main`.

## Current state

> This section is the only part that changes as the build advances. When
> a phase lands, update *only* this section and the corresponding
> `CHECKLIST.md` rows — nothing else in this file moves.

Specs are at **v1.2** — the v1.2 clarification resolved the previously
under-specified statistical anchors: AC-D9 (competence formula),
AC-D20/AC-D27 (calibration math), AC-D22 (embedding model), AC-D25
(benchmark carve-out). `CODE_SPEC.md` / `ROADMAP.md` / `CHECKLIST.md` are
written. **P0, P1, P2, P3 are landed** — Scaffold & stack lock, Data
model & migrations, Auth & user management, Catalogue. **9 phases
remain.** The next session starts at ROADMAP **P4 — Tests, assignments,
attempts (deterministic)**.

*End of SESSION_START. Paired with the v1.2 document set.*
