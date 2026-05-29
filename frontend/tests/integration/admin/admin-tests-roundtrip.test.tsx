/**
 * FE-8 admin-tests round-trip integration test (§D.3 of
 * `fe-specs/FE-8-admin-tests.md`). Slice 14.
 *
 * Walks the cross-page test-authoring chain:
 *
 *   1. /admin/tests                — verify the seeded per_testee test
 *                                     lands in the list and the +New
 *                                     CTA routes to the editor.
 *   2. /admin/tests/new/edit        — create a per_testee test with
 *                                     pill + difficulty, save as draft,
 *                                     URL flips to the new test id.
 *   3. /admin/tests/[newId]/edit    — click Publish, status flips to
 *                                     "published".
 *   4. /admin/assignments           — open New assignment, verify the
 *                                     freshly published per_testee
 *                                     test's pill is now bindable.
 *
 * Per Slice 14 drift sweep Finding #3: frozen tests have
 * `pill_id: null` so they cannot reach the assignments picker — the
 * round-trip uses per_testee mode which carries a pill_id by design.
 *
 * Frozen + question-editor authoring is covered by the Slice 13
 * `admin-question-editor.test.tsx` page test (which exercises Add →
 * Edit → Save&Next → Delete inside the modal). That flow is per-mount
 * (no cross-page transition), so it doesn't belong in a round-trip.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth/context";
import {
  getMockAdminAssignments,
  getMockAdminPills,
  getMockAdminTests,
  setMockAdminTests,
} from "@/mocks/handlers";
import AdminTestsPage from "@/app/(authed)/(admin)/admin/tests/page";
import AdminTestEditorPage from "@/app/(authed)/(admin)/admin/tests/[testId]/edit/page";
import AdminAssignmentsPage from "@/app/(authed)/(admin)/admin/assignments/page";

const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockSearch = new URLSearchParams();
let mockParams: Record<string, string> = {};
let mockPathname = "/admin/tests";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearch,
  useParams: () => mockParams,
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
  mockPush.mockClear();
  mockReplace.mockClear();
  mockSearch = new URLSearchParams();
  mockParams = {};
  mockPathname = "/admin/tests";
});

afterEach(() => {
  cleanup();
});

describe("FE-8 admin tests round-trip — create → publish → bindable", () => {
  it("walks the full chain end-to-end", async () => {
    const user = userEvent.setup();
    const initialTestCount = getMockAdminTests().length;
    const initialAssignmentCount = getMockAdminAssignments().length;

    // Clear all seeded tests so the assignment picker assertion in
    // step 4 is unambiguous (no other per_testee+published tests around).
    setMockAdminTests([]);

    // The pill we'll bind the new test to.
    const targetPill = getMockAdminPills()[0]!;

    // -------------------------------------------------------------
    // Step 1: list page lands, +New CTA routes to /new/edit
    // -------------------------------------------------------------
    render(mountTree(<AdminTestsPage />));
    // The list is empty (we just cleared it).
    await waitFor(() => expect(screen.getByTestId("tests-empty")).toBeInTheDocument());
    await user.click(screen.getByTestId("tests-add-button"));
    expect(mockPush).toHaveBeenCalledWith("/admin/tests/new/edit");

    cleanup();

    // -------------------------------------------------------------
    // Step 2: editor in create mode → save draft
    // -------------------------------------------------------------
    mockPathname = "/admin/tests/new/edit";
    mockParams = { testId: "new" };
    render(mountTree(<AdminTestEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("test-editor-form")).toBeInTheDocument(),
    );

    // per_testee is the default mode (see Slice 12 TestEditor defaults).
    expect(screen.getByTestId("per-testee-section")).toBeInTheDocument();

    await user.type(screen.getByTestId("test-editor-name"), "Antifouling — round-trip");
    const pillSelect = screen.getByTestId("per-testee-pill-select") as HTMLSelectElement;
    const pillOption = within(pillSelect)
      .getAllByRole("option")
      .find((o) => o.textContent?.includes(targetPill.name))! as HTMLOptionElement;
    await user.selectOptions(pillSelect, pillOption.value);
    await user.click(screen.getByTestId("difficulty-picker-6"));
    await user.click(screen.getByTestId("publish-controls-save"));

    await waitFor(() => {
      expect(getMockAdminTests().length).toBe(initialTestCount - initialTestCount + 1);
    });
    const newTest = getMockAdminTests().find(
      (t) => t.name === "Antifouling — round-trip",
    )!;
    expect(newTest).toBeTruthy();
    expect(newTest.mode).toBe("per_testee");
    expect(newTest.status).toBe("draft");
    expect(newTest.pill_id).toBe(targetPill.id);
    // URL flipped to /admin/tests/{newId}/edit
    expect(mockReplace).toHaveBeenCalledWith(`/admin/tests/${newTest.id}/edit`);

    cleanup();

    // -------------------------------------------------------------
    // Step 3: editor in edit mode → click Publish
    // -------------------------------------------------------------
    mockPathname = `/admin/tests/${newTest.id}/edit`;
    mockParams = { testId: newTest.id };
    render(mountTree(<AdminTestEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("publish-controls-publish")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("publish-controls-publish")).not.toBeDisabled();
    await user.click(screen.getByTestId("publish-controls-publish"));

    await waitFor(() => {
      const updated = getMockAdminTests().find((t) => t.id === newTest.id)!;
      expect(updated.status).toBe("published");
    });
    // Now in published state the warn banner mounts + Lock button shows.
    await waitFor(() =>
      expect(screen.getByTestId("warn-banner-published")).toBeInTheDocument(),
    );

    cleanup();

    // -------------------------------------------------------------
    // Step 4: new assignment can bind the published test
    // -------------------------------------------------------------
    mockPathname = "/admin/assignments";
    mockParams = {};
    render(mountTree(<AdminAssignmentsPage />));
    await waitFor(() =>
      expect(screen.getByTestId("assignments-add-button")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("assignments-add-button"));
    await waitFor(() =>
      expect(screen.getByTestId("assignment-editor-form")).toBeInTheDocument(),
    );

    const targetSelect = screen.getByTestId("assignment-target") as HTMLSelectElement;
    const testOption = within(targetSelect)
      .getAllByRole("option")
      .find((o) =>
        o.textContent?.includes("Antifouling — round-trip"),
      )! as HTMLOptionElement;
    expect(testOption).toBeTruthy(); // The just-published test is bindable.
    await user.selectOptions(targetSelect, testOption.value);

    // Pick any seeded group as the assignee target (groups always
    // render in the picker; testees depend on the loaded users page).
    const groupRows = await screen.findAllByTestId(/^picker-group-/);
    expect(groupRows.length).toBeGreaterThan(0);
    await user.click(groupRows[0]!);
    await user.click(screen.getByTestId("assignment-submit"));

    await waitFor(() => {
      expect(getMockAdminAssignments().length).toBe(initialAssignmentCount + 1);
    });
    const newAssignment = getMockAdminAssignments()[0]!;
    expect(newAssignment.pill_id).toBe(targetPill.id);
  });
});
