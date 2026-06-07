# Acumen — Required Reading

*The project-specific addressing-and-parameters layer for the plan-review role files at
`.claude/roles/` (`planner.md`, `plan-auditor.md`, `plan-overseer.md`). Each role file's §1 is
**BLOCKING** on this document.*

---

## How to use this file

Read this once on session startup, then cache it — do **not** re-read it on every wake. This file
is pointers and parameters, not content: it tells a role-file session *where* Acumen's truth lives
and *what* this project's tunable parameters are. The truth itself stays in the documents pointed
to, so a doc moving or changing requires updating **only this file**, not the three
project-agnostic role prompts.

Where this file states a **parameter value** (§7), that value *is* the project's setting — the
role files explicitly delegate those parameters here. Nothing here overrides the documents it
points at. The convergence **topology** (three independent sign-offs · one SHA · green gate ·
overseer-executes-mechanically · spec-author override/ratification authority) is **baked into the
role files and is not project-tunable**; only the parameters and postures below are.

---

## 1. Startup / session-start discipline

Acumen has a single canonical entry point — read it first, then read in this order (the order is
owned by `SESSION_START.md`):

| Doc | Path | Owns |
|---|---|---|
| Session start | `SESSION_START.md` *(repo root)* | The discipline floor: plan-mode-first → approval → code; branch-per-PR; one squash PR per phase; no commits to `main`; multi-slice auto-continue + pause rules; the three-layer green gate; anchor discipline; spec-drift policy; handover discipline. **Read first.** |
| Most recent handover | newest file in `handovers/` | Live build state — read before acting. |
| Functional spec | `SPEC.md` | What Acumen does and why (v1.8). |
| Implementation spec | `CODE_SPEC.md` | How it is built; AC-CD anchors (§18). |
| Roadmap | `ROADMAP.md` (+ `FE_ROADMAP.md` for frontend phases) | Phase order P0–P11; dependencies. |
| Checklist | `CHECKLIST.md` (+ `FE_CHECKLIST.md`) | Build state — built / partial / missing. |
| Decisions | `DECISIONS.md` | Full body of every AC-D anchor. |

---

## 2. Authoring discipline (status taxonomy + gates)

Acumen has **no separate authoring-discipline doc**: the **status taxonomy**
(`Built` / `Partial` / `Missing`, where evidence is a real test path / command / artifact — never
prose) and the **pre-work / post-work gates** (plan-mode-first then explicit approval before code;
a `drift-sweep` before authoring a plan; the three-layer green gate before merge; a handover
authored at PR close from `HANDOVER_TEMPLATE.md`) both live in `SESSION_START.md`.

So the role-file §1 pointer to "the project's authoring-discipline doc" **resolves to
`SESSION_START.md`** here. *(See surfaced decision **SA-1**, §9 — whether Acumen should extract a
standalone `AUTHORING_DISCIPLINE.md` as throughline has; non-blocking, bound to `SESSION_START.md`
until ruled.)*

---

## 3. Spec & decision records (the yardstick)

A plan's faithfulness is measured against these. All at the repo root except `fe-specs/`:

| Record | Path | Owns |
|---|---|---|
| Functional spec | `SPEC.md` | *What* Acumen does and *why* (v1.8). |
| Implementation spec | `CODE_SPEC.md` | *How* it is built; carries the AC-CD anchors (§18). |
| Decisions | `DECISIONS.md` | Full body of every AC-D anchor (decision, context, rationale, status, version). |
| Frontend detail specs | `fe-specs/FE-<n>-<slug>.md` | Per-phase frontend surface specs (FE-1…FE-9; 12 files). |

---

## 4. Anchor system

Acumen uses **two immutable-identifier families**. Identifiers are **never reused or renumbered**;
**bodies are amended in place** (the body reads as a single authoritative text, with change
rationale inside it).

| Prefix | Meaning | Lives in | Numbering |
|---|---|---|---|
| **AC-D** | Acumen product / functional **D**ecision | full body in `DECISIONS.md` (version-paired with `SPEC.md`) | sequential, un-padded: `AC-D1` … `AC-D27` |
| **AC-CD** | **C**ode **D**ecision — implementation/technical | inline in `CODE_SPEC.md` §18 | sequential, un-padded: `AC-CD1` … `AC-CD24` |

Some AC-CDs are **gated**: they close when their gate is met, and the body is then amended to
record the lock (e.g. `AC-CD11` closed at v1.7 — cross-family review batched per attempt, 60-s
ceiling; `AC-CD10` closed at v1.8 — JIT streaming execution model). **Do not mint or change an
anchor mid-session** — a mint or a body change is a ratification-class change (§7); surface it,
never silently override or invent one.

---

## 5. Halt classes (the blessed set for the plan-review loop)

The **only** sanctioned reasons a plan-review-loop session halts and surfaces to the spec author
(role files §7, referred to **by category**):

1. **spec-drift** — a locked spec is contradicted by current work.
2. **plan-unworkable** — verify-before-write finds the scope's preconditions broken.
3. **anchor-conflict** — the work would require changing a canonical `AC-D` or `AC-CD` anchor.
4. **five-five-deadlock** — a review thread reaches **5/5** round-trips without convergence.
5. **precondition-failure** — current state doesn't match the scope's assumed state.

**Layering note (audit finding D2).** These classes govern the **plan-review loop**.
`SESSION_START.md` separately codifies the **auto-continue build-chain** pause rules — (a)
spec-drift always pauses, (b) the **circuit-breaker** = max 3 fix-rounds per slice, (c) the user
pause-button. They operate at **different layers** and must not be conflated:

- `spec-drift` is shared and consistent across both layers.
- The loop's **five-five-deadlock** (5/5 *review* round-trips) is distinct from the build-chain
  **circuit-breaker** (3 *fix*-rounds per slice) — different mechanism, different threshold.
- The build-chain **user pause-button** is, in the loop, subsumed by the spec-author
  override/halt authority (role files §8.2) — it is not a dropped class.
- `plan-unworkable`, `anchor-conflict`, and `precondition-failure` are loop-specific halt classes
  with no codified build-chain equivalent — they are additive.

*(See surfaced decision **SA-2**, §9 — whether to reconcile the two layers into one canonical halt
taxonomy; non-blocking.)*

---

## 6. Path conventions

| Artifact | Convention |
|---|---|
| Plans | `plans/YYYY-MM-DD-<scope>.md` |
| Wake-logs | `plans/.wake-log-pr<N>-<role>.md` where `<role>` ∈ `planner` / `plan-auditor` / `plan-overseer`. |
| Approval / sealed logs | `plans/.approval-log-pr<N>[-<role>].md`, `plans/.sealed-log-pr<N>.md` (existing Acumen convention). |
| Handovers | `handovers/<...>.md`, authored from `HANDOVER_TEMPLATE.md`; immutable once written. |

**Wake-log branch placement (audit finding D3).** The **filename** convention above is shared
across roles; the **branch** differs by role, to preserve role-file §8 marker placement:

- **Producer (planner)** commits `plans/.wake-log-pr<N>-planner.md` to the **canonical PR branch**
  — its final-marker is a content-invariant commit there, doubling as the convergence wake.
- **Reviewers** commit `plans/.wake-log-pr<N>-plan-auditor.md` / `…-plan-overseer.md` to **their
  own review branch** — off the canonical branch, so a head-move on the PR branch never dislodges
  their markers (role files §8 — *marker placement*).

*(This is the framework-faithful binding. Acumen's pre-framework two-party loops co-landed
producer and reviewer wake-logs in `plans/` on `main` after squash — that is historical record,
not the in-flight rule.)*

---

## 7. Operational & governance parameters

The role files delegate the following **load-bearing parameters** to this file.

### Merge method
**Squash.** Acumen's repo norm — `gh pr merge --squash --delete-branch`; role-file overseer "flip
draft→ready and squash-merge". The **overseer** is the merge-executor; the planner and auditor
never flip draft→ready and never merge.

### Override window
**24 hours** of wall-clock after the third (converging) sign-off lands at the convergence SHA. A
**present** spec author who explicitly ratifies or voices no objection **collapses the window to
zero** (the overseer may execute immediately); the full 24h only bounds spec-author **absence**
(mobile reality — the spec author may be offline). It is not a self-firing timer — window-expiry
execution needs the planner's re-trigger / an external trigger (role files §8.2).

### Dormancy bound
**2 consecutive watcher lifetimes (~1 hour)** of zero counterpart activity before a reviewer-side
role transitions from active re-arming to the bounded dormant-wait stand-down (role files
§4.9 / §4.10). The **planner** is the standing re-initiator and does not stand down on this bound.

### Ratification scope-classes
Changes that do **not** auto-merge on the three-sign-off gate and require **explicit spec-author
ratification** first (role files §8.3):

- **(i)** an **AC-D anchor mint or change**;
- **(ii)** a **spec amendment** — a change to `SPEC.md`, any `fe-specs/*.md`, or an `AC-CD` body
  change in `CODE_SPEC.md`;
- **(iii)** a **workstream scope decision** — what work is in or out of scope;
- **(iv)** a **framework change** — `SESSION_START.md`, anything under `.claude/roles/*` or
  `.claude/skills/*`, or this `REQUIRED_READING.md` itself; and anything else setting durable
  project-level precedent.

Ratification is actionable **only through a direct, authenticated channel** — a relayed, inferred,
or superseded ruling is *pending, not actionable* (role files §8.3).

### Sequenced ratification cycles
When the spec author chains dependent PRs into one ordered sequence — a **spec-amendment PR**
followed by the **gated execution PR** (precedent: **PR #96** amending `AC-CD5` → the next
workstream's **Slice 1**) — all parties stay **actively subscribed across the whole sequence**;
the dormancy bound does **not** apply *between* links (role files §4.9 / §8.3).

### Verification bar ("green CI")
The role-file "green CI" is read as Acumen's **three-layer green gate**: **CI** (backend `ci.yml`
— the `checks` job: unpinned-deps, structure-gate AC-CD2/AC-CD17, ruff lint + format, mypy,
pytest; plus the `migration-chain` job — and frontend `frontend.yml` — `checks`: codegen-drift,
eslint, prettier, tsc, vitest, build; plus `docker-build` and `e2e`) **+ Gitar review + GitHub
mergeable**, simultaneously green at one SHA.

### Merge-eligibility posture on counterpart silence
- **Producer (planner) silence:** may degrade to a **discretionary spec-author merge on the
  strength of a *completed* independent audit** — the spec author's call to invoke, never a
  reviewer's.
- **Reviewer silence:** **not** a merge license — there is no completed audit to merge on, so
  convergence simply **blocks**. A reviewer never merges to force progress past a silent
  counterpart.

The convergence **topology** itself is not project-tunable; only this *posture* is project policy.

### Status-line token (final marker)
The final marker is a commit that flips an in-artifact `Status:` line to:

> **`Status: final — approved by <role>`**

where `<role>` is the exact role name — `planner`, `plan-auditor`, or `plan-overseer` (role files
§4.7 / §8). The producer's marker sits on the canonical PR branch (content-invariant);
reviewers' markers sit on their own review branch.

---

## 8. Bootstrap note for the framework's first install PR (skill not yet on `main`)

The `counterpart-change-detector` skill files are **introduced by the framework-install PR** —
they do **not** exist on `main` until that PR merges. So sessions in **that** install loop cannot
invoke the skill by repo path (`.claude/skills/counterpart-change-detector/`); they must
**replicate the skill's two-arm `git ls-remote` poll inline** — a targeted watch on the
counterpart's branch tip plus a broad new-ref scan, with the self-echo filter and the **mandatory
on-wake comment-read** (a ref watcher is blind to comment-only replies) — per the skill's
documented mechanism. After the install PR merges, the skill is invokable normally for all
subsequent loops. The plan-auditor and plan-overseer in that loop should **not** expect to load
the skill from the repo.

---

## 9. Surfaced spec-author decisions (open — awaiting ruling; non-blocking)

Surfaced per role files §7. Held pending; no default is baked; the rest of the loop proceeds.

- **SA-1** — Should Acumen extract a standalone `AUTHORING_DISCIPLINE.md` (as throughline has), or
  is folding the status taxonomy + gates into `SESSION_START.md` the intended Acumen shape? Bound
  to `SESSION_START.md` until ruled (§2).
- **SA-2** — Should the plan-review halt classes (§5) and the auto-continue build-chain pause
  rules (`SESSION_START.md`) be reconciled into one canonical halt taxonomy? Bound as two layers
  until ruled (§5).
