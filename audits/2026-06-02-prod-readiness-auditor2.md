# Production-Readiness Audit — Auditor 2 (independent)

**Date:** 2026-06-03 (filed under the 2026-06-02 prod-readiness cycle)
**Auditor:** Auditor 2 (parallel, independent — did not read Auditor 1's
findings before this Round-1 file was committed).
**Scope:** Production-readiness from a KBC pilot user's perspective, both
roles (admin + testee). "What would make Acumen broken or embarrassing
for a pilot user." Open methodology.
**Target audited:** the current deploy target — `origin/main` (HEAD
`5f0f184`, PR-#92 "Slice 5"), i.e. the working tree of this session.
**Method:** read the canonical doc set + FE/BE roadmaps + the 5 prior
audits (2026-05-30) + recent handovers + the pre-deploy fix plan, then
traced the live user surfaces (auth/email activation, dashboard,
attempt → grading → result, admin users/cost/engagement) end to end
against the shipped code. Every finding cites `file:line`, a concrete
reproduction, and a fix direction. Read-only — no source modified during
the audit.

> **Triage tags** are priority signals only; no code changed during the
> audit. Severity is user-impact-scaled: **Blocker** (a pilot cannot
> complete a core flow) · **High** (a careful user hits a broken/blank
> state) · **Medium** (degraded/embarrassing but usable) · **Low**
> (polish).

---

## Headline

**6 findings: 1 Blocker · 2 High · 2 Medium · 1 Low.**

The pre-deploy fix workstream (PR-073…079) correctly closed the five
fix-now items from the 2026-05-30 cycle, and the testee-FE workstream
(PR-088…092) cleaned the dashboard/nav placeholders. But the cycle's
fix-now tier never touched the **queued** silent-failure findings, and a
**new, un-audited deployment-blocker sits on the account-activation
path**: every setup/reset email link is structurally unreachable. A KBC
pilot literally cannot get a user past first login. This escaped all five
prior audits (none traced the email-link host/path shape).

A partial fix for one facet of it exists on an **unmerged, divergent**
branch (`fix/auth-email-token-links`) — see the Context note at the end —
so the deploy target is still broken.

---

## A2-F1 · Setup/reset email links are structurally unreachable — every invited user 404s on activation · **BLOCKER · FIX-NOW**

**The single most important finding.** A newly-invited KBC pilot user
cannot activate their account, and an existing user cannot reset a
password, because the link in the email goes nowhere. Two independent
defects compound on the same link:

**Facet A — wrong path shape (live in the deploy target).**
`app/permissions.py:266` / `:275` build the link as a **query
parameter**:
```python
link = f"{get_settings().app_public_url}/setup?token={raw_token}"   # :266
link = f"{get_settings().app_public_url}/reset?token={raw_token}"   # :275
```
The only frontend route is a **dynamic path segment**,
`frontend/src/app/(auth)/setup/[token]/page.tsx` (and `reset/[token]`).
There is **no** `/setup` or `/reset` page without a token (verified:
`(auth)/setup/` and `(auth)/reset/` each contain only `[token]/`), **no
middleware**, and **no `next.config` rewrites** (`output: "standalone"`,
`reactStrictMode` only). So `/setup?token=…` matches no route → Next.js
404. The page reads its token from the **path** (`params:
Promise<{ token: string }>`), never from `?token`.

**Facet B — wrong host (documented, not just inferred).** The link base is
`app_public_url`, which `docs/DEPLOYMENT.md:47-48` defines verbatim as
*"`APP_PUBLIC_URL` set to the externally-visible **API** URL,"* and which
`app/main.py:111` hands to the frontend as its `api_base_url`. The
frontend origin is a **separate** value (`CORS_ALLOWED_ORIGINS`,
`DEPLOYMENT.md:36-38`). In the documented split-deploy topology the email
link therefore points at the **FastAPI host**, which serves no `/setup`
page at all (its auth routes are `/v1/auth/setup/{token}/preview`).
There is no config knob that holds the frontend origin for link-building.

**Reproduction:** Admin invites a user (`POST /v1/users` → setup email
fires — and the Users page literally promises it:
`users-list.tsx:143` *"Setup emails fire automatically."*). User clicks
the email link → lands on the API host at `/setup?token=…` → 404.
Account is never activated; the user is stuck at the door. Same for
"forgot password."

**Why it escaped A1–A5:** the five audits covered email *send* presence
(A3 L3-F1: assignment emails) and token *TTL copy* (A3 L1-F4) but never
traced the activation-link URL against the FE route table. The seam is
backend-string ↔ FE-route, which no test exercises.

**Fix direction:** (1) emit a path-segment link
(`…/setup/{raw_token}`) — this is what the unmerged
`fix/auth-email-token-links` does, but it fixes **only** Facet A; (2)
**also** introduce a dedicated frontend-origin setting (e.g.
`APP_FRONTEND_URL` / reuse the first `CORS_ALLOWED_ORIGINS` entry) and
build the link from **that**, not from the API `app_public_url`. Pair
with a test asserting the generated link's `{host}{path}` resolves to the
`/setup/[token]` route. Both facets must land or the link still 404s.

---

## A2-F2 · Testee result page silently blanks on a fetch error (dead error boundary) · **High · FIX-NOW**

A testee whose result fails to load sees a page with the "RESULT / Your
attempt result" header and an **empty body** — no error, no message, no
retry. This is the climax surface of the whole testee flow (you just
submitted an assessment), and it fails invisibly.

`frontend/src/app/(authed)/(testee)/attempts/[attemptId]/result/page.tsx:45-62`
runs the result `useQuery` with **no `throwOnError`**, and the global
client sets none either (`lib/query-client.ts:17-21` —
`retry:false, staleTime:30_000`, no `throwOnError`). On error the query
neither retries nor throws, so:
- `resultQuery.isPending` is false and `result` is `undefined` → the
  render ternary at `:110-114` falls through to `null` (blank body);
- the Pattern-C boundary `result/error.tsx` — whose own docstring says it
  *"Fires on initial-fetch failure of GET /v1/attempts/{id}/result"* — is
  **dead code**, because the query never throws to it.

This is audit-4 **S7-F1**, triaged QUEUE on 2026-05-30 and **never
fixed** (the pre-deploy workstream shipped only the 5 fix-now items).
Independently re-confirmed live in the deploy target. Sibling surfaces
(`history`, `profile`) rethrow into their boundaries; the result page is
the lone deviation.

**Reproduction:** force `GET /v1/attempts/{id}/result` to 500 (e.g.
transient backend blip) → result page renders header + blank, indefinitely.

**Fix direction:** add `throwOnError: true` to the result `useQuery` (the
boundary it activates already exists and is correct), or render an inline
error card on `resultQuery.isError`.

---

## A2-F3 · GradingOverlay spins "Working through your responses…" forever on a result-poll error · **High · FIX-NOW**

Right before F2's surface, the post-submit GradingOverlay polls the
result endpoint. If that poll **errors persistently**, the overlay never
escapes — the testee stares at a fake-progress spinner indefinitely with
no error and no way out.

`frontend/src/components/attempt/GradingOverlay.tsx:111-121` drives the
poll cap off `resultQuery.dataUpdatedAt`:
```js
useEffect(() => {
  if (resultQuery.dataUpdatedAt === 0) return;   // never advances on error
  setPollCount((n) => { const next = n + 1; if (next >= POLL_MAX_ATTEMPTS) setPollExhausted(true); return next; });
}, [resultQuery.dataUpdatedAt]);
```
`dataUpdatedAt` only moves on a **successful** fetch. On a persistent
error it stays `0`, so `pollCount` never increments, `pollExhausted`
never flips, and `refetchInterval` (`:101-107`) keeps returning the
interval (status ≠ `ready`, not exhausted) — an unbounded poll loop with
a perpetual spinner. The cap that exists for the slow-grading case
(`pollExhausted` → escape card at `:130`) is unreachable on the error path.

This is audit-4 **S7-F2**, QUEUE on 2026-05-30, **not fixed**. Re-confirmed
live. F2 + F3 together mean the entire post-submit experience degrades to
"blank or infinite spinner" the moment the result endpoint hiccups.

**Fix direction:** advance the cap (or break to an error affordance) on
`resultQuery.isError` / `errorUpdatedAt`, not only on `dataUpdatedAt`.

---

## A2-F4 · Learning-path dashboard assignments are unstartable and pill names degrade to hex IDs · **Medium**

Two adjacent dashboard-assignment defects a pilot will see on day one:

**(a) Path assignments are a dead row.**
`frontend/src/components/dashboard/AssignmentsCard.tsx:44-51,64-66`: when
`assignment.pill_id` is null (a **learning-path** assignment) the row
renders the generic label `"Learning path"` (no name) and `href` is
`null` → **no "Start" affordance at all**. A testee assigned a path sees
an unnamed, unclickable row and has no dashboard path to begin it. (The
card comment acknowledges `/v1/learning-paths` is admin-only so no
testee-facing path-name source exists.)

**(b) Pill names fall back to raw hex.**
`AssignmentsCard.tsx:44-49,113-119` resolves pill names from only the
**first page** of `useCataloguePills({})`. Any assigned pill not on page 1
renders as `Pill 7f3a1b2c…` (`:48`). For a pilot catalogue larger than one
page, assigned pills show as truncated UUIDs — the canonical "looks
broken" surface.

These are flagged as Tier-B/carry-forward in the PR-092 handover, but
from a *pilot-user* lens they are live, visible defects on the primary
testee landing surface, so they belong in a production-readiness ledger.

**Fix direction:** add `pill_name` + `learning_path_name` to the
`GET /v1/me/assignments` response (the handover's own Tier-B item) and
give path rows a Start target (path detail / first-pill launch).

---

## A2-F5 · Engagement escalation is recorded, audited, and counted as "sent" while no email is sent · **Medium**

An admin trusting the engagement sweep summary is misled: the system
reports escalations that never reached anyone.

`app/domain/engagement.py:472-493`: the escalation email is guarded
`if assigner is not None:` (`:473-475`), but **outside** that guard the
code unconditionally writes the `AssignmentReminder(kind=escalation)`
row, sets `assignment.escalation_sent_at = now`, increments
`summary["escalations_sent"]`, and records the `assignment.escalate`
audit (`:476-493`). So when the assigner is missing/deactivated, the
escalation is logged + audited + counted as fired while **no notification
was sent**, with nothing recording the skip. `escalation_sent_at` being
set also **suppresses all future escalations** for that assignment
(`:463` gate), so the miss is permanent and silent.

This is audit-4 **S2-M1**, QUEUE on 2026-05-30, **not fixed**. Re-confirmed
live.

**Fix direction:** only mark/count/audit the escalation as sent when the
email actually goes out; if `assigner is None`, log a warning and leave
`escalation_sent_at` unset (so a later sweep can retry once an assigner
exists), or audit a distinct `assignment.escalate_skipped`.

---

## A2-F6 · Admin-facing "Coming in v1.x" placeholders are visible in the pilot UI · **Low**

For a KBC pilot the admin is a real KBC operator, and a couple of
unfinished-looking surfaces are visible:
- **Cost dashboard daily history** renders a literal placeholder chart:
  `cost-dashboard.tsx:258-276` `DailyBarsPlaceholder` with copy *"Daily
  history coming in v1.x · backend extension required."*
- **Users → Bulk invite** is a disabled button tooltipped *"Coming in
  v1.x"* (`users-list.tsx:147-152`).
- **TopBar search** is a no-op stub (`TopBar.tsx:12-13,127` —
  `// TODO(v1.x): wire search palette`) that looks interactive.

None are broken, all are deliberate descopes, but they read as
"unfinished product" to a paying pilot. Lowest priority; listed for the
ledger, not for a fix-now.

**Fix direction:** hide rather than disable the not-yet-built affordances
for the pilot (a disabled control that says "coming later" invites the
question "why ship it"), or gate them behind a feature flag.

---

## Out-of-scope / context notes (not findings)

- **Counterpart-watcher skill is absent in this environment.** The
  standing instructions reference
  `.claude/skills/counterpart-change-detector/SKILL.md` and a
  `watch-counterpart.sh`; neither exists in the repo `.claude/`, in
  `~/.claude/skills/`, or anywhere on the filesystem. I am replicating
  the watcher manually (`git ls-remote` + GitHub PR polling) to detect
  A1's branch/PR. Flagged so the coordination mechanism's absence is on
  the record.
- **Two divergent `fix/*` branches exist but are unmerged and
  stale-based.** `fix/auth-email-token-links` and
  `fix/mobile-shell-header-collisions` branch off the **stale** local
  baseline (`#66`), not the deploy target (`#92`); their large diffs are
  an artifact of that. Relevant to F1: the auth branch's fix commit
  (`6193e78`) patches **only Facet A** (path shape) of F1 and leaves
  **Facet B** (API-vs-frontend host) intact — so even if merged as-is the
  link still 404s in a split deploy. The mobile-shell concerns do **not**
  reproduce in the deploy target: the working tree already has
  `NavDrawer.tsx` + a responsive `lg:grid-cols` shell (`(testee)/layout.tsx`),
  arriving via a different lineage than `#80/#81`.
- **Token-lifetime UI copy (audit-3 L1-F4)** was queued and I did not
  re-trace it this round; it pairs naturally with the F1 email work.

---

## Round-1 status

Round 1 filed and adjudicated by the reviewer (synthesis on
`claude/dazzling-volta-6Vpzz` @ `bd5ca2e`): all six A2 findings stand —
F1 CONFIRMED (headline blocker), F2/F3/F4/F5 VERIFIED, F6 CONFIRMED; 0
disputed, 0 rejected. F2+F3 provisionally tiered pre-deploy.

---

# Round 2 — reviewer coverage-question follow-up

The reviewer asked (not a finding): were the **live SSE attempt-stream
resume contract (AC-CD22)** and the **cost/budget-alert email path
(AC-D18)** deliberately out of scope, or simply uncovered? Answer:
**in scope, simply not reached in Round 1.** I traced both for Round 2.
One yields a new finding; the other is sound.

## A2-R2-F7 · Streaming attempt dies unrecoverably when it outlives the 15-minute access token — the documented token-refresh mitigation is a no-op · **Medium**

The per-Testee streaming runner (FE-5 / P10, the core adaptive-assessment
surface) consumes `GET /v1/attempts/{id}/stream` via a fetch-based SSE
adapter. The access token TTL is **900 s = 15 min**
(`app/config.py:49`, `jwt_access_ttl_seconds: int = 900`). The adapter's
own docstring claims this is handled:

> *"If the access token expires mid-stream the next reconnect picks up
> the fresh token via `getAccessToken()`. v1 acceptable trade per
> AC-CD22."* (`frontend/src/lib/api/sse.ts:54-57`)

That mitigation does not actually work, for two compounding reasons:

1. **`getAccessToken()` never refreshes.** It is a plain in-memory getter
   — `export const getAccessToken = (): string | null => accessTokenInMemory;`
   (`frontend/src/lib/auth/storage.ts:21`). It does **not** invoke the
   api-client 401-refresh coordinator. The in-memory token is only
   refreshed when some *other* request 401s through `client.ts`. So "the
   next reconnect picks up the fresh token" only holds if a concurrent
   call happened to refresh it; the SSE adapter itself does nothing.
2. **A 401 on (re)connect throws hard instead of refresh-and-retry.** The
   adapter's one-reconnect budget only catches `fetch` *rejections*
   (network errors, `sse.ts:309-316`) and empty-body (`:333-339`). A
   non-ok HTTP response — including a `401` from an expired token —
   hits `if (!response.ok)` at `:318` and **throws** `apiErrorFromBody(...)`
   (`:325`) straight to the consumer. There is no refresh, no second
   attempt; the stream ends in an error state.

**User impact:** an actively-answering testee stays safe — every
answer-change autosave goes through `client.ts` and refreshes the token —
so the realistic trigger is **idle think-time on one question exceeding
15 min, or any network blip / reconnect after the token has expired**.
When it triggers, the streaming generation of the remaining questions
dies; the runner surfaces an error and the testee must re-authenticate
mid-assessment. Answers already given are persisted (autosave), so it is
not data-loss, but it is a broken core-flow experience on a long
assessment — and the in-code comment asserting it is handled makes it
likely to be assumed-safe and shipped.

**Why it is new:** audit-2 verified the *main* client's 401 coordinator
("F1 … correct") but no prior audit traced the **SSE** token path; it sits
on the exact AC-CD22 surface the reviewer flagged as uncovered.

**Fix direction:** before each (re)connect, ensure a fresh token (route
the SSE open through the same refresh coordinator / `ensureFreshToken()`
the api client uses); and on a `401` response specifically, refresh once
and retry rather than throwing. Minimum viable: treat `401` like the
network-error path (refresh + one reconnect) instead of an immediate hard
throw. Update the `sse.ts:54-57` comment to match real behaviour.

## Coverage note — cost/budget-alert email path (AC-D18): traced, sound (no new finding)

`maybe_fire_budget_alert` (`app/ai/cost.py:405-538`) is robust for v1:
the recipient is the first **active administrator** for the tenant with a
loud `logger.warning` + no-send when none exists (`:498-511`); thresholds
are dedup'd against the `budget_alert.fired` audit log so each fires once
per month; and because `record_audit` runs **after** `smtp.send` inside
the per-threshold loop (`:523-537`), an SMTP failure leaves no audit row
and the next sweep retries — self-healing. The only residual is the
already-on-the-books **audit-4 S3-M** top-level `try/except` swallow
(`:442-447`) that lets the cron report a clean no-op when a dependency
fails; that is a known queued item, not a new finding. The AC-D18 email
path itself is correctly wired.

## Coverage note — SSE resume / Last-Event-ID (AC-CD22): contract honored

Separate from F7's token gap, the resume **replay** contract is correctly
implemented: the adapter sends `Last-Event-ID` (highest received SSE id)
on auto-reconnect and `?since=`/`Last-Event-ID` for consumer-initiated
resume (`sse.ts:294-300`), and de-dups arrived positions via an
`arrivedSet` keyed on `attempt_position` — so snapshot replay does not
regenerate or reorder questions. No finding on the replay path.

---

## Round-2 status

Round 2 filed: 1 new finding (A2-R2-F7, Medium) + 2 coverage notes
answering the reviewer's question (both surfaces now traced). Reviewer
adjudicated (synthesis `claude/dazzling-volta-6Vpzz` @ `d451727`):
**A2-R2-F7 VERIFIED, Medium** (tiered post-deploy, flagged as the one
post-deploy item touching the core P10 streaming flow); coverage question
RESOLVED (both negatives independently confirmed). Running cross-audit
tally at that point: 13 graded findings — 2 CONFIRMED · 11 VERIFIED · 0
DISPUTED · 0 REJECTED.

---

# Auditor 2: no further findings

Both my rounds are adjudicated with every finding standing (Round 1: F1
CONFIRMED + F2–F6 VERIFIED/CONFIRMED; Round 2: F7 VERIFIED). Across the
two-auditor sweep the production-readiness surface is broadly and
independently covered — the auth/email activation blocker, the
post-submit result + grading-overlay silent failures, dashboard
assignments, the engagement-escalation trust gap, the SSE streaming
token-refresh gap, the admin recovery/anchor-leak/privacy/nav set, and
the admin-table mobile-overflow gap. I have **no further surfaces to
raise**. This is my final marker; I defer to the reviewer to produce the
final synthesis and seal. Filed read-only — no product code was modified
by this audit.
