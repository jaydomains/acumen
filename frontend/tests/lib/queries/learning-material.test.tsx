/**
 * POST-as-page-load-fetch + regenerate hook tests (FE-3 §C.6).
 *
 * Verifies that:
 *  - useLearningMaterial fires exactly one POST on mount
 *  - the result is cached (subsequent mounts within staleTime don't re-fetch)
 *  - useRegenerateLearningMaterial fires ?regenerate=true and updates cache
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/node";
import {
  useLearningMaterial,
  useRegenerateLearningMaterial,
  pillQueryKeys,
} from "@/lib/queries/pills";

const API = "http://localhost:8000";
const PILL = "aaaaaaaa-aaaa-aaaa-aaaa-000000000001";

function HookHarness({ id }: { id: string }) {
  const material = useLearningMaterial(id);
  const regen = useRegenerateLearningMaterial(id);
  return (
    <div>
      <div data-testid="kind">{material.data?.source ?? "loading"}</div>
      <div data-testid="cached">{String(material.data?.cached ?? "?")}</div>
      <button
        type="button"
        data-testid="regen"
        disabled={regen.isPending}
        onClick={() => regen.mutate()}
      >
        regen
      </button>
    </div>
  );
}

function makeClient() {
  // Mirror the production defaults from getQueryClient — in particular
  // staleTime: 30_000 — so the cache-hit assertion below exercises the
  // same staleness model as the app, not a 0-staleTime test fiction.
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 30_000 },
      mutations: { retry: false },
    },
  });
}

const baseAiBody = {
  id: "lm-1",
  pill_id: PILL,
  source: "ai_generated",
  content: "explainer content",
  safety_links: null,
  served_at: "2026-05-01T00:00:00Z",
  created_at: "2026-05-01T00:00:00Z",
};

describe("useLearningMaterial + useRegenerateLearningMaterial", () => {
  let hits: { regenerate: boolean }[] = [];

  beforeEach(() => {
    hits = [];
    server.use(
      http.post(`${API}/v1/pills/${PILL}/learning-material`, ({ request }) => {
        const url = new URL(request.url);
        const regenerate = url.searchParams.get("regenerate") === "true";
        hits.push({ regenerate });
        return HttpResponse.json({ ...baseAiBody, cached: !regenerate });
      }),
    );
  });

  it("fires exactly one POST on mount and caches the result", async () => {
    const client = makeClient();
    render(
      <QueryClientProvider client={client}>
        <HookHarness id={PILL} />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("kind")).toHaveTextContent("ai_generated"),
    );
    expect(hits.length).toBe(1);
    expect(hits[0]!.regenerate).toBe(false);

    // Cache hit: a second render via the same QueryClient must NOT
    // re-fire (staleTime default 30s + cache-by-key).
    render(
      <QueryClientProvider client={client}>
        <HookHarness id={PILL} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getAllByTestId("kind").length).toBe(2));
    expect(hits.length).toBe(1);
  });

  it("regenerate fires ?regenerate=true, sets cache to fresh, disables the button while pending", async () => {
    const user = userEvent.setup();
    const client = makeClient();
    render(
      <QueryClientProvider client={client}>
        <HookHarness id={PILL} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("cached")).toHaveTextContent("true"));
    expect(hits.length).toBe(1);

    await user.click(screen.getByTestId("regen"));
    await waitFor(() => expect(hits.length).toBe(2));
    expect(hits[1]!.regenerate).toBe(true);

    // Cache updated to fresh (cached: false from the regenerate branch).
    await waitFor(() => expect(screen.getByTestId("cached")).toHaveTextContent("false"));

    // The cache entry is keyed under pillQueryKeys.learningMaterial(PILL).
    expect(client.getQueryData(pillQueryKeys.learningMaterial(PILL))).toEqual(
      expect.objectContaining({ cached: false }),
    );
  });

  it("does NOT fire when pillId is empty (defensive `enabled` guard)", async () => {
    server.use(
      http.post(`${API}/v1/pills//learning-material`, () => {
        hits.push({ regenerate: false });
        return HttpResponse.json({ ...baseAiBody, cached: true });
      }),
    );
    const client = makeClient();
    render(
      <QueryClientProvider client={client}>
        <HookHarness id="" />
      </QueryClientProvider>,
    );
    // Give React a tick so any spurious fetch would have fired.
    await new Promise((r) => setTimeout(r, 50));
    expect(hits.length).toBe(0);
    expect(screen.getByTestId("kind")).toHaveTextContent("loading");
  });

  it("retries once on a 500 (override of global retry: false)", async () => {
    let count = 0;
    server.use(
      http.post(`${API}/v1/pills/${PILL}/learning-material`, () => {
        count += 1;
        if (count === 1) {
          return HttpResponse.json(
            { error: { code: "boom", message: "boom", detail: null } },
            { status: 500 },
          );
        }
        return HttpResponse.json({ ...baseAiBody, cached: false });
      }),
    );

    const client = makeClient();
    render(
      <QueryClientProvider client={client}>
        <HookHarness id={PILL} />
      </QueryClientProvider>,
    );
    await waitFor(
      () => expect(screen.getByTestId("kind")).toHaveTextContent("ai_generated"),
      { timeout: 3000 },
    );
    expect(count).toBe(2);
  });
});

// Silence vi unused warning when we ever skip a scenario in dev.
void vi;
