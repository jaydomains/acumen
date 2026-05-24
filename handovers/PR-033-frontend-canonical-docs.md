# Handover — PR-033 frontend canonical docs

> Copy this template to `handovers/<PR-id>-<slug>.md` at PR close and fill
> every section. Handovers are **immutable** once written, except where
> business confidentiality, privacy, or legal requirements compel an update.
> If an update is compelled, note what changed, why, and under which
> requirement.

## PR identifier and link

- PR: PR-033 — Frontend canonical-doc drafting (Session 2 of the two-session plan)
- Link: <pending — PR not yet opened>
- Author / session: Claude Code (web session, branch `claude/wizardly-volta-QbS5U`)
- Date closed: 2026-05-24

## Phase reference

- ROADMAP phase closed by this PR: Frontend canonical-doc drafting (a pre-FE-1 doc-only PR, not a numbered ROADMAP / FE_ROADMAP phase). Establishes the FE_ROADMAP / FE_CHECKLIST pair and AC-CD20..24 that subsequent FE-N PRs build against.
- Does this PR fully close the phase? Yes — the Session 1 plan
  (`/root/.claude/plans/frontend-canonical-doc-drafting-session-lucky-toast.md`)
  was approved and Session 2 executes it as a single-slice doc PR with no
  carry-over.

## What was built

- Files added:
  - `FE_ROADMAP.md` — frontend phased build plan, FE-0 (built — PR-032)
    plus FE-1..FE-9 (pending). Mirrors `ROADMAP.md`'s
    Deliverables / Done-when / Anchors / Risks block structure with a
    reverse scope statement.
  - `FE_CHECKLIST.md` — per-phase acceptance / drift checklist. Mirrors
    `CHECKLIST.md`'s `Capability | Phase | Anchors | Files to touch |
    Status | Evidence` row format. FE-0 rows show `built` with PR-032
    evidence; FE-1..FE-9 rows show `missing`.
  - `handovers/PR-033-frontend-canonical-docs.md` — this file.
- Files changed:
  - `CODE_SPEC.md` — appended AC-CD20..24 (routing structure & role
    guards; TanStack Query + form + error-envelope conventions; SSE
    consumption pattern; theming + token discipline + primitives;
    visual-content deferral). Closing-line ledger updated.
  - `SESSION_START.md` — three surgical additions: (a) cross-doc pointer
    paragraph after the Reading order list explaining the FE_*.md pair
    and the `PR-NNN-feN-slug` titling convention; (b) new subsection
    **"Auto-continue + per-slice Gitar workflow (FE-N phase work)"**
    co-located with the structural-additions carve-out, codifying
    spec-drift-pauses-the-loop, the 3-round Gitar circuit breaker, and
    the user pause-button discipline; (c) Current state update — FE-0
    landed at PR-032, FE-1..FE-9 pending, AC-CD20..24 added at PR-033,
    next session opens FE-1.
- Files removed: none.
- Summary of the change in 2–4 sentences. PR-033 establishes the frontend
  canonical-doc surface that subsequent FE-N PRs build against. The new
  `FE_ROADMAP.md` / `FE_CHECKLIST.md` pair mirrors the backend
  `ROADMAP.md` / `CHECKLIST.md` pair (which stay backend-only); five new
  technical anchors (AC-CD20..24) in `CODE_SPEC.md` lock the patterns
  (routing/guards, server-state/forms/errors, SSE, theming, visual-content
  deferral) so per-page PRs are not re-deciding them. No code changes;
  doc-only PR.

## What was decided in this PR

- **D1 — Parallel files for frontend phase tracking.** New
  `FE_ROADMAP.md` and `FE_CHECKLIST.md` at repo root, mirroring the
  backend `ROADMAP.md` / `CHECKLIST.md` pair in shape with reverse
  scope statements. Existing backend files untouched. (Recorded in
  the Session 1 plan as D1; ratified at Session 1 close.)
- **D2 — All five new AC-CDs land in `CODE_SPEC.md`.** AC-CD20..24
  share the file with AC-CD19, following the self-contained anchor
  pattern AC-CD19 established at PR-032.
- **D3 — Constellation visualisation ships in v1.** FE-7 stays as
  drafted (SVG constellation + matrix-view toggle). Related-pill
  edges defer to v1.x (Section A.3 of the Session 1 plan).
- **D4 (revised) — OpenAPI snapshot verified current at Session 1
  close via `pnpm codegen:check`.** The earlier 70-vs-90 endpoint
  count discrepancy was a counting-method artifact (distinct paths
  vs path+method permutations), not real drift. No precursor PR
  needed; this doc PR opens directly. If a backend endpoint change
  ships during an FE-N phase, the regen folds into that FE-N PR.
- **FE-8 test authoring lock-in: single editor with mode-conditional
  sections** (not four separate editors per test mode). Recorded as
  the FE-8 CHECKLIST row's anchor wording and as an E#5 resolution
  in the Session 1 plan.
- **FE-7 sequencing pin.** FE-7 cannot open until two backend
  spec-drift PRs are merged on `main`: `GET /v1/attempts` (own
  scope, admin-scope variant) and `GET /v1/me/competence`. The pin
  is captured in `FE_ROADMAP.md` (FE-7 Risks block) and as two
  explicit backend-dep rows in `FE_CHECKLIST.md`.
- **SESSION_START "Auto-continue + per-slice Gitar workflow (FE-N
  phase work)" subsection.** Codifies three conventions inherited
  from the existing PR-025 auto-continue default, applied to
  multi-slice FE-N work: spec-drift pauses the loop, max 3
  Gitar-fix-Gitar rounds per slice, user pause-button is binding.
- New anchors introduced by this PR: AC-CD20, AC-CD21, AC-CD22,
  AC-CD23, AC-CD24.
- Existing anchors this PR depends on: AC-CD19 (frontend stack lock,
  the pattern AC-CD20..24 follow), AC-CD6 (uniform error envelope —
  cited by AC-CD21 and AC-CD20), AC-CD10 (backend JIT streaming
  contract — cited by AC-CD22), AC-D11 (paused UI — cited by
  AC-CD22), AC-D16 (privacy acknowledgement — cited by AC-CD20),
  AC-D25 (per-Testee JIT — cited by AC-CD22), and the PR-030 image
  fields (cited by AC-CD24).

## Drift flags raised and how they were resolved

- **OpenAPI endpoint count mismatch (resolved during Session 1
  investigation).** The task description for Session 1 cited 76
  endpoints across 11 routers; the live backend reports 90 endpoints
  across 12 routers via `app.openapi()`. Initial Session 1 reasoning
  treated this as backend growth between PR-032 and now and proposed
  D4 as a tiny precursor PR to refresh the snapshot. Closer
  inspection — `pnpm codegen:check` exits clean against the
  committed snapshot — showed this was a counting-method artifact
  (path-only count vs path+method permutations of the same surface),
  not real drift. D4 revised in plan; no precursor PR opens. The
  doc-only PR-033 lands directly.
- **Four backend gaps surfaced (deferred, not closed in PR-033).**
  Section A.3 of the Session 1 plan documents four prototype features
  that the backend cannot serve as-is: `GET /v1/attempts` (own
  scope), per-Testee competence-read endpoint, related-pill edges,
  per-row engagement nudge/reassign. These are **user-authored
  spec-clarification PRs** per the SESSION_START rule that
  spec-drift is never silently resolved by the implementing session.
  Recommended resolutions in plan; FE-7 sequencing pin on the first
  two; the other two deferred (related pills → v1.x, per-row nudge
  → out of scope).

## Open questions deferred to a later phase

- Dark theme (`carbon` / `steel`) — explored in the design
  prototype's v5 screenshots, deferred to v1.x per AC-CD23. Revisit
  if a deployment posture (KBC partner-network expansion, mobile
  deployment) makes a dark theme a real requirement.
- Image rendering — typed through but not rendered in v1 per
  AC-CD24. The v1.x visual-content PR adds rendering; trigger is
  the backend starting to emit non-null image URLs.
- File-upload UI for admin authoring of reference images — same
  v1.x PR as image rendering, per AC-CD24.
- Mobile / responsive breakpoints — not anchored. Per-page judgement
  during build; resurface as an anchor only if a cross-page
  constraint emerges.
- Accessibility baseline — leans on shadcn/ui's Radix-primitive
  defaults; no separate anchor.
- Playwright E2E — introduced by the first PR that brings an
  E2E-worth flow (likely FE-4 or FE-5 per AC-CD19). Not pinned
  upfront.

## Build state vs spec

- Complete: `FE_ROADMAP.md` and `FE_CHECKLIST.md` exist at repo
  root with FE-0 (built — PR-032) and FE-1..FE-9 (missing) entries.
  `CODE_SPEC.md` carries AC-CD19..24 (full frontend stack +
  per-phase patterns). `SESSION_START.md` carries the FE pointer
  paragraph, the auto-continue FE-N workflow subsection, and an
  updated Current state.
- Partial: none (doc-only PR; no half-built code).
- Stubbed: none.

## Test coverage and CI results

- Tests added / changed: none (doc-only PR).
- Coverage delta or current coverage: unchanged.
- CI result at merge: <pending PR open>. Expected: existing backend
  CI (`ruff check . && ruff format --check . && pytest -q`) and
  existing frontend CI (`pnpm install --frozen-lockfile && pnpm
  codegen:check && pnpm lint && pnpm format:check && pnpm
  typecheck && pnpm test --run && pnpm build`) both green; no code
  paths touched. `python scripts/structure_gate.py` exits 0 — new
  repo-root `.md` files pass through the backend-path whitelist
  unchallenged (same posture as `frontend/` in PR-032).
- Manual verification performed:
  - Self-contained read test against AC-CD19..24 + one FE-N block
    from `FE_ROADMAP.md` + matching block from `FE_CHECKLIST.md`:
    full stack + routing + the FE-N PR's scope all derivable from
    the new text without cross-referencing the Session 1 plan.
  - Cross-file scope check: `ROADMAP.md` and `CHECKLIST.md` diffs
    empty; `FE_ROADMAP.md` and `FE_CHECKLIST.md` headers state the
    mirror relationship explicitly.
  - Anchor-coverage sweep: every `FE_CHECKLIST.md` row's Anchors
    column references at least one AC-D or AC-CD; every new AC-CD
    (20..24) has at least one row pointing at it.

## Post-merge validation considerations

- Does this PR touch code that runs inside a container without a
  source bind mount? No — doc-only. The stale-image trap does not
  apply.
- What's the specific local command sequence that re-verifies this
  PR's fix end-to-end? `git pull origin main && ls FE_ROADMAP.md
  FE_CHECKLIST.md && grep -c 'AC-CD2[0-4]' CODE_SPEC.md` — expect
  both files present and at least 5 anchor occurrences in
  CODE_SPEC. No runtime verification needed.

## Anything a fresh Claude Code session needs to pick up cleanly

- Required reading beyond `SESSION_START.md`: `FE_ROADMAP.md` and
  `FE_CHECKLIST.md` (new — the frontend phase pair); `CODE_SPEC.md`
  AC-CD19..24 (the full frontend technical anchor set). The
  Session 1 investigation plan
  (`/root/.claude/plans/frontend-canonical-doc-drafting-session-lucky-toast.md`)
  is the long-form reasoning behind the choices; not required
  reading for FE-1+ build sessions but useful if the four spec-drift
  gaps in Section A.3 resurface.
- Environment / setup notes: no new env vars; no new tooling
  required. The frontend toolchain pinned in AC-CD19 carries
  through unchanged.
- Known traps, gotchas, or in-progress work that is easy to
  misread:
  - `ROADMAP.md` and `CHECKLIST.md` are now **explicitly
    backend-only** (their existing "backend only" framing stays,
    and the new FE pair reverses the mirror). Do not add FE phases
    to the backend files; do not add P phases to the FE files.
  - **FE-7 sequencing pin** is real. The two backend dependencies
    (`GET /v1/attempts` own-scope, `GET /v1/me/competence`) must
    be merged on `main` before FE-7 opens. They are
    user-authored spec-clarification PRs (per the SESSION_START
    rule), not bundled into FE-N PRs.
  - **AC-CD20..24 are confident-default anchors from inception**
    (mirror the AC-CD19 PR-032 pattern). They do not carry a
    pre-build gate; the patterns are already locked.
  - OpenAPI snapshot stayed current at Session 1 close per
    `pnpm codegen:check`. If a backend endpoint change ships
    during an FE-N phase, fold the regen into that FE-N PR
    rather than opening a separate snapshot-refresh PR.
- Recommended next action: open FE-1 (Auth surface) per
  `FE_ROADMAP.md` and `FE_CHECKLIST.md`. Branch
  `claude/PR-034-fe1-auth-surface` or equivalent. Plan mode first
  per the SESSION_START discipline.
