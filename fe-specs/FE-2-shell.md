# FE-2 — App shell + design tokens (detail spec)

> **Status:** plan-mode authored, ready for build session (gated on the two §H bucket-(a) blockers).
> **Owns:** design tokens + paper/carbon themes; shell primitives (Rail / TopBar / PageHeader); layout primitives (Stat / BandTag / BandPips / Pill / Icon); typed-stub image primitives (Figure / InlineFigure / ChoiceFigure); shadcn/ui core install (Button / Card / Input / Select / Dialog / DropdownMenu / Tabs / Toast / Skeleton); role-gated route groups `(authed)`/`(testee)`/`(admin)` + 404 / 500 / 403 / loading boundaries; TopBar theme toggle (paper ↔ carbon) with `localStorage` persistence.
> **PR target:** `PR-NNN-fe2-shell` (one squash PR closes the spec phase per FE_ROADMAP discipline).
> **Anchors:** AC-D9 (band stamp + `competence_estimate` float), AC-D20 (anchor calibration confidence), AC-CD19 (FE stack), AC-CD20 (routing/guards/error/loading), AC-CD23 (theme + tokens + primitives — amendment PR pending, see §H), AC-CD24 (image-stub deferral).
>
> This spec follows the FE-1 template established in `fe-specs/FE-1-auth.md` per §G of that file: Context → A inventory → B per-page/per-capability 8-section → C cross-page → D tests → E placeholders → F scope-bleed → G template propagation → H drift roll-up. **One declared variance:** §B is per-capability rather than per-page because FE-2 is primitive-heavy (only six of eighteen rows are page-shaped). The 8-section sub-template adapts (§B preamble). The variance is a precedent for any future primitive-heavy FE-N phases.

---

## 0. Context

FE-0 (PR-032) shipped the Next.js 15 / App Router scaffold, the typed `openapi-fetch` client with `unwrap()`, the auth context (memory access + localStorage refresh + 401 dedup-retry), an empty `components/ui/.gitkeep`, and a minimal `globals.css` placeholder. FE-1 (PR #38, this session's predecessor) locked the auth-surface spec — five unauthenticated pages, route guards, the form-error display precedent — and pre-folded `QueryClientProvider` + `<Toaster />` mounts and the `AuthContext` `refresh()`/`setUserPrivacyAck()` extension into the FE-1 build scope. The FE-1 BUILD is pending; FE-2's BUILD assumes it has completed.

FE-2 is the second per-phase detail spec, and the first that does not write content pages. Its done-when from `FE_ROADMAP.md` lines 50–63:

> Empty testee dashboard renders inside the shell; admin can land on empty ops page; theme tokens present in `globals.css`; all shadcn/ui primitives importable.

This spec exists because (a) the primitive contracts — props, variants, token bindings — need to be pinned before the build session reaches the prototype source, since FE-3..FE-9 build content pages **on top of** these primitives and a rename or contract churn mid-build would propagate; (b) the v1 token names need to lock so FE-3 catalogue work doesn't surface band-display edge cases that force a token rename (the explicit FE_ROADMAP-named risk); (c) several spec-drift candidates surfaced during the cross-walk and must be visible to the user — two of them require user-authored amendment PRs to lock before the FE-2 build session can open (§H bucket (a)).

**Not in scope for FE-2** (delegated):
- Real testee dashboard content (greeting + stats + assignments list + recommendations + recent attempts + Today's Reading widget) — FE-3.
- Real admin ops page content (loop actions, engagement sweep, calibration, system page) — FE-9.
- Catalogue page, pill detail page, learning-material viewer — FE-3.
- Attempt flow, question rendering, autosave — FE-4.
- SSE streaming consumption — FE-5.
- Results page additions — FE-6.
- Profile / competence views — FE-7.
- Admin authoring (pill / users / groups / tests / paths / assignments) — FE-8.
- Image rendering inside `<Figure>` / `<InlineFigure>` / `<ChoiceFigure>` — typed stubs only per AC-CD24; v1.x adds rendering without touching question-component contracts.
- Steel theme — dropped from all scopes (see §H decision 4, scope expansion).
- Tweaks panel — design-reference dev affordance only, explicit non-goal (§F.1).
- The prototype TopBar's `role` / `onRole` segmented control — dev affordance only, not ported (§B.3 + §H bucket (c)).
- "View as testee" / admin role-switch navigation affordance — out of scope; FE_ROADMAP done-when satisfied by routing alone (§H bucket (c)). May surface as a v1.x feature if pilot feedback warrants.

**FE-2 adds to `app/layout.tsx`** (folds into handover under the SESSION_START.md AC-CD-level structural-additions carve-out — small, well-rationalised, does not violate any pinned anchor):
- Server-set `data-theme="paper"` on `<html>` (AC-CD23 mandate, post-amendment).
- Tiny inline `<script>` in `<head>` that reads `localStorage.getItem("acumen.theme")` and applies the stored value to `<html data-theme="…">` before React hydrates — avoids FOUC on a returning user whose preference is `carbon`.

---

## A. Capability inventory

| # | Capability | File / route | Design source | Screenshot |
|---|---|---|---|---|
| 1 | Design tokens + paper/carbon themes + typography classes | `frontend/src/app/globals.css`, `frontend/tailwind.config.ts` | `prototype/styles.css` (full file) | `01-v5-noitalic.png`, `02-v5-noitalic.png` |
| 2 | Rail (sidebar nav) | `frontend/src/components/shell/Rail.tsx` | `prototype/shell.jsx` (`Rail`) | `01-v5-noitalic.png`, `02-v5-noitalic.png` |
| 3 | TopBar (crumb + search-stub + avatar + theme toggle) | `frontend/src/components/shell/TopBar.tsx` | `prototype/shell.jsx` (`TopBar`) + `prototype/avatar-menu.jsx` | `01-v5-noitalic.png`, `v6-fe1-06-avatar-menu.png` |
| 4 | PageHeader | `frontend/src/components/shell/PageHeader.tsx` | `prototype/shell.jsx` (`PageHeader`) | `01-v5-noitalic.png` |
| 5 | Stat primitive | `frontend/src/components/primitives/Stat.tsx` | `prototype/shell.jsx` (`Stat`) | `01-v5-noitalic.png` |
| 6 | BandTag primitive | `frontend/src/components/primitives/BandTag.tsx` | `prototype/shell.jsx` (`BandTag`) | locked here; rendered FE-3+ |
| 7 | BandPips primitive | `frontend/src/components/primitives/BandPips.tsx` | `prototype/shell.jsx` (`BandPips`) | locked here; rendered FE-3+ |
| 8 | Pill primitive | `frontend/src/components/primitives/Pill.tsx` | `prototype/shell.jsx` (`Pill`) | locked here; rendered FE-3+ |
| 9 | Icon primitive (single component, `name` prop) | `frontend/src/components/primitives/Icon.tsx` | `prototype/icons.jsx` (full file) | n/a (used everywhere) |
| 10 | Figure / InlineFigure / ChoiceFigure (typed stubs, render `null`) | `frontend/src/components/primitives/figure.tsx` | `prototype/figure.jsx` | n/a (AC-CD24 deferral) |
| 11 | shadcn/ui core install | `frontend/src/components/ui/{button,card,input,select,dialog,dropdown-menu,tabs,toast,skeleton}.tsx` | shadcn-ui registry | n/a |
| 12 | `(authed)` route group + layout guard | `frontend/src/app/(authed)/layout.tsx` | AC-CD20; `prototype/app.jsx` (composition only) | n/a |
| 13 | `(testee)` route group + layout guard + empty dashboard | `frontend/src/app/(testee)/layout.tsx`, `frontend/src/app/(testee)/page.tsx` | `prototype/testee.jsx` (composition only) | `01-v5-noitalic.png` |
| 14 | `(admin)` route group + layout guard + empty ops page | `frontend/src/app/(admin)/layout.tsx`, `frontend/src/app/(admin)/ops/page.tsx` | `prototype/admin.jsx` (composition only) | `02-v5-noitalic.png` |
| 15 | 404 (repo-level) | `frontend/src/app/not-found.tsx` | `prototype/boundaries.jsx` (`NotFound`) | `v6-fe2-08-boundaries.png` |
| 16 | 500 boundaries (per route group) | `frontend/src/app/error.tsx`, `(authed)/error.tsx`, `(testee)/error.tsx`, `(admin)/error.tsx` | `prototype/boundaries.jsx` (`ServerError`) | `v6-fe2-08-boundaries.png` |
| 17 | 403 (refines FE-1 placeholder) | `frontend/src/app/403/page.tsx` | `prototype/boundaries.jsx` (`Forbidden`) | `v6-fe2-08-boundaries.png` |
| 18 | Loading skeletons (per route group) | `(authed)/loading.tsx`, `(testee)/loading.tsx`, `(admin)/loading.tsx` | `prototype/boundaries.jsx` (`RouteSkeleton`) | `v6-fe2-08-boundaries.png` |

Capabilities 6, 7, 8 are not directly screenshotted at FE-2 (rendered first by FE-3 dashboard / catalogue / profile). Their contracts lock here so FE-3+ can rely on them.

---

## B. Per-capability detail specs

> **Template** (used for every capability; propagates to FE-3..FE-9 per §G — pages use the FE-1 form, capabilities use the form below):
> 1. File path + scope
> 2. Components / exports / deps (scaffold reused / new in this PR / shadcn / design-port)
> 3. API endpoints consumed (mostly `n/a` for FE-2)
> 4. Props / token contract / styling contract (replaces the FE-1 form+zod section)
> 5. States / variants (every variant from the design state-strip)
> 6. Acceptance criteria (Gherkin — each trio maps to one Vitest test)
> 7. Edge cases / gotchas
> 8. Visual reference

### B.1 Design tokens + paper/carbon themes + typography classes

**1. File path + scope**

- `frontend/src/app/globals.css` — full token system + typography classes + paper and carbon theme blocks. Replaces the FE-0 placeholder (`--color-background`, `--color-foreground`, body font stack).
- `frontend/tailwind.config.ts` — minimal; the `@theme` directives in `globals.css` carry the token registration. `content: ["./src/**/*.{ts,tsx}"]` retained.

**2. Components / exports / deps**

- No JS exports. Pure CSS + Tailwind v4 `@theme` declarations.
- New deps: none (Tailwind v4 already in devDeps from FE-0).
- The `data-theme` attribute on `<html>` is the theme selector; `app/layout.tsx` sets it server-side and the §C.2 inline script + §B.3 toggle mutate it client-side.

**3. API endpoints consumed**

- n/a.

**4. Props / token contract / styling contract**

The full v1 token set, ported verbatim from `prototype/styles.css`. Names are bare (no `--color-` prefix) — Tailwind v4 utilities are exposed via `--color-*` aliases under `@theme` per the AC-CD23 amendment (§H bucket (a) blocker #1). Component code uses Tailwind utility classes that resolve to the bare tokens.

> **Build-session verification — verify against `prototype/styles.css`:** the token list below is sourced from the prototype's `:root, [data-theme="paper"]` and `[data-theme="carbon"]` blocks at FE-2-shell.md authoring time. The build session re-reads the prototype as the source of truth; if any token drifted in the prototype after this spec landed, lock to the prototype and surface the drift in the handover.

**Color tokens (paper, all hex):**

```css
:root,
[data-theme="paper"] {
  --bg:           #f3efe7;
  --bg-sunk:      #ece7dc;
  --bg-raised:    #faf7f0;
  --bg-deep:      #e4ddcc;
  --ink:          #1a1814;
  --ink-2:        #4a463e;
  --ink-3:        #7a7468;
  --ink-4:        #a8a193;
  --line:         #d6cfbe;
  --line-strong:  #b9b09c;
  --accent:       #b8743a;        /* ochre */
  --accent-soft:  #ecd8bd;
  --accent-ink:   #5f3a1c;
  --ok:           #5a7a4a;
  --ok-soft:      #d5e0c7;
  --warn:         #b15a2c;
  --warn-soft:    #ecc9aa;
  --danger:       #97352a;
  --danger-soft:  #ecc3bc;
  --info:         #3d5e7a;
  --info-soft:    #c7d4e0;
  --band-novice:    #a8a193;
  --band-junior:    #c2956b;
  --band-working:   #b8743a;
  --band-advanced:  #6e8f5b;
  --band-expert:    #2f5d63;
  color-scheme: light;
}
```

**Color tokens (carbon):**

```css
[data-theme="carbon"] {
  --bg:           #262624;
  --bg-sunk:      #1f1e1c;
  --bg-raised:    #30302d;
  --bg-deep:      #1a1917;
  --ink:          #f5f0e8;
  --ink-2:        #c5beb1;
  --ink-3:        #8a8479;
  --ink-4:        #57534c;
  --line:         #3a3835;
  --line-strong:  #4f4c47;
  --accent:       #d97757;
  --accent-soft:  rgba(217, 119, 87, 0.16);
  --accent-ink:   #e89a7e;
  --ok:           #a8c490;
  --ok-soft:      rgba(168, 196, 144, 0.14);
  --warn:         #d99a55;
  --warn-soft:    rgba(217, 154, 85, 0.14);
  --danger:       #d27668;
  --danger-soft:  rgba(210, 118, 104, 0.14);
  --info:         #8aa9c4;
  --info-soft:    rgba(138, 169, 196, 0.14);
  --band-novice:    #6e6a62;
  --band-junior:    #c4956a;
  --band-working:   #d97757;
  --band-advanced:  #a8c490;
  --band-expert:    #7fc0c8;
  color-scheme: dark;
}
```

**Steel theme is not ported.** Per §H decision 4, the prototype's `[data-theme="steel"]` block is stripped during port; v1 ships paper + carbon only, steel is not a v1.x deliverable either.

**Radius (all zero — hard corners):**

```css
:root { --r-1: 0; --r-2: 0; --r-3: 0; --r-4: 0; }
```

**Elevation:**

```css
:root {
  --shadow-1: 0 1px 0 rgba(255,255,255,.5) inset, 0 1px 2px rgba(40,30,15,.06);
  --shadow-2: 0 1px 0 rgba(255,255,255,.6) inset, 0 6px 24px rgba(40,30,15,.10);
  --shadow-3: 0 1px 0 rgba(255,255,255,.65) inset, 0 18px 50px rgba(40,30,15,.18);
}
```

**Typography:**

```css
:root {
  --font-sans:  'DM Sans', ui-sans-serif, system-ui, sans-serif;
  --font-serif: 'Quicksand', 'DM Sans', ui-sans-serif, system-ui, sans-serif;
  --font-mono:  'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;
}
```

**Typography classes** (ported verbatim from prototype — class-driven, not Tailwind utility-driven, because the design's typography is a small fixed vocabulary):

```css
.serif    { font-family: var(--font-serif); font-weight: 600; letter-spacing: -0.008em; }
.serif-it { font-family: var(--font-serif); font-style: normal; font-weight: 500; } /* intentional no-italic override */
.mono     { font-family: var(--font-mono); font-feature-settings: 'ss01', 'zero', 'cv01'; }
.eyebrow  { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-3); }
.h-display { font-family: var(--font-serif); font-size: 52px; line-height: 1.12; letter-spacing: -0.022em; font-weight: 600; }
.h-1 { font-family: var(--font-serif); font-size: 36px; line-height: 1.2;  letter-spacing: -0.018em; font-weight: 600; }
.h-2 { font-family: var(--font-serif); font-size: 24px; line-height: 1.22; letter-spacing: -0.014em; font-weight: 600; }
.h-3 { font-size: 17px; line-height: 1.3; letter-spacing: -0.005em; font-weight: 600; }
.h-4 { font-size: 13px; line-height: 1.3; font-weight: 600; }
.t-meta { font-family: var(--font-mono); font-size: 11px; color: var(--ink-3); letter-spacing: 0.02em; }
.t-fig  { font-family: var(--font-mono); font-feature-settings: 'tnum'; }
```

The `.serif-it` class is intentionally not italic — it overrides the typical italic of a serif "it" suffix because the prototype's design eliminated italics across the v5/v6 iterations (note the `01-v5-noitalic.png` / `02-v5-noitalic.png` canonical screenshots).

**Tailwind v4 `@theme` aliases** (exposes Tailwind utilities like `bg-ink`, `text-band-working`, `border-line` — the AC-CD23 amendment form):

```css
@import "tailwindcss";

@theme {
  --color-bg:           var(--bg);
  --color-bg-sunk:      var(--bg-sunk);
  --color-bg-raised:    var(--bg-raised);
  --color-bg-deep:      var(--bg-deep);
  --color-ink:          var(--ink);
  --color-ink-2:        var(--ink-2);
  --color-ink-3:        var(--ink-3);
  --color-ink-4:        var(--ink-4);
  --color-line:         var(--line);
  --color-line-strong:  var(--line-strong);
  --color-accent:       var(--accent);
  --color-accent-soft:  var(--accent-soft);
  --color-accent-ink:   var(--accent-ink);
  --color-ok:           var(--ok);
  --color-ok-soft:      var(--ok-soft);
  --color-warn:         var(--warn);
  --color-warn-soft:    var(--warn-soft);
  --color-danger:       var(--danger);
  --color-danger-soft:  var(--danger-soft);
  --color-info:         var(--info);
  --color-info-soft:    var(--info-soft);
  --color-band-novice:   var(--band-novice);
  --color-band-junior:   var(--band-junior);
  --color-band-working:  var(--band-working);
  --color-band-advanced: var(--band-advanced);
  --color-band-expert:   var(--band-expert);
  --radius-1: 0;
  --radius-2: 0;
  --radius-3: 0;
  --radius-4: 0;
}
```

**Token discipline (AC-CD23):** literal hex values, RGB values, and arbitrary-value brackets (`bg-[#fafafa]`) are prohibited in component code under `frontend/src/components/` and `frontend/src/app/`. Reviewers reject PRs that introduce them. The single source of token truth is `globals.css`; component code consumes only Tailwind utility classes that resolve to those tokens, or the typography classes above.

**5. States / variants**

- Paper (default, server-set). All tokens carry paper hex values.
- Carbon (opt-in via toggle, `localStorage`-persisted). All tokens flip to carbon hex via the `[data-theme="carbon"]` selector.

**6. Acceptance criteria (Gherkin)**

```
Scenario: First-visit user lands with paper theme
  Given no acumen.theme key in localStorage
  When the user navigates to any URL
  Then <html> carries data-theme="paper"
  And the rendered colours match the paper token set

Scenario: Returning user lands with their stored theme
  Given localStorage.acumen.theme === "carbon"
  When the user navigates to any URL
  Then <html> carries data-theme="carbon" before React hydrates
  And the rendered colours match the carbon token set with no white flash
```

(Toggle interaction is covered in §B.3.)

**7. Edge cases / gotchas**

- The inline FOUC script in `<head>` (§C.2) runs synchronously before any CSS or React; the script must be tiny (sub-200 bytes) to avoid blocking paint. Avoid `try`/`catch` overhead; bare `localStorage.getItem` is fine in modern browsers.
- The `color-scheme` CSS property differs between paper (`light`) and carbon (`dark`) — Browser-native UI (scrollbars, form widgets) inherits, which matters for the carbon theme.
- A token added or renamed after FE-2 lands cascades to every consuming PR. Token churn is the FE_ROADMAP-named FE-2 risk; this spec locks the full set at the prototype state cited above.

**8. Visual reference:** `prototype/styles.css` (full file) · `01-v5-noitalic.png`, `02-v5-noitalic.png`.

---

### B.2 Rail — sidebar nav

**1. File path + scope**

- `frontend/src/components/shell/Rail.tsx`. Mounted by `(testee)/layout.tsx` and `(admin)/layout.tsx`. Not mounted by `(auth)` or `(authed)/privacy/`.

**2. Components / exports / deps**

- New in this PR: `Rail` component.
- shadcn primitives used: none (Rail is a pure layout component).
- Design-port: `AcumenMark` SVG (also used by FE-1's `AuthLogo`; FE-2 either reuses FE-1's port or co-locates as a shared SVG at `frontend/src/components/primitives/AcumenMark.tsx` — pick at build time).

**3. API endpoints consumed**

- n/a (Rail receives `role` from caller; navigation links route via Next.js `<Link>`).

**4. Props / token contract / styling contract**

```ts
type RailProps = {
  role: "testee" | "admin";
  activeRoute: string;             // e.g., "/dashboard", "/ops"
};
```

Token bindings: `--bg-sunk` (rail bg), `--line` (rail right border), `--ink` / `--ink-2` / `--ink-3` / `--ink-4` (label and meta), `--bg-raised` (active-link text), `--accent-soft` / `--accent-ink` (badge bg / fg).

Navigation arrays are role-derived (lock from prototype's `TESTEE_NAV` and `ADMIN_NAV`):

- `TESTEE_NAV`: Dashboard (`/`), In Progress (attempt route from FE-4 — placeholder anchor for FE-2), Discover (catalogue — FE-3 anchor), Latest Result (results — FE-6 anchor), Competency (profile — FE-7 anchor), History (FE-7 anchor).
- `ADMIN_NAV`: Operations (`/ops`), Grade Review (FE-6), Engagement (FE-9), Catalogue (FE-3 admin view — FE-8), Users & Groups (FE-8), AI Cost (FE-9), Loops (FE-9).

In FE-2 the rail items render with their target hrefs but several targets are placeholder routes that 404 until later phases land them. The Rail itself does not check route existence — it lists what the role can navigate to.

**5. States / variants**

| State | Trigger | Visual |
|---|---|---|
| `default` | `activeRoute` does not match item href | Label in `--ink-2`, no chip |
| `active` | `activeRoute === item.href` | Background swap to `--ink`, label flips to `--bg-raised`, badge (if any) stays in `--accent-soft` |
| `with-badge` | item carries a count > 0 | Small numeric pill in `--accent-soft` / `--accent-ink` after the label |
| `narrow viewport` | Width < small breakpoint | Labels hidden; icons + 1–2-char abbrev only (per prototype) |

> **Build-session verification — verify against `prototype/shell.jsx::Rail`:** the badge counts in the prototype (e.g., "1" on attempt, "4" on review) are illustrative dev values. FE-2 ships the badges with `count={0}` defaults; future phases wire real counts (FE-4 sets in-progress; FE-6 sets review queue). Confirm at build time that no prototype-dev count leaks as a literal into production.

**6. Acceptance criteria (Gherkin)**

```
Scenario: Rail renders the testee nav for a testee
  Given <Rail role="testee" activeRoute="/" />
  Then the rendered nav contains "Dashboard", "In Progress", "Discover", "Latest Result", "Competency", "History"
  And no admin-only labels (e.g., "Operations") appear

Scenario: Rail renders the admin nav for an admin
  Given <Rail role="admin" activeRoute="/ops" />
  Then the rendered nav contains "Operations", "Grade Review", "Engagement", "Catalogue", "Users & Groups", "AI Cost", "Loops"
  And no testee-only labels (e.g., "Dashboard") appear

Scenario: Rail highlights the active item
  Given <Rail role="testee" activeRoute="/" />
  Then the "Dashboard" item carries the active visual treatment
  And no other item does

Scenario: Rail badge shows count when > 0
  Given a nav item with count 3
  Then a small chip with "3" renders beside the label
  And the chip is hidden when count is 0
```

**7. Edge cases / gotchas**

- Active-route matching is exact (`===`), not prefix. The dashboard `/` does NOT match `/profile` etc. Sub-route active-state is per-page concern — FE-3+ may extend the prop to `activeRoute: string | (route: string) => boolean` if needed; FE-2 ships the exact-match form.
- Rail and TopBar are siblings of `main`, not children. The layout file mounts them around `children`.

**8. Visual reference:** `prototype/shell.jsx` (`Rail`) · `01-v5-noitalic.png` (testee rail), `02-v5-noitalic.png` (admin rail).

---

### B.3 TopBar — crumb + search-stub + avatar + theme toggle

**1. File path + scope**

- `frontend/src/components/shell/TopBar.tsx`. Mounted by `(testee)/layout.tsx` and `(admin)/layout.tsx`.
- Avatar-menu sub-component: `frontend/src/components/shell/AvatarMenu.tsx` — replaces FE-1's logout-function-only stub with the actual dropdown UI.
- Theme-toggle sub-component: `frontend/src/components/shell/ThemeToggle.tsx` — small icon button beside the avatar.

**2. Components / exports / deps**

- Scaffold reused: `useAuth()` from `lib/auth/context.tsx` (reads `user.name`, `user.role`); `logout()` from FE-1's wiring.
- New in this PR: `TopBar`, `AvatarMenu`, `ThemeToggle`.
- shadcn primitives used: `DropdownMenu` (for the avatar dropdown).
- Design-port: avatar circle visual, theme-toggle icon (sun/moon from `prototype/icons.jsx`).

**3. API endpoints consumed**

- Indirect via `useAuth()` → backed by FE-0's `GET /v1/auth/me` mount resolver and FE-1's post-login resolver. TopBar itself does not call any endpoint.
- `logout()` calls `POST /v1/auth/logout` per FE-1's wiring.

**4. Props / token contract / styling contract**

```ts
type TopBarProps = {
  crumb?: { label: string; href?: string }[]; // override the default "Acumen / {page}" trail
  rightSlot?: React.ReactNode;                // page-specific right-aligned content
};
```

**Critical omissions vs the prototype's `TopBar`:**

- **No `role` / `onRole` props.** The prototype's segmented role-switch toggle is a dev affordance for previewing testee vs admin views without auth. Production TopBar reads role from `useAuth().user.role` and renders the appropriate breadcrumb / search placeholder; it does NOT expose a role-switch control. Per §H decision 3 (Q3 loose-wording reading), no "View as testee" / role-switch affordance ships in FE-2. (Cross-reference §F.1 for the related tweaks-panel non-goal.)
- **No `user` prop.** TopBar reads `useAuth().user` directly. Caller does not pass identity.

Token bindings: `--bg-raised` (top bar bg), `--bg`/`--bg-deep` (page bg around it), `--line` (bottom border), `--ink` / `--ink-2` / `--ink-3` / `--ink-4` (crumb + search placeholder + avatar circle), `--accent` (active state for theme toggle hover, if any).

Default breadcrumb: `SiteMesh / Acumen / {page-from-route}`. Page label derives from the current route (e.g., `/` → "Dashboard"; `/ops` → "Operations"). Caller can override via the `crumb` prop.

Search stub: read-only input with placeholder per role — "Search pills, testees, attempts…" for admin; "Search pills…" for testee. Renders a `⌘K` hint chip on the right. **Click is a no-op in FE-2.** Future phase wires the search to a real palette.

Theme-toggle sub-component (`ThemeToggle.tsx`):

```ts
function ThemeToggle() {
  const [theme, setTheme] = useState<"paper" | "carbon">(() =>
    (typeof document !== "undefined" &&
     (document.documentElement.getAttribute("data-theme") as "paper" | "carbon")) || "paper",
  );
  const onClick = () => {
    const next = theme === "paper" ? "carbon" : "paper";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("acumen.theme", next);
    setTheme(next);
  };
  return (
    <button onClick={onClick} aria-label={`Switch to ${theme === "paper" ? "carbon" : "paper"} theme`}>
      <Icon name={theme === "paper" ? "sun" : "moon"} size={16} />
    </button>
  );
}
```

Sun icon when on paper (click → switch to carbon); moon icon when on carbon (click → switch to paper). Beside the avatar, NOT inside the avatar dropdown. Persisted via `localStorage.acumen.theme`. Bootstrap + FOUC handling in §C.2.

Avatar-menu sub-component (`AvatarMenu.tsx`):

- Trigger: circular avatar with the user's first initial (read from `useAuth().user.name`).
- Dropdown items (final FE-2 set, logout-only per §H decision 3):
  - "Sign out" — calls `logout()` from FE-1, then `router.push("/login")`.
- Three visual states from the prototype mock: `closed` (default avatar circle), `open` (dropdown menu visible), `logging-out` (Sign out item shows a pulse-dot + "Signing out…" while `logout()` is in flight, both menu and avatar disabled).

> **Build-session verification — verify against `prototype/avatar-menu.jsx`:** the prototype dropdown likely lists additional items (settings, profile, etc.) that are out-of-scope for FE-2. The FE-2 build ports only the "Sign out" item. Confirm the prototype contents, surface any item that looks production-intended-not-yet-deferred, and either fold into FE-2 or surface as out-of-scope for the relevant later phase.

**5. States / variants**

| State | Trigger | Visual |
|---|---|---|
| `default` | Authenticated, dropdown closed | Crumb + search-stub + theme toggle + avatar circle with initial |
| `dropdown-open` | User clicked avatar | DropdownMenu visible anchored to avatar; "Sign out" item present |
| `logging-out` | "Sign out" clicked, `logout()` in flight | Item shows pulse-dot + "Signing out…"; menu trigger disabled |
| `theme-paper` | `data-theme="paper"` | Sun icon in toggle button |
| `theme-carbon` | `data-theme="carbon"` | Moon icon in toggle button |

**6. Acceptance criteria (Gherkin)**

```
Scenario: TopBar shows the user's initial and a search-stub for their role
  Given the auth context exposes user { name: "Asha Patel", role: "testee" }
  When TopBar mounts inside (testee)/layout.tsx
  Then the avatar circle renders the initial "A"
  And the search-stub placeholder reads "Search pills…"
  And no role-switch control is rendered

Scenario: TopBar admin variant shows the admin search-stub
  Given user { role: "admin" }
  When TopBar mounts inside (admin)/layout.tsx
  Then the search-stub placeholder reads "Search pills, testees, attempts…"

Scenario: Avatar dropdown opens and logs out
  Given the avatar dropdown is closed
  When the user clicks the avatar
  Then the dropdown renders with a single "Sign out" item
  When the user clicks "Sign out"
  Then logout() is called
  And after logout resolves, the router pushes "/login"

Scenario: Avatar dropdown does NOT carry a role-switch affordance
  Given the user is an admin
  When the avatar dropdown opens
  Then no "View as testee" / role-switch item is present
  (This codifies §H decision 3.)

Scenario: Theme toggle flips data-theme and writes localStorage
  Given <html data-theme="paper">
  And localStorage has no acumen.theme key
  When the user clicks the theme toggle
  Then <html> carries data-theme="carbon"
  And localStorage.acumen.theme === "carbon"
  And the toggle icon changes from sun to moon

Scenario: Theme toggle round-trips
  Given <html data-theme="carbon"> after a prior toggle
  When the user clicks the toggle again
  Then <html> carries data-theme="paper"
  And localStorage.acumen.theme === "paper"
```

**7. Edge cases / gotchas**

- `useAuth().user` is null briefly during the (authed) guard's loading state; TopBar must skeleton-render the avatar circle (greyed bg, no initial) rather than crashing on `.name[0]`.
- Theme toggle uses `useState` initialized from a function that reads `document.documentElement.getAttribute("data-theme")` — but `document` is undefined during SSR. The initializer guards via `typeof document !== "undefined"` and falls back to `"paper"`; the post-hydration `useEffect` (not shown above but recommended) re-syncs from the actual attribute.
- The breadcrumb's first segment ("SiteMesh") is intentional: Acumen is a future-SiteMesh app per the broader product context. Do not strip "SiteMesh" thinking it's design-prototype debris.

**8. Visual reference:** `prototype/shell.jsx` (`TopBar`) · `prototype/avatar-menu.jsx` · `01-v5-noitalic.png` · `v6-fe1-06-avatar-menu.png` (closed / open / logging-out variants).

---

### B.4 PageHeader

**1. File path + scope**

- `frontend/src/components/shell/PageHeader.tsx`. Used by every page inside `(testee)/` and `(admin)/`.

**2. Components / exports / deps**

- New in this PR. No shadcn deps. No state.

**3. API endpoints consumed**

- n/a.

**4. Props / token contract / styling contract**

```ts
type PageHeaderProps = {
  eyebrow?: string;                  // small all-caps label
  title: string;                     // h-1 serif
  subtitle?: string | React.ReactNode;
  actions?: React.ReactNode;         // right-aligned slot for buttons
};
```

Token bindings: `.eyebrow` class (mono, `--ink-3`), `.h-1` class (serif, `--ink`), subtitle reads default body in `--ink-2`. Actions slot is layout-only.

**5. States / variants**

| State | Trigger | Visual |
|---|---|---|
| `default` | All props provided | Eyebrow + h-1 + subtitle in left column, actions in right column |
| `no-eyebrow` | `eyebrow` omitted | h-1 + subtitle only |
| `no-actions` | `actions` omitted | Single full-width text column |
| `narrow viewport` | width below md | Actions wrap below the text block |

**6. Acceptance criteria (Gherkin)**

```
Scenario: PageHeader renders all four slots
  Given <PageHeader eyebrow="DASHBOARD" title="Welcome, Asha" subtitle="3 pills due" actions={<button>New</button>} />
  Then the eyebrow text "DASHBOARD" renders with the .eyebrow class
  And the title "Welcome, Asha" renders with the .h-1 class
  And the subtitle "3 pills due" renders below the title
  And the actions slot contains the rendered button

Scenario: PageHeader without eyebrow
  Given <PageHeader title="Operations" />
  Then no eyebrow element renders
  And no subtitle element renders
  And no actions container renders
```

**7. Edge cases / gotchas**

- `subtitle` accepts `ReactNode` (not just string) so dynamic content like "3 pills due · last review 2d ago" with chips can render inline.

**8. Visual reference:** `prototype/shell.jsx` (`PageHeader`) · `01-v5-noitalic.png`.

---

### B.5 Stat primitive

**1. File path + scope**

- `frontend/src/components/primitives/Stat.tsx`. Used by dashboard pages (FE-3, FE-9).

**2. Components / exports / deps**

- New in this PR. No state.

**3. API endpoints consumed**

- n/a.

**4. Props / token contract / styling contract**

```ts
type StatProps = {
  value: string | number;
  label: string;
  hint?: string;
  tone?: "accent" | "default";   // default omitted
};
```

Token bindings: `value` renders in 54px serif (Quicksand via `var(--font-serif)`); `tone="accent"` swaps text colour to `--accent`. `label` is 11px mono in `--ink-3`. `hint` is small body in `--ink-3`.

**5. States / variants**

| State | Trigger | Visual |
|---|---|---|
| `default` | Default | Large value + label + (optional) hint, value in `--ink` |
| `accent` | `tone="accent"` | Value coloured `--accent` |
| `no-hint` | `hint` omitted | Value + label only |

**6. Acceptance criteria (Gherkin)**

```
Scenario: Stat renders value, label, and hint
  Given <Stat value={47} label="Attempts this week" hint="↑ 12 from last week" />
  Then the value "47" renders in the large serif treatment
  And the label "Attempts this week" renders in the mono small-caps treatment
  And the hint "↑ 12 from last week" renders below

Scenario: Stat accent tone
  Given <Stat value="6.7" label="Working" tone="accent" />
  Then the value is rendered with the accent colour
```

**7. Edge cases / gotchas**

- `value` accepts both `string` and `number` because some stats are formatted (e.g., "6.7" with one-decimal precision) — caller decides formatting; Stat does not format.

**8. Visual reference:** `prototype/shell.jsx` (`Stat`) · `01-v5-noitalic.png`.

---

### B.6 BandTag primitive

**1. File path + scope**

- `frontend/src/components/primitives/BandTag.tsx`. Used by FE-3 catalogue (pill cards), FE-7 profile (band stamps), FE-9 admin views.

**2. Components / exports / deps**

- New in this PR. No state.

**3. API endpoints consumed**

- n/a.

**4. Props / token contract / styling contract**

```ts
type Band = "novice" | "junior" | "working" | "advanced" | "expert";

type BandTagProps = {
  band: Band;
  withLabel?: boolean;          // default true; if false, renders only the pip row
  withPips?: boolean;           // default false; if true, appends 1–5 pip row inside the badge
  estimate?: number;            // AC-D9 competence_estimate float (e.g., 6.7)
  confidence?: "preliminary" | "confident";  // AC-D20 calibration qualifier
};
```

Token bindings: badge bg picks `--band-{band}` (novice / junior / working / advanced / expert — named, not numbered, per AC-D9). Text colour is `--bg-raised` (white-on-coloured for paper; light-on-coloured for carbon).

Display per AC-D9 amendment + AC-D20:

- Label: capitalized band name ("Novice" / "Junior" / "Working" / "Advanced" / "Expert").
- If `estimate` provided: append `" (6.7)"` (one-decimal format) per AC-D9 amendment ("Working (6.7)").
- If `confidence` provided: append `" · n=…, preliminary"` or `" · n=…, confident"` per AC-D20 ("Working (6.7) · n=47, confident"). FE-2 ships `confidence` as an optional prop; sample-size `n` is part of the same prop value (caller composes the string), since FE-2 has no access to sample-size data — FE-7 wires the real values.

> **Build-session verification — confirm against AC-D9 amendment + AC-D20:** the format "Working (6.7) · n=47, confident" is from `SPEC.md` §4.10. FE-2 locks the BandTag prop shape that supports it; FE-7 wires the data binding. If the SPEC display format changes between FE-2 lock and FE-7 build, FE-7 has flexibility to render via composition (caller passes a final string) rather than amending BandTag.

**5. States / variants**

| State | Trigger | Visual |
|---|---|---|
| `novice` | `band="novice"` | Bg `--band-novice` (muted grey), text "Novice" |
| `junior` | `band="junior"` | Bg `--band-junior`, text "Junior" |
| `working` | `band="working"` | Bg `--band-working`, text "Working" |
| `advanced` | `band="advanced"` | Bg `--band-advanced`, text "Advanced" |
| `expert` | `band="expert"` | Bg `--band-expert`, text "Expert" |
| `with-pips` | `withPips=true` | 5 small circles after label, n filled per band level (1..5) |
| `with-estimate` | `estimate=6.7` | Label appended with " (6.7)" |
| `with-confidence` | `confidence="preliminary"` | Label appended with " · preliminary" qualifier |

**6. Acceptance criteria (Gherkin)**

```
Scenario: BandTag renders the band label and colour
  Given <BandTag band="working" />
  Then the rendered text reads "Working"
  And the background colour resolves to var(--band-working)

Scenario: BandTag with competence_estimate float (AC-D9)
  Given <BandTag band="working" estimate={6.7} />
  Then the rendered text reads "Working (6.7)"

Scenario: BandTag with calibration confidence (AC-D20)
  Given <BandTag band="working" estimate={6.7} confidence="confident" />
  Then the rendered text contains "confident"

Scenario: BandTag with pips
  Given <BandTag band="working" withPips />
  Then 5 pip elements render
  And 3 of them carry the filled state (working = band level 3)

Scenario: BandTag pips-only (label hidden)
  Given <BandTag band="advanced" withLabel={false} withPips />
  Then the badge contains pips but no text label
```

**7. Edge cases / gotchas**

- Pip count per band: novice=1, junior=2, working=3, advanced=4, expert=5. Lock these in code as a constant `BAND_PIP_LEVEL: Record<Band, number>`.
- `estimate` is a `number`; format via `estimate.toFixed(1)`. Out-of-range values (< 1.0 or > 10.0) are caller's responsibility — BandTag does not clamp.

**8. Visual reference:** `prototype/shell.jsx` (`BandTag`); rendered first by FE-3 catalogue (no FE-2-tagged screenshot).

---

### B.7 BandPips primitive

**1. File path + scope**

- `frontend/src/components/primitives/BandPips.tsx`. Used where the band is shown compactly without label (e.g., dense table cells in FE-7 / FE-9).

**2. Components / exports / deps**

- New in this PR. No state.

**3. API endpoints consumed**

- n/a.

**4. Props / token contract / styling contract**

```ts
type BandPipsProps = {
  band: Band;
};
```

Renders 5 small circles; the first `BAND_PIP_LEVEL[band]` (shared constant from §B.6) are filled with `--band-{band}`; the rest are outlined `--line`. No background container; renders inline.

**5. States / variants**

| State | Trigger | Visual |
|---|---|---|
| `novice` through `expert` | per `band` | 1–5 filled pips coloured per `--band-{band}`, remainder outlined |

**6. Acceptance criteria (Gherkin)**

```
Scenario: BandPips renders the right pip count
  Given <BandPips band="advanced" />
  Then 4 pips render filled
  And 1 pip renders outlined
  And the filled colour resolves to var(--band-advanced)
```

**7. Edge cases / gotchas**

- Pip-level constant is shared with `BandTag` — single source of truth at `frontend/src/components/primitives/bands.ts` (or co-located with BandTag).

**8. Visual reference:** `prototype/shell.jsx` (`BandPips`); rendered first by FE-3 / FE-7.

---

### B.8 Pill primitive

**1. File path + scope**

- `frontend/src/components/primitives/Pill.tsx`. Used as a generic chip/badge for tags, status flags, metadata (FE-3, FE-6, FE-9).

> Naming note: this is the generic chip primitive. It is **not** related to the Acumen domain "pill" (the unit of learning content). The prototype's class is `.chip`, so build-session may co-locate the class as `.chip` while exporting the component as `Pill`.

**2. Components / exports / deps**

- New in this PR. No state.

**3. API endpoints consumed**

- n/a.

**4. Props / token contract / styling contract**

```ts
type PillTone = "accent" | "ok" | "warn" | "danger" | "info" | "default";

type PillProps = {
  tone?: PillTone;          // default "default"
  mono?: boolean;            // default false; if true, label uses the mono font
  children: React.ReactNode;
};
```

Token bindings per tone:

- `accent` — bg `--accent-soft`, fg `--accent-ink`.
- `ok` / `warn` / `danger` / `info` — bg `--{tone}-soft`, fg `--{tone}`.
- `default` (no tone) — bg `--bg-deep`, fg `--ink-2`.

**5. States / variants**

| State | Trigger | Visual |
|---|---|---|
| `default` | no tone | Subtle neutral chip |
| `accent` | `tone="accent"` | Ochre chip |
| `ok` | `tone="ok"` | Green chip |
| `warn` | `tone="warn"` | Amber chip |
| `danger` | `tone="danger"` | Red chip |
| `info` | `tone="info"` | Blue chip |
| `mono` | `mono=true` | Label in mono font; useful for numeric / code-like content |

**6. Acceptance criteria (Gherkin)**

```
Scenario: Pill default tone
  Given <Pill>v1</Pill>
  Then the rendered chip uses --bg-deep / --ink-2 token bindings

Scenario: Pill warn tone
  Given <Pill tone="warn">overdue</Pill>
  Then the rendered chip uses --warn-soft bg and --warn fg

Scenario: Pill mono
  Given <Pill mono>3.14</Pill>
  Then the label renders with var(--font-mono)
```

**7. Edge cases / gotchas**

- Pill is intentionally untyped on content — accepts any ReactNode. Callers can compose `<Pill tone="ok"><Icon name="check" size={12} /> Done</Pill>`.

**8. Visual reference:** `prototype/shell.jsx` (`Pill`); rendered first by FE-3.

---

### B.9 Icon primitive

**1. File path + scope**

- `frontend/src/components/primitives/Icon.tsx`. Used everywhere. Single component with a `name` prop per AC-CD23.

**2. Components / exports / deps**

- New in this PR. No state. Internal `<svg>` switch on `name`.

**3. API endpoints consumed**

- n/a.

**4. Props / token contract / styling contract**

```ts
type IconName =
  | "dashboard" | "compass" | "attempt" | "graph" | "constellation" | "history"
  | "users" | "catalogue" | "review" | "cost" | "loop" | "shield" | "flag"
  | "sparkles" | "lock" | "eye" | "eyeOff" | "arrowRight" | "arrowUp" | "arrowDown"
  | "check" | "x" | "plus" | "search" | "menu" | "sliders" | "pause" | "clock"
  | "book" | "external" | "spark" | "link" | "logout" | "settings" | "inbox"
  | "wave" | "sun" | "moon";

type IconProps = {
  name: IconName;
  size?: number;            // default 16
  strokeWidth?: number;     // default 1.5
} & React.SVGProps<SVGSVGElement>;
```

> **Build-session verification — verify the icon set against `prototype/icons.jsx`:** the union above is sourced from the prototype's icon set as enumerated at FE-2-shell.md authoring time, plus `sun` and `moon` added for the theme toggle (§B.3). If the prototype gained or renamed icons since spec authoring, lock the union to the prototype state at build time. If `sun` / `moon` are missing from the prototype, the build session adds them (lightweight SVG, well-known iconography).

Stroke-based SVG; `currentColor` for stroke so consumer can colour via Tailwind text utilities (`text-ink`, `text-accent`).

**5. States / variants**

- Each icon name renders its own SVG. No state.

**6. Acceptance criteria (Gherkin)**

```
Scenario: Icon renders the requested glyph
  Given <Icon name="check" size={20} />
  Then an svg of width and height 20 renders
  And the path data matches the "check" definition

Scenario: Icon inherits text colour
  Given <Icon name="lock" /> inside an element with class text-accent
  Then the rendered stroke uses var(--accent)

Scenario: Icon TypeScript union forbids unknown names
  Given <Icon name="not-real" />
  Then TypeScript compilation fails  (compile-time, not Vitest)
```

**7. Edge cases / gotchas**

- Theme-toggle icons `sun` / `moon` are FE-2 additions to the icon set; if they are not in the prototype's `icons.jsx`, the build session sketches them in line with the existing stroke-based style.
- `prototype/icons.jsx` writes `window.Icon = Icon` (browser globals). The FE-2 port is a normal React component export with no `window` binding.

**8. Visual reference:** `prototype/icons.jsx` (full file).

---

### B.10 Figure / InlineFigure / ChoiceFigure (typed stubs)

**1. File path + scope**

- `frontend/src/components/primitives/figure.tsx`. Three exports: `<Figure>`, `<InlineFigure>`, `<ChoiceFigure>`. Per AC-CD24, the v1 contract is that they accept the PR-030 image fields through the type layer but render `null` when the values are null — and since v1 backend always emits null, they render `null` everywhere in v1.

**2. Components / exports / deps**

- New in this PR. No state.
- Type sources: `components["schemas"]["QuestionResponse"]` and `components["schemas"]["ChoiceResponse"]` from `frontend/src/types/api.d.ts` (generated via `openapi-typescript`).

**3. API endpoints consumed**

- n/a (consumed by FE-4's question-rendering paths; FE-2 ships the typed shells).

**4. Props / token contract / styling contract**

```ts
type FigureProps = {
  url: string | null;
  caption?: string | null;
  alt?: string | null;
};

type InlineFigureProps = FigureProps;

type ChoiceFigureProps = {
  url: string | null;
  alt?: string | null;
};
```

When `url` is `null`, every component returns `null` (no DOM). When `url` is non-null, the v1.x add-path lands rendering inside these primitives without touching question-component contracts (per AC-CD24 v1.x add-path).

**5. States / variants**

| State | Trigger | Visual |
|---|---|---|
| `null` (v1 default) | `url === null` | Returns `null`; no DOM |
| `non-null` (v1.x) | `url` is a URL | v1.x renders an `<img>` (or `<figure>`); shape defined by v1.x PR |

**6. Acceptance criteria (Gherkin)**

```
Scenario: Figure renders nothing in v1
  Given <Figure url={null} caption={null} alt={null} />
  Then the rendered output contains no DOM

Scenario: Figure type accepts non-null URL without widening
  Given the call site <Figure url={response.reference_image_url} ...> where reference_image_url has type string | null
  Then TypeScript compiles with no `as` casts or widening  (compile-time)
```

**7. Edge cases / gotchas**

- Per AC-CD24, the build session for FE-4 must verify that question-component props accept the image fields without widening or `as` casts. FE-2 locks the prop shapes so FE-4's verification is a mechanical check.
- No alt-text fallback story in v1.x; that lands when the v1.x rendering PR opens.

**8. Visual reference:** `prototype/figure.jsx`.

---

### B.11 shadcn/ui core install

**1. File path + scope**

- `frontend/src/components/ui/button.tsx`, `card.tsx`, `input.tsx`, `select.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `tabs.tsx`, `toast.tsx`, `skeleton.tsx`. Per AC-CD23, copy-source posture: paste shadcn-generated source verbatim, commit to `components/ui/`, no edits unless overriding for token discipline.

**2. Components / exports / deps**

- New in this PR. Each install copies the shadcn source plus its `@radix-ui/*` peer deps into `package.json`.
- Install commands (build session runs these in order):
  - `pnpm dlx shadcn@latest init` (one-time, generates `components.json`).
  - `pnpm dlx shadcn@latest add button card input select dialog dropdown-menu tabs toast skeleton`.

> **Build-session verification — Tailwind v4 compatibility (FE_ROADMAP-named risk):** before running the install across the full set, run `pnpm dlx shadcn@latest add button` in a throwaway branch. Inspect the generated `button.tsx` for any Tailwind v3-only utilities (e.g., `ring-offset-background` semantics that changed in v4, or arbitrary-value brackets that bypass the `@theme` tokens). If incompatible, halt and surface a spec-clarification PR; the FE_ROADMAP risk converts to a real blocker. If compatible, proceed with the full set.

**3. API endpoints consumed**

- n/a.

**4. Props / token contract / styling contract**

- Per shadcn's source-copy posture, each primitive's props are as shadcn generates them; FE-2 does not customise prop shapes.
- Token discipline: any generated `bg-background`, `text-foreground`, etc. that doesn't map to the project tokens must be replaced with the project token utilities (`bg-bg`, `text-ink`, etc.). The shadcn `init` step will ask for token names; answer with the project's bare names.
- Hard-corner discipline (AC-CD23 / §B.1): any generated `rounded-*` utility must be either removed or overridden to `rounded-none` (or relies on the `--radius-*: 0` overrides in `@theme`).

**5. States / variants**

- Per-primitive variants are shadcn's defaults (Button: `default` / `destructive` / `outline` / `secondary` / `ghost` / `link` × `default` / `sm` / `lg` / `icon`; etc.). FE-2 ships the defaults; FE-3+ may add project-specific variants.

**6. Acceptance criteria (Gherkin)**

```
Scenario: shadcn/ui primitives are importable
  Given the FE-2 install has completed
  When code imports { Button } from "@/components/ui/button"
  Then the import resolves and the component renders

Scenario: shadcn primitives bind to project tokens
  Given <Button> rendered in a paper-themed page
  Then the rendered colours resolve to project tokens (no literal hex)

Scenario: Hard corners across all shadcn primitives
  Given any shadcn primitive renders
  Then no rounded corner exceeds 0px  (visual smoke check, enforced by --radius-*: 0)
```

**7. Edge cases / gotchas**

- The shadcn `Toast` primitive may coexist or conflict with FE-1's `sonner` mount. FE-1 chose sonner for AC-CD21 form-error toasts; FE-2's shadcn `toast` install ships the component but does not replace sonner. Resolution: ship both; sonner stays the project-default toast surface; shadcn `toast` is available for shadcn-derived UIs that hard-depend on it. Document the coexistence in §C.5.
- `components/ui/` is reserved for shadcn-source-copy. Project primitives (Stat / BandTag / BandPips / Pill / Icon / Figure variants) live in `components/primitives/` per AC-CD23 — do not blend the folders.

**8. Visual reference:** shadcn-ui registry (https://ui.shadcn.com/) — primitives ship with their own visuals; integration with project tokens is verified at build time.

---

### B.12 `(authed)` route group + layout guard

**1. File path + scope**

- `frontend/src/app/(authed)/layout.tsx`. Calls `useAuth()`, redirects to `/login` if unauthenticated, redirects to `/privacy` if `privacy_ack_at === null` per AC-D16. Hosts `/privacy` itself (route-group exception bypasses the privacy subgate).
- Per §H bucket (a) blocker #2, `/privacy` belongs in `(authed)/privacy/`, NOT in `(auth)/privacy/`. A user-authored FE-1 spec amendment PR relocates the page before the FE-1 build opens. The FE-2 spec assumes the post-amendment layout.

**2. Components / exports / deps**

- Scaffold reused: `useAuth()` from FE-1's auth context.
- Scaffold extended by FE-1 (per FE-1-auth.md §C.4): `refresh()`, `setUserPrivacyAck()` setters on `AuthContext` (used by `/privacy` to flip ack and let the (authed) guard re-evaluate).
- Guard logic in `frontend/src/lib/auth/guards.ts` per AC-CD20 — pure functions `requireAuthed(session)` and `requirePrivacyAck(session)` returning a redirect path or `null`. FE-1 BUILD adds these per FE-1-auth.md §C.4; FE-2 BUILD composes them in `(authed)/layout.tsx`.

**3. API endpoints consumed**

- Indirect via `useAuth()`. No additional calls.

**4. Props / token contract / styling contract**

- No primitive contract; it's a layout composer. Renders `loading.tsx` skeleton while `status === "loading"`; renders `children` once `status === "authenticated"` and the guards pass.

**5. States / variants**

Per the FE-1 §C.4 five-posture matrix (re-cited; FE-2 implements the `(authed)` cells):

| Posture | Behaviour at `(authed)/layout.tsx` |
|---|---|
| Auth `loading` | Render `loading.tsx` skeleton; do not flash children |
| Unauthenticated | Redirect to `/login?next=<path>` |
| Authed, `privacy_ack_at === null`, route ≠ `/privacy` | Redirect to `/privacy` |
| Authed, `privacy_ack_at === null`, route === `/privacy` | Render children (the privacy page) |
| Authed, ack'd | Render children |

**6. Acceptance criteria (Gherkin)**

```
Scenario: Unauthenticated user hits an (authed) route
  Given the user is unauthenticated
  When the user navigates to /dashboard
  Then the (authed) layout redirects to /login?next=/dashboard

Scenario: Privacy-unacked user hits a non-privacy (authed) route
  Given the user is authenticated with privacy_ack_at === null
  When the user navigates to /dashboard
  Then the (authed) layout redirects to /privacy

Scenario: Privacy-unacked user hits /privacy
  Given the user is authenticated with privacy_ack_at === null
  When the user navigates to /privacy
  Then the (authed) layout renders the children (the privacy page)

Scenario: Acked user hits an (authed) route
  Given the user is authenticated with privacy_ack_at !== null
  When the user navigates to /dashboard
  Then the (authed) layout renders the children
```

**7. Edge cases / gotchas**

- The layout must render `loading.tsx` skeleton during the brief auth-resolving window — flashing the protected page is the classic bug AC-CD20 is written to prevent.
- `/privacy` lives inside `(authed)/` per AC-CD20 post-amendment; it is the only (authed) route that bypasses the privacy subgate. The bypass is implemented by checking `pathname === "/privacy"` inside the privacy-ack branch.

**8. Visual reference:** AC-CD20 (CODE_SPEC.md lines 933–987) · `prototype/app.jsx` (composition only).

---

### B.13 `(testee)` route group + layout guard + empty dashboard

**1. File path + scope**

- `frontend/src/app/(testee)/layout.tsx` — composes the `(authed)` guard plus a role check (`role === "testee"`; else redirect to `/403`), mounts the shell (Rail + TopBar) around children.
- `frontend/src/app/(testee)/page.tsx` — the empty dashboard at `/`. Note: Next.js App Router places `(testee)/page.tsx` at the URL `/` (the route group `(testee)` is invisible).

> **Build-session verification — route placement:** if FE-1 has already shipped a page at `/` (the post-login landing per FE-1-auth.md §C.4), FE-2 either moves that into `(testee)/page.tsx` (preferred — composes the shell) or composes them. Confirm at build time; resolve by moving FE-1's `app/page.tsx` into `(testee)/page.tsx` if non-trivial.

**2. Components / exports / deps**

- Scaffold reused: `useAuth()`, `requireAuthed` / `requireRole` / `requirePrivacyAck` from `lib/auth/guards.ts`.
- New: `Rail`, `TopBar`, `PageHeader` from `components/shell/` (§B.2–§B.4).

**3. API endpoints consumed**

- Indirect via `useAuth()`. Empty dashboard does not call any endpoint.

**4. Props / token contract / styling contract**

- Layout: 2-column grid — Rail (fixed width) + main (flex-1, scrollable). TopBar pinned to top of main column. Page content below TopBar.
- Empty dashboard renders: `<PageHeader eyebrow="DASHBOARD" title="Welcome, {name}" subtitle="You have no assignments yet" />` and below it an empty-state Stat block or empty-state illustration.

**5. States / variants**

| State | Trigger | Visual |
|---|---|---|
| `loading` | Auth resolving | Loading.tsx skeleton (rail + topbar chrome with skel content) |
| `unauthenticated` | Composed (authed) guard redirects | Redirected to /login |
| `privacy-unacked` | Composed (authed) guard redirects | Redirected to /privacy |
| `role mismatch` | `role !== "testee"` | Redirected to /403 |
| `ok` | Authed, ack'd, role testee | Rail + TopBar + empty dashboard |

**6. Acceptance criteria (Gherkin)**

```
Scenario: Testee lands on the empty dashboard
  Given user { role: "testee", name: "Asha Patel", privacy_ack_at: <iso> }
  When the user navigates to /
  Then the (testee) layout renders the shell (Rail + TopBar)
  And the PageHeader renders "Welcome, Asha Patel"
  And the subtitle reads "You have no assignments yet"

Scenario: Admin trying to hit /
  Given user { role: "admin" }
  When the user navigates to /
  Then the (testee) layout redirects to /403

Scenario: Testee TopBar shows the testee search-stub
  Given the testee dashboard renders
  Then the search-stub placeholder reads "Search pills…"
```

**7. Edge cases / gotchas**

- Empty dashboard is intentionally minimal — FE-3 replaces the body with the real content. Tag the body with `// TODO(FE-3): real dashboard content` to make the placeholder visible.
- The Rail's "Dashboard" item is active when route is `/`.

**8. Visual reference:** `prototype/testee.jsx` (composition) · `01-v5-noitalic.png` (shell with testee content).

---

### B.14 `(admin)` route group + layout guard + empty ops page

**1. File path + scope**

- `frontend/src/app/(admin)/layout.tsx` — same shape as `(testee)/layout.tsx` but checks `role === "admin"`.
- `frontend/src/app/(admin)/ops/page.tsx` — empty ops page at `/ops`.

**2. Components / exports / deps**

- Same as B.13 with role check flipped.

**3. API endpoints consumed**

- Indirect via `useAuth()`. Empty ops does not call any endpoint.

**4. Props / token contract / styling contract**

- Same layout grid as B.13. Empty ops renders `<PageHeader eyebrow="OPERATIONS" title="Operations" subtitle="System overview — placeholder until FE-9 lands the loop / engagement / cost / calibration sections." />`.

**5. States / variants**

| State | Trigger | Visual |
|---|---|---|
| `loading` / `unauthenticated` / `privacy-unacked` | Same as B.13 | Same redirects / skeleton |
| `role mismatch` | `role !== "admin"` | Redirected to /403 |
| `ok` | Authed, ack'd, role admin | Rail + TopBar + empty ops |

**6. Acceptance criteria (Gherkin)**

```
Scenario: Admin lands on the empty ops page
  Given user { role: "admin", name: "Sam Lee", privacy_ack_at: <iso> }
  When the user navigates to /ops
  Then the (admin) layout renders the shell (Rail + TopBar)
  And the PageHeader renders "Operations"

Scenario: Testee trying to hit /ops
  Given user { role: "testee" }
  When the user navigates to /ops
  Then the (admin) layout redirects to /403

Scenario: Admin TopBar shows the admin search-stub
  Given the empty ops page renders
  Then the search-stub placeholder reads "Search pills, testees, attempts…"

Scenario: Admin TopBar carries NO role-switch / "View as testee" affordance
  Given the empty ops page renders
  Then the avatar dropdown contains only "Sign out"
  (Codifies §H decision 3.)
```

**7. Edge cases / gotchas**

- Admin post-login landing: per AC-CD20, the post-login resolver lands testees at `/` and admins at `/ops`. Confirm FE-1 build session implements the role-aware landing (FE-1 spec §C.4 line 617 says "post-login resolver routes per matrix" — verify the resolver branches on `user.role`).
- Tag the body with `// TODO(FE-9): real ops content`.

**8. Visual reference:** `prototype/admin.jsx` (composition) · `02-v5-noitalic.png` (shell with admin content).

---

### B.15 404 (repo-level)

**1. File path + scope**

- `frontend/src/app/not-found.tsx` (Next.js App Router convention). Repo-level per AC-CD20.

**2. Components / exports / deps**

- New: `BoundaryFrame` shared layout helper (defined here or co-located at `frontend/src/components/shell/BoundaryFrame.tsx`; reused by §B.16 / §B.17).
- Icon: serif "404" text (34px, `--ink-3`) per prototype.

**3. API endpoints consumed**

- n/a.

**4. Props / token contract / styling contract**

- `BoundaryFrame` props (sourced from `prototype/boundaries.jsx`):

```ts
type BoundaryFrameProps = {
  glyph: React.ReactNode;          // SVG / text in a rounded sunk circle
  eyebrow: string;                  // small all-caps label
  title: React.ReactNode;           // may contain .serif-it spans
  body: React.ReactNode;            // muted prose
  actions: React.ReactNode;         // button row
  footer?: React.ReactNode;         // bordered footer with trace / path info
};
```

Token bindings: `--bg-sunk` (glyph circle bg), `--ink-3` (glyph fill), `--line` (footer border), `--ink` (button primary), `--bg-raised` (button text).

**Posture (per §H decision 5):** repo-level `not-found.tsx` is full-page (no shell chrome), because it covers 404s for unauthed routes too. Authed in-shell 404 is achieved by per-group `not-found.tsx` files if added later — FE-2 ships only the repo-level catchall, which renders full-page; if a 404 fires inside `(authed)`/`(testee)`/`(admin)`, the catchall renders full-page (acceptable v1 behaviour).

Copy from prototype:
- Eyebrow: "NOT FOUND"
- Title: "That <span class='serif-it'>page</span> doesn't exist"
- Body: "The link may be old or mistyped. Try the dashboard or go back."
- Actions: "Go to dashboard →" (primary, routes to `/`), "Back" (calls `router.back()`)
- Footer: `path · {request URL}` (mono small, `--ink-3`)

**5. States / variants**

- Single variant. No state.

**6. Acceptance criteria (Gherkin)**

```
Scenario: 404 renders for an unknown route
  Given the user navigates to /not-a-real-route
  Then the not-found.tsx renders
  And the eyebrow reads "NOT FOUND"
  And the "Go to dashboard →" button routes to /
```

**7. Edge cases / gotchas**

- Next.js App Router invokes `not-found.tsx` automatically on `notFound()` calls and unmatched routes. No additional wiring.

**8. Visual reference:** `prototype/boundaries.jsx` (`NotFound`) · `v6-fe2-08-boundaries.png`.

---

### B.16 500 boundaries (per route group)

**1. File path + scope**

- `frontend/src/app/error.tsx` — root-level error boundary; full-page posture.
- `frontend/src/app/(authed)/error.tsx` — in-shell-when-FE-2-shell-exists; for `(authed)/privacy/` and any future direct (authed) children, renders within the (authed) layout's chrome (which for FE-2 is no shell — the `(authed)` layout itself doesn't mount the shell; the shell mounts inside `(testee)` and `(admin)`).
- `frontend/src/app/(testee)/error.tsx`, `frontend/src/app/(admin)/error.tsx` — in-shell posture: Rail + TopBar remain, only the page content swaps to the BoundaryFrame.

> **Posture (per §H decision 5):** in-shell when route group is `(authed)`/`(testee)`/`(admin)`; full-page at root and inside `(auth)` (FE-1's existing `(auth)/error.tsx` per FE-1-auth.md §C.6 stays full-page).

**2. Components / exports / deps**

- Scaffold reused: `BoundaryFrame` from §B.15.
- New: the four `error.tsx` files. Per Next.js App Router convention, each receives `{ error, reset }` props.

**3. API endpoints consumed**

- n/a (error display is local; no fetch).

**4. Props / token contract / styling contract**

- Each `error.tsx` calls `<BoundaryFrame ...>` with copy per prototype:
  - Eyebrow: "SOMETHING WENT WRONG"
  - Title: "We hit <span class='serif-it'>a snag</span>"
  - Body: "The issue has been logged. Try again, or contact support if it persists."
  - Glyph: `<Icon name="wave" size={26} />`
  - Actions: "Try again →" (primary, calls `reset()`), "Contact support" (mailto stub for v1; v1.x wires the real support channel)
  - Footer: expandable `+ show details` / `— hide details` revealing `error.code` (if `ApiError`) + `error.traceId` (per FE-1 spec §C.6 — Pattern C's traceId is populated by `unwrap()` from `x-acumen-trace` response header)

Per AC-CD20, each route-group error boundary "surfaces the AC-CD6 error envelope through a toast" — but for FE-2 the visible surface is the full-card BoundaryFrame (Pattern C); the toast is for mutation errors (Pattern B) handled separately in FE-1's `applyApiErrorToForm`. The two are not in conflict; FE-2 ships Pattern C for the route-scope `error.tsx`.

**5. States / variants**

| State | Trigger | Visual |
|---|---|---|
| `collapsed` | Default | Glyph + eyebrow + title + body + actions; footer shows "+ show details" toggle |
| `expanded` | Toggle clicked | Footer reveals code + trace ID in a `--bg-sunk` block, mono font |
| `try-again-pending` | "Try again →" clicked, async reset in flight | Button briefly disabled |

**6. Acceptance criteria (Gherkin)**

```
Scenario: error.tsx renders when a route throws
  Given a (testee) page throws during render
  When the (testee)/error.tsx boundary catches
  Then the BoundaryFrame renders inside the shell (Rail + TopBar still visible)
  And the eyebrow reads "SOMETHING WENT WRONG"

Scenario: error.tsx footer reveals trace ID
  Given the BoundaryFrame is collapsed
  When the user clicks "+ show details"
  Then the footer reveals error.code and error.traceId (if ApiError)

Scenario: Try again resets the boundary
  Given the BoundaryFrame is mounted with a non-null error
  When the user clicks "Try again →"
  Then reset() is invoked

Scenario: Root error.tsx renders full-page
  Given an error fires at the root layout
  Then the BoundaryFrame renders with no shell chrome
  (Codifies §H decision 5 posture.)
```

**7. Edge cases / gotchas**

- Per FE-1 spec §C.6 + §H bucket (c) resolution 5, `ApiError` carries an optional `traceId: string | null` populated from the `x-acumen-trace` response header. FE-2's `error.tsx` reads `error.traceId` when `error instanceof ApiError`; for non-`ApiError` throwables, the footer omits the trace ID line.
- The "Contact support" action is a placeholder for v1 — see §E.

**8. Visual reference:** `prototype/boundaries.jsx` (`ServerError`) · `v6-fe2-08-boundaries.png`.

---

### B.17 403 (refines FE-1 placeholder)

**1. File path + scope**

- `frontend/src/app/403/page.tsx` — refined version of FE-1's placeholder. Full-page posture (the 403 is a navigation destination, not a route-error boundary).

**2. Components / exports / deps**

- Scaffold reused: `BoundaryFrame` from §B.15.

**3. API endpoints consumed**

- n/a (the redirect to `/403` is fired by the role-mismatch guard in `(testee)`/`(admin)` layouts).

**4. Props / token contract / styling contract**

- BoundaryFrame copy per prototype:
  - Eyebrow: "NO ACCESS"
  - Title: "This area is <span class='serif-it'>for administrators</span>" (variant per current role — if a testee hits an admin route, the title says "administrators"; if an admin hits a testee-only route in some future world, the title says "testees"; for v1 the only realistic path is testee → admin so the static "administrators" copy ships)
  - Body: "Your account doesn't have access. Ask an admin if you need elevated permissions."
  - Glyph: `<Icon name="lock" size={24} />`
  - Actions: "Go to dashboard →" (primary, routes to `/`)
  - Footer: `route · {request URL} · required role · admin` (mono small)

**5. States / variants**

- Single variant. The "required role" text in the footer is parameterised on the role the route required (read from query string or context — for FE-2 it's static "admin", since only the (admin) routes can 403 a testee in v1; future role expansion may pass `?required=admin` to the redirect).

**6. Acceptance criteria (Gherkin)**

```
Scenario: Testee redirected to /403 from an admin route
  Given user { role: "testee" }
  When the user navigates to /ops
  Then the (admin) layout redirects to /403
  And the 403 page renders with the BoundaryFrame
  And the "Go to dashboard →" action routes to /
```

**7. Edge cases / gotchas**

- FE-1's `/403/page.tsx` placeholder is replaced wholesale. The Vitest test for the FE-1 placeholder (if any) is updated to the FE-2 copy.

**8. Visual reference:** `prototype/boundaries.jsx` (`Forbidden`) · `v6-fe2-08-boundaries.png`.

---

### B.18 Loading skeletons (per route group)

**1. File path + scope**

- `frontend/src/app/(authed)/loading.tsx`, `frontend/src/app/(testee)/loading.tsx`, `frontend/src/app/(admin)/loading.tsx`. Per AC-CD20, "suspense skeleton matching the route's primary layout".

> **Posture (per §H decision 5):** in-shell for `(testee)`/`(admin)` loading — Rail + TopBar are persistent skeleton chrome, page content area shimmers. The `(authed)` loading is full-page since `(authed)` itself does not mount the shell.

**2. Components / exports / deps**

- Scaffold reused: `Rail`, `TopBar` (mounted as skeletons for (testee)/(admin)), shadcn `Skeleton` from §B.11.

**3. API endpoints consumed**

- n/a.

**4. Props / token contract / styling contract**

- `(testee)/loading.tsx` and `(admin)/loading.tsx`: render Rail (with its real nav, since nav doesn't depend on async data) + TopBar (skeleton avatar circle if auth still loading) + a placeholder skeleton for the main content per the prototype's `RouteSkeleton`:
  - PageHeader skeleton (eyebrow + h-1 + subtitle shimmer lines)
  - 4-stat grid skeleton (4 cols, each with stat-big + label + hint shimmer)
  - 2-column main skeleton (7 cols + 5 cols split)
  - Bottom "Loading" text with pulse-dot
- `(authed)/loading.tsx`: simpler — centered "Loading" with pulse-dot; no shell.

Token bindings: `--bg-raised` (skel base), `--line` (skel border), `--bg-sunk` (shimmer-end). The shimmer animation uses a linear-gradient 90deg over 1.4s per prototype.

**5. States / variants**

- One variant per file (testee skeleton / admin skeleton / authed skeleton).

**6. Acceptance criteria (Gherkin)**

```
Scenario: Testee loading.tsx renders in-shell
  Given navigation to a (testee) route is suspended
  When loading.tsx mounts
  Then Rail and TopBar are visible
  And the content area renders skeleton shimmer blocks

Scenario: Authed loading.tsx renders full-page
  Given navigation to /privacy is suspended
  When (authed)/loading.tsx mounts
  Then no Rail / TopBar render
  And a centered "Loading" with pulse-dot renders
```

**7. Edge cases / gotchas**

- Skeleton chrome should not block real content rendering once data resolves — keep the file lean (no animations heavier than the gradient shimmer).
- The Rail's `activeRoute` during loading is unknown; pass `activeRoute=""` to render no active item (or pass the route from `usePathname()`).

**8. Visual reference:** `prototype/boundaries.jsx` (`RouteSkeleton`) · `v6-fe2-08-boundaries.png`.

---

## C. Cross-page concerns

### C.1 Shared components (introduced this PR)

| Component | Purpose | Source-of-truth design lines |
|---|---|---|
| `Rail` | Role-aware sidebar nav | `prototype/shell.jsx` (Rail) |
| `TopBar` | Crumb + search-stub + avatar + theme toggle | `prototype/shell.jsx` (TopBar) + `prototype/avatar-menu.jsx` |
| `AvatarMenu` | Avatar dropdown with logout (replaces FE-1 stub) | `prototype/avatar-menu.jsx` |
| `ThemeToggle` | Paper ↔ carbon toggle, `localStorage`-persisted | derived; sun/moon icons |
| `PageHeader` | Eyebrow + h-1 + subtitle + actions slot | `prototype/shell.jsx` (PageHeader) |
| `Stat` | Large value + label + hint | `prototype/shell.jsx` (Stat) |
| `BandTag` | Band-coloured badge with optional estimate/confidence | `prototype/shell.jsx` (BandTag) |
| `BandPips` | Standalone pip row for compact band display | `prototype/shell.jsx` (BandPips) |
| `Pill` | Generic chip primitive (tone × mono variants) | `prototype/shell.jsx` (Pill / `.chip` class) |
| `Icon` | Single-component, `name`-prop icon set | `prototype/icons.jsx` |
| `Figure` / `InlineFigure` / `ChoiceFigure` | Typed image-shells, render null in v1 | `prototype/figure.jsx` (AC-CD24) |
| `BoundaryFrame` | Shared layout for 404 / 500 / 403 cards | `prototype/boundaries.jsx` |
| shadcn `Button`, `Card`, `Input`, `Select`, `Dialog`, `DropdownMenu`, `Tabs`, `Toast`, `Skeleton` | Generic UI primitives | shadcn-ui registry |

FE-1's `components/auth/*` (`AuthShell`, `AuthLogo`, `AuthCard`, `AuthCardTitle`, `AuthField`, `AuthNotice`, `SubmitButton`, `BackLink`, `PasswordRulesChecklist`, `TokenErrorCard`) stay in `components/auth/` per §H bucket (c) decision 14. They are composed auth widgets, not raw primitives; `components/ui/` is shadcn-source-copy only per AC-CD23.

### C.2 Theme bootstrap + persistence

Per §H decision 4 (scope expansion: carbon is v1). The flow:

1. **Server-render default.** `app/layout.tsx` sets `<html data-theme="paper">` server-side. Default theme for any first-visit, unauthenticated, or `localStorage`-cleared user.

2. **FOUC-prevention inline script.** A tiny synchronous `<script>` in `<head>` runs before React hydrates:

   ```html
   <script>
     (function () {
       try {
         var t = localStorage.getItem("acumen.theme");
         if (t === "carbon" || t === "paper") {
           document.documentElement.setAttribute("data-theme", t);
         }
       } catch (e) {}
     })();
   </script>
   ```

   The script is sub-300 bytes, runs synchronously, mutates `data-theme` to the user's stored preference if present. The `try`/`catch` is necessary because `localStorage` may throw in some browsers (private-browsing modes, third-party-storage restrictions).

3. **Toggle interaction (post-hydration).** `<ThemeToggle>` (§B.3) sets `data-theme` and writes `localStorage.acumen.theme` synchronously on click. The button is the single user-facing affordance — no other code mutates `data-theme` or `localStorage.acumen.theme`.

4. **Steel theme not supported.** `localStorage.acumen.theme === "steel"` is treated as invalid by the inline script (the `t === "carbon" || t === "paper"` check filters); the attribute falls back to the server-set default. Per §H decision 4, no path produces `"steel"` in v1 because the prototype's steel block is stripped during port.

### C.3 Token discipline (AC-CD23) enforcement

The Vitest test `frontend/src/lib/discipline/no-hex.test.ts` (§D.4) greps `frontend/src/` for literal hex values and arbitrary-value Tailwind brackets in component / app code:

- Forbidden: `/#[0-9a-fA-F]{3,8}\b/` inside `**/*.tsx` and `**/*.ts` under `frontend/src/components/` and `frontend/src/app/`.
- Forbidden: `className=` attributes that contain `\[#`, e.g., `className="bg-[#fafafa]"`.
- Allowed: hex values inside `frontend/src/app/globals.css` (the single source of token truth).

PR review enforces this discipline beyond the test as well; the test catches the regressions, not every case.

### C.4 Route-group composition (the layout tree)

> **Build-session amendment (Slice 4):** the spec authoring placed
> `(testee)/` and `(admin)/` as *siblings* of `(authed)/`. The build
> session shipped them as *nested* children of `(authed)/` per user
> directive — `(authed)/layout.tsx` keeps the auth + privacy gate at the
> outer layer; `(authed)/(testee)/layout.tsx` and
> `(authed)/(admin)/layout.tsx` add the role gate and mount the shell
> chrome. The nested form avoids re-evaluating the (authed) posture
> inside the role layouts. The privacy page also moved out of
> `(authed)/` in the FE-1 build (it lives at `app/privacy/` with its own
> `Gate posture="privacy"`) to break the recursive-redirect trap that
> would occur if `/privacy` were inside `(authed)/`. The layout tree
> below reflects the as-shipped form.

```
app/
  layout.tsx                       # FE-1 BUILD: AuthProvider + QueryClient + Toaster
                                   # FE-2 add: data-theme="paper" on <html> + inline FOUC <script>
                                   #          + next/font/google variables
  not-found.tsx                    # FE-2 (B.15) — full-page 404
  error.tsx                        # FE-2 (B.16 root variant) — full-page 500
  403/page.tsx                     # FE-2 (B.17) — refined from FE-1 placeholder
  (auth)/
    layout.tsx                     # FE-1 — auth-group guard
    error.tsx                      # FE-1 (existing) — full-page (auth) error
    login/page.tsx                 # FE-1
    forgot/page.tsx                # FE-1
    reset/[token]/page.tsx         # FE-1
    setup/[token]/page.tsx         # FE-1
  privacy/                         # FE-1 — root-level (NOT inside (authed))
    layout.tsx                     #   to avoid the recursive-redirect trap
    page.tsx
  (authed)/
    layout.tsx                     # FE-1 — auth gate + privacy gate
    error.tsx                      # FE-2 (B.16 (authed) variant) — full-page (no shell)
    loading.tsx                    # FE-2 (B.18 (authed) variant) — centered pulse-dot
    (testee)/
      layout.tsx                   # FE-2 (B.13) — role gate + shell mount
      error.tsx                    # FE-2 (B.16 (testee) variant) — in-shell
      loading.tsx                  # FE-2 (B.18 (testee) variant) — in-shell skeleton
      page.tsx                     # FE-2 (B.13) — empty dashboard at /
    (admin)/
      layout.tsx                   # FE-2 (B.14) — role gate + shell mount
      error.tsx                    # FE-2 (B.16 (admin) variant) — in-shell
      loading.tsx                  # FE-2 (B.18 (admin) variant) — in-shell skeleton
      ops/page.tsx                 # FE-2 (B.14) — empty ops at /ops
```

### C.5 Toast surfaces (sonner + shadcn coexistence)

Per FE-1 spec §C.3, sonner is mounted in `app/layout.tsx` as the project's default toast surface (Pattern B for form-error overflow). FE-2's shadcn install includes a `toast` primitive — but FE-2 does NOT switch the project off sonner. The shadcn `toast` is available for any future feature that hard-depends on it (rare, since sonner covers the use cases), but the project default and AC-CD21's referenced toast surface stays sonner. Document this coexistence so future contributors don't migrate one to the other without cause.

### C.6 Inter-phase dependencies

- **FE-1 → FE-2:** FE-2's TopBar reads `useAuth().user.name` and `.role`; the role-gated layouts depend on FE-1's `lib/auth/guards.ts` functions; the `/privacy` page lives in `(authed)/privacy/` per the FE-1 spec amendment (§H bucket (a) blocker #2); the `app/layout.tsx` providers (AuthProvider, QueryClientProvider, Toaster) are mounted by FE-1's BUILD before FE-2's BUILD opens. FE-2 BUILD opens after FE-1 BUILD merges.
- **FE-2 → FE-3..FE-9:** every primitive's contract locks here. Renames or contract churn after FE-2 propagate to every consuming PR. FE-3 catalogue first exercises BandTag / Pill / Stat at scale; FE-7 profile first exercises BandTag confidence rendering; FE-9 ops first exercises the (admin) shell beyond the empty page.
- **FE-2 ↔ FE-4:** Figure / InlineFigure / ChoiceFigure type-stubs lock here; FE-4 question-component props consume them. AC-CD24 v1.x add-path lights up the body when image rendering is wired.

### C.7 Avatar-menu UI replaces FE-1's stub

FE-1 spec §B.6 lists "Logout flow (action wiring only — UI is FE-2)". FE-2 ships the actual avatar-menu UI (`AvatarMenu.tsx`) consuming FE-1's `logout()`. The FE-1 BUILD does NOT ship dropdown UI; the FE-2 BUILD does. Document this hand-off explicitly so the FE-1 build session doesn't accidentally also build the dropdown.

---

## D. Test cases (Vitest)

Vitest config aliases `@` → `/src` (FE-0). RTL installed (FE-0 or FE-1). MSW installed by FE-1 BUILD per FE-1-auth.md §D — FE-2 reuses it for the round-trip test.

### D.1 Unit tests — primitives

- `frontend/src/components/primitives/Stat.test.tsx` — renders value/label/hint; accent tone variant; missing-hint variant.
- `frontend/src/components/primitives/BandTag.test.tsx` — all 5 bands render correct label and bg token; estimate appends `(6.7)`; confidence appends qualifier; pips variant renders correct count; pips-only (labelless) variant.
- `frontend/src/components/primitives/BandPips.test.tsx` — pip count matches band level (1..5); filled pips use `--band-{band}` colour; remainder outlined.
- `frontend/src/components/primitives/Pill.test.tsx` — all 6 tones bind correct token pair; mono variant uses mono font.
- `frontend/src/components/primitives/Icon.test.tsx` — every name in the union renders an `<svg>`; size and strokeWidth applied; passthrough props forwarded.
- `frontend/src/components/primitives/figure.test.tsx` — all three exports return `null` when `url` is null; type assertion that prop shapes accept the API-generated types without widening (compile-time check via `expectTypeOf`).
- `frontend/src/components/shell/Rail.test.tsx` — testee role renders testee nav; admin role renders admin nav; active-route highlights the right item; badge count > 0 renders chip, count 0 hides chip.
- `frontend/src/components/shell/TopBar.test.tsx` — renders user initial; renders role-appropriate search-stub placeholder; does NOT render role-switch control; opens avatar dropdown on click; "Sign out" calls `logout()` and routes to `/login`; theme toggle round-trips paper ↔ carbon and writes localStorage; no "View as testee" item present.
- `frontend/src/components/shell/PageHeader.test.tsx` — all four slots render when provided; eyebrow / subtitle / actions omitted when prop absent.
- `frontend/src/components/shell/ThemeToggle.test.tsx` — sun icon when paper, moon when carbon; click flips `data-theme` and writes `localStorage`.
- `frontend/src/components/shell/BoundaryFrame.test.tsx` — renders all five slots; footer toggle expands/collapses; respects glyph / title / actions composition.

### D.2 Layout + boundary integration tests

- `frontend/src/app/(authed)/layout.test.tsx` — unauthenticated → redirect; privacy-unacked + route ≠ `/privacy` → redirect to `/privacy`; privacy-unacked + route === `/privacy` → render children; acked → render children; loading → render `loading.tsx`.
- `frontend/src/app/(testee)/layout.test.tsx` — role testee renders shell + children; role admin redirects to `/403`; composes (authed) checks correctly.
- `frontend/src/app/(admin)/layout.test.tsx` — symmetric.
- `frontend/src/app/(testee)/page.test.tsx` — empty dashboard renders "Welcome, {name}" and subtitle.
- `frontend/src/app/(admin)/ops/page.test.tsx` — empty ops renders "Operations" header.
- `frontend/src/app/not-found.test.tsx` — renders full-page; "Go to dashboard →" routes to `/`.
- `frontend/src/app/error.test.tsx` — renders full-page on root error; "Try again →" calls reset.
- `frontend/src/app/(testee)/error.test.tsx` — renders in-shell (Rail + TopBar still present).
- `frontend/src/app/(admin)/error.test.tsx` — symmetric.
- `frontend/src/app/(testee)/loading.test.tsx` — renders in-shell skeleton (Rail + TopBar).
- `frontend/src/app/(admin)/loading.test.tsx` — symmetric.
- `frontend/src/app/(authed)/loading.test.tsx` — renders full-page (no shell).
- `frontend/src/app/403/page.test.tsx` — renders BoundaryFrame with admin-required copy; "Go to dashboard →" routes to `/`.

### D.3 Round-trip integration test

`frontend/tests/integration/shell-roundtrip.test.tsx`:

> Mount app at `/login` → submit testee credentials → land on `/` rendered inside (testee) shell (Rail + TopBar visible, "Dashboard" active in Rail, user initial in TopBar) → click avatar → click "Sign out" → land on `/login`. Single test, exercises FE-1's login flow + FE-2's shell + avatar-menu logout.

Companion: same flow with admin credentials → lands on `/ops` inside (admin) shell.

### D.4 Token discipline test

`frontend/src/lib/discipline/no-hex.test.ts`:

- Walks `frontend/src/components/` and `frontend/src/app/` for `.ts` / `.tsx`.
- For each file, fails if `/#[0-9a-fA-F]{3,8}\b/` matches (literal hex).
- For each file, fails if `className=` attributes contain `\[#` (arbitrary-value Tailwind brackets with hex).
- Excludes `frontend/src/app/globals.css` (the single source of token truth — but `.css` is excluded by extension anyway).
- Excludes `frontend/src/components/ui/` shadcn-source-copy files if shadcn-generated source contains literal hex (override discipline for vendor-managed code; document the exception inline in the test file).

### D.5 Theme toggle integration test

`frontend/tests/integration/theme.test.tsx`:

- First-visit: no `localStorage.acumen.theme` → `<html data-theme="paper">`.
- Toggle click: flips to `carbon`, writes `localStorage`.
- Second-visit (simulated by re-mount + pre-set localStorage): `<html data-theme="carbon">` before hydration (asserts the inline FOUC script behaviour).
- Invalid stored value (`localStorage.acumen.theme = "steel"`): inline script ignores; `<html data-theme="paper">`.

### D.6 Existing tests preserved + coverage gate

- FE-0 / FE-1 tests pass unchanged.
- `pnpm test --run` clean.
- `pnpm typecheck` clean.
- `pnpm lint` clean.
- `pnpm build` succeeds.

---

## E. Known placeholders (DO NOT SHIP AS-IS)

| # | Placeholder | Location | Action before production |
|---|---|---|---|
| 1 | Empty testee dashboard body | `app/(testee)/page.tsx` | FE-3 replaces with real dashboard. Empty-state copy "You have no assignments yet" is fine for FE-2 done-when. Not a blocker. Tag with `// TODO(FE-3): real dashboard content`. |
| 2 | Empty admin ops page body | `app/(admin)/ops/page.tsx` | FE-9 replaces with admin ops surfaces. Empty placeholder copy fine. Not a blocker. Tag with `// TODO(FE-9): real ops content`. |
| 3 | "Contact support" mailto stub in 500 boundary | `app/error.tsx` and per-group `error.tsx` files | v1.x wires the real support channel (mailto or in-app). Not a blocker for v1. Tag with `// TODO(v1.x): wire real support channel`. |
| 4 | Search-stub no-op in TopBar | `components/shell/TopBar.tsx` | Future v1.x phase wires a real palette. Not a blocker. Tag with `// TODO(v1.x): wire search palette`. |
| 5 | Rail badge counts hard-coded to 0 | `components/shell/Rail.tsx` (nav arrays) | Real counts wire in FE-4 (in-progress attempts), FE-6 (review queue), FE-9 (engagement). Not a blocker. |

---

## F. Scope additions beyond `fe-specs/FE-2-shell.md`

Two additional doc / scaffold changes land alongside the FE-2 spec PR — both small, both surfaced explicitly.

### F.1 `FE_ROADMAP.md` — tweaks-panel non-goal

Append to the existing "Non-goals (v1 frontend)" section (FE-1 spec §F.1 created it):

> - Tweaks panel (`frontend/design-reference/prototype/tweaks-panel.jsx`) is design-reference-only — a dev affordance for theme- and role-switching during prototype exploration. Not ported to production frontend; the prototype's TopBar `role` / `onRole` segmented control is similarly dev-only. Theme switching is exposed to users via the TopBar paper-↔-carbon toggle (FE-2 §B.3); role switching is not exposed at all in v1 (single-role-per-user per AC-CD20).

Clarifies that a future PR cannot quietly port `tweaks-panel.jsx` thinking it was an oversight.

### F.2 `app/layout.tsx` — dynamic `data-theme` on `<html>` + FOUC script

Per §H decision 4 + §C.2: the root `layout.tsx` is amended to (a) set `data-theme="paper"` on the server-rendered `<html>`, and (b) inline a tiny synchronous `<script>` in `<head>` that reads `localStorage.acumen.theme` and applies it before React hydrates. Both are AC-CD23-mandated post-amendment; both are small structural additions that fold into the FE-2 BUILD handover under the SESSION_START.md AC-CD-level structural-additions carve-out. The wording is "dynamic, not static" — the attribute reflects the user's stored preference, not a hard-coded value.

---

## G. Session 3 onwards — template propagation to FE-3..FE-9

The structure (Context → A inventory → B per-page-or-per-capability 8-section template → C cross-page → D tests → E placeholders → F scope-bleed → G template propagation → H drift roll-up) is the template for every subsequent FE-N detail spec. FE-2 introduces ONE allowed variance to FE-1:

### Allowed variance: per-capability §B for primitive-heavy phases

FE-1 used per-page §B because every FE-1 capability was a content page. FE-2's capabilities are mixed — six are pages (the four boundaries + two empty placeholders) and twelve are primitives or scaffolding. Per-capability §B (with the adapted 8-section sub-template documented at the head of §B) is the correct form for primitive-heavy phases. The variance MUST BE DECLARED IN THE SPEC HEADER ("One declared variance: …") and the adapted sub-template MUST appear at the head of §B — silent introduction is itself spec drift. Future primitive-heavy phases (none expected after FE-2; FE-3..FE-9 are page-heavy) may invoke the same variance with a header declaration.

### Continued from FE-1 §G (unchanged):

- Skipping Gherkin acceptance criteria — not allowed.
- Skipping drift-watch / verification / blocker callouts — not allowed. No callouts means either the cross-walk was incomplete or the spec is genuinely clean; declare which.
- Folding test list into per-capability sections — not allowed. Tests live in §D for scannability and coverage-counting.

### Design-reference completeness check (per SESSION_START.md)

Run for FE-2 as part of this spec authoring. The FE-2 design surface comprises:

- Tokens: `prototype/styles.css` (full file, all three theme blocks present — steel intentionally stripped during port).
- Shell: `prototype/shell.jsx` (Rail, TopBar, PageHeader, Stat, BandTag, BandPips, Pill — all present).
- Boundaries: `prototype/boundaries.jsx` (404, 500, 403, route skeleton — all present).
- Avatar menu: `prototype/avatar-menu.jsx` + `v6-fe1-06-avatar-menu.png` (closed / open / logging-out variants — all present).
- Image stubs: `prototype/figure.jsx` (Figure / InlineFigure / ChoiceFigure — all present).
- Icons: `prototype/icons.jsx` (full set — all present). `sun` / `moon` added at FE-2 build time for the theme toggle if not in prototype.
- Tweaks panel: `prototype/tweaks-panel.jsx` (read once to confirm non-port per §F.1).

Result: **clean.** No FE-2 surface that SPEC / DECISIONS / CODE_SPEC names is missing a mock. The theme toggle's sun/moon icons are an FE-2 addition not present in the prototype mock set — surfaced explicitly in §B.9 build-session verification.

---

## H. Spec-drift roll-up (post-review classification)

The cross-walk surfaced 17 candidate items. After user review and locked decisions (this session), they classify into three buckets.

### (a) BLOCKERS for the FE-2 build session — must land before the build session opens

Two open blockers — both require user-authored amendment PRs before the FE-2 BUILD session opens. The FE-2 SPEC PR (this PR) ships with both visible per the FE-1 precedent (where the SPEC PR shipped with one open blocker that gated the BUILD).

1. **AC-CD23 amendment PR — token naming convention + theme-scope expansion (user-authored, pending).** AC-CD23 currently names tokens as `--color-XXX` (Tailwind v4 `@theme` convention); `prototype/styles.css` uses bare names (`--ink`, `--bg`, `--band-novice/junior/working/advanced/expert`). Per §H decision 1, the AC-CD23 amendment PR will (a) re-anchor token names to the prototype's bare form, with `--color-*` aliases exposed through `@theme` for Tailwind utility generation, and (b) fold in the v1 theme scope expansion: paper + carbon both v1; steel dropped from all scopes (not v1.x either). The FE-2 spec body above cites the post-amendment AC-CD23 form. FE-2 BUILD opens after the amendment merges.

2. **FE-1 spec amendment PR — `/privacy` route-group relocation (user-authored, pending).** `fe-specs/FE-1-auth.md` §C.4 places `/privacy` in `(auth)/`. AC-CD20 (CODE_SPEC.md lines 953–958) places `/privacy` in `(authed)/`. Per §H decision 2, AC-CD20 wins; the FE-1 spec amendment relocates `/privacy` from `(auth)/privacy/page.tsx` to `(authed)/privacy/page.tsx`. The FE-2 spec body above assumes the post-amendment placement (§C.4 layout tree). FE-1 BUILD opens after the amendment merges; FE-2 BUILD opens after FE-1 BUILD merges.

### (b) BUILD-SESSION VERIFICATION TASKS — front-loaded at the start of the FE-2 build session

Five tasks. The build session opens with a single verification block before any code lands; if any check fails, halt and surface for a spec-clarification PR.

3. **shadcn/ui Tailwind v4 install path** (FE_ROADMAP-named risk). Run `pnpm dlx shadcn@latest add button` in a throwaway branch; verify the generated source is Tailwind v4 compatible (no v3-only utilities, no arbitrary-value brackets bypassing `@theme`). If compatible, proceed with the full install. If not, halt.

4. **`UserResponse` shape verification.** TopBar reads `useAuth().user.name` (string) and `user.role` (singular: `"testee" | "admin"`). Verify against `frontend/openapi/schema.json` that `UserResponse` exposes both fields with the expected types. If divergent, halt.

5. **`prototype/avatar-menu.jsx` content audit.** §H decision 3 locked the avatar dropdown to logout-only (no role-switch / "View as testee"). Read the prototype to confirm the items list; if the prototype shows additional items intended for v1, surface them for scope reconciliation. If the prototype is consistent with logout-only, proceed.

6. **`prototype/figure.jsx` prop shape verification.** AC-CD24 mandates that question-component props accept the image fields without TypeScript widening or `as` casts. The FE-2 spec locks `<Figure>` / `<InlineFigure>` / `<ChoiceFigure>` prop shapes per §B.10. Read the prototype to confirm the shapes match; if divergent, surface for resolution before FE-4 inherits the contract.

7. **Hard-corner discipline through shadcn install.** Prototype `--r-1..4 = 0`. The `@theme` aliases set `--radius-1..4 = 0` (§B.1). Confirm at build time that shadcn-generated primitives respect the zero-radius — either via the `--radius-*` overrides or by scrubbing `rounded-*` classes from generated source. Visual smoke-check on Button / Card / Input / Dialog.

### (c) APPROVED RESOLUTIONS — folded into the FE-2 build PR scope, captured in the build PR's handover

Eight items. Not blockers; the spec body resolves; the build session implements; the build PR's handover records them under the SESSION_START.md AC-CD-level structural-additions carve-out.

8. **`data-theme` dynamic on `<html>`** — small server-set attribute + tiny inline FOUC `<script>` in `<head>` per §C.2 / §F.2.
9. **Tweaks panel explicit non-goal in FE_ROADMAP** (§F.1).
10. **Token-discipline Vitest test** (§D.4) — small new test file enforcing AC-CD23 (no literal hex / arbitrary-value brackets in `src/components/` or `src/app/`).
11. **FE-1's `components/auth/*` left in place.** AuthField / AuthNotice / etc. are composed auth widgets; `components/ui/` is shadcn-source-copy only per AC-CD23.
12. **Typography classes ported verbatim into `globals.css`** (per §B.1 prose: `.serif`, `.serif-it`, `.mono`, `.eyebrow`, `.h-display`, `.h-1..4`, `.t-meta`, `.t-fig`). The class-driven discipline is explicit (`.serif-it` intentionally not italic).
13. **`onRole` prop NOT present on FE-2's production `TopBar`** (§B.3 + §H decision 3). The prototype's `role`/`onRole` dev affordance is not ported; production TopBar reads role from `useAuth().user.role`. The avatar dropdown carries logout only — no "View as testee" / role-switch affordance ships in FE-2. A v1.x feature may add the affordance if pilot feedback warrants.
14. **`@tanstack/react-query` + `<Toaster />` mounting precondition.** Both are pre-folded into FE-1's BUILD per FE-1-auth.md §C.3 (AC-CD-structural carve-out). FE-2's BUILD assumes both are mounted by the time it opens. If FE-2 BUILD opens against an FE-1 BUILD that did not mount them, FE-2 BUILD halts and surfaces.
15. **Theme toggle as a TopBar control beside the avatar (not inside the dropdown)** (§B.3 + §H decision 4). Small icon button; reads `data-theme` from `<html>`; writes `localStorage.acumen.theme`. Bootstrap via the FOUC script (§C.2).

---

*End of FE-2-shell.md. Template propagates to FE-3..FE-9 per §G; deviations surface as spec drift. The per-capability §B variance declared in the header is a precedent for any future primitive-heavy phase (none expected after FE-2).*
