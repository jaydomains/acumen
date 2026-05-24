# Acumen design reference — prototype

Interactive React + Babel-standalone prototype for the Acumen design system.
Theme: `paper` only (carbon/steel exist as CSS but aren't v1 ship-targets).

## v6 mocks (post-v5 additions)

v6 fills the gaps surfaced by the design-reference audit. Files live alongside
the existing prototype at the project root.

**FE-1 — Auth surface  (session 1)** ✓
- `auth.jsx` — login / forgot / reset / setup / privacy (5 card pages, all states)
- `avatar-menu.jsx` — TopBar avatar dropdown (closed / open / logging-out)
- `error-patterns.jsx` — inline field error + toast + full-page boundary

Reach FE-1 mocks via Tweaks → **Role → unauth**. The auth-frame shows a sub-nav
at the top to jump between mocks; each mock has its own **STATE** strip below
the nav to walk through every state.

**FE-2 · FE-3 · FE-4 · FE-5 — Shell-internal mocks (session 2)** ✓
- `boundaries.jsx` — 404 / 500 / 403 / route-loading skeleton (FE-2 · #8)
- `pill-detail.jsx` — pill detail page (FE-3 · #9) + safety-pill curated-links variant (#10)
- `attempt-variants.jsx` — benchmark mode attempt screen (FE-4 · #11) + autosave indicator sheet (#12)
- `streaming-paused.jsx` — user-paused vs system-glitch overlays side-by-side (FE-5 · #13)

Reach these via Tweaks → **v6 Mock preview → {pick}**. Each mock has its
own STATE strip at the top. The sticky-bottom difficulty bar on the pill
viewer is left wired-up (clicking D1–D10 is real, the band tag updates).

**FE-6 — Results page additions (session 3)** ✓
- `results-additions.jsx` — review-pending vs complete stat-card (#14) + PDF export click-state UX (#15) + realism feedback summary card (#16)

**FE-9 — Admin operations (session 3)** ✓
- `admin-ops.jsx` — loop approve/reject actions + modals (#23) + engagement sweep header button with per-row Nudge/Reassign removed (#24) + consolidated /admin/system page (#25) + /admin/calibration page with resolve-anchor modal (#26)

Reach these via Tweaks → **v6 Mock preview → FE-6 / FE-9**. Each has its
own STATE strip at the top, plus a SUB-STATE strip inside each mock for
walking through the per-mock variants (e.g. row state → approve modal →
reject modal → submitting).

**FE-8 — Admin authoring (session 4, final)** ✓
- `admin-authoring.jsx` — pill CRUD + safety-override toggle (#17) · users CRUD + deactivate confirm (#18) · groups CRUD + membership picker + system-group immutability (#19) · learning-path authoring + drag-reorder (#21) · assignment authoring with multi-picker (#22)
- `admin-test-authoring.jsx` — test list page + create editor with mode-conditional middle sections + question sub-editor + state-conditional publish controls (#20). Modes covered: per_testee, frozen, hand_authored, benchmark. Question types: MCQ, T/F, matching, short-answer, scenario.

Reach FE-8 via Tweaks → **v6 Mock preview → FE-8 · Admin authoring (5 forms)** or **FE-8 · Test authoring (#20)**. Each has its own STATE strip plus a SUB-STATE strip inside each form for create / edit / submitting / validation / locked variants.

**All v6 work complete.** 23 mocks across 7 phases — FE-1 (7) · FE-2 (1) · FE-3 (2) · FE-4 (2) · FE-5 (1) · FE-6 (3) · FE-8 (6) · FE-9 (4). Total of 9 .jsx files added at the project root.

## Patterns deliberately NOT carried forward (v1 scope rule)

- Pill-proposal "Edit & approve" affordance — v1 is approve / reject only.
- Per-row Nudge / Reassign buttons on the engagement page — v1 is sweep-only.
- Carbon / Steel theme variants — v1 ships paper only.

## Screenshot naming convention

`screenshots/v6-fe{N}-{nn}-{descriptor}.png` — one canonical PNG per mock.
