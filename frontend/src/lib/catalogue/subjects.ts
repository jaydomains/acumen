/**
 * Subject colour helper (FE-3 §C.4, §F.5).
 *
 * Static map keyed by `subject_id`, seeded from the prototype's
 * `window.SUBJECTS`. Components consume these as data — the colour
 * value reaches PillCard via inline `style={{ color: ... }}`, which
 * keeps the AC-CD23 no-hex-in-component rule satisfied (the literal
 * lives in this data file, not in a component).
 *
 * If `GET /v1/catalogue/subjects` lands later (FE-3 §H(b) item 5),
 * this map becomes the fallback colour source only — subject ids +
 * names will come from the API and we'll merge via `subject_id`.
 *
 * Unknown subject ids resolve to a neutral entry so the catalogue
 * still renders against any backend-issued id we haven't seen yet
 * (avoids `undefined` access in PillCard).
 */

export type SubjectMeta = {
  id: string;
  name: string;
  shortLabel: string;
  /** Hex literal — data, not component code. PillCard reads it via
   *  `style={{ color: meta.colour }}`. */
  colour: string;
};

const SUBJECT_FIXTURES: readonly SubjectMeta[] = [
  { id: "paint-qa", name: "Paint QA", shortLabel: "PAINT", colour: "#b8743a" },
  { id: "marine", name: "Marine Coatings", shortLabel: "MARINE", colour: "#3a5b8c" },
  { id: "nace", name: "NACE Prep", shortLabel: "NACE", colour: "#2f5d63" },
  { id: "qs", name: "Quantity Surveying", shortLabel: "QS", colour: "#6e8f5b" },
  {
    id: "safety",
    name: "Safety & Compliance",
    shortLabel: "SAFETY",
    colour: "#97352a",
  },
  { id: "pm", name: "Project Management", shortLabel: "PM", colour: "#5b5d6e" },
];

const SUBJECT_MAP: Record<string, SubjectMeta> = Object.fromEntries(
  SUBJECT_FIXTURES.map((s) => [s.id, s]),
);

const UNKNOWN_SUBJECT: SubjectMeta = {
  id: "unknown",
  name: "Subject",
  shortLabel: "SUBJECT",
  colour: "#5b5d6e",
};

export const SUBJECT_LIST: readonly SubjectMeta[] = SUBJECT_FIXTURES;

export function subjectById(id: string): SubjectMeta {
  return SUBJECT_MAP[id] ?? { ...UNKNOWN_SUBJECT, id };
}
