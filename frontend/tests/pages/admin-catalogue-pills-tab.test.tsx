/**
 * Pills tab integration tests (FE-8 §B.2 §6 Gherkin coverage).
 *
 * Mounts the full admin catalogue page with `?tab=pills` and exercises
 * real MSW handlers for GET / POST / PATCH `/v1/pills` + the dedicated
 * PATCH `/v1/pills/{id}/safety` endpoint. Client-side filter validates
 * the §E.7 absorption (server has no q/subject_id/status query params).
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/node";
import {
  getMockAdminPills,
  getMockAdminSubjects,
  resetMockAdminPills,
  resetMockAdminSubjects,
  setMockAdminPills,
} from "@/mocks/handlers";
import AdminCataloguePage from "@/app/(authed)/(admin)/admin/catalogue/page";

const API = "http://localhost:8000";

const mockReplace = vi.fn();
let mockSearch = new URLSearchParams("tab=pills");

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/admin/catalogue",
  useSearchParams: () => mockSearch,
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
  mockReplace.mockClear();
  mockSearch = new URLSearchParams("tab=pills");
  server.resetHandlers();
  resetMockAdminPills();
  resetMockAdminSubjects();
});

afterEach(() => {
  cleanup();
});

describe("pills tab — list", () => {
  it("renders all loaded pills in the table", async () => {
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() => expect(screen.getByTestId("pills-table")).toBeInTheDocument());
    expect(screen.getByText("Reference Panels")).toBeInTheDocument();
    expect(screen.getByText("DFT Measurement")).toBeInTheDocument();
    expect(screen.getByText("Antifouling Systems")).toBeInTheDocument();
    expect(screen.getByText("Cathodic Protection")).toBeInTheDocument();
    expect(screen.getByText("Confined Space Entry")).toBeInTheDocument();
  });

  it("renders the Safety badge for safety-relevant pills", async () => {
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByText("Confined Space Entry")).toBeInTheDocument(),
    );
    const confined = getMockAdminPills().find((p) => p.name === "Confined Space Entry")!;
    expect(screen.getByTestId(`pills-safety-badge-${confined.id}`)).toBeInTheDocument();
  });

  it("renders the Draft / Published status mapping from discoverable (§H(b) item 7)", async () => {
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByText("Cathodic Protection")).toBeInTheDocument(),
    );
    // Cathodic Protection is the fixture with discoverable=false.
    const cathodic = getMockAdminPills().find((p) => p.name === "Cathodic Protection")!;
    const row = screen.getByTestId(`pills-row-${cathodic.id}`);
    expect(row).toHaveTextContent(/Draft/);
    // Reference Panels is discoverable=true.
    const ref = getMockAdminPills().find((p) => p.name === "Reference Panels")!;
    expect(screen.getByTestId(`pills-row-${ref.id}`)).toHaveTextContent(/Published/);
  });

  it("renders em-dash for the Used-in column (§E.8 placeholder)", async () => {
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() => expect(screen.getByTestId("pills-table")).toBeInTheDocument());
    expect(screen.getAllByTestId("derived-count-pending").length).toBeGreaterThan(0);
  });

  it("disables Edit on retired pills (drift Finding #7)", async () => {
    const subjects = getMockAdminSubjects();
    setMockAdminPills([
      {
        id: "eeeeeeee-eeee-eeee-eeee-000000009999",
        subject_id: subjects[0]!.id,
        name: "Retired Pill",
        description: null,
        available_difficulty_min: 1,
        available_difficulty_max: 10,
        discoverable: false,
        safety_relevant: false,
        safety_relevant_overridden_at: null,
        estimated_minutes: null,
        retired_at: "2026-01-01T00:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() => expect(screen.getByText("Retired Pill")).toBeInTheDocument());
    expect(
      screen.getByTestId("pills-edit-eeeeeeee-eeee-eeee-eeee-000000009999"),
    ).toBeDisabled();
  });

  it("shows empty state when no pills exist", async () => {
    setMockAdminPills([]);
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() => expect(screen.getByTestId("pills-empty")).toBeInTheDocument());
  });
});

describe("pills tab — client-side filters (Finding #3 / §E.7)", () => {
  it("filters by ?q= text search across loaded pills", async () => {
    mockSearch = new URLSearchParams("tab=pills&q=antifouling");
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByText("Antifouling Systems")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Reference Panels")).not.toBeInTheDocument();
    expect(screen.queryByText("DFT Measurement")).not.toBeInTheDocument();
  });

  it("filters by ?status=draft to show only non-discoverable pills", async () => {
    mockSearch = new URLSearchParams("tab=pills&status=draft");
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByText("Cathodic Protection")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Reference Panels")).not.toBeInTheDocument();
  });

  it("filters by ?subject= to show only matching subject", async () => {
    const subjects = getMockAdminSubjects();
    const marine = subjects.find((s) => s.name === "Marine coatings")!;
    mockSearch = new URLSearchParams(`tab=pills&subject=${marine.id}`);
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByText("Antifouling Systems")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Reference Panels")).not.toBeInTheDocument();
    expect(screen.queryByText("DFT Measurement")).not.toBeInTheDocument();
  });

  it("writes ?q= to the URL when typing in FilterBar", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() => expect(screen.getByTestId("pills-table")).toBeInTheDocument());

    await user.type(screen.getByTestId("filter-bar-search"), "antifouling");

    await waitFor(
      () =>
        expect(mockReplace).toHaveBeenCalledWith(
          "/admin/catalogue?tab=pills&q=antifouling",
        ),
      { timeout: 1500 },
    );
  });
});

describe("pills tab — create modal", () => {
  it("creates a pill via POST with the dirty fields and closes the modal", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByTestId("pills-add-button")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("pills-add-button"));
    await waitFor(() =>
      expect(screen.getByTestId("pill-modal-form")).toBeInTheDocument(),
    );

    await user.type(screen.getByTestId("pill-modal-name"), "New Pill");
    const subjects = getMockAdminSubjects();
    const paint = subjects.find((s) => s.name === "Paint QA")!;
    await user.selectOptions(screen.getByTestId("pill-modal-subject"), paint.id);

    await user.click(screen.getByTestId("pill-modal-submit"));

    await waitFor(() =>
      expect(screen.queryByTestId("pill-modal-form")).not.toBeInTheDocument(),
    );
    expect(getMockAdminPills().some((p) => p.name === "New Pill")).toBe(true);
  });

  it("surfaces zod validation error when title or subject is empty", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByTestId("pills-add-button")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("pills-add-button"));
    await user.click(screen.getByTestId("pill-modal-submit"));

    await waitFor(() =>
      expect(screen.getByText("Title is required.")).toBeInTheDocument(),
    );
    expect(screen.getByText("Pick a subject.")).toBeInTheDocument();
    expect(screen.getByTestId("pill-modal-form")).toBeInTheDocument();
  });

  it("chains PATCH /safety after create when the SafetyToggle is on (drift Finding #1)", async () => {
    const user = userEvent.setup();
    const safetyCalls: Array<{ id: string; safety_relevant: boolean }> = [];
    server.use(
      http.patch(`${API}/v1/pills/:pill_id/safety`, async ({ params, request }) => {
        const body = (await request.json()) as { safety_relevant: boolean };
        safetyCalls.push({
          id: String(params.pill_id),
          safety_relevant: body.safety_relevant,
        });
        // Defer to the real handler to keep state coherent.
        const pill = getMockAdminPills().find((p) => p.id === String(params.pill_id));
        if (!pill) return new HttpResponse(null, { status: 404 });
        const next = { ...pill, safety_relevant: body.safety_relevant };
        setMockAdminPills(getMockAdminPills().map((p) => (p.id === pill.id ? next : p)));
        return HttpResponse.json(next);
      }),
    );
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByTestId("pills-add-button")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("pills-add-button"));
    await user.type(screen.getByTestId("pill-modal-name"), "Safety Pill");
    const subjects = getMockAdminSubjects();
    const safetySubject = subjects.find((s) => s.name === "Site safety")!;
    await user.selectOptions(screen.getByTestId("pill-modal-subject"), safetySubject.id);
    // Flip the safety toggle on.
    await user.click(screen.getByRole("switch", { name: /Safety-relevant/i }));
    await user.click(screen.getByTestId("pill-modal-submit"));

    await waitFor(() => expect(safetyCalls.length).toBe(1));
    expect(safetyCalls[0]!.safety_relevant).toBe(true);
  });

  it("projects FastAPI 422 field errors onto the form via applyApiErrorToForm", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/v1/pills`, () =>
        HttpResponse.json(
          {
            detail: [
              { loc: ["body", "name"], msg: "Already taken.", type: "value_error" },
            ],
          },
          { status: 422 },
        ),
      ),
    );
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByTestId("pills-add-button")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("pills-add-button"));
    await user.type(screen.getByTestId("pill-modal-name"), "Duplicate");
    const subjects = getMockAdminSubjects();
    const paint = subjects.find((s) => s.name === "Paint QA")!;
    await user.selectOptions(screen.getByTestId("pill-modal-subject"), paint.id);
    await user.click(screen.getByTestId("pill-modal-submit"));

    await waitFor(() => expect(screen.getByText("Already taken.")).toBeInTheDocument());
  });
});

describe("pills tab — edit modal", () => {
  it("opens edit modal with pill pre-filled and subject read-only", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() => expect(screen.getByText("Reference Panels")).toBeInTheDocument());

    const ref = getMockAdminPills().find((p) => p.name === "Reference Panels")!;
    await user.click(screen.getByTestId(`pills-edit-${ref.id}`));

    const nameInput = (await screen.findByTestId("pill-modal-name")) as HTMLInputElement;
    expect(nameInput.value).toBe("Reference Panels");

    // Subject is read-only on edit because `PillUpdate` doesn't carry subject_id.
    const subjectReadonly = screen.getByTestId(
      "pill-modal-subject-readonly",
    ) as HTMLInputElement;
    expect(subjectReadonly).toBeDisabled();
    expect(subjectReadonly.value).toBe("Paint QA");
  });

  it("PATCHes only the dirty fields and updates the list", async () => {
    const user = userEvent.setup();
    let patchBody: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${API}/v1/pills/:pill_id`, async ({ request, params }) => {
        patchBody = (await request.json()) as Record<string, unknown>;
        const pill = getMockAdminPills().find((p) => p.id === String(params.pill_id));
        if (!pill) return new HttpResponse(null, { status: 404 });
        const next = { ...pill, ...patchBody };
        setMockAdminPills(getMockAdminPills().map((p) => (p.id === pill.id ? next : p)));
        return HttpResponse.json(next);
      }),
    );
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() => expect(screen.getByText("Reference Panels")).toBeInTheDocument());

    const ref = getMockAdminPills().find((p) => p.name === "Reference Panels")!;
    await user.click(screen.getByTestId(`pills-edit-${ref.id}`));

    const nameInput = (await screen.findByTestId("pill-modal-name")) as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, "Reference Panels v2");
    await user.click(screen.getByTestId("pill-modal-submit"));

    await waitFor(() => expect(patchBody).not.toBeNull());
    // Only `name` is dirty; description / discoverable / difficulty
    // must NOT appear in the PATCH body.
    expect(patchBody!.name).toBe("Reference Panels v2");
    expect("description" in patchBody!).toBe(false);
    expect("discoverable" in patchBody!).toBe(false);
    expect("available_difficulty_min" in patchBody!).toBe(false);
  });

  it("pre-fills description as '' when PillResponse.description is null (drift Finding #2 parity)", async () => {
    const subjects = getMockAdminSubjects();
    setMockAdminPills([
      {
        id: "eeeeeeee-eeee-eeee-eeee-000000007777",
        subject_id: subjects[0]!.id,
        name: "Null Description Pill",
        description: null,
        available_difficulty_min: 1,
        available_difficulty_max: 10,
        discoverable: true,
        safety_relevant: false,
        safety_relevant_overridden_at: null,
        estimated_minutes: null,
        retired_at: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);
    const user = userEvent.setup();
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByText("Null Description Pill")).toBeInTheDocument(),
    );
    await user.click(
      screen.getByTestId("pills-edit-eeeeeeee-eeee-eeee-eeee-000000007777"),
    );

    const desc = (await screen.findByTestId(
      "pill-modal-description",
    )) as HTMLTextAreaElement;
    expect(desc.value).toBe("");
  });
});

describe("pills tab — invalidation discipline (§C.1)", () => {
  it("invalidates adminKeys.pills.all() after create so list refetches", async () => {
    const user = userEvent.setup();
    let listCalls = 0;
    server.use(
      http.get(`${API}/v1/pills`, () => {
        listCalls += 1;
        return HttpResponse.json({
          data: getMockAdminPills(),
          meta: { next_cursor: null },
        });
      }),
    );
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByTestId("pills-add-button")).toBeInTheDocument(),
    );
    const initialCalls = listCalls;

    await user.click(screen.getByTestId("pills-add-button"));
    await user.type(screen.getByTestId("pill-modal-name"), "Invalidating Pill");
    const subjects = getMockAdminSubjects();
    const paint = subjects.find((s) => s.name === "Paint QA")!;
    await user.selectOptions(screen.getByTestId("pill-modal-subject"), paint.id);
    await user.click(screen.getByTestId("pill-modal-submit"));

    await waitFor(() => expect(listCalls).toBeGreaterThan(initialCalls));
  });
});
