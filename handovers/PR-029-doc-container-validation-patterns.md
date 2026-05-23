# Handover — PR-029 doc container-validation patterns (post-Clump-1/2 closure)

> Interstitial doc-hygiene PR (same class as PR-014 / PR-017 / PR-022 /
> PR-025 / PR-026 / PR-027). Captures two lessons from the Clump 1 /
> Clump 2 closure into the canonical doc set so a fresh session inherits
> them on first read: the stale-image trap reproduced at PR-028, and a
> Resend SMTP-username casing pitfall surfaced from the operator side.
> Single editorial slice under the PR-025 auto-continue default; Gitar
> review binding.

## PR identifier and link

- PR: #29 — *docs: capture stale-image-trap + Resend SMTP casing in canonical docs*
- Link: https://github.com/jaydomains/acumen/pull/29
- Author / session: Claude Code session (Opus 4.7 1M)
- Date closed: 2026-05-23

## Phase reference

- ROADMAP phase closed by this PR: **none** — interstitial doc hygiene, same class as PR-014 / PR-017 / PR-022 / PR-025 / PR-026 / PR-027. P0–P11 are complete; P12 (full hardening / end-to-end) remains the next operator's call.
- Does this PR fully close the phase? n/a — no phase closed. The PR captures two lessons from the Clump 1 / Clump 2 closure (the PR-028 stale-image trap; the Resend SMTP-username casing pitfall) and ports them forward into the canonical doc set + the per-PR handover template so a future session faces the prompt at handover time rather than re-learning the trap.

## What was built

- Files added:
  - `handovers/PR-029-doc-container-validation-patterns.md` — this file.
- Files changed:
  - `.env.example` — one-line inline comment above `SMTP_USERNAME=` warning that Resend SMTP credentials are case-sensitive and the username must be literal lowercase `resend`. Other SMTP entries unchanged (`SMTP_HOST` is just a hostname; `SMTP_PASSWORD` / `SMTP_SENDER` do not share the casing concern). Other non-SMTP entries unchanged (sweep confirmed no other casing-sensitive surface in the file — Anthropic / OpenAI / Drive / web-search all use API keys, no username-casing surface).
  - `SESSION_START.md` — new Working-agreement bullet **Stale-image trap (post-merge local validation)** inserted between the existing **Prescriptive-checks lesson (reviewer mode)** bullet and the existing **Doc hygiene** bullet. Bullet wording: when a PR touches code inside a container without a source bind-mount, post-merge local validation requires `docker compose build --no-cache <service>` before re-running; CI runs against checked-out source and passes; local containers run against baked images and can mask a successful fix; the "I merged the fix but it's still failing locally" trap is almost always this. Names the four built services in `docker-compose.yml` that have no source bind-mount (`acumen`, `acumen-worker`, `acumen-beat`, `migrate`) so the operator does not have to recompute the surface. Cites PR-028 as the reproducing precedent.
  - `HANDOVER_TEMPLATE.md` — new section **Post-merge validation considerations** inserted between **Test coverage and CI results** and **Anything a fresh Claude Code session needs to pick up cleanly**. Two question-prompt bullets: (a) does the PR touch container code without a source bind-mount? if yes, document the `--no-cache` rebuild requirement; (b) what is the exact local command sequence that re-verifies the fix end-to-end? Document so the next debug session doesn't waste cycles on stale-image masks. Template now has nine sections instead of eight.
- Files removed: none.
- Summary: three-file editorial pass that captures two operational lessons into canonical docs. The stale-image lesson lands in both the working-agreement (so the *next* session reads it on entry) and the handover template (so the *next handover author* faces the prompt before declaring the PR complete). The Resend casing note lands at the single inline location it applies to. No spec / no anchor / no code / no test / no migration change. Per PR-029 prompt: handover authored to match PR-014 / PR-017 / PR-022 / PR-025 / PR-026 / PR-027 precedent — every interstitial doc-hygiene PR in the chain has authored one.

## What was decided in this PR

- **D1 — Stale-image trap codified in SESSION_START Working-agreement, alongside the prescriptive-checks lesson.** Position groups it with the other build/review-practice bullets and immediately ahead of the Doc-hygiene bullet (which closes the Working-agreement section). Names the four built services with no source bind-mount inline so the bullet stands alone without requiring a `docker-compose.yml` re-read. Cites PR-028 as the reproducing precedent. The trap is operator-facing, not reviewer-facing, so the bullet is voiced to the executing session ("post-merge local validation requires …") rather than to a reviewer.
- **D2 — Stale-image lesson re-prompted at handover time via a new `HANDOVER_TEMPLATE.md` section.** The Working-agreement bullet alone would catch the case where the executing session re-reads SESSION_START on entry; the handover-template section catches the case where the session has been running for a while and is about to author the handover. Two prompts: container-touch yes/no + exact local re-verify command sequence. Sections-strict rule (`HANDOVER_TEMPLATE.md` sections must be filled, no abbreviation) means the prompt cannot silently drop out of a future handover.
- **D3 — Resend casing note placed inline in `.env.example`, not in a `docs/` guide.** Operators read `.env.example` at deploy / first-config time; they do not read `docs/`. The single-line comment is the smallest, closest-to-the-point-of-misuse warning available. Comment scoped to the one entry it applies to — no `SMTP_HOST` comment (just a hostname), no `SMTP_PASSWORD` / `SMTP_SENDER` comment (not casing-sensitive in the Resend-specific way). The sweep for other casing-sensitive provider surfaces in the file returned empty (no invented guidance for providers we don't use).
- **D4 — Rejected: `docker-compose.override.yml` source-bind-mount for dev.** Out of scope for this PR. A bind-mount would obviate the `--no-cache` rebuild step after merge for local validation but would change the dev-loop architecture (live-reload semantics, dependency-install semantics, file-permission edge cases on Linux/macOS). That is a separate dev-workflow conversation; the discipline patch fixes the proximate "I didn't know I needed `--no-cache`" failure mode without touching that architecture.
- **D5 — Rejected: retroactive edit of `handovers/PR-028-*.md`.** Handovers are immutable per `handovers/README.md:7` (except where confidentiality / privacy / legal compels an update, which does not apply here). The lesson lives forward in SESSION_START + HANDOVER_TEMPLATE + `.env.example`. Separate matter: `handovers/PR-028-*.md` does not exist on `main` at all (PR-028 landed without a handover); the missing-handover gap is recorded in "Open questions deferred" below.
- **D6 — Handover authored for this PR.** Confirmed via `AskUserQuestion` at plan time. Matches PR-014 / PR-017 / PR-022 / PR-025 / PR-026 / PR-027 precedent — every prior interstitial doc-hygiene PR authored one. This handover is itself the first to fill the new `HANDOVER_TEMPLATE.md` "Post-merge validation considerations" section (see below).
- New anchors introduced: **none**.
- Existing anchors referenced (no amendments): AC-CD16 / SPEC §8.3 (`.env.example` as the operator-facing env surface, AC-CD18 for env-defaulted model IDs), AC-D26 (SMTP comms surface — the SMTP block's existing comment is `SMTP (setup/reset/reminder/escalation, AC-D10 / AC-D26)`, which the inline Resend comment now sits within), the existing working-agreement bullets (prescriptive-checks lesson, doc hygiene, handover immutability, sections-strict rule, auto-continue default).

## Drift flags raised and how they were resolved

- **No spec drift.** Three doc edits land against canonical-doc text that was already at v1.8. No footer / version-pairing / phase-table mirror sweep triggered.
- **Plan-mode pre-execution surfacing.** Two items surfaced via `AskUserQuestion` at plan time (handover authorship; bind-mount carve-out positioning) rather than silently resolved. Both within the doc-only scope.
- **The "PR-028 has no handover on `main`" observation.** Recorded in "Open questions deferred" below as a forward-action item, not resolved here. Same pattern PR-018 → PR-026/F2 closed post-hoc — second instance of the same gap. Three resolution paths are open (post-hoc author later, procedural SESSION_START enforcement bullet, mechanical CI handover-at-PR-close check); selection deferred per the user's plan-approval note ("Worth raising after Clumps 3-5 ship").

## Open questions deferred to a later phase

- **`docker-compose.override.yml` source-bind-mount for the dev loop.** Would replace the post-merge `--no-cache` rebuild step with live source on the running container, removing the trap at the dev-loop architecture layer rather than the discipline layer. Trade-offs (live-reload semantics, dependency-install semantics, file-permission edge cases) are non-trivial; out of scope here. If pursued, separate dev-workflow PR.
- **Post-hoc handover for PR-028.** PR-028 landed without a handover file (`handovers/PR-028-*.md` is absent on `main`). Same gap pattern as PR-018 (caught post-hoc by PR-026 / F2). Two instances of the same drift now. Three open resolution paths:
  - **(a) Post-hoc handover author later** — same pattern as PR-018 / PR-026-F2. Reconstructs from the PR-028 commits (`83e5de1` freeze; `00efa32` Gitar review follow-up; merge `2009869`), the issue (alembic `DuplicateColumn` against an empty Postgres at 0003), and the resolution (freeze 0002 as a P1 snapshot with 34 explicit `Table(...)` objects against a migration-local `MetaData`, decoupled from `app.models`). Reactive; relies on each gap being noticed.
  - **(b) Procedural SESSION_START bullet about handover-at-PR-close enforcement.** Working-agreement already has "Handover at PR close" and the sections-strict rule; the gap is that neither blocks a merge when violated. A procedural bullet would name a *checking* step ("before declaring a PR complete, verify `handovers/PR-<id>-*.md` exists on the feature branch"). Preventive but discipline-bound, not enforced.
  - **(c) Mechanical CI check on handover presence at merge time.** A pre-merge GitHub Actions job that scans the diff for `handovers/PR-<id>-*.md` (or interstitial-class exemption). Hardest enforcement; requires a small CI add. Most reliable.
  - Selection deferred per the user's plan-approval note: "Worth raising after Clumps 3-5 ship." Not in scope for PR-029.
- **Multi-tenancy on cost-budget sweep, SQL push-down for `_live_anchor_counts_by_band`, frontend SSE consumer, real-Postgres E2E for Q1-failure rate-limit-no-burn, P12 hardening / full E2E, email-change workflow, hard-delete of users, refresh-token revocation store, `app/domain/users.py` listing in `scripts/structure_gate.py` `_DOMAIN`, AC-CD2-per-feature-router-layout vs admin-consolidation-reality divergence.** All carried forward from PR-024 / PR-025 / PR-026 / PR-027 — out of scope for this doc-only PR; ownership reverts to the next operator (P12 plan-mode).

## Build state vs spec

- Complete: three doc edits land (`.env.example` + `SESSION_START.md` + `HANDOVER_TEMPLATE.md`). Each is the smallest, closest-to-the-point-of-misuse edit available. Voice matched against the surrounding canonical-doc voice; section position chosen to group with related material.
- Partial: none. The PR is one-shot doc hygiene; nothing is started-but-incomplete.
- Stubbed: none. No code or interfaces touched.

## Test coverage and CI results

- Tests added / changed: none — doc-only PR.
- Coverage delta or current coverage: n/a — no executable code changed.
- CI result at merge: see PR final state.
- Manual verification performed:
  - `grep -n "Resend SMTP credentials are case-sensitive" .env.example` → one match, immediately above `SMTP_USERNAME=`.
  - `grep -n "Stale-image trap" SESSION_START.md` → one match, inside the Working-agreement section, between the **Prescriptive-checks lesson** bullet and the **Doc hygiene** bullet.
  - `grep -n "Post-merge validation considerations" HANDOVER_TEMPLATE.md` → one match, between **Test coverage and CI results** and **Anything a fresh Claude Code session needs to pick up cleanly**.
  - Read each edited file end-to-end after the edit to confirm the surrounding prose still flows.

## Post-merge validation considerations

- **Does this PR touch code that runs inside a container without a source bind mount?** **No.** Doc-only PR; the three edited files (`.env.example`, `SESSION_START.md`, `HANDOVER_TEMPLATE.md`) plus this handover are all read by humans / by the harness at session start, not by any running container. No `docker compose build` step is required to validate this PR.
- **What's the specific local command sequence that re-verifies this PR's fix end-to-end?** Three greps (in the manual-verification list above) plus an end-to-end read of each edited file. No container rebuild, no test re-run, no migration re-play.

## Anything a fresh Claude Code session needs to pick up cleanly

- **The new SESSION_START Working-agreement bullet should be picked up on first read.** A multi-slice plan that touches container code now has a named trap to test for before declaring a slice complete locally. The bullet names the four services that hit the trap (`acumen`, `acumen-worker`, `acumen-beat`, `migrate`) so the operator does not have to recompute the surface from `docker-compose.yml`.
- **`HANDOVER_TEMPLATE.md` now has nine sections, not eight.** The new section is **Post-merge validation considerations** and sits between **Test coverage and CI results** and **Anything a fresh Claude Code session needs to pick up cleanly**. The sections-strict rule applies — fill it on every future handover even if the answer is "doc-only PR, no container-code touched, three greps to re-verify."
- **`.env.example` now carries one inline operator-warning comment** above `SMTP_USERNAME=`. The line above it (`SMTP_PORT=587`) and the line below it (`SMTP_PASSWORD=`) are unchanged. If a future operator switches the SMTP provider away from Resend, the comment can be edited or removed in a single line; the AC-CD16 / AC-D26 framing of the SMTP block above the comment is unaffected.
- **`handovers/PR-028-*.md` does not exist on `main`.** Same gap pattern as PR-018 (caught post-hoc by PR-026 / F2). Recorded in "Open questions deferred" above with three resolution paths. The next interstitial doc-hygiene PR — or a future audit — can pick this up; do not silently treat the missing file as expected state.
- **Recommended next action.** Merge this PR; next session starts fresh against the new `main`, reads the updated SESSION_START Working-agreement (the **Stale-image trap** bullet lives next to the **Prescriptive-checks lesson** bullet now), and faces the **Post-merge validation considerations** prompt when it authors its own handover. If the next session is Clump 3 / 4 / 5, the PR-028 missing-handover gap is on the table for after that ships.
