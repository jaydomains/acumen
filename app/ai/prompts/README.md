# app/ai/prompts/ — versioned prompt registry (AC-CD8)

The AI operation prompts (SPEC §6) live here in version control,
**not** in the database (the canonical operation count is nine, v1.9;
built-state grows per slice — `pill_generation` lands at B1,
`content_self_review` at C1). Each prompt file carries an embedded semantic
version; the version used for any AI call is persisted on the resulting
`grade` / `question` row for reproducibility (CODE_SPEC §7).

Empty in P0 — prompts are authored from P5 onward. This README + the
`.gitkeep` keep the directory tracked.
