# Handover — C2 autonomous auto-publish gate (Stage C complete)

## PR identifier and link

- PR: #122 — "C2 — autonomous auto-publish gate: compute_confidence + auto_publish_draft + PublishRecord (AC-D31 / §6.5)"
- Link: https://github.com/jaydomains/acumen/pull/122
- Author / session: executor session, autonomous-content sequenced cycle (A1→F1)
- Date closed: 2026-06-12 (squash-merged to `main` @ `7aa5119` by the code-overseer)

> Slice **8/14 — Stage C complete.** The autonomous pipeline now generates → grounds → self-reviews → **auto-publishes**.

## Phase reference

- ROADMAP phase: **Autonomous content generation + retroactive oversight** (NS-5) — slice **C2**.
- Fully closes the phase? **Yes for the C1–C2 row** (`done`); Stage C complete.

## What was built

- Files added: `app/domain/publish.py`, `alembic/versions/0011_c2_publish_record.py`, `tests/unit/test_autopublish_gate.py`.
- Files changed: `app/models.py` (`PublishRecord` + `SystemSettings.pill_publish_confidence_threshold`), `app/routers/catalogue.py` (the `/pill-proposals/{id}/approve` endpoint repointed to the gate), `app/domain/catalogue.py` (removed the human-gate `approve_pill_proposal`), `tests/unit/test_p1_schema.py`, the 3 pill-proposal integration tests, `CHECKLIST.md`.
- Summary: `compute_confidence` (hard-fail floor on grounding/provenance; authority-weighted DS1-a mean + capped DS2-b corroboration) + `auto_publish_draft` (C1 self-review → score → `create_pill` honouring the re-adjudicated `safety_relevant`; ≥ threshold live, < threshold / NS-7-degrade / **safety-pass-fail** → `low_confidence` publish-with-warning; nothing held). `PublishRecord` (DS8-a) is the E1/E2 read + per-batch-rollback surface.

## What was decided in this PR

- **NORMAL class** — AC-D31/AC-D7/§6.5/§290 ratified PR-C; anchor diff empty. Migration `0011` (PublishRecord + threshold column).
- **Refiner-reroute = Option 2 (spec-author ruling, authenticated this conversation):** the `pill_proposal` refiner now routes through the **same AC-D31 gate** (`auto_publish_draft` normalizes both `payload["draft"]` and `payload["proposal"]`; the `/approve` endpoint repoints to the gate — the ruling's blessed "repoint"; the human-gate `approve_pill_proposal` removed; FE proposals-tab catch-up is a follow-up PR). One publication path, no per-source gate exception.

## Drift flags raised and how they were resolved

- **The refiner-reroute spec-drift** (AC-D31/AC-D7 "approve_pill_proposal removed, refiner through the gate" vs the detail plan + OV-C2-8 generated-only scope) was **surfaced to the spec author** (the third detail-plan-vs-amendment-chain drift this cycle) → ruled **Option 2 (fold)**, folded. Note: the amendment-chain ratifications post-date the detail plan; **ratified anchors govern**.
- **Gitar (2 rounds):** (1) `auto_publish_draft` ignored `review.safety.verdict` → a failed safety pass could publish live + unflagged multi-provider → added `safety_failed → low_confidence` (≡ auditor CA-C2-1, both flagged; the floor flags, ruling 2 still "nothing held"). Earlier C1: the fail-closed verdict reconciliation.

## Open questions deferred to a later phase

- **Refiner FE catch-up** (proposals-tab UX vs the new auto-publish backend) — a follow-up FE PR per the ruling.
- The bootstrap-on-publish trigger fires on `auto_publish_draft`'s publish event — that wiring is **F1**.
- E1/E2 consume the `PublishRecord` (read surface + per-pill/question/batch/source rollback).

## Build state vs spec

- Complete: the confidence score + auto-publish gate + `PublishRecord` + the threshold + the refiner-reroute (one publication path).
- Partial (later slices): gap-detection trigger that feeds the gate (D3 calls `enqueue_generated_drafts`); bootstrap-on-publish (F1); oversight dashboard + rollback (E1/E2).

## Test coverage and CI results

- `tests/unit/test_autopublish_gate.py` — 8 tests (above/below-threshold, re-adjudicated safety honoured, single global threshold + tenant override, per-type telemetry, NS-7 degrade, safety-fail flagging, refiner-through-gate, `compute_confidence` floors) + the 3 pill-proposal integration files updated to the gate behavior. 1002/1002 unit+integration at merge.
- CI at merge: green; 3 sign-offs + Gitar green + mergeable clean; merged on the spec-author A-confirm (the refiner-reroute, a ratification-class decision, was authenticated to the overseer's own channel).

## Post-merge validation considerations

- Migration `0011` additive (PublishRecord table + threshold column; up/down clean; `--sql` round-trip verified). The threshold's server default applies on DB insert; `_publish_threshold` tolerates a None/absent value (0.70 default).
- Re-verify: `python -m pytest tests/unit/test_autopublish_gate.py tests/integration/test_p3_proposal_queue.py tests/integration/test_p5_pill_proposal.py -q`.

## Anything a fresh Claude Code session needs to pick up cleanly

- Required reading: `plans/REQUIRED_READING.md`, detail §8 (C2) / §9 (D1-D2).
- Next is **D1-D2** (the §6.5 signal spine, SPEC §5 `GapSignal`) — the polymorphic signal store + discovery-miss/question-tag capture + signal-layer dedup; `scope_clarification` type defined, capture deferred (signal-3). Ratified SPEC §5/§6.5 (PR-D); NORMAL class + a migration. It does NOT require Stage A/B/C merged (captures from existing flows) — the most independent Stage-D slice.
- **Verify-before-write against merged main + DECISIONS/CODE_SPEC, not the detail-plan body** (the spec author's standing note — three drifts surfaced this cycle: A3 cron-count, cosine Option-B, C2 refiner-reroute; the amendment chain post-dates the detail plan, ratified anchors govern).
