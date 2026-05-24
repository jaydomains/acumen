# Frontend Design Reference

This directory holds design reference material for the Acumen frontend. The
files here are produced separately in Claude design tooling (Claude design
artifacts and Claude Code design sessions) and dropped in as raw material
for the real Next.js implementation.

## What lives here

Design artifacts that capture the intended look, feel, and interaction
patterns for Acumen frontend screens and flows. These are reference inputs,
not shipping code.

## How it's used

When building real Next.js pages starting in FE-1 and beyond, these
artifacts are the source-of-truth visual and interaction reference. The
implementation in `frontend/src/` should match the structure, layout, and
behavior captured here, adapted to the real API, real data shapes, and the
project's component conventions.

## File formats expected

Anything useful as reference is welcome:

- React / JSX components (not wired to the real API — illustrative only)
- Static HTML mockups
- Screenshots (PNG, JPG)
- Flow diagrams / wireframes
- Notes, annotations, or copy decks in Markdown

## Not production code

Nothing under `frontend/design-reference/` is imported by `frontend/src/`.
It is reference material only. Build tooling, type checks, and tests for
the real frontend should not depend on anything in this directory.

## Organization

Files are dropped into this directory flat. A follow-up session will
analyze what has been added, reorganize into sensible subdirectories, and
update this README to reflect the resulting structure.
