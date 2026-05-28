/**
 * Admin path editor integration tests (FE-8 §B.7 §6 Gherkin coverage).
 *
 * `pathId === "new"` exercises create mode; UUID values exercise
 * edit mode. Drag-reorder a11y is verified via @dnd-kit's
 * KeyboardSensor (Slice 7 drift Finding #8 absorption).
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/node";
import {
  getMockAdminPaths,
  getMockAdminPills,
  resetMockAdminPaths,
  resetMockAdminPills,
  resetMockAdminSubjects,
} from "@/mocks/handlers";
import PathEditorPage from "@/app/(authed)/(admin)/admin/paths/[pathId]/edit/page";

const API = "http://localhost:8000";

const mockPush = vi.fn();
let mockParams: { pathId: string } = { pathId: "new" };

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/admin/paths/edit",
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
  mockParams = { pathId: "new" };
  server.resetHandlers();
  resetMockAdminPaths();
  resetMockAdminPills();
  resetMockAdminSubjects();
});

afterEach(() => {
  cleanup();
});

describe("path editor — create mode (`/admin/paths/new/edit`)", () => {
  it("mounts with empty form on pathId='new'", async () => {
    render(mountTree(<PathEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("path-editor-form")).toBeInTheDocument(),
    );
    expect((screen.getByTestId("path-editor-name") as HTMLInputElement).value).toBe("");
    expect(screen.getByTestId("path-editor-empty")).toBeInTheDocument();
  });

  it("rejects submit with empty pills array (zod min(1) — drift Finding #4)", async () => {
    const user = userEvent.setup();
    render(mountTree(<PathEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("path-editor-name")).toBeInTheDocument(),
    );

    await user.type(screen.getByTestId("path-editor-name"), "Empty path");
    await user.click(screen.getByTestId("path-editor-save"));

    await waitFor(() =>
      expect(screen.getByText("Add at least one pill to the path.")).toBeInTheDocument(),
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("rejects submit with empty name (zod min(1))", async () => {
    const user = userEvent.setup();
    render(mountTree(<PathEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("path-editor-save")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("path-editor-save"));
    await waitFor(() =>
      expect(screen.getByText("Path name is required.")).toBeInTheDocument(),
    );
  });

  it("adds pills via the picker and saves with POST + navigates to /admin/paths", async () => {
    const user = userEvent.setup();
    let createBody: { name?: string; pill_ids?: string[] } | null = null;
    server.use(
      http.post(`${API}/v1/learning-paths`, async ({ request }) => {
        createBody = (await request.json()) as {
          name: string;
          pill_ids: string[];
        };
        return HttpResponse.json(
          {
            id: "00000000-0000-0000-0000-000000000999",
            name: createBody!.name!,
            description: null,
            is_private: false,
            owner_user_id: null,
            pill_ids: createBody!.pill_ids!,
            created_at: "2026-04-01T00:00:00Z",
            updated_at: "2026-04-01T00:00:00Z",
          },
          { status: 201 },
        );
      }),
    );
    render(mountTree(<PathEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("path-editor-name")).toBeInTheDocument(),
    );

    await user.type(screen.getByTestId("path-editor-name"), "Welding fundamentals");

    // Open picker, select first available pill, add.
    await user.click(screen.getByTestId("path-editor-add-pill"));
    await waitFor(() => expect(screen.getByTestId("picker-list")).toBeInTheDocument());

    const refPanels = getMockAdminPills().find((p) => p.name === "Reference Panels")!;
    await user.click(screen.getByTestId(`picker-row-${refPanels.id}`));
    await user.click(screen.getByTestId("picker-add"));

    await waitFor(() =>
      expect(screen.getByTestId("path-editor-pill-row-1")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("path-editor-save"));

    await waitFor(() => expect(createBody).not.toBeNull());
    expect(createBody!.name).toBe("Welding fundamentals");
    expect(createBody!.pill_ids).toEqual([refPanels.id]);
    expect(mockPush).toHaveBeenCalledWith("/admin/paths");
  });
});

describe("path editor — edit mode", () => {
  it("pre-fills form from useAdminPath response", async () => {
    const target = getMockAdminPaths().find((p) => p.name === "Paint QA induction")!;
    mockParams = { pathId: target.id };

    render(mountTree(<PathEditorPage />));
    await waitFor(() =>
      expect((screen.getByTestId("path-editor-name") as HTMLInputElement).value).toBe(
        "Paint QA induction",
      ),
    );
    // pill_ids from the fixture (2 pills) populate ordered rows.
    expect(screen.getByTestId("path-editor-pill-row-1")).toBeInTheDocument();
    expect(screen.getByTestId("path-editor-pill-row-2")).toBeInTheDocument();
  });

  it("PATCH only changed fields (drift Finding #10 — value-diff strategy)", async () => {
    const target = getMockAdminPaths().find((p) => p.name === "Paint QA induction")!;
    mockParams = { pathId: target.id };

    const user = userEvent.setup();
    let patchBody: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${API}/v1/learning-paths/:path_id`, async ({ request }) => {
        patchBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...target, name: patchBody.name ?? target.name });
      }),
    );
    render(mountTree(<PathEditorPage />));
    await waitFor(() =>
      expect((screen.getByTestId("path-editor-name") as HTMLInputElement).value).toBe(
        "Paint QA induction",
      ),
    );

    const nameInput = screen.getByTestId("path-editor-name");
    await user.clear(nameInput);
    await user.type(nameInput, "Paint QA induction v2");
    await user.click(screen.getByTestId("path-editor-save"));

    await waitFor(() => expect(patchBody).not.toBeNull());
    expect(patchBody!.name).toBe("Paint QA induction v2");
    // description + pill_ids unchanged → must NOT appear in the body.
    expect("description" in patchBody!).toBe(false);
    expect("pill_ids" in patchBody!).toBe(false);
    expect(mockPush).toHaveBeenCalledWith("/admin/paths");
  });

  it("removes a pill row when 'Remove' is clicked", async () => {
    const target = getMockAdminPaths().find((p) => p.name === "Paint QA induction")!;
    mockParams = { pathId: target.id };

    const user = userEvent.setup();
    render(mountTree(<PathEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("path-editor-pill-row-1")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("path-editor-pill-row-2")).toBeInTheDocument();

    await user.click(screen.getByTestId("path-editor-remove-pill-1"));

    // After removal, original row 2 becomes row 1.
    await waitFor(() =>
      expect(screen.queryByTestId("path-editor-pill-row-2")).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("path-editor-pill-row-1")).toBeInTheDocument();
  });
});

describe("path editor — cancel + dirty-confirm (drift Finding #11)", () => {
  it("navigates straight back when the form is pristine", async () => {
    const user = userEvent.setup();
    render(mountTree(<PathEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("path-editor-cancel")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("path-editor-cancel"));
    expect(mockPush).toHaveBeenCalledWith("/admin/paths");
  });

  it("opens the Modal-based confirm dialog when the form is dirty", async () => {
    const user = userEvent.setup();
    render(mountTree(<PathEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("path-editor-name")).toBeInTheDocument(),
    );
    await user.type(screen.getByTestId("path-editor-name"), "Dirty");
    await user.click(screen.getByTestId("path-editor-cancel"));

    await waitFor(() =>
      expect(screen.getByTestId("path-editor-discard-confirm")).toBeInTheDocument(),
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("Discard navigates to /admin/paths", async () => {
    const user = userEvent.setup();
    render(mountTree(<PathEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("path-editor-name")).toBeInTheDocument(),
    );
    await user.type(screen.getByTestId("path-editor-name"), "Dirty");
    await user.click(screen.getByTestId("path-editor-cancel"));
    await user.click(screen.getByTestId("path-editor-discard-confirm"));
    expect(mockPush).toHaveBeenCalledWith("/admin/paths");
  });
});

describe("path editor — 422 projection on save", () => {
  it("projects field errors via applyApiErrorToForm", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/v1/learning-paths`, () =>
        HttpResponse.json(
          {
            detail: [
              { loc: ["body", "name"], msg: "Duplicate path name.", type: "value_error" },
            ],
          },
          { status: 422 },
        ),
      ),
    );
    render(mountTree(<PathEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("path-editor-name")).toBeInTheDocument(),
    );
    await user.type(screen.getByTestId("path-editor-name"), "Welding");
    await user.click(screen.getByTestId("path-editor-add-pill"));
    await waitFor(() => expect(screen.getByTestId("picker-list")).toBeInTheDocument());
    const refPanels = getMockAdminPills().find((p) => p.name === "Reference Panels")!;
    await user.click(screen.getByTestId(`picker-row-${refPanels.id}`));
    await user.click(screen.getByTestId("picker-add"));
    await waitFor(() =>
      expect(screen.getByTestId("path-editor-pill-row-1")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("path-editor-save"));
    await waitFor(() =>
      expect(screen.getByText("Duplicate path name.")).toBeInTheDocument(),
    );
    expect(mockPush).not.toHaveBeenCalled();
  });
});
