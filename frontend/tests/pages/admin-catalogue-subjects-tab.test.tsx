/**
 * Subjects tab integration tests (FE-8 §B.3 §6 Gherkin coverage).
 *
 * Mounts the full admin catalogue page with `?tab=subjects` and
 * exercises real MSW handlers for GET / POST / PATCH / DELETE
 * `/v1/subjects`. Client-side filter validates the §E.7 absorption
 * (server has no `q` param — Slice 2 Finding #1).
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/node";
import {
  getMockAdminSubjects,
  resetMockAdminSubjects,
  setMockAdminSubjects,
} from "@/mocks/handlers";
import AdminCataloguePage from "@/app/(authed)/(admin)/admin/catalogue/page";

const API = "http://localhost:8000";

const mockReplace = vi.fn();
let mockSearch = new URLSearchParams("tab=subjects");

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
  mockSearch = new URLSearchParams("tab=subjects");
  server.resetHandlers();
  resetMockAdminSubjects();
});

afterEach(() => {
  cleanup();
});

describe("subjects tab — list", () => {
  it("renders all loaded subjects in the table", async () => {
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() => expect(screen.getByTestId("subjects-table")).toBeInTheDocument());
    expect(screen.getByText("Paint QA")).toBeInTheDocument();
    expect(screen.getByText("Marine coatings")).toBeInTheDocument();
    expect(screen.getByText("NACE corrosion")).toBeInTheDocument();
    expect(screen.getByText("Site safety")).toBeInTheDocument();
  });

  it("shows skeletons while the first page is in flight", async () => {
    server.use(
      http.get(`${API}/v1/subjects`, async () => {
        await new Promise((r) => setTimeout(r, 50));
        return HttpResponse.json({ data: [], meta: { next_cursor: null } });
      }),
    );
    render(mountTree(<AdminCataloguePage />));
    expect(screen.getByTestId("subjects-loading")).toBeInTheDocument();
  });

  it("shows empty state copy when no subjects exist", async () => {
    setMockAdminSubjects([]);
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() => expect(screen.getByTestId("subjects-empty")).toBeInTheDocument());
    expect(screen.getByText(/No subjects yet/i)).toBeInTheDocument();
  });
});

describe("subjects tab — client-side filter (Finding #1 / §E.7)", () => {
  it("filters subjects by name client-side and writes ?q= to the URL", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() => expect(screen.getByTestId("subjects-table")).toBeInTheDocument());

    await user.type(screen.getByTestId("filter-bar-search"), "marine");

    // Debounce is 300ms; wait for the router.replace call.
    await waitFor(
      () =>
        expect(mockReplace).toHaveBeenCalledWith(
          "/admin/catalogue?tab=subjects&q=marine",
        ),
      { timeout: 1500 },
    );
  });

  it("shows filtered-empty copy when the search matches no rows", async () => {
    mockSearch = new URLSearchParams("tab=subjects&q=zzznomatch");
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() => expect(screen.getByTestId("subjects-empty")).toBeInTheDocument());
    expect(screen.getByText(/No subjects match your search/i)).toBeInTheDocument();
  });

  it("renders only matching rows when the URL carries ?q=", async () => {
    mockSearch = new URLSearchParams("tab=subjects&q=marine");
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() => expect(screen.getByText("Marine coatings")).toBeInTheDocument());
    expect(screen.queryByText("Paint QA")).not.toBeInTheDocument();
    expect(screen.queryByText("NACE corrosion")).not.toBeInTheDocument();
  });
});

describe("subjects tab — create modal", () => {
  it("creates a subject via POST and closes the modal", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByTestId("subjects-add-button")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("subjects-add-button"));
    await waitFor(() =>
      expect(screen.getByTestId("subject-modal-form")).toBeInTheDocument(),
    );

    await user.type(screen.getByTestId("subject-modal-name"), "Welding");
    await user.click(screen.getByTestId("subject-modal-submit"));

    await waitFor(() =>
      expect(screen.queryByTestId("subject-modal-form")).not.toBeInTheDocument(),
    );

    expect(getMockAdminSubjects().some((s) => s.name === "Welding")).toBe(true);
  });

  it("surfaces zod validation error when name is empty", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByTestId("subjects-add-button")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("subjects-add-button"));
    await user.click(screen.getByTestId("subject-modal-submit"));

    await waitFor(() =>
      expect(screen.getByText("Subject name is required.")).toBeInTheDocument(),
    );
    // Modal stays open on validation error.
    expect(screen.getByTestId("subject-modal-form")).toBeInTheDocument();
  });

  it("projects FastAPI 422 field errors onto the form via applyApiErrorToForm", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/v1/subjects`, () =>
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
      expect(screen.getByTestId("subjects-add-button")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("subjects-add-button"));
    await user.type(screen.getByTestId("subject-modal-name"), "Duplicate");
    await user.click(screen.getByTestId("subject-modal-submit"));

    await waitFor(() => expect(screen.getByText("Already taken.")).toBeInTheDocument());
  });
});

describe("subjects tab — edit modal (Finding #2)", () => {
  it("pre-fills description as '' when SubjectResponse.description is null", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminCataloguePage />));
    // "NACE corrosion" is the fixture with description=null.
    await waitFor(() => expect(screen.getByText("NACE corrosion")).toBeInTheDocument());

    const nace = getMockAdminSubjects().find((s) => s.name === "NACE corrosion")!;
    await user.click(screen.getByTestId(`subjects-edit-${nace.id}`));

    await waitFor(() =>
      expect(screen.getByTestId("subject-modal-form")).toBeInTheDocument(),
    );
    const desc = screen.getByTestId("subject-modal-description") as HTMLTextAreaElement;
    expect(desc.value).toBe("");
  });

  it("updates a subject via PATCH and refreshes the list", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() => expect(screen.getByText("Paint QA")).toBeInTheDocument());

    const paint = getMockAdminSubjects().find((s) => s.name === "Paint QA")!;
    await user.click(screen.getByTestId(`subjects-edit-${paint.id}`));

    const nameInput = (await screen.findByTestId(
      "subject-modal-name",
    )) as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, "Paint QA v2");
    await user.click(screen.getByTestId("subject-modal-submit"));

    await waitFor(() => expect(screen.getByText("Paint QA v2")).toBeInTheDocument());
  });
});

describe("subjects tab — delete modal", () => {
  it("deletes a subject via DELETE on confirm", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() => expect(screen.getByText("Site safety")).toBeInTheDocument());

    const safety = getMockAdminSubjects().find((s) => s.name === "Site safety")!;
    await user.click(screen.getByTestId(`subjects-delete-${safety.id}`));
    await user.click(screen.getByTestId("subjects-delete-confirm"));

    await waitFor(() =>
      expect(screen.queryByText("Site safety")).not.toBeInTheDocument(),
    );
    expect(getMockAdminSubjects().some((s) => s.name === "Site safety")).toBe(false);
  });

  it("surfaces server-side rejection in the modal body and disables confirm", async () => {
    const user = userEvent.setup();
    server.use(
      http.delete(`${API}/v1/subjects/:subject_id`, () =>
        HttpResponse.json(
          {
            error: {
              code: "subject_in_use",
              message: "this subject has 14 pills.",
              detail: null,
            },
          },
          { status: 409 },
        ),
      ),
    );
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() => expect(screen.getByText("Marine coatings")).toBeInTheDocument());

    const marine = getMockAdminSubjects().find((s) => s.name === "Marine coatings")!;
    await user.click(screen.getByTestId(`subjects-delete-${marine.id}`));
    await user.click(screen.getByTestId("subjects-delete-confirm"));

    await waitFor(() =>
      expect(
        screen.getByText(/Can't delete — this subject has 14 pills/i),
      ).toBeInTheDocument(),
    );
    expect(screen.getByTestId("subjects-delete-confirm")).toBeDisabled();
  });
});

describe("subjects tab — invalidation discipline (§C.1)", () => {
  it("invalidates adminKeys.subjects.all() on create so list refetches", async () => {
    const user = userEvent.setup();
    let listCalls = 0;
    server.use(
      http.get(`${API}/v1/subjects`, () => {
        listCalls += 1;
        return HttpResponse.json({
          data: getMockAdminSubjects(),
          meta: { next_cursor: null },
        });
      }),
    );
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByTestId("subjects-add-button")).toBeInTheDocument(),
    );
    const initialCalls = listCalls;

    await user.click(screen.getByTestId("subjects-add-button"));
    await user.type(screen.getByTestId("subject-modal-name"), "Welding");
    await user.click(screen.getByTestId("subject-modal-submit"));

    await waitFor(() => expect(listCalls).toBeGreaterThan(initialCalls));
  });
});
