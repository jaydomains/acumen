# Overpass Audit — Autonomous Content Generation + Retroactive Oversight

**Date:** 2026-06-13
**Subject:** Post-merge cross-cutting verification of the autonomous content
generation + retroactive oversight workstream (PR-A..PR-D ratification cycle;
14 execution slices A1..F1; PRs #107–#128, amendments #110–#113 + #116).
**Type:** Independent single-pass overpass audit (OV-6 mitigation — catch what
correlated same-model reviewers missed). Two passes filed: a primary pass over
ten cross-cutting axes, and a second pass over eight orthogonal axes.
**Discipline:** Read-only. Surface only — no fixes authored, no code touched, no
SPEC/DECISIONS/CODE_SPEC modified (SESSION_START audit pattern).

**Severity legend:** CRITICAL (blocks deploy) · HIGH (fix before pilot launch) ·
MEDIUM (fix when convenient post-deploy) · LOW (note for awareness) ·
CONFIRMED (verified working, no action).

---

# PASS 1 — Primary axes

**Method:** three fan-out maps (docs/anchors, implementation, PRs/handovers) +
firsthand reads of `publish.py`, `self_review.py`, `corpus_builder.py`,
`oversight.py`, `worker.py`, `catalogue.py`, `config.py`, `source_authority.py`,
`SESSION_START.md`.

The workstream is well-built at the slice level — 17 findings were caught and
fixed pre-merge (incl. the A2 blind-SSRF and the C1 fail-open). The findings
below are overwhelmingly **seam-level**: where individually-correct slices don't
compose — the OV-6 blind spot.

## Axis 1 — Cross-slice contract integrity

**CRITICAL — F1: the autonomous generation→publish drain is not wired; the loop
does not close.** `gap_detection.sweep` / `catalogue_health.check` crons
(`worker.py:227–261`) → `enqueue_generated_drafts` → N `pending`
`pill_generation` ProcessingTask rows (`generation.py:267`). Nothing consumes
them. The only non-test caller of `auto_publish_draft` is the HTTP endpoint
`POST /pill-proposals/{id}/approve` (`catalogue.py:396`) — an admin manually
approving one refiner proposal. `worker.py` registers eleven tasks; none drains
`pill_generation` tasks through the gate. (`pill_generation.bootstrap`,
`worker.py:264`, drains `pill_bootstrap` tasks — which are only created *by*
`auto_publish_draft:224`, so they are never created either.) Consequence: the
"fully autonomous, no human pre-publish gate" pipeline (§6.5 / AC-D31) cannot
publish anything autonomously in production; the sole publish trigger is a human
hitting `/approve` — the very gate the workstream claimed to remove. This is the
carry-forward "deployment-drain orchestration" item (B3 + F1 handovers) — but it
is load-bearing for the workstream's core thesis, not deploy plumbing.

**CONFIRMED — C1→C2 gating (the headline question): self-review does NOT hold
publish — by design — and the code matches the spec.** `publish.py:153` computes
`low_confidence = confidence < threshold or ns7_degrade or safety_failed`;
`create_pill()` at `:167` runs unconditionally. A grounding/provenance hard-fail
(`compute_confidence` floors to `0.0`, `:69`) or a failed safety pass only sets
the flag and the audit-action string. This faithfully implements AC-D31 rulings
1+2 ("nothing held pre-publish") and NS-7 degrade-not-gate. The gate is a
scorer/flagger, not a hold — no accidental hard-block, no accidental fail-open.

**CONFIRMED — refiner and generator share one path** (`publish.py:112`); and the
A2→B2 and D-spine cascades are coherent. The break is only the B3→C2
orchestration seam above.

## Axis 2 — Anchor-vs-code drift (spot-checked 7; full sweep in Pass 2 Axis 8)

AC-D31, AC-D30, AC-D29, AC-CD25, §290 — MATCH. AC-CD7 nine crons — consistent in
`worker.py`. **AC-D28 — partial:** acquisition-side demotion works; retrieval-side
does not (see Axis 3 HIGH).

## Axis 3 — Security beyond SSRF

**HIGH — Per-source rollback does not purge the discredited source's existing
corpus chunks; future generations re-ground on it.** `rollback_source`
(`oversight.py:497`) retires existing pills and writes a `denied` `DemotedSource`
row — but `filter_demoted` is consulted only at acquisition
(`corpus_builder.py:235`) and in the allowlist override. `retrieve_corpus_for_topic`
(`corpus_builder.py:425–428`) filters by `tenant_id` + `min_tier` only — never
consults `denied_hosts`. So a discredited source's already-stored `CorpusChunk`
rows stay live in the retrieval pool, and the next generation can ground new
pills on them. The "killer feature" rein-in is incomplete: it blocks
re-acquisition but not re-use.

**LOW — SSRF guard doesn't resolve DNS** (`corpus_builder.py:75`, blocks IP
literals only) — DNS-rebinding theoretically possible but requires controlling
DNS for a curated authority domain.
**LOW — no decompression-ratio guard**, but bounded by the 5 MB streamed cap (`:157`).
**CONFIRMED** — per-hop pre-request host validation, `follow_redirects=False`,
bounded redirects (`:133–150`), 5 MB cap, malformed-content fail-soft,
content-hash idempotent dedup (`:366`). The A2 SSRF fix holds.

## Axis 4 — Edge cases

**CONFIRMED** empty corpus → general-knowledge fallback (`publish.py:43,73`).
**MEDIUM** threshold unvalidated/unclamped (`publish.py:81`) — misconfig >1.0
flags all, <0 lands all live; T3-only grounding maxes at 0.45 < 0.70 → always
publish-with-warning (by design). **LOW** simultaneous gap-detection race
declined-with-rationale (single-tenant + D3 backstop). **CONFIRMED** partial-batch
fail-soft.

## Axis 5 — Resource handling

**MEDIUM — Unbounded full-table scans on oversight read + rollback paths.**
`_draft_ref_for_pill` (`oversight.py:215`, on the per-item provenance *read*
path) and `_pill_ids_for_source` (`:475`) load all `pill_generation`
ProcessingTasks and filter in Python — degrade linearly with generation volume.
Plus N+1 `_pill_by_id` loops in `rollback_batch` (`:442`) and `rollback_source`
(`:510`).
**MEDIUM — `GenerationProvenance` / `CorpusChunk` unbounded growth** — no
archival/truncation; IVFFlat recall degrades as the corpus grows without reindex.

## Axis 6 — Failure modes + recovery

**MEDIUM — AI cost sunk on post-LLM DB failure.** `auto_publish_draft` runs
`self_review_draft` (3 OpenAI calls) at `:132` before `db.flush()` at `:226`; a
commit failure rolls back the records atomically (good) but the review spend is
incurred and untracked (the provenance rows roll back too); no idempotency key.
**MEDIUM — LLM timeout/503 mid-self-review is uncaught.** After tenacity exhausts
(`anthropic.py:182`) the exception propagates; on `/approve` → HTTP 500, task
stays `pending`; with no autonomous drain there is no retry.
**CONFIRMED** corpus refresh dying halfway is safe (per-pill fail-soft, idempotent).

## Axis 7 — Audit-log completeness (§290)

**CONFIRMED complete across both origins.** `record_audit` (`catalogue.py:51`) is
append-only. Publish → `pill_generation.publish` / `.publish_flagged`
(`publish.py:179`); rollbacks → `pill_generation.rollback_{pill,question,batch,source}`
(`oversight.py:393,420,451,519,551`); safety override via `override_pill_safety`.
Caller-commit ties each audit row atomically to its state change. §290's
published / published-with-warning / rolled-back are all covered. (Only
*exercised* on the manual `/approve` path until the Axis-1 drain exists.)

## Axis 8 — Test coverage adequacy

**MEDIUM — Tests exercise `auto_publish_draft` directly, not the autonomous
trigger path.** No test drives cron→enqueue→drain→publish end-to-end, because the
drain (Axis 1) doesn't exist — so the missing orchestration is invisible to a
green suite. Same "fake/direct-call tests mask the integration gap" pattern the
D1-D2 handover flagged (CA-D-2).

## Axis 9 — Carry-forward debt (deferred → forgotten check)

Tracked and still-deferred (not forgotten): NS-1 Drive code removal; FE-10
oversight dashboard; thin-band remediation (spec-owned); concurrent-dup race
(declined); per-tenant gap-weight tuning. **Could not verify (ledger not
in-repo):** OV-6 (the audit charter, not a repo artifact); "15 admin AC-D sites"
and "F3 model-name divergence" — not present in any v1.9 doc/PR/handover. F3 in
code: model defaults are pinned literals (`config.py:60–71`) but env-overridable
(AC-CD18-compliant); the divergence is doc "latest" vs code-pinned name
(cosmetic, LOW). **MEDIUM (governance):** the deferred-debt ledger referenced by
the audit charter is itself not discoverable in the canonical docs.

## Axis 10 — Anything else

**HIGH — The compensating control for autonomous publish has no operable
surface.** The safety posture is "publish live (flagged), rein in retroactively"
(AC-D31 + §4.11), but the retroactive half is backend-only: FE-10 (oversight +
rollback UI) is deferred. In a pilot, safety-failed/low-confidence content goes
live with no human-visible review/rollback surface — admins can only rein in via
raw API calls.
**HIGH — `SESSION_START.md` is stale at v1.8.** The canonical "read first"
doc still declares AC-D1–AC-D27 / AC-CD1–AC-CD18, "Open items (none)", and a
"Backend v1 complete, FE the live track" Current-State — with zero mention of the
v1.9 workstream, AC-D28–31, AC-CD25–26, the nine crons, or FE-10. The repo's own
in-body-override/sweep-the-mirrors rule was not applied on the v1.9 merge.

## Pass 1 severity roll-up

| # | Finding | Sev |
|---|---|---|
| 1 | Autonomous generation→publish drain not wired — loop doesn't close (`worker.py`) | CRITICAL |
| 2 | Demoted-source corpus chunks stay retrievable; generations re-ground (`corpus_builder.py:425`) | HIGH |
| 3 | Retroactive-oversight mitigation (FE-10) deferred — autonomy ships without an operable review/rollback surface | HIGH |
| 4 | `SESSION_START.md` stale at v1.8; v1.9 workstream not reflected | HIGH |
| 5 | Unbounded scans + N+1 on oversight read/rollback paths (`oversight.py:215,442,475,510`) | MEDIUM |
| 6 | `GenerationProvenance`/`CorpusChunk` unbounded growth; IVFFlat at scale | MEDIUM |
| 7 | AI cost sunk + untracked on post-LLM commit failure (`publish.py:132`) | MEDIUM |
| 8 | LLM timeout mid-review uncaught; no retry for generated drafts | MEDIUM |
| 9 | Publish threshold unvalidated/unclamped (`publish.py:81`) | MEDIUM |
| 10 | Tests exercise the gate directly, not the autonomous pipeline closure | MEDIUM |
| 11 | Carry-forward debt ledger (OV-6/15-sites/F3) not discoverable in-repo | MEDIUM |
| 12 | SSRF guard doesn't resolve DNS (rebinding) | LOW |
| 13 | No decompression-ratio guard (bounded by 5 MB cap) | LOW |
| 14 | F3: model defaults pinned literals but env-overridable (AC-CD18-compliant) | LOW |
| — | C2 gate matches AC-D31; C1 fail-closed; §290 complete; SSRF/redirect/size solid; refiner+generator unified; corroboration math; idempotent dedup; acquisition-side demotion | CONFIRMED |

## Pass 1 overall assessment: NOT READY (autonomous) / READY-WITH-CONDITIONS (gated pilot)

Slice-level engineering is strong; the gate/review/audit core is correct and
faithful to spec. Two seam-level facts block the workstream's thesis: the
autonomous loop does not close in merged code (Finding 1), and the compensating
control is not operable and is leaky (Findings 2 + 3).

**Conditions before pilot launch:**
- (blocker) Wire and test the generation→self-review→publish drain end-to-end
  (1), with timeout/retry (8) and a cost-idempotency key (7).
- (blocker) Make per-source rollback exclude demoted hosts from
  `retrieve_corpus_for_topic`, not just re-acquisition (2).
- (pilot-gating) Ship a thin operable oversight+rollback surface, or run the
  pilot with autonomy disabled and `/approve` as the publish path until FE-10
  lands (3).
- (should-fix) Refresh `SESSION_START.md` to v1.9 (4); clamp the publish
  threshold (9); surface the carry-forward ledger (11).

MEDIUM/LOW items (scans, cardinality, DNS, decompression, F3) are fine
post-deploy.

---

# PASS 2 — Orthogonal axes

**Premise:** Pass 1 findings assumed standing, not re-verified. **Method:**
firsthand reads of `generation.py`, `gap_detection.py`, `bootstrap.py`,
`oversight.py` (router + domain), `source_authority.py`, `config.py`, migrations
0009–0013; dedicated full 57-anchor sweep. Recurring theme: the *mechanics* are
sound (anchors, migrations, authz, bounded loops) while the *production reality*
(concurrency, cost ceilings, contradictory/paywalled sources, multi-tenant) is
under-defended.

## Axis 1 — Concurrency + race conditions

**HIGH — The ProcessingTask work-queue and the signal-dedup guards have no
DB-level locking or unique constraints; concurrent workers/sweeps double-process
and duplicate-generate.** `process_pending_bootstraps` (`bootstrap.py:221`) and
the to-be-wired generation drain select `status == pending` with a plain
`SELECT` — no `FOR UPDATE SKIP LOCKED`. Two concurrent workers claim the same
rows → double LLM spend (idempotency protects data, not cost). The
`gap_detection_sweep` / `catalogue_health_check` three-arm dedup (suppressed-topics,
pending-batch `_pending_batch_for`, generate-once `_generated_gap_signals`) is
read-then-write TOCTOU with no constraint backing it → concurrent sweeps open
duplicate generation batches.

**MEDIUM — `/approve` is check-then-act without a row lock** (`catalogue.py:394`):
two concurrent submits both pass the `pending` guard → the same proposal
publishes twice (two pills, double spend).

**CONFIRMED — the Pass-1 declined D1-D2 race rationale holds, but only for
signals.** D3 clusters by `dedup_key` and sums `occurrence_count`
(`gap_detection.py:120,126`), so duplicate signal rows still cluster correctly.
The identical pattern at the drain / sweep / `/approve` sites is NOT benign; that
generalization gap is unflagged.
**LOW** auto-publish vs concurrent demotion — uses an authority snapshot; benign.

## Axis 2 — Multi-tenant assumptions

**MEDIUM — Every autonomous-workstream function hard-codes the literal
`SEED_TENANT_ID`; there is no tenant-from-actor seam.** (`generation.py:134/179`,
all of `gap_detection.py`, `bootstrap.py:179/223`, all of `oversight.py`,
`publish.py:86`, all of `corpus_builder.py`, `source_authority.py:235/291`.)
Consistent with AC-CD3 (RLS deferred), so pilot-safe. But when a 2nd tenant is
added: (a) every oversight read returns tenant-0's data to any admin →
cross-tenant leak; rollback/demotion mutate tenant-0. (b) `require_role` checks
role, not tenant membership. (c) Contra AC-CD5's "one-file swap", tenant scoping
is sprinkled across ~8 modules (`worker.py:339` itself defers the
"tenant-iteration loop"). The workstream deepened the single-tenant coupling with
no abstraction and no guard test.

## Axis 3 — Operational observability

**MEDIUM — If autonomous publish goes wrong at 3am, no one is paged; diagnosis
means DB/log spelunking.** Present: AuditLog rows, structured `logger.warning/
.exception` (`generation.py:151,243`, `corpus_builder.py:138`,
`bootstrap.py:244`), Celery `task_failure`/`task_retry` logs (`worker.py:54-93`).
Absent: (a) any metric/counter emission (no publish rate, flag-rate, confidence
distribution, drain-backlog depth, spend-rate); (b) cron wrappers write no audit
row (Decision D6) — a sweep's effect is only a return dict + log; (c) the only
proactive alert is the budget threshold; (d) FE-10 deferred. Diagnosis is
pull-only.
**LOW** no correlation id threading gap-signal→batch→draft→publish→bootstrap
(`batch_id` helps partially).

## Axis 4 — Permission + authorization boundaries

**CONFIRMED — admin boundary enforced at the endpoint layer, consistently.** All
six oversight endpoints + `/approve` are `Depends(_require_admin)` =
`require_role(ROLE_ADMINISTRATOR)` (`oversight.py:62–197`, `catalogue.py:381`).
Path/query params typed (UUID/bounded int) → FastAPI rejects malformed input.
`db_schema` is regex-guarded (`config.py:129`); `source_host` is `_normalise`-d,
not interpolated.
**LOW** `rollback_source`/`safety-override` accept free-form `source_host`/
arbitrary `pill_id` — admin-trust-bounded; cross-tenant authz absent → Axis 2.

## Axis 5 — Migration safety + rollback

**CONFIRMED — migrations are safe and reversible.** 0009→0013 form a linear
chain, each an additive new-table create with a real `downgrade()` (drop trigger
then table); none touches a P1 table. Postgres transactional DDL → mid-deploy
failure rolls back atomically.
**MEDIUM — `generation_provenance.corpus_chunk_id` is `ON DELETE CASCADE`**
(`0010:38`). Benign today (chunks never deleted), but the natural remediation for
the Pass-1 poisoning finding (purge a discredited source's chunks) would
cascade-delete the provenance of already-published pills, erasing their
claim→source audit trail.
**LOW** code and schema must roll back together; no in-code migration-version
guard.

## Axis 6 — Confidence + demotion feedback loops

**CONFIRMED — no pathological loops; the design is self-limiting.** (a) Rollback
does not trigger regeneration — `subjects_with_any_pill` and `_suppressed_topics`
both count retired pills (`gap_detection.py:69-70,181`). (b) "Demote all T1 →
can't clear 0.70" is not a deadlock — nothing is held, so it just means "always
publish-with-warning." (c) Flagged content doesn't re-trigger generation.
**MEDIUM — demotion does not recompute existing confidence.**
`PublishRecord.confidence` is frozen at publish (`publish.py:206`); demote-without-
rollback leaves stale (possibly high) confidence + stale source-authority
breakdown for live content.
**LOW** `corroboration_count` computed only over a single acquisition run's new
chunks (`corpus_builder.py:267`) — under-counts cross-run corroboration
(conservative).

## Axis 7 — Cost economics at production scale

**HIGH — No hard budget enforcement and no generation-volume cap anywhere.**
`config.py` has no monthly budget, no max-generations-per-sweep, no `target_count`
ceiling; AC-D18 is visibility+alerts only. Per published draft: 1 shared
generation call + 3 cross-model self-review calls (`self_review.py:115`) +
per-pill bootstrap. `gap_detection_sweep` opens one batch per distinct
`dedup_key ≥ 3` with no per-sweep ceiling; `catalogue_health_check` one per
uncovered subject + per thin pill. A flooded `GapSignal` table or a large seeded
catalogue → unbounded batches in one daily sweep, with only an after-the-fact
budget alert, never a stop. (Currently masked by the Pass-1 CRITICAL — no drain,
zero publish spend — goes live the moment the drain is wired.)
**MEDIUM — missing AI keys only WARN, never error, even outside dev envs**
(`config.py:202-212`) → a prod deploy with unset keys silently serves the stub
provider and auto-publishes stub content live.

## Axis 8 — Full anchor coverage (all 57)

**CONFIRMED — dedicated full sweep of AC-D1–31 + AC-CD1–26 returned MATCHES; no
new drift.** Re-confirmed the high-risk anchors: AC-D12 (`pill_generation` ∈
`_ANTHROPIC_DEFAULT_OPS`), AC-CD18 (env-default model IDs, `config.py:60-71`),
AC-CD7 (nine crons), AC-D29/30/31 surfaces.
**LOW (standing caveat)** — the sweep scored AC-D28 a clean MATCH despite the
Pass-1 acquisition-only-demotion HIGH: a per-anchor MATCH confirms the surface
exists, not that it's wired everywhere the anchor implies. An all-MATCHES result
from one same-class reviewer reads as "no drift found," not "no drift exists" —
the OV-6 concern.

## Axis 9 — Counter-claim / contradiction handling

**HIGH — There is no contradiction detection or resolution; conflicting
authoritative sources are both grounded silently.** `corroboration_count`
(`corpus_builder.py:290-322`) measures agreement — distinct sources within cosine
≥0.90. Two T1 sources that contradict embed far apart (<0.90) → not corroborated
and never flagged; both chunks are independently retrieved by top-k (`:437`) and
both injected into the generation prompt (`generation.py:113`). The self-review
grounding pass checks whether each claim is supported by *some* source
(`unsupported_claims`), not whether sources mutually conflict — so a claim backed
by source A while source B contradicts it passes grounding. For SANS/NRCS content
with superseded standard versions or differing numeric limits, this is a real
correctness/safety gap with no surfacing.

## Axis 10 — Content-domain assumptions

**HIGH — The pilot's highest-authority sources are exactly the ones this pipeline
silently mishandles.** SABS/SANS (`sabs.co.za`), NRCS, many `*.gov.za` standards
are paywalled or scanned-image PDFs. (a) A paywalled source returns a 200-OK
login/preview HTML page → `_extract_html` chunks it → embedded → stamped
authority_tier T1 / score 1.0 (`corpus_builder.py:271-283`); no
content-quality/validity gate → high-confidence grounding on a login page. (b) A
scanned-image PDF yields empty text from `pypdf` → fail-soft empty (`:191-194`) →
no corpus → general-knowledge fallback → ungrounded content for the most
authoritative topics, silently.
**MEDIUM — the seed allowlist is ZA-construction-specific and additive-only**
(`source_authority.py:83-95`): env-extensible but the seed can't be removed
(iso.org/osha.gov stay T1 for any domain); no per-tenant parameterization.
**LOW** `text-embedding-3-small` + HTML extraction are English-centric (no
language detection); content-type dispatch trusts the `content-type`/`.pdf`
suffix (`:197-202`).

## Pass 2 severity roll-up

| # | Finding | Sev |
|---|---|---|
| 1 | No row-locking/constraints on task queue + signal dedup → concurrent double-spend & duplicate batches | HIGH |
| 2 | No hard budget/volume cap on autonomous generation; unbounded fan-out, alert-only | HIGH |
| 3 | No contradiction detection — conflicting T1 sources both grounded, passes self-review silently | HIGH |
| 4 | Paywalled/scanned T1 sources → login-page-as-corpus (stamped T1) or silent empty grounding | HIGH |
| 5 | `/approve` check-then-act without lock → double-publish on concurrent submit | MEDIUM |
| 6 | `SEED_TENANT_ID` hard-coded across ~8 modules; cross-tenant leak + no tenant authz on 2nd tenant | MEDIUM |
| 7 | No metrics/alerts for autonomous publish health; diagnosis is pull-only | MEDIUM |
| 8 | `provenance→corpus_chunk` ON DELETE CASCADE — corpus purge erases published-pill provenance | MEDIUM |
| 9 | Demotion doesn't recompute frozen `PublishRecord.confidence` → stale dashboard | MEDIUM |
| 10 | Missing AI keys WARN-only outside dev → prod stub auto-publishes live | MEDIUM |
| 11 | ZA-construction seed allowlist, additive-only, no per-tenant scoping | MEDIUM |
| 12–14 | Free-form rollback inputs; code/schema rollback ordering; English-centric embeddings/content-type trust | LOW |
| — | Authz admin-gated at every endpoint; migrations reversible/additive/transactional; feedback loops self-limiting; all 57 anchors MATCH | CONFIRMED |

## Pass 2 overall assessment: NOT READY (autonomous) / READY-WITH-CONDITIONS (supervised pilot)

Tracks Pass 1. Adds four HIGH issues bearing on the pilot's actual content even
once the drain is wired: contradictory sources resolve silently (Axis 9), the
pilot's best sources are silently mis-grounded (Axis 10), spend is structurally
uncapped (Axis 7), the work-queue is not concurrency-safe (Axis 1). The
reassuring half is real: anchors clean (Axis 8), migrations safe (Axis 5), authz
solid (Axis 4), feedback loops terminate (Axis 6).

**Conditions added on top of Pass 1's:**
- (blocker, correctness) Add a content-validity gate to corpus acquisition —
  reject login/preview pages and zero-text PDF extractions rather than stamping
  them T1 (Axis 10a/b); decide a paywalled-source policy.
- (blocker, safety) Decide a contradiction posture — surface inter-source
  disagreement to the oversight/flag layer (Axis 9).
- (blocker, cost) Hard ceiling on autonomous generation (per-sweep batch cap
  and/or budget kill-switch) before enabling the drain; promote missing-AI-key to
  fail-closed outside dev (Axis 7).
- (should-fix) `FOR UPDATE SKIP LOCKED` / unique constraint on the task-claim and
  `/approve` paths (Axis 1, 5); emit publish-health metrics + one alert (Axis 3).
- (pre-second-tenant) Thread `tenant_id` from the actor and add a cross-tenant
  guard test before KBC onboards a second tenant (Axis 2).

---

# Fix-workstream scope preview (structural input)

Consolidated, priority-ordered, for the parent-plan PR of the fix workstream.

**Path-independent (apply regardless of generation strategy):**
1. Close the autonomous loop OR explicitly scope the pilot to a triggered/gated
   publish path (P1-#1, CRITICAL). With the ratified dual-path direction
   (LLM-direct primary for the KBC pilot), this becomes "wire the drain for the
   chosen primary path + decide the trigger model."
2. Hard cost ceiling + missing-key fail-closed before any autonomous publish is
   enabled (P2-#2, #10).
3. Concurrency-safety on the task-claim / `/approve` paths
   (`FOR UPDATE SKIP LOCKED` or unique constraints) (P2-#1, #5).
4. Operable oversight + rollback surface, or pilot with autonomy disabled until
   FE-10 lands (P1-#3).
5. Publish-health metrics + at least one proactive alert (P2-#7).

**Corpus-path maturation (matters for future tenants / tenant-specific content,
deferred for the LLM-direct pilot):**
6. Retrieval-side demotion — exclude `denied` hosts from
   `retrieve_corpus_for_topic` (P1-#2).
7. Content-validity gate on acquisition — reject login/preview pages + zero-text
   PDFs; paywalled-source policy (P2-#4).
8. Contradiction posture — surface inter-source disagreement (P2-#9).
9. Provenance-purge safety — reconsider the `ON DELETE CASCADE` coupling (P2-#8).

**Per-tenant mode configuration (newly ratified direction):**
10. Tenant-from-actor seam through the workstream's domain functions; cross-tenant
    guard test (P2-#6) — re-raised earlier than expected by per-tenant mode config.

**Hygiene / awareness:**
11. Refresh `SESSION_START.md` to v1.9; surface the carry-forward ledger
    (P1-#4, #11). Clamp the publish threshold (P1-#9). Re-confirm the C2
    "nothing held" gate + §290 completeness against the LLM-direct provenance
    shape (a refiner-style draft has no `draft_ref`/provenance chain → oversight
    read facets degrade to empty — expected, but verify).

---

*Filed read-only per the SESSION_START audit pattern. Triage and any follow-on
edits are the user's. OV-6 mitigation (independent cross-model overpass) is
recommended as a mandatory step for class-(iv) workstreams going forward.*
