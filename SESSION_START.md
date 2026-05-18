# SESSION_START — Acumen entry point & reading order for every Claude Code session (canonical)

> Read this first, every session, before touching anything.

## What Acumen is

A standalone AI-driven competency assessment and adaptive-learning app for
KBC, built to later fold into the SiteMesh platform as a peer Workflow
module. Standalone-first; SiteMesh port seams are documented, not built.

## Canonical documents (root, in precedence order)

1. **`SPEC.md`** — functional specification. Status **v1.2**.
2. **`DECISIONS.md`** — product anchors **AC-D1–AC-D27**. Status **v1.2**.
3. **`CODE_SPEC.md`** — technical spec + stack lock; anchors
   **AC-CD1–AC-CD18**. The codebase is the source of truth; unbuilt items
   are `(pending P{n})`.
4. **`ROADMAP.md`** — phased build plan **P0–P11**, one PR per phase.
5. **`CHECKLIST.md`** — per-phase acceptance + the live drift questions.

This file is itself canonical. Anything under `docs/` is supplementary
and is overridden by the five documents above.

## Reading order for a build session

1. This file. 2. `CHECKLIST.md` (what is `built` / `partial` / `missing`,
and the open **Drift questions**). 3. The `ROADMAP.md` phase you are
closing. 4. The `CODE_SPEC.md` sections + AC-CD anchors that phase cites.
5. The `DECISIONS.md` AC-D anchors those reference. 6. The latest file in
`handovers/`.

## Working agreement

- **One prompt -> one branch -> one squash PR -> one ROADMAP phase.**
- Close every PR with a handover written from `HANDOVER_TEMPLATE.md` into
  `handovers/PR-<id>-<slug>.md`. Handovers are immutable once written.
- Product decisions are anchored `AC-D{n}` in `DECISIONS.md`; technical
  decisions `AC-CD{n}` in `CODE_SPEC.md`. Never decide silently — add or
  cite an anchor.
- Doc hygiene: no `TBD`, no trailing "etc.", no "or"-framed requirements
  in `CODE_SPEC.md`. CHECKLIST rows tick only with real Evidence.
- The statistical core (`app/domain/calibration.py`, `competence.py`)
  cannot be cheaply A/B-tested in production — it carries near-full
  unit/branch coverage with fixtures derived from the DECISIONS formulas.

## Known open item

- **AC-CD11** (cross-family review latency rule) is the one unresolved
  technical anchor. It has a **pre-build gate at P6** — resolve it with
  the user before building the blocking submit path. See `CHECKLIST.md`
  Drift questions and `CODE_SPEC.md` §11/AC-CD11.

## Current state

Specs are at **v1.2** (v1.2 clarification resolved the previously
under-specified statistical anchors: AC-D9 competence formula,
AC-D20/AC-D27 calibration math, AC-D22 embedding model, AC-D25 benchmark
carve-out). CODE_SPEC / ROADMAP / CHECKLIST are written. **No
application code exists yet** — the next session starts at ROADMAP **P0**.

*End of SESSION_START. Paired with the v1.2 document set.*
