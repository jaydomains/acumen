# Handover — PR-090 Slice 3: resolve dead nav (remove In-Progress, redirect Latest Result)

> Testee FE completion workstream, PR 3 of 5 (Slice 3). Authored after the merge
> of #90 on the following slice's branch (trailing-handover model). Merge SHA
> `de4eb2c`.

## PR identifier and link

- PR: #90 — `Slice 3 — resolve dead nav (remove In-Progress, redirect Latest Result)`
- Link: https://github.com/jaydomains/acumen/pull/90
- Author / session: Claude Code (`claude/testee-fe-s3-dead-nav`)
- Date closed: 2026-06-02 (squash-merged on verified three-layer-green;
  intermediate slice)

## Phase reference

- ROADMAP phase: **none** — post-roadmap testee-FE completion (Tier A), Slice 3
  of 5. Closes smoke-test issue #3 (dead/404 nav). Gate cleared: D3 FE-2-shell
  amendment (PR #87).
- Fully closes Slice 3.

## What was built

- Files added: `frontend/src/app/(authed)/(testee)/results/page.tsx`,
  `frontend/tests/pages/results-redirect.test.tsx`.
- Files changed: `frontend/src/components/shell/Rail.tsx`,
  `frontend/tests/components/shell/Rail.test.tsx`.
- Files removed: none.
- Summary: removed the dead `In Progress` (`/attempts`) nav item and made
  `Latest Result` (`/results`) resolve via a thin client redirect to the
  most-recent submitted attempt's result. v1 `TESTEE_NAV` =
  `Dashboard · Discover · Latest Result · Competency · History`. No testee nav
  item 404s.

## What was decided in this PR

- **D3 = remove In-Progress, redirect Latest Result** (resume is handled by the
  dashboard `ResumePrompt`; no in-progress list endpoint exists). The FE-2-shell
  nav-contract + Gherkin were amended by the D3 PR (#87), not here (code-only).
- **DEC-S3-A — freshness:** the redirect uses `useMeAttemptsCapped(1)` (distinct
  `{limit:1}` key the hero/profile never warm) **and** a mount `refetch()` gated
  on `isFetchedAfterMount`, so a warm-but-stale list (never invalidated on submit)
  cannot redirect to the *prior* result. A freshness regression test guards this.
- **DEC-S3-B — empty state:** "No results yet" + a Discover CTA; error renders a
  neutral card (never a redirect, never the empty copy).
- New anchors: none (the nav model is recorded in handover + the D3 spec
  amendment; AC-D28 was not minted — D7 handover-note option).

## Drift flags raised and how they were resolved

- None new. A Gitar review suggestion (use `refetchOnMount: "always"` instead of
  the imperative effect) was **declined with rationale** on the PR: the literal
  inline-`useQuery` form violates AC-CD21 (no inline key construction in pages);
  the effect approach is the DEC-S3-A-sanctioned, key-reuse-compliant, tested
  choice. Non-correctness; PR was "approved with suggestions".

## Open questions deferred to a later phase

- **DEC-S3-C (carry-forward, deferred):** `meQueryKeys.attempts()` is never
  invalidated on submit (every attempt-flow `invalidateQueries` targets
  `attemptQueryKeys.detail` only). This causes a ≤30s stale window post-submit on
  the hero day-streak, `/profile`, and `/history` too. The systemic fix
  (invalidate `meQueryKeys.attempts()` in the grading/submit flow) touches the
  runner — out of this nav-only slice's scope. Slice 3's own correctness is fully
  handled by the `(1)` + mount-fresh gate.

## Build state vs spec

- Complete: every testee nav item resolves; `TESTEE_NAV` matches the D3 ruling;
  `/results` redirects to the latest result or shows an honest empty/error state.
- Partial / Stubbed: none.

## Test coverage and CI results

- Tests: `Rail.test.tsx` href-lock → 5-item v1 array (+ `/attempts`/"In Progress"
  absent); badge-hidden-at-0 repointed to the admin `review` item; new
  `results-redirect.test.tsx` (latest→redirect, empty, error, freshness
  regression).
- CI at merge: all 11 checks **success**; Gitar **approved with suggestions**
  (1 non-correctness nit, declined with rationale); `mergeable_state: clean`. No
  fix-rounds.
- Manual verification: local `typecheck` / `lint` / `format:check` / `test --run`
  (134 files / 978) green; results-redirect test confirmed stable across 4 runs.

## Post-merge validation considerations

- FE-only; no dependency/config change. Re-verify locally: `cd frontend && pnpm
  install && pnpm test --run tests/components/shell/Rail.test.tsx
  tests/pages/results-redirect.test.tsx`. The Playwright shell e2e is unaffected
  (its nav-tap clicks "Discover").

## Anything a fresh Claude Code session needs to pick up cleanly

- `/results` is a **client** redirect by design (needs the authed testee's
  attempts via the bearer-token react-query client); don't convert it to a server
  `redirect()`.
- The `useMeAttemptsCapped(1)` distinct key + mount-fresh gate is load-bearing —
  do not "simplify" to the shared 200-cap or drop the `isFetchedAfterMount` gate,
  or "Latest Result" can point at the prior attempt within the 30s stale window
  (DEC-S3-A / DEC-S3-C).
- Recommended next action: Slice 5 (drift/dead-code hygiene — final slice; merge
  awaits explicit user authorization) after Slice 4 merges.
