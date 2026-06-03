# Production-readiness audit — Auditor 1 (Round 1)

> Date: 2026-06-02 · Branch baseline: `claude/practical-cannon-QKdwy` @ `5f0f184`
> Scope: production-readiness from a real KBC-pilot user's perspective (admin +
> testee). Every nav destination + the flows reached from each; auth + email-link
> routing; empty/error states; mobile shell. Methodology: walked the route tree
> (`frontend/src/app/**`) against the backend surfaces it consumes, grounding each
> finding in code (`file:line`). The prior 2026-05-30 cycle caught correctness
> bugs; this pass asks "does it actually work end-to-end for a real user, without
> breaking the illusion that this is finished software."
>
> Findings are ordered by severity. Each carries: severity · user-perspective
> description · code reference · reproduction · proposed fix direction.

---

## Finding 1 — Setup & password-reset email links 404 for every user — **BLOCKING**

**User perspective.** This is the single most important flow for a pilot launch
and it is broken end to end. An admin invites a new KBC user; the user receives
the "Set up your Acumen account" email, clicks the link, and lands on a 404. The
same is true for "Reset your Acumen password." No invited user can ever set a
password, and no user can recover a forgotten one. Onboarding is impossible.

There are **two compounding root causes:**

1. **Wrong path shape.** The backend builds the link as a *query-string* token,
   but the frontend route is a *path-segment* dynamic route.
   - Backend: `app/permissions.py:266`
     `link = f"{get_settings().app_public_url}/setup?token={raw_token}"`
   - Backend: `app/permissions.py:275`
     `link = f"{get_settings().app_public_url}/reset?token={raw_token}"`
   - Frontend route: `frontend/src/app/(auth)/setup/[token]/page.tsx` — expects
     `/setup/<token>` and reads `params.token` (`page.tsx:39-41`). Likewise
     `frontend/src/app/(auth)/reset/[token]/page.tsx`.
   - There is **no** `/setup` or `/reset` index page (only the `[token]`
     subroute). So `/setup?token=X` matches nothing and renders the global
     `not-found.tsx`. The token in the query string is never read.

2. **Wrong host.** `app_public_url` defaults to `http://localhost:8000`
   (`app/config.py:30`, `.env.example:20`), which is the **backend API** origin
   (`docker-compose.yml:42-43` maps `8000:8000`; the Next.js frontend is a
   separate service on `3000:3000`, `docker-compose.yml:115-116`). The same
   setting is consumed as the API base in `app/main.py:111`
   (`api_base_url=settings.app_public_url`). So even with a corrected path, the
   link points at the API host, which serves no `/setup` route → 404 from
   FastAPI. There is no separate "public frontend origin" setting, and the
   minimal Traefik config (`infra/traefik/traefik.yml`) defines no rule that
   would route `/setup` to the frontend service.

**Reproduction.**
1. As admin, create a user (`POST /v1/users` → `app/routers/users.py:68` calls
   `setup_email_content`).
2. Open the generated email link. It is `http://localhost:8000/setup?token=…`.
3. Backend (`:8000`) returns 404; pointed at the frontend (`:3000`) it still
   404s because `/setup` (no token segment) matches no route.
4. Same path via `/forgot` → `POST /v1/auth/password-reset/request`
   (`app/routers/auth.py:141`) → reset email → identical 404.

**Proposed fix direction.**
- Fix the link path shape to match the routes: `…/setup/{raw_token}` and
  `…/reset/{raw_token}`.
- Introduce a dedicated public-frontend-origin setting (e.g.
  `app_public_web_url`) used only for user-facing email links, distinct from the
  API base `app_public_url`. Document that in prod it must be the real frontend
  origin (and, if reverse-proxied under one host, that `/v1/*` proxies to the API
  while `/setup`,`/reset` reach the frontend). Fail-closed in prod if unset, in
  the same spirit as the existing `APP_SECRET_KEY`/CORS prod guards.
- Add a regression test asserting the emitted link matches the frontend route
  pattern.

---

## Finding 2 — 404 / 500 / 403 recovery routes admins into an inescapable loop — **SERIOUS**

**User perspective.** Every "go home" affordance on the error/forbidden pages
sends the user to `/`. But `/` is the **testee** dashboard, role-gated to
testees. An admin who mistypes a URL, follows a stale link, or hits a render
error sees a 404/500 page, clicks "Go to dashboard →", lands on `/`, gets
role-bounced to `/403`, and the `/403` page's "Go to dashboard →" sends them to
`/` again — back to `/403`. The admin has **no working recovery link** on any of
these pages; their only escape is manually typing `/ops` or using the browser
back button.

**Code reference.**
- `frontend/src/app/not-found.tsx:23` — `<Link href="/">Go to dashboard →`
- `frontend/src/app/error.tsx:54` — `router.push("/")`
- `frontend/src/app/403/page.tsx:54` — `<Link href="/">Go to dashboard →`
- `/` is testee-gated: `frontend/src/app/(authed)/(testee)/layout.tsx:36`
  (`<Gate posture="authed" role="testee">`). The role-aware home already exists:
  `dashboardPathFor()` in `frontend/src/lib/auth/guards.tsx:40-43` returns
  `/ops` for admins.

**Reproduction.** Log in as admin → visit any non-existent path (e.g.
`/admin/does-not-exist`) → 404 → click "Go to dashboard →" → redirected to
`/403?from=/&required=testee` → click "Go to dashboard →" → back to `/403`.

**Proposed fix direction.** Make the recovery CTA role-aware. The error/404/403
pages are client components and can read `useAuth().role` (or reuse
`dashboardPathFor`) to link admins to `/ops` and testees to `/`. For `not-found`
(a server component) either convert the CTA to a small client component or point
it at a role-detecting redirect.

---

## Finding 3 — Internal decision-anchor IDs leak into the production UI — **SERIOUS**

**User perspective.** Multiple user-facing surfaces render raw internal
decision-anchor identifiers (`AC-D6`, `AC-D19`, `AC-D21`, `AC-D25`) as visible
label text. To a KBC pilot user these are meaningless codes that read like
unfinished scaffolding and immediately break the "this is polished software"
illusion. They appear in core, high-traffic testee flows (taking a test, viewing
a result, opening a safety pill) and in the admin review queue.

**Code reference (all visible rendered text, not comments/aria):**
- `frontend/src/components/attempt/JITQueue.tsx:78` — `Queue · AC-D25`
  (right-rail header **while a testee is taking a per-Testee streamed test**).
- `frontend/src/components/result/loop-step-row.tsx:74` —
  `Stepped difficulty down · AC-D6 third-iteration rule` (testee result page).
- `frontend/src/components/pill-detail/SafetyPosterCard.tsx:22` —
  `Safety pill · AC-D21` (testee pill detail).
- `frontend/src/components/pill-detail/SafetyEmpty.tsx:16` —
  `Curated industry sources · AC-D21` (testee pill detail).
- `frontend/src/components/pill-detail/SafetyLinks.tsx:28` —
  `Curated industry sources · AC-D21` (testee pill detail).
- `frontend/src/app/(authed)/(admin)/review/_components/grade-review-queue.tsx:105`
  — `Cross-family review · AC-D19 · batched per attempt · 60s ceiling` (admin).

**Reproduction.** Start a per-Testee test → the JIT queue header reads
`Queue · AC-D25`. Open any pill detail → `Safety pill · AC-D21`. Finish an
adaptive loop with a step-down → result page shows
`Stepped difficulty down · AC-D6 third-iteration rule`.

**Proposed fix direction.** Strip the `· AC-Dxx` suffixes from all user-facing
strings; keep the human-readable portion ("Queue", "Curated industry sources",
"Cross-family review"). If an internal trace marker is wanted, move it to a
`data-*` attribute or a comment, not rendered copy.

---

## Finding 4 — Mandatory privacy gate shows non-legal-reviewed placeholder copy — **SERIOUS**

**User perspective.** Every user must acknowledge the privacy notice before they
can use the app (the privacy `Gate` blocks all authed routes until
`privacy_ack_at` is set). The notice text is explicitly tagged as
**placeholder, not-legal-reviewed** copy pulled from a design mock. For a KBC
pilot with real people clicking "I acknowledge," presenting un-reviewed legal
copy as a binding consent is a launch-blocking compliance risk that the code
itself flags must clear legal sign-off "before any external user sees it."

**Code reference.** `frontend/src/app/privacy/page.tsx:42-51` —
`// TODO(AC-D16): placeholder copy, needs legal review before production.` …
`// Block external launch on legal sign-off`. The four-paragraph
`PRIVACY_NOTICE_PARAGRAPHS` array is the body shown at `NoticeView`
(`privacy/page.tsx:103-107`).

**Reproduction.** Set up any new account → after first login you are routed to
`/privacy` → the displayed notice is the placeholder text.

**Proposed fix direction.** Not a code fix — this is a launch gate. Surface to the
operator that KBC legal must supply/approve the production notice before the
pilot. (Mechanically: the gate plumbing is independent of the copy, so a copy
swap is low-risk once approved.) Flagging here so it is not lost behind a
buried `TODO`.

---

## Finding 5 — Admin-facing "Coming in v1.x" placeholder copy persists — **WORTH-KNOWING**

**User perspective.** The 2026-06-02 testee-FE workstream (PR-088…092) swept
placeholder/"v1.x-pending" copy off the **testee** surface but explicitly left
the **admin** surface untouched (see PR-092 handover "Open questions"). An admin
poking around still meets several "coming in v1.x" dead affordances, one of which
leaks an internal backend field name into the UI.

**Code reference.**
- `frontend/src/app/(authed)/(admin)/admin/paths/[pathId]/edit/_components/path-editor.tsx:394`
  — visible body text `Assignment summary coming in v1.x.` in the "Assigned to"
  panel of the path editor.
- `frontend/src/app/(authed)/(admin)/cost/_components/cost-dashboard.tsx:276` —
  `Daily history coming in v1.x · backend extension required (daily_history field
  on cost/summary).` — exposes the internal field/endpoint name to the admin.
- `frontend/src/app/(authed)/(admin)/cost/_components/cost-dashboard.tsx:88` —
  disabled toggle with `title="Coming in v1.x"`.
- `frontend/src/app/(authed)/(admin)/admin/users/_components/users-list.tsx:150`
  — disabled "Bulk invite" button, `title="Coming in v1.x"`.

**Proposed fix direction.** Mirror the testee sweep on the admin surface: either
remove the dead controls entirely (preferred for a pilot — a disabled button the
user can never enable is just noise) or reframe to neutral copy that doesn't
expose internal field names or version-roadmap language.

---

## Finding 6 — Admin group detail shows 3 of 4 stats as bare "—" — **WORTH-KNOWING**

**User perspective.** Opening any group's detail page shows a four-card stat grid
where only "Members" has a real value; "Assignments", "Avg engagement", and "Avg
competence" are permanently rendered as a bare em-dash "—" with **no visual
indication that they are deferred**. To an admin this reads as broken/missing
data, not "feature coming later" — there's no tooltip, label, or muted styling to
distinguish "not built yet" from "failed to load."

**Code reference.**
`frontend/src/app/(authed)/(admin)/admin/groups/[groupId]/_components/group-detail.tsx:158-161`
(three `<StatCard … value="—" deferred />`). The `deferred` flag only sets a
`data-testid` (`group-detail.tsx:304`); it produces no user-visible affordance —
the rendered output is identical to a real "—" value.

**Reproduction.** Admin → Groups → open any group → the stat grid is 75% dashes.

**Proposed fix direction.** Give `deferred` a visible treatment (muted style +
"—" with a "Coming soon"/"Not yet tracked" caption or tooltip), or drop the three
unbuilt cards until the backend supplies the figures, so the grid never looks
like a data-load failure.

---

## Finding 7 — Disabled "Contact support" on the 500 page contradicts its own copy — **WORTH-KNOWING**

**User perspective.** The root error boundary tells the user "contact support if
it persists," then renders a **permanently disabled** "Contact support" button.
There is no support channel wired anywhere, so the instruction is a dead end.

**Code reference.** `frontend/src/app/error.tsx:50` (body copy "…contact support
if it persists.") vs `error.tsx:57-59` (`{/* TODO(v1.x): wire real support
channel */}` `<Button variant="ghost" disabled>Contact support</Button>`).

**Proposed fix direction.** Either wire a real channel (mailto to an admin/support
address, sourced from config) or remove both the disabled button and the
"contact support" sentence so the page doesn't promise an action it can't deliver.

---

## Finding 8 — Rail active-nav highlight is lost on every deep route — **WORTH-KNOWING**

**User perspective.** The sidebar highlights the active nav item by **exact** path
equality (`activeRoute === item.href`). So on any nested destination — the test
editor (`/admin/tests/<id>/edit`), the path editor, a group detail
(`/admin/groups/<id>`), a tabbed catalogue (`/admin/catalogue?tab=proposals`),
or a testee viewing a result (`/attempts/<id>/result`) — **no** nav item is
highlighted, and the user loses the "where am I" cue exactly where the app is
deepest. This is acknowledged in the component's own comment as a spec edge case,
but it's a real navigation-orientation gap for a pilot.

**Code reference.** `frontend/src/components/shell/Rail.tsx:127`
(`const active = activeRoute === item.href`). Note `/admin/catalogue?tab=…` also
won't match because `usePathname()` excludes the query string — though that case
happens to still equal `/admin/catalogue`; the `[id]/edit` and `[id]` detail
routes are the ones that go dark.

**Proposed fix direction.** Use prefix matching for non-root items (e.g. active
when `pathname === href || pathname.startsWith(href + "/")`), keeping the root
`/` item on exact match so it doesn't stay lit everywhere.

---

## Out-of-scope finding (surfaced while grounding, not folded into the above)

- **OOS-1 — Auth/privacy pages bypass the theme system.** The `(auth)` group and
  `/privacy` use hardcoded Tailwind gray utilities (`text-gray-600`, `bg-gray-50`,
  `border-gray-300`, …) rather than the Acumen theme tokens (`bg-bg`, `text-ink`,
  `border-line`). The shell `ThemeToggle` writes a `carbon` (dark) preference to
  `localStorage`, applied via `data-theme` on `<html>` at the next boot. A
  returning user who selected dark mode, then logs out, will see light-gray auth
  cards on a token-driven background — a contrast/consistency mismatch. New
  invited users (no stored theme → `paper` default) are unaffected, so the
  user-facing blast radius is small and this leans cosmetic — recording it as
  out-of-scope rather than a graded finding. References: `app/privacy/page.tsx`
  (5 `gray-*` sites), `app/(auth)/setup/[token]/page.tsx` (4),
  `components/auth/TokenErrorCard.tsx` (3), et al.

---

## Operational note (not a product finding)

- The session brief cites a `counterpart-change-detector` skill at
  `.claude/skills/counterpart-change-detector/SKILL.md`. That path does not exist
  in this checkout — `.claude/` contains only `agents/` and `commands/`. The
  watcher loop described in the brief therefore could not be armed as specified.
  On-wake pairing is being performed manually instead (fresh `git ls-remote` +
  PR comment read + verify-against-code) on each turn. Flagging so the reviewer
  knows the automated watcher is not running.

---

*Auditor 1 — Round 1 complete. Awaiting reviewer adjudication before Round 2.*

---

# Round 2 — mobile responsiveness pass + reviewer coverage-question concurrence

> Round 1 adjudicated by the reviewer (synthesis on `claude/dazzling-volta-6Vpzz`):
> all 8 A1 findings stand (#1 & #5 CONFIRMED via convergence with A2; V1/V2/V3/
> V8/V9/V10 VERIFIED; 0 disputed, 0 rejected). For Round 2 I deliberately avoided
> re-treading A2's dynamic-flow ground (result page / grading overlay / dashboard
> assignments / engagement / SSE) and instead drove the one explicit in-scope
> surface **neither** Round-1 file traced concretely: **mobile responsiveness
> (PR #82)**. One new finding; plus a short concurrence on the reviewer's
> coverage question.

## Finding 9 (A1-R2) — Admin data tables overflow on mobile; the responsive table wrapper was applied to testee surfaces only — **WORTH-KNOWING**

**User perspective.** PR #82 made the *shell* responsive (hamburger nav drawer,
collapsing breadcrumbs, search hidden under `md:`) and that part works — I traced
it through `TopBar.tsx:73-86` (`lg:hidden` hamburger), `NavDrawer.tsx`, and both
authed layouts. The **content** inside the shell did not get the same treatment.
Every admin data table is a bare `<table className="… w-full …">` with **no
horizontal-scroll wrapper**, while the two *testee* tables both wrap in
`overflow-x-auto`. On a phone, a multi-column admin table (e.g. Users:
name · email · role · status · actions) cannot shrink below its columns' intrinsic
content width — long unbreakable tokens like email addresses force the table wider
than the viewport. With no `overflow-x-auto` boundary, the overflow propagates to
the page, producing horizontal scroll / a broken sticky-header alignment rather
than a contained, swipeable table. So a KBC admin who opens the console on a phone
gets a half-responsive experience: the nav adapts, the actual data doesn't.

**Code reference.**
- Admin tables with **no** overflow wrapper (all `<table className="mt-5 w-full …">`):
  `admin/users/_components/users-list.tsx:276`,
  `admin/tests/_components/tests-table.tsx:247`,
  `admin/assignments/_components/assignments-list.tsx:242`,
  `engagement/_components/pending-list.tsx:139`, plus `admin/paths/_components/
  paths-list.tsx`, `loop/_components/loop-queue.tsx`,
  `calibration/_components/calibration-view.tsx`, `cost/_components/cost-dashboard.tsx`,
  and the four catalogue tabs (`pills-tab`/`subjects-tab`/`proposals-tab`/`safety-tab`)
  + `admin/groups/**`.
- The pattern that **was** applied — on testee surfaces only:
  `components/profile/history-table.tsx:54` (`<div className="overflow-x-auto">`)
  and `components/profile/matrix-table.tsx:78` (`overflow-x-auto`).
- No page-level guard catches the overflow: the admin/testee shells render content
  in `<main className="… w-full mx-auto">` inside a `min-w-0` grid column
  (`(admin)/layout.tsx:44-48`) — `min-w-0` lets the column shrink, but the table's
  intrinsic min-width still overflows it.

**Reproduction.** Load `/admin/users` (seeded with a few users) at a ~360px
viewport (or DevTools device mode). The table runs off-screen and the page scrolls
horizontally. Compare `/history` (testee) at the same width — it scrolls *within*
the card, page intact.

**Confidence note.** Grounded structurally (the missing wrapper + the testee/admin
asymmetry are certain from the code); the exact pixel at which each table overflows
depends on column content and device width, which I could not render headlessly in
this environment. Filed at worth-knowing on the audit's bias-toward-surfacing rule
since mobile is explicitly in scope.

**Proposed fix direction.** Wrap each admin table in the same `overflow-x-auto`
boundary the testee tables already use (ideally hoist it into the shared table
primitive so the responsive behavior is uniform and can't drift per-surface again),
or adopt a card/stacked layout for these tables under `md:`. This is the admin-side
mirror of Finding 5's "the testee sweep didn't reach admin" theme.

## Concurrence — reviewer coverage question (SSE/AC-CD22, cost/AC-D18)

For the record (fair triangulation, not a duplicate finding): both surfaces the
reviewer flagged were **in scope and simply not reached in my Round 1** — neither
was a deliberate exclusion. A2 traced both in their Round 2; having reviewed that
trace against the code, I concur: **A2-R2-F7** (SSE stream dies on mid-stream token
expiry because `getAccessToken()` never refreshes and a 401 on reconnect throws
hard at `sse.ts:318-325`) is real and correctly characterized, and the AC-D18
budget-alert path and the AC-CD22 `Last-Event-ID` replay contract are sound. I have
nothing to add to A2's treatment of those two surfaces.

---

## Round-2 status

Round 2 filed: **1 new finding** (A1-R2-F9, worth-knowing — admin-table mobile
overflow) + concurrence on the reviewer's coverage question. This is my only
Round-2 finding.

Round 2 adjudicated by the reviewer (synthesis `claude/dazzling-volta-6Vpzz` @
`8d38074`): **A1-R2-F9 VERIFIED** (worth-knowing; tiered into the post-deploy
UI-hygiene pass as the admin-side mirror of the placeholder finding). Both my
rounds are adjudicated with every finding standing.

---

# Auditor 1: no further findings

All A1 findings are filed and adjudicated, none disputed or rejected:

- **Round 1 (8):** #1 email-link blocker (CONFIRMED, blocker) · #2 admin 404/500/403
  recovery loop (VERIFIED) · #3 anchor-ID UI leak (VERIFIED) · #4 privacy
  placeholder copy (VERIFIED, legal/operator launch gate) · #5 admin "Coming in
  v1.x" placeholders (CONFIRMED) · #6 group-detail bare-dash stats (VERIFIED) ·
  #7 disabled contact-support contradiction (VERIFIED) · #8 rail exact-equality
  active-nav (VERIFIED).
- **Round 2 (1):** A1-R2-F9 admin-table mobile overflow (VERIFIED) + concurrence on
  A2-R2-F7 / the AC-D18 + AC-CD22 coverage negatives.

I have **no further surfaces to raise.** Deferring to the reviewer for the final
synthesis (fix workstream + firm pre/post-deploy tiering) and the seal. Staying
subscribed for any follow-up question, but otherwise done.

*Auditor 1 — audit complete.*
