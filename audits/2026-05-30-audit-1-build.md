# Audit 1 — Build

**Date:** 2026-05-30
**Type:** Comprehensive build audit (read-only)
**Scope:** Build pipeline only — install/dependency resolution, frontend typecheck/lint/test/build, backend ruff/mypy/pytest, OpenAPI codegen sync, migration-chain validity, workflow/CI config validity, build-time warnings & deprecations.
**Out of scope:** functional bug-hunting (Audit 2), functional correctness (Audit 3), silent-failure analysis (Audit 4), code improvements (Audit 5), making any fixes.
**Method:** three parallel read-only lanes — Lane 1 Frontend (node env), Lane 2 Backend (python env), Lane 3 Static config (no env). Full verbatim capture; `exit-0-with-warnings` treated as passed.

---

## Verdict

**The codebase builds cleanly end-to-end.** Every source-level gate in both CI workflows passes:

- **Frontend** `install → codegen:check → lint → format:check → typecheck → test → build` — all exit 0; 936/936 tests; clean `next build` with zero build warnings; no codegen drift.
- **Backend** `pin gate → structure gate → ruff → ruff format → mypy → pytest` — all exit 0; mypy clean across 62 files; 873 tests passed; 164 files formatted.
- **Migrations** — valid single-head linear chain `<base> → 0001 → … → 0008` (head `0008_slice_b_test_pill_id`).
- **Static config** — both workflows parse; every CI command resolves to a real script/target; node/pnpm/python pins agree across all locations; all Dockerfile stages & compose targets cross-reference.

**Zero source-level failures.** The single `failure`-severity finding is an environment/packaging artifact of the audit container, not the repository.

---

## Environment (audit-container conditions — not code findings)

These conditions of the audit sandbox are recorded separately so they are not mistaken for repository defects. All are absent on the clean CI runners.

| Condition | Detail | Effect on results |
|---|---|---|
| Python 3.11.15 on PATH, project targets 3.12 | `pyproject.toml` (ruff `py312`, mypy `3.12`) and both CI workflows use 3.12 | Lane 2 `mypy`/`pytest` PASS verdicts were produced on **3.11.15**. mypy *modeled* 3.12 via config, but the runtime interpreter + imported stdlib were 3.11. No 3.12-only API usage observed; green is strong but not a guarantee of identical outcome on the 3.12 CI runner. |
| Postgres unreachable | nothing on `:5432`; `alembic` not pre-installed | Migration **round-trip not executed** (init.sql → upgrade → downgrade → upgrade → pytest e2e) per agreed static-only scope. Static chain checks ran and passed. |
| `pip install` literal command failed (then worked around) | Debian-managed `PyJWT 2.7.0` has no RECORD file; pip's atomic transaction aborted at the first uninstall, committing nothing | Without the workaround every downstream backend step would have been BLOCKED. `pip install --ignore-installed PyJWT …` unblocked steps 2–8, which then ran for real. See F1. |
| Tool versions on PATH ≠ pins | PATH `/root/.local/bin`: ruff 0.15.8, mypy 1.19.1, pytest 9.0.2 vs pins ruff 0.6.9, mypy 1.11.2, pytest 8.4.2 | Lane 2 deliberately invoked the **pinned** versions via `python -m`, so reported results reflect the project toolchain. |
| node 22.22.2 / pnpm 10.33.0 | match pins exactly | Frontend lane fully representative of CI. |

---

## Per-segment summary

| Lane | Steps | Result |
|---|---|---|
| 1 — Frontend | install, codegen:check, lint, format:check, typecheck, test, build | **7/7 exit 0.** No drift; 0 lint/format/type errors; 936/936 tests; clean `next build`, zero build warnings. 2 steps emitted non-fatal warnings. |
| 2 — Backend | pip install, pin gate, structure gate, ruff, ruff format, mypy, pytest, alembic static | **Source: all PASS** (mypy 62 files clean; 873 tests; ruff clean; 164 files formatted). 1 environmental FAIL (pip/PyJWT). Migration round-trip not executed (no Postgres, by scope). |
| 3 — Static config | workflow YAML, CI command-drift, version-pin consistency, Dockerfile/compose | **All PASS.** Both workflows parse; every CI command resolves; node/pnpm/python pins agree across all locations; all Dockerfile stages & compose targets cross-reference. |

---

## Findings & triage

Triage locked at Audit 1 close. No GitHub issues are opened per-audit; convergent sites are surfaced after Audit 5's cross-audit synthesis.

### FAILURE

**F1 · be-install · `pip install -r requirements.txt -r requirements-dev.txt` exits 1 — TRIAGE: ACCEPT (environmental, not repo)**
```
ERROR: Cannot uninstall PyJWT 2.7.0, RECORD file not found. Hint: The package was installed by debian.
```
Triggered by `requirements.txt:18` (`PyJWT[crypto]==2.10.1`) upgrading over a Debian-provided PyJWT 2.7.0 in the audit container. pip downloaded every pinned wheel successfully (all cp311-compatible — **not** a `requires>=3.12` conflict); the atomic transaction aborted at the first uninstall, so nothing committed. A clean CI image carries no Debian-managed PyJWT, so this does not reproduce in CI. No source change. Accepted as an audit-environment artifact.

### WARNING

**W1 · fe-test · React `act()` warnings (high volume) — TRIAGE: QUEUE**
```
An update to GradingOverlay inside a test was not wrapped in act(...).
```
From fake-timer/state-driven tests: `tests/components/attempt/GradingOverlay.test.tsx` (~100+ repetitions), `tests/pages/attempt-runner.test.tsx` (FrozenRunner, Radio), `tests/components/admin/sweep-button.test.tsx`. Tests pass; the warnings are noise from timer advances not wrapped in `act()`. Small mechanical fix (wrap timer advances in `act()`) with real noise-reduction value. Does not block the build. Queued — fix opened after Audit 5 synthesis.

**W2 · fe-install · pnpm ignored build scripts — TRIAGE: ACCEPT**
```
Ignored build scripts: esbuild@0.21.5, msw@2.14.6, sharp@0.33.5, unrs-resolver@1.12.2.
```
pnpm 10 default (unapproved postinstall scripts not run). Build, tests, and codegen all succeeded without them. Revisit only if native `sharp` image optimization or MSW worker regeneration is needed.

**W3 · fe-test · jsdom navigation not implemented — TRIAGE: ACCEPT**
```
Error: Not implemented: navigation (except hash changes)
```
From `tests/components/result/pdf-export-button.test.tsx` — jsdom limitation on the synthetic anchor-click in the PDF-export flow; the test asserts the blob/objectURL/revoke path and passes. Cosmetic stderr.

### INFORMATIONAL — all TRIAGE: ACCEPT

- **fe-build:** clean `next build` — no build/deprecation/bundle warnings; 31 routes, shared First Load JS 106 kB (largest route 199 kB, under any Next threshold).
- **fe-test:** Vite CJS Node API deprecation notice (Vitest 2.1.8).
- **be-install:** pip "running as root" warning (sandbox artifact).
- **install notices:** pnpm self-update 10.33.0→11.5.0 (pin matches; cosmetic); Next telemetry notice.
- **Lane 3:** `actionlint`/`yamllint` not installed → substituted `yaml.safe_load` parse (all 3 files OK); `requirements-dev.txt` is the documented AC-CD1 third-file deviation.

---

## Cross-cutting patterns

1. **Sandbox ≠ CI in three concrete ways** (python 3.11 vs 3.12; Debian PyJWT; PATH tools vs pins). All are audit-environment issues, not repo defects, and all are absent on the clean CI runners. The single FAIL and the tool-version caveat both trace to this. Net signal: the repo's own gates are green; the divergences are container artifacts.
2. **Discipline gates are real and passing.** `check_unpinned_deps.py`, `structure_gate.py`, the `codegen:check` drift gate, and the Alembic single-head assertion all executed and passed — the project's self-imposed CI invariants hold.
3. **Test-suite warning hygiene is the only repo-side quality signal worth queueing** — the `act()` warnings (W1) are the lone non-cosmetic, repo-fixable item in the entire audit.
4. **No version drift anywhere.** node/pnpm/python pins agree across `.nvmrc`, `package.json`, workflows, and Dockerfiles; every CI `run:` maps to a real script/target; all compose `target:`s match Dockerfile stages.

---

## Recommendations

- **Fix-now:** none. No source-level failure exists in the build pipeline.
- **Queue:** W1 (wrap fake-timer advances in `act()` in the three named test files — quality, not correctness). F1's local-environment mitigation (use a clean venv / pre-remove Debian PyJWT for local & sandbox runs) is tooling/dev-env, not source.
- **Accept:** F1, W2, W3, and all informational items.
- **Confirm on a 3.12 runner:** the backend mypy/pytest greens were produced on 3.11.15 and carry the 3.11-vs-3.12 caveat. CI already runs 3.12, so the authoritative signal is the next CI run — no separate action, but do not treat this lane's green as a substitute for the 3.12 CI result.

---

*Read-only audit — no files were modified during investigation (the frontend `codegen:check` temp file self-cleaned). Per audit-trail convention, GitHub issues are not opened per-audit; convergent sites are identified after Audit 5's cross-audit synthesis.*
