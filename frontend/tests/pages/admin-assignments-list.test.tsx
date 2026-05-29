/**
 * Admin assignments list integration tests (FE-8 admin-identity §B.4
 * §6 Gherkin coverage). Mounts `/admin/assignments` and exercises
 * MSW GET/POST/DELETE `/v1/assignments` plus the cross-resource picker
 * caches (users, groups, tests, paths).
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/node";
import {
  getMockAdminAssignments,
  getMockAdminGroups,
  getMockAdminPaths,
  getMockAdminTests,
  getMockAdminUsers,
  resetMockAdminAssignments,
  resetMockAdminGroups,
  resetMockAdminPaths,
  resetMockAdminPills,
  resetMockAdminSubjects,
  resetMockAdminTests,
  resetMockAdminUsers,
  setMockAdminAssignments,
} from "@/mocks/handlers";
import { AuthProvider } from "@/lib/auth/context";
import AdminAssignmentsPage from "@/app/(authed)/(admin)/admin/assignments/page";

const API = "http://localhost:8000";

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
  usePathname: () => "/admin/assignments",
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
  resetMockAdminAssignments();
  resetMockAdminUsers();
  resetMockAdminGroups();
  resetMockAdminTests();
  resetMockAdminPaths();
  resetMockAdminPills();
  resetMockAdminSubjects();
});

afterEach(() => {
  cleanup();
});

describe("assignments list — render + cross-resource joins (drift Finding #3)", () => {
  it("renders both seed assignments with joined Test/Path names", async () => {
    render(mountTree(<AdminAssignmentsPage />));
    await waitFor(() =>
      expect(screen.getByTestId("assignments-table")).toBeInTheDocument(),
    );
    // First seed assignment is bound to pill_id of Antifouling Systems
    // → "Antifouling — focus (test, per_testee)" via reverse lookup.
    expect(screen.getByText(/Antifouling — focus/)).toBeInTheDocument();
    // Second seed is path-bound → "Paint QA induction (path)".
    expect(screen.getByText(/Paint QA induction \(path\)/)).toBeInTheDocument();
  });

  it("renders Progress column as em-dash placeholder (drift Finding #3 / §E.7)", async () => {
    render(mountTree(<AdminAssignmentsPage />));
    await waitFor(() =>
      expect(screen.getByTestId("assignments-table")).toBeInTheDocument(),
    );
    expect(screen.getAllByTestId("derived-count-pending").length).toBe(2);
  });

  it("formats Loop column via formatLoopMode helper (admin_reviewed → 'admin-reviewed')", async () => {
    render(mountTree(<AdminAssignmentsPage />));
    await waitFor(() =>
      expect(screen.getByTestId("assignments-table")).toBeInTheDocument(),
    );
    expect(screen.getByText("admin-reviewed")).toBeInTheDocument();
  });

  it("renders empty state when no assignments", async () => {
    setMockAdminAssignments([]);
    render(mountTree(<AdminAssignmentsPage />));
    await waitFor(() =>
      expect(screen.getByTestId("assignments-empty")).toBeInTheDocument(),
    );
  });
});

describe("assignments list — assigner filter", () => {
  it("URL replace fires when admin clicks 'All' segment", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminAssignmentsPage />));
    await waitFor(() =>
      expect(screen.getByTestId("assignments-table")).toBeInTheDocument(),
    );
    // FilterBar emits the value via the standard segment button id.
    const allBtn = screen.getByRole("button", { name: "All" });
    await user.click(allBtn);
    expect(mockReplace).toHaveBeenCalledWith("/admin/assignments?assigner=all");
  });
});

describe("assignments list — create flow (drift Findings #6 + #9)", () => {
  it("creates an assignment via POST + closes modal", async () => {
    const user = userEvent.setup();
    let createBody: {
      pill_id?: string | null;
      learning_path_id?: string | null;
      difficulty?: number;
      testee_ids?: string[];
      group_ids?: string[];
      loop_mode?: string;
    } | null = null;
    server.use(
      http.post(`${API}/v1/assignments`, async ({ request }) => {
        createBody = (await request.json()) as typeof createBody;
        return HttpResponse.json(
          {
            id: "eeee4444-eeee-eeee-eeee-000000000999",
            assigner_id: getMockAdminUsers()[0]!.id,
            pill_id: createBody!.pill_id ?? null,
            learning_path_id: createBody!.learning_path_id ?? null,
            difficulty: createBody!.difficulty ?? 5,
            deadline: null,
            is_mandatory: false,
            loop_mode: createBody!.loop_mode ?? "autonomous",
            assignee_ids: createBody!.testee_ids ?? [],
            created_at: "2026-04-20T00:00:00Z",
            updated_at: "2026-04-20T00:00:00Z",
          },
          { status: 201 },
        );
      }),
    );
    render(mountTree(<AdminAssignmentsPage />));
    await waitFor(() =>
      expect(screen.getByTestId("assignments-add-button")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("assignments-add-button"));
    await waitFor(() =>
      expect(screen.getByTestId("assignment-editor-form")).toBeInTheDocument(),
    );

    // Pick a test (per_testee with pill_id — bindable per drift Finding #6).
    const test = getMockAdminTests().find((t) => t.name === "Antifouling — focus")!;
    await user.selectOptions(screen.getByTestId("assignment-target"), `test:${test.id}`);

    // Pick a testee.
    const lerato = getMockAdminUsers().find((u) => u.email === "lerato@sitemesh.co")!;
    await user.click(screen.getByTestId(`picker-testee-${lerato.id}`));

    await user.click(screen.getByTestId("assignment-submit"));

    await waitFor(() => expect(createBody).not.toBeNull());
    expect(createBody!.pill_id).toBe(test.pill_id);
    expect(createBody!.learning_path_id).toBeNull();
    // Difficulty auto-derived from test.target_difficulty (drift Finding #9).
    expect(createBody!.difficulty).toBe(test.target_difficulty);
    expect(createBody!.testee_ids).toEqual([lerato.id]);
  });

  it("path-bound assignment posts learning_path_id + default difficulty=5", async () => {
    const user = userEvent.setup();
    let createBody: {
      pill_id?: string | null;
      learning_path_id?: string | null;
      difficulty?: number;
    } | null = null;
    server.use(
      http.post(`${API}/v1/assignments`, async ({ request }) => {
        createBody = (await request.json()) as typeof createBody;
        return HttpResponse.json(
          {
            id: "eeee4444-eeee-eeee-eeee-000000000998",
            assigner_id: getMockAdminUsers()[0]!.id,
            pill_id: null,
            learning_path_id: createBody!.learning_path_id!,
            difficulty: createBody!.difficulty!,
            deadline: null,
            is_mandatory: false,
            loop_mode: "autonomous",
            assignee_ids: [],
            created_at: "2026-04-20T00:00:00Z",
            updated_at: "2026-04-20T00:00:00Z",
          },
          { status: 201 },
        );
      }),
    );
    render(mountTree(<AdminAssignmentsPage />));
    await waitFor(() =>
      expect(screen.getByTestId("assignments-add-button")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("assignments-add-button"));

    const path = getMockAdminPaths().find((p) => p.name === "Paint QA induction")!;
    await user.selectOptions(screen.getByTestId("assignment-target"), `path:${path.id}`);

    const lerato = getMockAdminUsers().find((u) => u.email === "lerato@sitemesh.co")!;
    await user.click(screen.getByTestId(`picker-testee-${lerato.id}`));

    await user.click(screen.getByTestId("assignment-submit"));

    await waitFor(() => expect(createBody).not.toBeNull());
    expect(createBody!.pill_id).toBeNull();
    expect(createBody!.learning_path_id).toBe(path.id);
    expect(createBody!.difficulty).toBe(5);
  });

  it("zod blocks empty target", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminAssignmentsPage />));
    await waitFor(() =>
      expect(screen.getByTestId("assignments-add-button")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("assignments-add-button"));
    await user.click(screen.getByTestId("assignment-submit"));
    await waitFor(() =>
      expect(screen.getByText("Pick a test or learning path.")).toBeInTheDocument(),
    );
  });

  it("zod blocks empty targets array", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminAssignmentsPage />));
    await waitFor(() =>
      expect(screen.getByTestId("assignments-add-button")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("assignments-add-button"));
    const test = getMockAdminTests().find((t) => t.name === "Antifouling — focus")!;
    await user.selectOptions(screen.getByTestId("assignment-target"), `test:${test.id}`);
    await user.click(screen.getByTestId("assignment-submit"));
    await waitFor(() =>
      expect(
        screen.getByText("Bind to at least one testee or group."),
      ).toBeInTheDocument(),
    );
  });

  it("client-side dedup counts unique testees from group + testee selections (drift Finding #7)", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminAssignmentsPage />));
    await waitFor(() =>
      expect(screen.getByTestId("assignments-add-button")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("assignments-add-button"));

    // Pick the Q3 group (1 member: Lerato).
    const q3 = getMockAdminGroups().find((g) => g.name === "Q3 2026 induction")!;
    await user.click(screen.getByTestId(`picker-group-${q3.id}`));
    // Also pick Lerato directly — dedup should count her once.
    const lerato = getMockAdminUsers().find((u) => u.email === "lerato@sitemesh.co")!;
    await user.click(screen.getByTestId(`picker-testee-${lerato.id}`));

    // Field hint surfaces the dedup count.
    expect(screen.getByText(/1 unique testee selected/)).toBeInTheDocument();
  });
});

describe("assignments list — delete flow", () => {
  it("opens DeleteAssignmentModal + DELETE on confirm", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminAssignmentsPage />));
    await waitFor(() =>
      expect(screen.getByTestId("assignments-table")).toBeInTheDocument(),
    );
    const first = getMockAdminAssignments()[0]!;
    await user.click(screen.getByTestId(`assignments-delete-${first.id}`));
    await waitFor(() =>
      expect(screen.getByTestId("assignment-delete-confirm")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("assignment-delete-confirm"));
    await waitFor(() =>
      expect(getMockAdminAssignments().some((a) => a.id === first.id)).toBe(false),
    );
  });
});

describe("assignments list — test picker filters to bindable tests (drift Finding #6)", () => {
  it("tests with pill_id appear; tests with null pill_id (frozen/hand_authored) don't", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminAssignmentsPage />));
    await waitFor(() =>
      expect(screen.getByTestId("assignments-add-button")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("assignments-add-button"));

    const select = screen.getByTestId("assignment-target") as HTMLSelectElement;
    // Picker filters to tests with pill_id !== null (drift Finding #6).
    // Slice 11 extended seeds with two pill_id=null tests (frozen +
    // hand_authored) — those must NOT appear in the picker.
    const allTests = getMockAdminTests();
    const bindableCount = allTests.filter((t) => t.pill_id !== null).length;
    const testOptions = Array.from(select.querySelectorAll('option[value^="test:"]'));
    expect(testOptions.length).toBe(bindableCount);
    expect(testOptions.length).toBeLessThan(allTests.length);
  });
});
