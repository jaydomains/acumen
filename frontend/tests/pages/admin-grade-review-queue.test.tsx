/**
 * Grade-review queue integration tests (FE-9 admin-ops §B.2 §6 Gherkin
 * coverage). Mounts `/review` and exercises the real MSW flagged +
 * resolve handlers.
 *
 * Note on URL state: `useSearchParams` is mocked with a static value per
 * test, and `router.replace` is a spy (it does not feed back into the
 * mock). So URL-state assertions check the `replace` calls, and rows that
 * need to be pre-selected are seeded into the mocked search params.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/node";
import { AuthProvider } from "@/lib/auth/context";
import GradeReviewPage from "@/app/(authed)/(admin)/review/page";

const API = "http://localhost:8000";
const ROW1 = "00000000-0000-0000-0000-0000000d0a01"; // Naledi P.

const mockReplace = vi.fn();
let mockSearch = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/review",
  useSearchParams: () => mockSearch,
}));

function mountTree(node: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <Suspense fallback={null}>{node}</Suspense>
      </AuthProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockReplace.mockClear();
  mockSearch = new URLSearchParams();
  server.resetHandlers();
});

afterEach(() => {
  cleanup();
});

describe("grade-review queue — mount + auto-select", () => {
  it("normalises verdict to flagged and auto-selects the first row", async () => {
    render(mountTree(<GradeReviewPage />));
    await waitFor(() => expect(screen.getByTestId("review-list")).toBeInTheDocument());

    const replacedUrls = mockReplace.mock.calls.map((c) => String(c[0]));
    expect(replacedUrls.some((u) => u.includes("verdict=flagged"))).toBe(true);
    expect(replacedUrls.some((u) => u.includes(`selected=${ROW1}`))).toBe(true);
  });

  it("renders the queue rows", async () => {
    render(mountTree(<GradeReviewPage />));
    await waitFor(() => expect(screen.getByTestId("review-list")).toBeInTheDocument());
    expect(screen.getByText("Naledi P.")).toBeInTheDocument();
    expect(screen.getByText("Kabelo R.")).toBeInTheDocument();
  });

  it("eyebrow dropped its AC-D19 anchor (V2 testee-facing scope)", async () => {
    render(mountTree(<GradeReviewPage />));
    // Targeted: the eyebrow text proves the strip (FE-9 amended #101).
    // Scoped to the element — admin ops scaffolding elsewhere is out of V2.
    const eyebrow = await screen.findByText(
      "Cross-family review · batched per attempt · 60s ceiling",
    );
    expect(eyebrow.textContent ?? "").not.toMatch(/AC-D\d/);
  });
});

describe("grade-review queue — detail + override", () => {
  beforeEach(() => {
    mockSearch = new URLSearchParams(`verdict=flagged&selected=${ROW1}`);
  });

  it("renders the selected row's detail with AI-vs-reviewer comparison", async () => {
    render(mountTree(<GradeReviewPage />));
    await waitFor(() => expect(screen.getByTestId("review-detail")).toBeInTheDocument());
    expect(
      screen.getByText("Describe the atmospheric tests required before entry."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Response is too vague to credit partial/),
    ).toBeInTheDocument();
  });

  it("keep AI grade: resolves and closes the drawer", async () => {
    const user = userEvent.setup();
    render(mountTree(<GradeReviewPage />));
    await waitFor(() => expect(screen.getByTestId("review-detail")).toBeInTheDocument());

    await user.click(screen.getByTestId("review-apply-override"));
    expect(await screen.findByTestId("override-substitute-form")).toBeInTheDocument();

    await user.click(screen.getByTestId("override-keep-ai"));

    await waitFor(() =>
      expect(screen.queryByTestId("override-substitute-form")).not.toBeInTheDocument(),
    );
    // selection cleared on resolve
    expect(mockReplace.mock.calls.map((c) => String(c[0]))).toContainEqual(
      expect.stringMatching(/^\/review($|\?verdict=flagged$)/),
    );
  });

  it("substitute without a tile is blocked with a root error and no network", async () => {
    const resolveSpy = vi.fn();
    server.use(
      http.post(`${API}/v1/admin/grade-reviews/:id/resolve`, () => {
        resolveSpy();
        return HttpResponse.json({}, { status: 200 });
      }),
    );

    const user = userEvent.setup();
    render(mountTree(<GradeReviewPage />));
    await waitFor(() => expect(screen.getByTestId("review-detail")).toBeInTheDocument());

    await user.click(screen.getByTestId("review-apply-override"));
    await user.click(await screen.findByTestId("override-apply"));

    expect(await screen.findByText("Pick a verdict to substitute")).toBeInTheDocument();
    expect(resolveSpy).not.toHaveBeenCalled();
  });

  it("substitute with a tile fires the resolve and closes the drawer", async () => {
    const user = userEvent.setup();
    render(mountTree(<GradeReviewPage />));
    await waitFor(() => expect(screen.getByTestId("review-detail")).toBeInTheDocument());

    await user.click(screen.getByTestId("review-apply-override"));
    // "Partial · 0.6" tile
    await user.click(await screen.findByTestId("verdict-tile-partial-0.6"));
    await user.click(screen.getByTestId("override-apply"));

    await waitFor(() =>
      expect(screen.queryByTestId("override-substitute-form")).not.toBeInTheDocument(),
    );
  });

  it("query failure renders the inline Pattern C boundary with retry", async () => {
    server.use(
      http.get(`${API}/v1/admin/grade-reviews/flagged`, () =>
        HttpResponse.json(
          { error: { code: "server_error", message: "boom", detail: null } },
          { status: 500 },
        ),
      ),
    );
    render(mountTree(<GradeReviewPage />));
    await waitFor(() => expect(screen.getByTestId("boundary-frame")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();
  });
});
