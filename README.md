# Acumen

Acumen is a standalone adaptive learning application. Its full functional
specification lives in `SPEC.md` and `DECISIONS.md` at the repo root; those,
together with `CODE_SPEC.md`, `ROADMAP.md`, and `CHECKLIST.md`, are the
canonical discipline documents that govern how this project is built.

## Project state

Pre-build. The v1.1 specification is locked. Discipline scaffolding is in
place; no application code has been written and no stack has been chosen yet
(`CODE_SPEC.md` will lock that).

## How to engage with this codebase

Read `SESSION_START.md` first. It is the entry point for every working
session and defines the required reading order and working discipline before
any change is made. Per-PR handovers are recorded in `handovers/`, one file
per PR, using `HANDOVER_TEMPLATE.md`.

The frontend lives at `frontend/`; see `frontend/README.md` and
`CODE_SPEC.md` AC-CD19 for the stack lock and dev workflow.

For taking a build to production, see `docs/DEPLOYMENT.md` — the operator
deploy-readiness checklist (required-in-prod env vars, the no-wildcard CORS
rule, and the fail-closed boot checks) — paired with the annotated
`.env.example`.

This README is internal documentation, not a public-facing description.
