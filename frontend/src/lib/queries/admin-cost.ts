/**
 * Admin Cost query layer (FE-9 admin-systems §B.1 in
 * `fe-specs/FE-9-admin-systems.md:73–223`). Read-only — no mutations.
 *
 * The `/v1/admin/cost/summary` endpoint returns an inline `dict[str,
 * Any]` with no named Pydantic schema, so the generated OpenAPI type is
 * `Record<string, never>` (§H(b) item 10). Until the backend adds a
 * named response model, the field shape is locked here as
 * `CostSummaryResponse` and the response is cast to it.
 */

import { useQuery } from "@tanstack/react-query";
import { client, unwrap } from "@/lib/api/client";
import { adminKeys } from "@/lib/queries/admin-keys";

export type CostSummaryResponse = {
  since: string;
  year_month: string;
  total_usd: number;
  by_provider: Partial<Record<"anthropic" | "openai" | "stub" | "(unknown)", number>>;
  by_model: Record<string, number>;
  monthly_budget: number | null;
  percent_of_budget: number | null;
  alerts_fired_this_month: number[];
};

export function useCostSummary() {
  return useQuery({
    queryKey: adminKeys.cost.summary(),
    staleTime: 30_000,
    queryFn: async () =>
      // Cast through `unknown`: the wire type is an untyped inline dict
      // (§H(b) item 10) so there is no structural overlap to narrow.
      (await unwrap(
        client.GET("/v1/admin/cost/summary"),
      )) as unknown as CostSummaryResponse,
  });
}
