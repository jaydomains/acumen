/**
 * Me-domain query keys (FE-3 §B.5; AC-CD21).
 *
 * Keys land in Slice 1 to lock the convention; hooks land alongside
 * the dashboard in Slice 3. Many `/v1/me/*` endpoints are unmounted
 * or absent in v1 (see FE-3 §E placeholders) — dashboard widgets
 * render v1.x-pending placeholders WITHOUT constructing the query,
 * satisfying the spec Gherkin "no request fires".
 */

export const meQueryKeys = {
  all: ["me"] as const,
  competence: () => [...meQueryKeys.all, "competence"] as const,
  assignments: () => [...meQueryKeys.all, "assignments"] as const,
  attempts: () => [...meQueryKeys.all, "attempts"] as const,
};
