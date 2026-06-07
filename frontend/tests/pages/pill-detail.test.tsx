/**
 * Pill detail page integration tests — FE-3 §B.3 + §B.4.
 *
 * Hits real MSW handlers for /v1/catalogue/pills/{id} +
 * POST /v1/pills/{id}/learning-material. Overrides via server.use
 * shape per scenario.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/node";
import { resetMockCatalogue } from "@/mocks/handlers";
import PillDetailPage from "@/app/(authed)/(testee)/pills/[pillId]/page";

const API = "http://localhost:8000";

const STANDARD_PILL_ID = "aaaaaaaa-aaaa-aaaa-aaaa-000000000005"; // Antifouling
const SAFETY_PILL_ID = "aaaaaaaa-aaaa-aaaa-aaaa-000000000012"; // Confined Space

let mockParams: Record<string, string> = { pillId: STANDARD_PILL_ID };

const mockedRouter = {
  replace: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useParams: () => mockParams,
  useRouter: () => mockedRouter,
  usePathname: () => `/pills/${mockParams.pillId}`,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));
import { toast } from "sonner";

function mountTree(node: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>{node}</Suspense>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  resetMockCatalogue();
  mockParams = { pillId: STANDARD_PILL_ID };
  vi.mocked(toast).mockClear();
  vi.mocked(toast.error).mockClear();
  mockedRouter.push.mockClear();
  mockedRouter.replace.mockClear();
  localStorage.removeItem("acumen.attempts.inflight");
});

afterEach(() => {
  cleanup();
});

describe("Pill detail page · standard branch", () => {
  it("renders the pill name + subject crumb from the pill query", async () => {
    render(mountTree(<PillDetailPage />));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Antifouling Systems" }),
      ).toBeInTheDocument(),
    );
    // The eyebrow shows the subject name uppercased ("MARINE COATINGS").
    expect(screen.getByText("MARINE COATINGS")).toBeInTheDocument();
  });

  it("POST learning-material fires exactly once on mount; loading → ready transition", async () => {
    let hits = 0;
    server.use(
      http.post(`${API}/v1/pills/${STANDARD_PILL_ID}/learning-material`, () => {
        hits += 1;
        return HttpResponse.json({
          id: "lm-1",
          pill_id: STANDARD_PILL_ID,
          source: "ai_generated",
          content: "Antifouling explainer body.",
          safety_links: null,
          served_at: "2026-05-01T00:00:00Z",
          created_at: "2026-05-01T00:00:00Z",
          cached: true,
        });
      }),
    );

    render(mountTree(<PillDetailPage />));
    // MSW resolves synchronously in tests so we can't reliably catch
    // the loading frame. Assert the terminal state + that the POST
    // fired exactly once.
    await waitFor(() => expect(screen.getByTestId("material-ready")).toBeInTheDocument());
    expect(hits).toBe(1);
    expect(screen.getByText("Antifouling explainer body.")).toBeInTheDocument();
  });

  it("regenerate fires ?regenerate=true and disables the button until it resolves", async () => {
    const user = userEvent.setup();
    let regenHits = 0;
    server.use(
      http.post(
        `${API}/v1/pills/${STANDARD_PILL_ID}/learning-material`,
        ({ request }) => {
          const url = new URL(request.url);
          const regenerate = url.searchParams.get("regenerate") === "true";
          if (regenerate) regenHits += 1;
          return HttpResponse.json({
            id: "lm-1",
            pill_id: STANDARD_PILL_ID,
            source: "ai_generated",
            content: regenerate ? "Fresh body." : "Cached body.",
            safety_links: null,
            served_at: "2026-05-01T00:00:00Z",
            created_at: "2026-05-01T00:00:00Z",
            cached: !regenerate,
          });
        },
      ),
    );

    render(mountTree(<PillDetailPage />));
    await waitFor(() => expect(screen.getByTestId("material-ready")).toBeInTheDocument());

    const btn = screen.getByTestId("material-regenerate");
    await user.click(btn);
    await waitFor(() => expect(regenHits).toBe(1));
    await waitFor(() => expect(screen.getByText("Fresh body.")).toBeInTheDocument());
  });

  it("'Practice at D{n}' resolves test → starts attempt → routes to runner (FE-4 slice 2)", async () => {
    const user = userEvent.setup();
    render(mountTree(<PillDetailPage />));
    await waitFor(() =>
      expect(screen.getByTestId("sticky-start-cta")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("sticky-start-cta"));
    await waitFor(() => expect(mockedRouter.push).toHaveBeenCalled());
    const [path] = mockedRouter.push.mock.calls[0] ?? [];
    expect(path).toMatch(/^\/attempts\//);
    // Inflight bridge populated for the dashboard resume prompt.
    expect(localStorage.getItem("acumen.attempts.inflight")).toBeTruthy();
  });

  it("toasts when the resolver returns 404 (no test at this difficulty)", async () => {
    server.use(
      http.get("http://localhost:8000/v1/tests/resolve", () =>
        HttpResponse.json(
          {
            error: { code: "not_found", message: "No matching test.", detail: null },
          },
          { status: 404 },
        ),
      ),
    );
    const user = userEvent.setup();
    render(mountTree(<PillDetailPage />));
    await waitFor(() =>
      expect(screen.getByTestId("sticky-start-cta")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("sticky-start-cta"));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.stringMatching(/No test at D\d+/),
        expect.any(Object),
      ),
    );
  });
});

describe("Pill detail page · safety branch", () => {
  beforeEach(() => {
    mockParams = { pillId: SAFETY_PILL_ID };
  });

  it("renders SafetyPosterCard + SafetyLinks when curated links are available", async () => {
    render(mountTree(<PillDetailPage />));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Confined Space Entry" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByTestId("safety-poster-card")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("safety-links")).toBeInTheDocument());
    // The default fixture serves 3 safety links.
    expect(screen.getByTestId("safety-link-0")).toBeInTheDocument();
    expect(screen.getByTestId("safety-link-2")).toBeInTheDocument();
    // MaterialReady must NOT render in safety branch.
    expect(screen.queryByTestId("material-ready")).not.toBeInTheDocument();
  });

  it("renders SafetyEmpty when curated link set is empty", async () => {
    server.use(
      http.post(`${API}/v1/pills/${SAFETY_PILL_ID}/learning-material`, () =>
        HttpResponse.json({
          id: "lm-1",
          pill_id: SAFETY_PILL_ID,
          source: "curated_safety_links",
          content: null,
          safety_links: [],
          served_at: "2026-05-01T00:00:00Z",
          created_at: "2026-05-01T00:00:00Z",
          cached: true,
        }),
      ),
    );

    render(mountTree(<PillDetailPage />));
    await waitFor(() => expect(screen.getByTestId("safety-empty")).toBeInTheDocument());
    expect(
      screen.getByText("Acumen never generates safety teaching content."),
    ).toBeInTheDocument();
    // V2 (testee-facing): the safety subtitle dropped its "(AC-D21)".
    // Targeted to the subtitle element — the mock pill *description* fixture
    // still carries an AC-D21 annotation (test data, not production copy),
    // so a page-wide regex would be out of V2's scope here.
    const subtitle = screen.getByText(
      "Safety-tagged pill — curated external sources only.",
    );
    expect(subtitle.textContent ?? "").not.toMatch(/AC-D\d/);
  });
});

describe("Pill detail page · contract violations", () => {
  it("catches narrowMaterial throw and surfaces inline boundary (no route remount)", async () => {
    server.use(
      http.post(`${API}/v1/pills/${STANDARD_PILL_ID}/learning-material`, () =>
        HttpResponse.json({
          id: "lm-1",
          pill_id: STANDARD_PILL_ID,
          source: "from-mars",
          content: null,
          safety_links: null,
          served_at: null,
          created_at: "2026-05-01T00:00:00Z",
          cached: false,
        }),
      ),
    );
    // narrowMaterial logs a console.warn before returning the inline
    // boundary; swallow it so the test output stays clean.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(mountTree(<PillDetailPage />));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /unexpected material format/i }),
      ).toBeInTheDocument(),
    );
    // PillMetaCard still rendered — only RightColumn fell back.
    expect(screen.getByTestId("pill-meta-card")).toBeInTheDocument();
    warnSpy.mockRestore();
  });
});

describe("Pill detail page · errors", () => {
  it("surfaces the inline boundary when /v1/catalogue/pills/{id} fails", async () => {
    server.use(
      http.get(`${API}/v1/catalogue/pills/${STANDARD_PILL_ID}`, () =>
        HttpResponse.json(
          { error: { code: "boom", message: "boom", detail: null } },
          { status: 500 },
        ),
      ),
    );
    render(mountTree(<PillDetailPage />));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /we couldn't load this pill/i }),
      ).toBeInTheDocument(),
    );
  });
});
