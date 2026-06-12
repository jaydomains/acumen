# Handover — C1 generated-content self-review protocol (the safety floor)

## PR identifier and link

- PR: #121 — "C1 — generated-content self-review protocol: content_self_review op + 3 cross-model passes (AC-D30 / §6.9)"
- Link: https://github.com/jaydomains/acumen/pull/121
- Author / session: executor session, autonomous-content sequenced cycle (A1→F1)
- Date closed: 2026-06-12 (squash-merged to `main` @ `a59a40c` by the code-overseer)

> Slice **7/14 (halfway)** — the non-negotiable safety floor (ruling 4) is live.

## Phase reference

- ROADMAP phase: **Autonomous content generation + retroactive oversight** (NS-5) — slice **C1**.
- Fully closes the phase? **No** — the C1–C2 row stays `partial` (C2 completes it).

## What was built

- Files added: `app/ai/prompts/content_self_review_{grounding,safety,provenance}.py`, `app/domain/self_review.py`, `tests/unit/test_self_review.py`.
- Files changed: `app/ai/provider.py` (mint `Operation.content_self_review` + `_REVIEW_DEFAULT_OPS` + `resolve_model` + stub per-variant branch + count docstrings), `app/ai/openai.py` (`review()` prompt-variant support + `_REVIEW_OPS`/`_MAX_OUTPUT_TOKENS`), `app/ai/cost.py` (`OP_TO_METHOD`), `app/ai/prompts/__init__.py` (`_REGISTRY` + 3 `_VARIANT_REGISTRY`), `tests/unit/test_p5_prompts.py`, `CHECKLIST.md`.
- Summary: the ninth named op (`content_self_review`) routed cross-family to OpenAI `review()`; three prompt-variant passes (grounding/safety/provenance); `self_review_draft(db, *, draft, provenance) -> SelfReviewResult` runs the three cross-model passes and returns the verdicts + the **re-adjudicated `safety_relevant`** (AC-D21 catch) + the NS-7 `degrade_mode` switch (default `degrade`).

## What was decided in this PR

- **NORMAL class** — AC-D30/NS-2/NS-7/AC-D21/§6.9 all ratified PR-A/B/C; `git diff origin/main` on the anchors is **empty**. Only code count-mirrors completed to nine. No migration, no new config field (`content_self_review` reuses `openai_model_review`).
- **Registry design:** `content_self_review`'s default `_REGISTRY` prompt = the grounding pass (the primary review, so the op is a `registered_operations()` member); all three passes are named `_VARIANT_REGISTRY` entries.

## Drift flags raised and how they were resolved

- None spec-class. **Gitar #1 ≡ auditor CA-C1-1 (BLOCKING), both independently flagged + folded:** `self_review_draft` trusted the model's free-form `verdict` string over the derived structured signals — a self-contradicting model could fail-OPEN past C2's hard floor. Fixed with **fail-closed verdict reconciliation** (force `fail` when `unsupported_claims`/`orphan_claims` non-empty or the safety tag flips up) + a conservative safety-tag fallback when the safety pass omits the tag. Enforces the ratified per-pass contract; no design change.

## Open questions deferred to a later phase

- The C1 protocol returns verdicts + cost (`PassVerdict.cost_usd` / `total_cost_usd`); **C2** computes the confidence score from them + the provenance authority tiers and persists the review spend on the `PublishRecord`.
- The NS-7 `degrade_mode` switch is read by **C2's gate**.

## Build state vs spec

- Complete: the self-review protocol (op + 3 passes + `self_review_draft` + re-adjudication + NS-7 switch).
- Partial (later slices): the confidence score + auto-publish gate (C2 consumes the verdicts), bootstrap-on-publish (F1), the oversight dashboard (E1/E2).

## Test coverage and CI results

- `tests/unit/test_self_review.py` — 7 zero-network tests: three cross-model passes, safety flip of a false-negative mistag + correct tag unchanged, orphan-claim provenance verdict, op-wiring sweep floors, NS-7 degrade default, fail-closed verdict reconciliation. 479/479 unit pass at merge.
- CI at merge: green (checks/migration-chain/docker-build/e2e/Gitar). 3 sign-offs at `4bd3345` + Gitar-green + mergeable=clean.

## Post-merge validation considerations

- No migration. Re-verify: `python -m pytest tests/unit/test_self_review.py tests/unit/test_p5_prompts.py tests/unit/test_p5_cost.py -q`.

## Anything a fresh Claude Code session needs to pick up cleanly

- Required reading: `plans/REQUIRED_READING.md`, `.claude/roles/planner.md`, detail §7 (C1) / §8 (C2).
- Next is **C2** (the auto-publish gate, AC-D31 / §6.5) — `compute_confidence` + `auto_publish_draft` + `PublishRecord` + `SystemSettings.pill_publish_confidence_threshold` (default 0.70) + a migration. It consumes C1's `SelfReviewResult` (verdicts + re-adjudicated `safety_relevant` + the NS-7 `degrade_mode`).
- **⚠️ C2 surfaced spec-drift:** AC-D31/AC-D7 text says `approve_pill_proposal` is removed + the refiner routes through the gate, but the detail plan + both reviewers scope C2 as generated-only (keep `approve_pill_proposal`); the refiner-reroute is assigned to no slice. Surfaced to the spec author; C2 built the generated-only scope pending the ruling.
- **Verify-before-write against merged main, not the detail plan** (re-confirmed every slice).
