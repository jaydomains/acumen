# app/ai/prompts/ — versioned prompt registry (AC-CD8)

The seven AI operation prompts (SPEC §6) live here in version control,
**not** in the database. Each prompt file carries an embedded semantic
version; the version used for any AI call is persisted on the resulting
`grade` / `question` row for reproducibility (CODE_SPEC §7).

Empty in P0 — prompts are authored from P5 onward. This README + the
`.gitkeep` keep the directory tracked.
