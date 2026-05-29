/**
 * Admin test editor integration tests (FE-8 admin-tests §B.2 §6
 * Gherkin coverage). Slice 12 — the test-editor pattern that the
 * binding-pause #2 review gates on.
 *
 * Covers the per_testee mode (only fully wired in Slice 12), the
 * mode-picker lock state for edit mode, the publish/unlock flow, and
 * the 3 stub modes (frozen / hand_authored / benchmark) carrying
 * Slice 13 / v1.x placeholders.
 */

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/node";
import {
  getMockAdminTests,
  resetMockAdminPaths,
  resetMockAdminPills,
  resetMockAdminSubjects,
  resetMockAdminTests,
  setMockAdminTests,
} from "@/mocks/handlers";
import TestEditorPage from "@/app/(authed)/(admin)/admin/tests/[testId]/edit/page";

const API = "http://localhost:8000";

const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockParams: { testId: string } = { testId: "new" };

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/admin/tests/edit",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => mockParams,
}));

function mountTree(node: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>
      <Suspense fallback={null}>{node}</Suspense>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
  mockParams = { testId: "new" };
  server.resetHandlers();
  resetMockAdminTests();
  resetMockAdminPills();
  resetMockAdminSubjects();
  resetMockAdminPaths();
});

afterEach(() => {
  cleanup();
});

describe("test editor — create mode (`/admin/tests/new/edit`)", () => {
  it("mounts with empty form and per_testee mode active by default", async () => {
    render(mountTree(<TestEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("test-editor-form")).toBeInTheDocument(),
    );
    expect((screen.getByTestId("test-editor-name") as HTMLInputElement).value).toBe("");
    expect(screen.getByTestId("mode-picker")).toBeInTheDocument();
    expect(screen.getByTestId("per-testee-section")).toBeInTheDocument();
    // Status bar reflects "not saved yet" until the create POST lands.
    expect(screen.getByTestId("status-bar-empty")).toBeInTheDocument();
  });

  it("Publish button is disabled in create mode (drift Finding #12)", async () => {
    render(mountTree(<TestEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("publish-controls-publish")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("publish-controls-publish")).toBeDisabled();
  });

  it("benchmark mode card is disabled (§E.8) — clicking it does not change mode", async () => {
    const user = userEvent.setup();
    render(mountTree(<TestEditorPage />));
    await waitFor(() => expect(screen.getByTestId("mode-picker")).toBeInTheDocument());
    const card = screen.getByTestId("mode-card-benchmark");
    expect(card).toBeDisabled();
    await user.click(card);
    // Per-testee section still rendered — mode didn't flip.
    expect(screen.getByTestId("per-testee-section")).toBeInTheDocument();
  });

  it("rejects submit with empty title (zod min(1))", async () => {
    const user = userEvent.setup();
    render(mountTree(<TestEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("publish-controls-save")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("publish-controls-save"));
    await waitFor(() =>
      expect(screen.getByText("Title is required.")).toBeInTheDocument(),
    );
  });

  it("per_testee mode requires a pill (zod superRefine)", async () => {
    const user = userEvent.setup();
    render(mountTree(<TestEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("test-editor-name")).toBeInTheDocument(),
    );
    await user.type(screen.getByTestId("test-editor-name"), "No pill test");
    await user.click(screen.getByTestId("publish-controls-save"));
    await waitFor(() => expect(screen.getByText("Pick a pill.")).toBeInTheDocument());
  });

  it("per_testee mode requires a target difficulty when pill picked", async () => {
    const user = userEvent.setup();
    render(mountTree(<TestEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("per-testee-pill-select")).toBeInTheDocument(),
    );
    await user.type(screen.getByTestId("test-editor-name"), "Pill but no D");
    const select = screen.getByTestId("per-testee-pill-select") as HTMLSelectElement;
    // Pick the first non-empty option.
    const opt = within(select).getAllByRole("option")[1] as HTMLOptionElement;
    await user.selectOptions(select, opt.value);
    await user.click(screen.getByTestId("publish-controls-save"));
    await waitFor(() =>
      expect(screen.getByText("Pick a target difficulty.")).toBeInTheDocument(),
    );
  });

  it("creates a per_testee test, replaces URL to /admin/tests/{newId}/edit", async () => {
    const user = userEvent.setup();
    let createBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API}/v1/tests`, async ({ request }) => {
        createBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            id: "00000000-0000-0000-0000-000000000999",
            name: String(createBody!.name),
            mode: String(createBody!.mode),
            status: "draft",
            visibility: "library",
            timed: true,
            duration_minutes: createBody!.duration_minutes ?? null,
            pause_allowance: null,
            timeout_behaviour: "auto_submit",
            max_pause_duration_minutes: 30,
            pass_threshold: createBody!.pass_threshold ?? 0.7,
            target_difficulty: createBody!.target_difficulty ?? null,
            lock_mode: "open",
            campaign_id: null,
            benchmark_scope: null,
            benchmark_target_testee_id: null,
            randomise_question_order: false,
            randomise_option_order: false,
            pill_id: createBody!.pill_id ?? null,
            created_at: "2026-05-29T00:00:00Z",
            updated_at: "2026-05-29T00:00:00Z",
          },
          { status: 201 },
        );
      }),
    );
    render(mountTree(<TestEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("per-testee-pill-select")).toBeInTheDocument(),
    );

    await user.type(screen.getByTestId("test-editor-name"), "Antifouling — focus");
    const select = screen.getByTestId("per-testee-pill-select") as HTMLSelectElement;
    const firstPill = within(select).getAllByRole("option")[1] as HTMLOptionElement;
    await user.selectOptions(select, firstPill.value);
    await user.click(screen.getByTestId("difficulty-picker-5"));

    await user.click(screen.getByTestId("publish-controls-save"));

    await waitFor(() => expect(createBody).not.toBeNull());
    expect(createBody).toMatchObject({
      name: "Antifouling — focus",
      mode: "per_testee",
      pill_id: firstPill.value,
      target_difficulty: 5,
    });
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith(
        "/admin/tests/00000000-0000-0000-0000-000000000999/edit",
      ),
    );
  });
});

describe("test editor — edit mode (existing per_testee draft)", () => {
  const draftId = "ffff5555-ffff-ffff-ffff-0000000000aa";
  const seededPillId = "eeeeeeee-eeee-eeee-eeee-000000000001";

  beforeEach(() => {
    // Seed a per_testee draft for these tests (no such seed exists in
    // the default set — defaults cover published + locked branches).
    // `pill_id` references admin pill seed #1 so the form's zod
    // superRefine passes without a UI pill-pick step.
    setMockAdminTests([
      {
        id: draftId,
        name: "Per-testee draft",
        mode: "per_testee",
        status: "draft",
        visibility: "library",
        timed: true,
        duration_minutes: 30,
        pause_allowance: 2,
        timeout_behaviour: "auto_submit",
        max_pause_duration_minutes: 5,
        pass_threshold: 0.7,
        target_difficulty: 5,
        lock_mode: "open",
        campaign_id: null,
        benchmark_scope: null,
        benchmark_target_testee_id: null,
        randomise_question_order: false,
        randomise_option_order: false,
        pill_id: seededPillId,
        created_at: "2026-05-28T00:00:00Z",
        updated_at: "2026-05-28T00:00:00Z",
      },
    ]);
    mockParams = { testId: draftId };
  });

  it("mounts edit mode with hydrated form values + locked ModePicker", async () => {
    render(mountTree(<TestEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("test-editor-form")).toBeInTheDocument(),
    );
    expect((screen.getByTestId("test-editor-name") as HTMLInputElement).value).toBe(
      "Per-testee draft",
    );
    // ModePicker locks in edit mode regardless of status.
    expect(screen.getByTestId("mode-card-per_testee")).toBeDisabled();
    expect(screen.getByTestId("mode-card-frozen")).toBeDisabled();
    // Per-testee section visible (the seed's mode).
    expect(screen.getByTestId("per-testee-section")).toBeInTheDocument();
    // Publish enabled in edit mode (draft + has id).
    expect(screen.getByTestId("publish-controls-publish")).not.toBeDisabled();
  });

  it("PATCH on save with only the diffed name field (value-diff PATCH)", async () => {
    const user = userEvent.setup();
    let patchBody: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${API}/v1/tests/:test_id`, async ({ params, request }) => {
        patchBody = (await request.json()) as Record<string, unknown>;
        const t = getMockAdminTests().find((x) => x.id === String(params.test_id))!;
        return HttpResponse.json({
          ...t,
          name: (patchBody!.name as string) ?? t.name,
          updated_at: "2026-05-29T00:00:01Z",
        });
      }),
    );
    render(mountTree(<TestEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("test-editor-name")).toBeInTheDocument(),
    );
    const nameField = screen.getByTestId("test-editor-name") as HTMLInputElement;
    await user.clear(nameField);
    await user.type(nameField, "Per-testee draft (updated)");
    await user.click(screen.getByTestId("publish-controls-save"));
    await waitFor(() => expect(patchBody).not.toBeNull());
    expect(patchBody).toEqual({ name: "Per-testee draft (updated)" });
  });

  it("publishes the draft via POST /publish + flips controls to Save changes + Lock", async () => {
    const user = userEvent.setup();
    render(mountTree(<TestEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("publish-controls-publish")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("publish-controls-publish"));
    await waitFor(() =>
      expect(screen.getByTestId("publish-controls-lock")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("publish-controls-save")).toHaveTextContent("Save changes");
    expect(screen.getByTestId("warn-banner-published")).toBeInTheDocument();
  });
});

describe("test editor — edit mode (frozen draft → published flow)", () => {
  const draftId = "ffff5555-ffff-ffff-ffff-000000000003";

  beforeEach(() => {
    mockParams = { testId: draftId };
  });

  it("draft status renders Save draft + Publish, then Publish flips to Save changes + Lock", async () => {
    const user = userEvent.setup();
    render(mountTree(<TestEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("publish-controls-publish")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("publish-controls-publish")).toHaveTextContent("Publish");
    expect(screen.getByTestId("publish-controls-save")).toHaveTextContent("Save draft");
    // Slice 13: FrozenSection now renders the real pool table.
    expect(screen.getByTestId("frozen-section")).toBeInTheDocument();

    await user.click(screen.getByTestId("publish-controls-publish"));

    await waitFor(() =>
      expect(screen.getByTestId("publish-controls-lock")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("publish-controls-save")).toHaveTextContent("Save changes");
    // Warn banner mounts for published status.
    expect(screen.getByTestId("warn-banner-published")).toBeInTheDocument();
  });

  it("Lock button is disabled in v1 (drift Finding #1 — no /v1/campaigns)", async () => {
    setMockAdminTests([
      {
        ...getMockAdminTests().find((t) => t.id === draftId)!,
        status: "published",
      },
    ]);
    render(mountTree(<TestEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("publish-controls-lock")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("publish-controls-lock")).toBeDisabled();
  });
});

describe("test editor — edit mode (locked test → unlock flow)", () => {
  // The ISO 9001 seed is hand_authored + campaign-locked.
  const lockedId = "ffff5555-ffff-ffff-ffff-000000000004";

  beforeEach(() => {
    mockParams = { testId: lockedId };
  });

  it("renders locked warn banner + only Unlock control", async () => {
    render(mountTree(<TestEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("warn-banner-locked")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("publish-controls-unlock")).toBeInTheDocument();
    expect(screen.queryByTestId("publish-controls-save")).not.toBeInTheDocument();
    expect(screen.queryByTestId("publish-controls-publish")).not.toBeInTheDocument();
    // Title input is disabled in locked state.
    expect(screen.getByTestId("test-editor-name")).toBeDisabled();
  });

  it("unlocks via POST /unlock and flips back to published state", async () => {
    const user = userEvent.setup();
    render(mountTree(<TestEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("publish-controls-unlock")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("publish-controls-unlock"));
    await waitFor(() =>
      expect(screen.queryByTestId("warn-banner-locked")).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("warn-banner-published")).toBeInTheDocument();
    expect(screen.getByTestId("publish-controls-save")).toHaveTextContent("Save changes");
  });

  it("renders the HandAuthoredSection info card + composed FrozenSection for hand_authored seed", async () => {
    render(mountTree(<TestEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("hand-authored-info")).toBeInTheDocument(),
    );
    // Slice 13: hand-authored composes the real FrozenSection beneath
    // the info card; both lock states inherited from the parent.
    expect(screen.getByTestId("frozen-section")).toBeInTheDocument();
  });
});

describe("test editor — not found", () => {
  beforeEach(() => {
    mockParams = { testId: "ffff5555-ffff-ffff-ffff-deadbeefdead" };
  });

  it("renders inline empty-state on 404", async () => {
    render(mountTree(<TestEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("test-editor-not-found")).toBeInTheDocument(),
    );
    expect(screen.getByText("Test not found")).toBeInTheDocument();
  });
});
