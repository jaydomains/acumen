/**
 * URL-state ↔ filter-state helpers for the catalogue page
 * (FE-3 §B.2, §C.7).
 *
 * The URL is the source of truth for catalogue filters
 * (`/catalogue?search=&subject=&difficulty=`). On first render the
 * page reads searchParams synchronously and seeds local state — never
 * in a `useEffect`, which would flash an empty filter bar before
 * hydration catches up.
 *
 * Pure functions, no React imports, so they're trivially unit-testable
 * and reusable from server-side prefetch code if we ever add it.
 *
 * NOTE: the URL parameter `subject` corresponds to the API param
 * `subject_id` — the URL is short-form, the API is canonical.
 */

export type CatalogueFilterState = {
  search?: string;
  subject_id?: string;
  difficulty?: number;
};

type ReadOnlySearchParams = Pick<URLSearchParams, "get">;

export function parseFilterState(
  searchParams: ReadOnlySearchParams,
): CatalogueFilterState {
  const state: CatalogueFilterState = {};

  const search = searchParams.get("search")?.trim();
  if (search) state.search = search;

  const subject = searchParams.get("subject")?.trim();
  if (subject) state.subject_id = subject;

  const difficultyRaw = searchParams.get("difficulty");
  if (difficultyRaw) {
    const d = Number.parseInt(difficultyRaw, 10);
    if (Number.isFinite(d) && d >= 1 && d <= 10) state.difficulty = d;
  }

  return state;
}

/**
 * Build a `?…` query string from a filter state, suitable for
 * `router.replace`. Empty/undefined fields are omitted so the URL
 * stays clean ("/catalogue" not "/catalogue?search=&subject=").
 *
 * Returns an empty string when no filters are active so callers can
 * `router.replace(\`/catalogue${qs}\`)` without conditional logic.
 */
export function serializeFilterState(state: CatalogueFilterState): string {
  const params = new URLSearchParams();
  if (state.search) params.set("search", state.search);
  if (state.subject_id) params.set("subject", state.subject_id);
  if (typeof state.difficulty === "number") {
    params.set("difficulty", String(state.difficulty));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function isFilterStateEmpty(state: CatalogueFilterState): boolean {
  return !state.search && !state.subject_id && typeof state.difficulty !== "number";
}
