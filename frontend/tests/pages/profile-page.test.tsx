/**
 * Profile-page Slice 1 integration tests (FE-7 §B.1 §5/§6).
 *
 * Covers the four top-level state branches that ship in Slice 1:
 * loading skeleton, endpoint_absent placeholder, empty fallback, and
 * the happy-state slots that host the Slice 2/3 components.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ProfilePage from "@/app/(authed)/(testee)/profile/page";
import {
  resetMockMeCompetence,
  setMockMeCompetence,
  setMockMeCompetenceStatus,
} from "@/mocks/handlers";
import type { MeCompetencePill } from "@/lib/queries/me";

const routerReplace = vi.fn();
const routerPush = vi.fn();
let mockParamId: string | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPush,
    replace: routerReplace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/profile",
  useSearchParams: () =>
    mockParamId ? new URLSearchParams({ pill: mockParamId }) : new URLSearchParams(),
}));

const PILL_A = "11111111-1111-1111-1111-aaaaaaaaaaaa";
const PILL_B = "22222222-2222-2222-2222-bbbbbbbbbbbb";

const makePill = (
  input: Partial<MeCompetencePill> & { pill_id: string },
): MeCompetencePill => ({
  pill_name: "Antifouling",
  subject_id: "11111111-1111-1111-1111-000000000111",
  competence_estimate: 6.4,
  band: "working",
  n: 22,
  confidence: "confident",
  last_activity_at: "2026-05-26T09:00:00Z",
  related_pill_ids: [],
  safety_relevant: false,
  ...input,
});

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
  routerReplace.mockClear();
  routerPush.mockClear();
  mockParamId = null;
  resetMockMeCompetence();
});

afterEach(() => cleanup());

describe("Profile page · loading skeleton", () => {
  it("renders the skeleton while the competence fetch is in-flight", () => {
    render(mountTree(<ProfilePage />));
    expect(screen.getByTestId("profile-skeleton")).toBeInTheDocument();
  });
});

describe("Profile page · happy state", () => {
  it("renders hero, view-toggle, legend, constellation SVG, detail card, and how-to-read after fetch resolves", async () => {
    setMockMeCompetence([
      makePill({ pill_id: PILL_A, pill_name: "Antifouling", n: 22 }),
      makePill({ pill_id: PILL_B, pill_name: "DFT", n: 8 }),
    ]);
    render(mountTree(<ProfilePage />));
    await waitFor(() => expect(screen.getByTestId("profile-happy")).toBeInTheDocument());
    expect(screen.getByTestId("profile-hero")).toHaveTextContent(
      /Your competency · 2 pills · calibrated/,
    );
    expect(screen.getByTestId("view-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("profile-legend")).toBeInTheDocument();
    expect(screen.getByTestId("constellation-svg")).toBeInTheDocument();
    expect(screen.getByTestId("selected-pill-detail-card")).toBeInTheDocument();
    expect(screen.getByTestId("how-to-read-card")).toBeInTheDocument();
  });

  it("clicking a related-pill chip in the detail card routes via router.replace with the new pill id", async () => {
    mockParamId = PILL_A;
    setMockMeCompetence([
      makePill({
        pill_id: PILL_A,
        pill_name: "Antifouling",
        related_pill_ids: [PILL_B],
      }),
      makePill({ pill_id: PILL_B, pill_name: "DFT" }),
    ]);
    const user = userEvent.setup();
    render(mountTree(<ProfilePage />));
    await waitFor(() =>
      expect(screen.getByTestId("selected-pill-detail-card")).toBeInTheDocument(),
    );
    const chip = screen.getByTestId("detail-related-chip");
    expect(chip).toHaveAttribute("data-pill-id", PILL_B);
    await user.click(chip);
    expect(routerReplace).toHaveBeenLastCalledWith(
      `?pill=${encodeURIComponent(PILL_B)}`,
      { scroll: false },
    );
  });

  it("Practice + Step-up CTAs router.push into FE-3 pill detail with the rounded difficulty", async () => {
    mockParamId = PILL_A;
    setMockMeCompetence([
      makePill({
        pill_id: PILL_A,
        pill_name: "Antifouling",
        competence_estimate: 6.7,
      }),
    ]);
    const user = userEvent.setup();
    render(mountTree(<ProfilePage />));
    await waitFor(() =>
      expect(screen.getByTestId("selected-pill-detail-card")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("detail-cta-practice"));
    expect(routerPush).toHaveBeenLastCalledWith(`/pills/${PILL_A}?d=7`);
    await user.click(screen.getByTestId("detail-cta-step-up"));
    expect(routerPush).toHaveBeenLastCalledWith(`/pills/${PILL_A}?d=8`);
  });

  it("defaults selection to the first pill with n > 0 (URL replaces with ?pill=)", async () => {
    setMockMeCompetence([
      makePill({ pill_id: PILL_A, pill_name: "Antifouling", n: 0 }),
      makePill({ pill_id: PILL_B, pill_name: "DFT", n: 8 }),
    ]);
    render(mountTree(<ProfilePage />));
    await waitFor(() =>
      expect(routerReplace).toHaveBeenCalledWith(`?pill=${encodeURIComponent(PILL_B)}`, {
        scroll: false,
      }),
    );
  });

  it("falls back to default + replaces URL when ?pill= references an unknown id", async () => {
    mockParamId = "unknown-pill-id";
    setMockMeCompetence([makePill({ pill_id: PILL_A, pill_name: "Antifouling", n: 5 })]);
    render(mountTree(<ProfilePage />));
    await waitFor(() =>
      expect(routerReplace).toHaveBeenCalledWith(`?pill=${encodeURIComponent(PILL_A)}`, {
        scroll: false,
      }),
    );
  });

  it("does NOT call router.replace when ?pill= already matches the selected id", async () => {
    mockParamId = PILL_A;
    setMockMeCompetence([makePill({ pill_id: PILL_A, pill_name: "Antifouling", n: 5 })]);
    render(mountTree(<ProfilePage />));
    await waitFor(() => expect(screen.getByTestId("profile-happy")).toBeInTheDocument());
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it("clicking a constellation star routes via router.replace with the new pill id", async () => {
    mockParamId = PILL_A;
    setMockMeCompetence([
      makePill({ pill_id: PILL_A, pill_name: "Antifouling", n: 22 }),
      makePill({ pill_id: PILL_B, pill_name: "DFT", n: 8 }),
    ]);
    const user = userEvent.setup();
    render(mountTree(<ProfilePage />));
    await waitFor(() =>
      expect(screen.getByTestId("constellation-svg")).toBeInTheDocument(),
    );
    const starB = screen
      .getAllByTestId("constellation-star")
      .find((el) => el.getAttribute("data-pill-id") === PILL_B);
    if (!starB) throw new Error("missing star for PILL_B");
    await user.click(starB);
    expect(routerReplace).toHaveBeenCalledWith(`?pill=${encodeURIComponent(PILL_B)}`, {
      scroll: false,
    });
  });

  it("toggles between constellation SVG (with detail card + how-to-read) and the matrix table", async () => {
    setMockMeCompetence([makePill({ pill_id: PILL_A, pill_name: "Antifouling" })]);
    const user = userEvent.setup();
    render(mountTree(<ProfilePage />));
    await waitFor(() =>
      expect(screen.getByTestId("constellation-svg")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("selected-pill-detail-card")).toBeInTheDocument();
    expect(screen.getByTestId("how-to-read-card")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /matrix/i }));
    expect(screen.getByTestId("matrix-table")).toBeInTheDocument();
    expect(screen.queryByTestId("constellation-svg")).toBeNull();
    expect(screen.queryByTestId("selected-pill-detail-card")).toBeNull();
    expect(screen.queryByTestId("how-to-read-card")).toBeNull();

    await user.click(screen.getByRole("button", { name: /constellation/i }));
    expect(screen.getByTestId("constellation-svg")).toBeInTheDocument();
    expect(screen.queryByTestId("matrix-table")).toBeNull();
  });
});

describe("Profile page · endpoint_absent", () => {
  it("renders the drift-placeholder card and hides the constellation slots on 404", async () => {
    setMockMeCompetenceStatus(404);
    render(mountTree(<ProfilePage />));
    await waitFor(() =>
      expect(screen.getByTestId("profile-endpoint-absent")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("constellation-svg")).toBeNull();
    expect(screen.queryByTestId("view-toggle")).toBeNull();
    expect(routerReplace).not.toHaveBeenCalled();
  });
});

describe("Profile page · empty", () => {
  it("renders the empty-state copy when the response has zero pills", async () => {
    setMockMeCompetence([]);
    render(mountTree(<ProfilePage />));
    await waitFor(() => expect(screen.getByTestId("profile-empty")).toBeInTheDocument());
    expect(screen.getByTestId("profile-hero")).toHaveTextContent(
      /0 pills · no attempts yet/,
    );
    expect(routerReplace).not.toHaveBeenCalled();
  });
});
