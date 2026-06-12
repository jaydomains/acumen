# Handover — A1 source-authority allowlist + scoring registry

## PR identifier and link

- PR: #114 — "A1 — source-authority allowlist + tiered scoring registry (AC-D28)"
- Link: https://github.com/jaydomains/acumen/pull/114
- Author / session: executor session for the autonomous-content-generation sequenced execution cycle (A1→F1)
- Date closed: 2026-06-12 (squash-merged to `main` @ `4f95414` by the code-overseer)

> Authored just after merge (A1 converged fast); carried on the A2 branch as the additive record, since A1's branch was deleted at merge.

## Phase reference

- ROADMAP phase closed by this PR: **Autonomous content generation + retroactive oversight** (named non-phase workstream, NS-5) — slice **A1** of 14.
- Does this PR fully close the phase? **Partial** — A1 is the first of 14 execution slices; it closes only the A1 row in `CHECKLIST.md`.

## What was built

- Files added: `app/domain/source_authority.py`, `tests/unit/test_source_authority.py`, `plans/.wake-log-a1-executor.md`
- Files changed: `app/config.py` (3 `source_authority_t{1,2,3}_extra` env fields), `.env.example` (siblings), `CHECKLIST.md` (A1 row `missing`→`built`)
- Files removed: none
- Summary: A pure, offline source-authority registry (AC-D28) — `Tier` IntEnum (T1/T2/T3), a seed allowlist, `authority_tier`/`authority_score`/`is_allowlisted`/`filter_to_allowlist`, and a memoised seed+env allowlist builder. It answers "is this host allowlisted, and at what tier/score?" and restricts a web-search result list to allowlisted hosts. No DB table at A1 (code-VCS-registry pattern); the demoted-sources override layer is the E2 half.

## What was decided in this PR

- No new decisions made (execution-only PR). Implemented against the **ratified** `AC-D28` body verbatim.
- New anchors introduced by this PR: **none** (NORMAL execution class; `AC-D28` was minted upstream in the amendment cycle PR-A / #110).
- Existing anchors this PR depends on: **AC-D28** (source-authority allowlist + tiered scoring — DS1-a scores 1.0/0.6/0.3; DS1-b T1+T2 seeds, T3 minimal; DS1-c corpus-acquisition-only), **AC-CD18** (env-default pattern), **AC-CD15** (zero-network tests), **AC-CD2/AC-CD17** (structure gate), **AC-D21** (informal authority predecessor; untouched here).

## Drift flags raised and how they were resolved

- No spec/code drift. Verified the ratified `AC-D28` body matches the detail-plan's recommended direction before coding (DS1-a/b/c all ratified as leaned). Amend-once held — no anchor body touched.
- One **real implementation bug** caught in review (not spec drift): `authority_tier` short-circuited on the exact-host match before the wildcard scan, so an env *exact* entry at a weaker tier silently downgraded a host a seed *wildcard* ranked higher (`*.gov.za`=T1 + `SOURCE_AUTHORITY_T3_EXTRA=data.gov.za` → returned T3), violating AC-D28's "resolves to the stronger tier." **Resolved** (r1 fix `ef30795`): take the strongest of the exact tier and any covering wildcard (exact-wins-on-tie preserved), pinned by `test_env_exact_does_not_downgrade_seed_wildcard`. Reviewer IDs: CA-A1-1 / OV-A1-4r / Gitar finding 1.

## Open questions deferred to a later phase

- The per-source **demotion / override** DB layer (`demoted_sources`) is deferred to **E2 / AC-CD26** (DS13-a [A1+E2]). A1 reads only the code seed; E2 adds the DB override join.
- Runtime allowlist editing (a dashboard surface promoting the registry to a DB table) is a fresh design point to surface **if/when** a later slice shows the operator needs it — not pre-built.

## Build state vs spec

- Complete: the A1 registry surface (`authority_tier`, `authority_score`, `is_allowlisted`, `filter_to_allowlist`) + env-extension + tests — matches AC-D28's A1 half fully.
- Partial: AC-D28 as a whole is multi-slice — A2 stamps `source_host`/`authority_tier`/`authority_score` on `CorpusChunk`; E2 adds `demoted_sources`. Those are later slices.
- Stubbed: none.

## Test coverage and CI results

- Tests added: `tests/unit/test_source_authority.py` — 18 zero-network tests (tier resolution exact+wildcard, exact-wins-on-tie, env-exact-no-downgrade regression, multi-wildcard precedence, score monotonicity, filter drop/pair/order, env merge + stronger-tier conflict, pure-offline).
- Coverage: full branch coverage of the new module.
- CI result at merge: **green** — all `checks` (backend+frontend), `migration-chain`, `docker-build`, `e2e` ✓; Gitar ✓; 422/422 unit pass locally.
- Manual verification: ran the suite + ruff/format/mypy/structure-gate locally before each push.

## Post-merge validation considerations

- No container/bind-mount concern — pure Python domain module, no migration, no runtime service change.
- Re-verify locally: `python -m pytest tests/unit/test_source_authority.py -q` and `python scripts/structure_gate.py`.

## Anything a fresh Claude Code session needs to pick up cleanly

- Required reading: `plans/REQUIRED_READING.md`, `.claude/roles/planner.md` (executor adaptation), the detail plan `plans/2026-06-09-autonomous-content-generation-detail.md` §1 (A1) and §2 (A2 next).
- The `source_authority` module is the **A2 dependency**: A2 wires `filter_to_allowlist` around `get_web_search_source().search(...)` and stamps the tier/score onto each `CorpusChunk`.
- Reviewers ride the whole chain on fixed branches: code-auditor `claude/code-audit-sequenced-execution-57lyby`, code-overseer `claude/code-execution-governance-3sh4hm`. Watch those for review markers; the webhook only delivers comments + CI failures (not branch markers or clean-green).
- Recommended next action: A2 — reference corpus builder (AC-CD25): `CorpusChunk` model + migration, `app/domain/corpus_builder.py` (allowlist web-search → fetch → extract → embed → pgvector), bs4+pypdf deps, NS-1 Drive-ingest relocation of shared primitives.
