# FE-10 — Admin oversight: autonomous-content dashboard + rollback (detail spec)

> **Status:** plan-mode authored as part of the **PR-D ratification** (autonomous-content-generation cycle, the final link); ratified through the authenticated in-session channel (extraction PR #109 §C AM-17/D-6; detail-plan PR #108 Slices 12/E1 + 13/E2). **Build deferred** — this surface spec is the PR-D deliverable; the FE build is a separate slice gated on (a) the E1/E2 backend execution (the `oversight.py` read + rollback API behind AC-CD26) and (b) FE-1..FE-9 builds landing per FE_ROADMAP order. In the interim admin exercises oversight via the admin shell + direct queries.
> **Owns:** the autonomous-content **retroactive oversight** admin surface (`/admin/oversight`) — the read dashboard (recent publishes, per-item provenance, confidence, source-authority breakdown, spot-check) + the rollback matrix actions (per pill / per question / per batch / per source) + the relocated AC-D21 safety-tag override. This is the "rein-in" half of the autonomy model (no human pre-publish gate — SPEC §4.11, §6.5).
> **PR target:** `PR-NNN-fe10-admin-oversight` (a later FE build PR; not PR-D — PR-D ships this spec doc only).
> **Anchors:** AC-CD26 (oversight dashboard — read surface + rollback matrix + source-override layer), AC-D31 (`PublishRecord` — recent-publishes + confidence + `low_confidence` flag), AC-D30 (per-pass self-review verdicts), AC-D29 (`GenerationProvenance` — claim→source→authority-tier chain), AC-D28 (source-authority tiers/scores + the `demoted_sources` override layer, DS13-a), AC-D21 (retroactive safety-tag override), AC-D14 (retire = retract-not-delete), AC-CD5 (admin-role gate), AC-CD20 (`(admin)` route group + role guard → `/403`), AC-CD21 (centralised query keys + form-error envelope), AC-CD22 (SSE — not used here; oversight is poll/read), AC-CD23 (theming + primitives).
>
> Template inheritance: per-page §B from `fe-specs/FE-1-auth.md` verbatim; FE-2's `(admin)` route group + admin shell consumed unchanged; FE-1's `applyApiErrorToForm` precedent for the rollback-reason mutation forms; FE-3 cursor-pagination + filter-bar + URL-state-sync patterns reused for the recent-publishes table; FE-8 `adminKeys` library EXTENDED with an `oversight` key root; the FE-9 `SweepButton` state-machine primitive is **not** reused (oversight has no cron triggers) but its destructive-confirm modal pattern informs the rollback confirmations. **This is a post-FE-9 spec authored out of band for the autonomous-content workstream** — it inherits the established FE conventions and propagates none downstream.

---

## 0. Context

The autonomous content-generation pipeline (SPEC §6.5) publishes AI-generated pills with **no human pre-publish gate** (AC-D31 auto-publish). Admin governance is **retroactive** (SPEC §4.11): admin *observes* what the pipeline published and *rolls back* what is wrong. This dashboard is that surface — the primary admin oversight surface for the workstream, replacing the legacy admin "generate pill from topic" form as the main admin content surface.

The backend is **AC-CD26** (`app/routers/oversight.py` → `app/domain/oversight.py`): an admin-role-gated read API + rollback API over the existing `PublishRecord` (AC-D31), `GenerationProvenance` (AC-D29), and source-authority (AC-D28) stores. This doc specs the FE that consumes it.

## 1. Route + guard

- **`/admin/oversight`** — inside the `(admin)` route group (AC-CD20): role-guarded to admin, unauthorized → `/403`. Lands the read dashboard; rollback actions are in-page (modals), no separate routes.
- One page, tabbed/sectioned (no sub-routes) — read views + a rollback action surface. URL-state-synced filters on the recent-publishes table (FE-3 pattern).

## 2. Read surface (E1 — pure read; AC-CD26 read half)

**§2.1 Recent publishes** — paginated table over `PublishRecord` (newest-first; filters: `low_confidence` toggle, date range, subject). Columns: pill name + link, subject, confidence score, `low_confidence` badge, generation batch, published-at. Cursor pagination + filter-bar + URL-state sync per the FE-3 patterns. Row → expands to §2.2/§2.3.

**§2.2 Per-item provenance** — for a selected publish: the **claim → corpus-source → authority-tier** chain (`GenerationProvenance`, AC-D29) — each generated assertion with its grounding corpus chunk, `source_host`, and authority tier (T1/T2/T3 per AC-D28). The transparency surface: *what grounded this content.*

**§2.3 Confidence + self-review verdicts** — the per-publish confidence score + the three AC-D30 per-pass verdicts (grounding / safety / provenance), incl. any NS-7 single-provider-degrade marker. Read-only.

**§2.4 Source-authority breakdown** — aggregate of publishes/claims by `authority_tier` and `source_host` (which tiers + which hosts ground the live catalogue) — the rein-in radar. Surfaces over-reliance on a single host or a low tier; each `source_host` row links to a per-source rollback (§3.4).

**§2.5 Spot-check sample** — a low-confidence-weighted random sample of recent publishes (`sample_for_spotcheck`, deterministic under a seed) for retroactive human review — a "review these N first" queue.

## 3. Rollback matrix (E2 — destructive; AC-CD26 rollback half)

All rollbacks are **retract-not-delete** (retire per AC-D14; reversible where sensible; audit-logged per §290). Each action is a confirm-modal mutation with a required `reason`, using the FE-1 `applyApiErrorToForm` envelope (AC-CD21) and the FE-9 destructive-confirm pattern.

- **§3.1 Per pill** — `rollback_pill(pill_id, reason)` from a recent-publishes row.
- **§3.2 Per question** — `rollback_question(question_id, reason)`.
- **§3.3 Per batch** — `rollback_batch(batch_id, reason)` — retracts every pill/question of a generation batch; the confirm modal shows the batch's full membership count before commit.
- **§3.4 Per source (the killer action)** — `rollback_source(source_host, reason)` from a §2.4 breakdown row — retracts every claim grounded on a discredited host **and** writes a `demoted_sources` demotion (AC-D28 / DS13-a) so the corpus builder stops re-acquiring it. The confirm modal shows the affected pill/claim count + a "also demote this source" affirmation (default on — the durable rein-in).
- **§3.5 Safety-tag override** — `override_safety_relevant(pill_id, value, reason)` — the relocated AC-D21 retroactive `safety_relevant` retoggle.

## 4. State + keys

- Extend the FE-8 `adminKeys` library (AC-CD21) with an `oversight` root: `adminKeys.oversight.publishes(filters)`, `.provenance(pillId)`, `.breakdown()`, `.spotcheck(seed)`. Rollback mutations invalidate the relevant read keys on success.
- Read views are TanStack-Query reads (no SSE — oversight is poll/read, AC-CD22 not engaged). Rollbacks are mutations with optimistic-off (await server confirm — destructive).

## 5. Out of scope (fence)

No generation triggering (the pipeline is autonomous — §6.5); no pre-publish review queue (there is none — AC-D31); no cron triggers (oversight is read/act, not scheduled — the D4 crons are backend); no `pill_proposal` refiner UI (that admin path is unchanged, G7a — outside this surface). Hard-delete is never offered (retract = retire, AC-D14).

## 6. Build-readiness

**Deferred.** Build gated on: (a) the E1/E2 backend (AC-CD26 `oversight.py` read + rollback API) executed + merged; (b) FE-1..FE-9 builds landed (FE_ROADMAP order). This spec fixes the surface so the build session has a ratified target; no FE code is written by PR-D.
