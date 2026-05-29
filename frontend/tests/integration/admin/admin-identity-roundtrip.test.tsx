/**
 * FE-8 admin-identity round-trip integration test (§D.3 of
 * `fe-specs/FE-8-admin-identity.md`). Slice 14.
 *
 * Walks the cross-page chain:
 *
 *   1. /admin/users           — create new user "Casey Inspector".
 *   2. /admin/groups          — create new group "Yard A inspectors".
 *   3. /admin/groups/[groupId] — add the new user as a member via the
 *                                 picker modal (cross-cache: the user
 *                                 from step 1 must appear).
 *   4. /admin/assignments     — open New assignment, target the new
 *                                 group, pick a per_testee test seed
 *                                 (which has the required `pill_id`),
 *                                 submit. Verify the assignment lands
 *                                 in the table with the group's
 *                                 members as assignees.
 *
 * Per Slice 8 absorption (drift Finding #6): assignments resolve
 * `test_id → pill_id` locally and submit `AssignmentCreate.pill_id`.
 * Per Slice 14 drift Finding #3: frozen tests have `pill_id: null` so
 * they're not bindable — we use the per_testee seed which carries a
 * pill_id.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth/context";
import {
  getMockAdminAssignments,
  getMockAdminGroups,
  getMockAdminTests,
  getMockAdminUsers,
} from "@/mocks/handlers";
import AdminUsersPage from "@/app/(authed)/(admin)/admin/users/page";
import AdminGroupsPage from "@/app/(authed)/(admin)/admin/groups/page";
import AdminGroupDetailPage from "@/app/(authed)/(admin)/admin/groups/[groupId]/page";
import AdminAssignmentsPage from "@/app/(authed)/(admin)/admin/assignments/page";

const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockSearch = new URLSearchParams();
let mockParams: Record<string, string> = {};
let mockPathname = "/admin";

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
  mockPathname = "/admin";
});

afterEach(() => {
  cleanup();
});

describe("FE-8 admin identity round-trip — user → group → membership → assignment", () => {
  it("walks the full chain end-to-end", async () => {
    const user = userEvent.setup();
    const initialUserCount = getMockAdminUsers().length;
    const initialGroupCount = getMockAdminGroups().length;
    const initialAssignmentCount = getMockAdminAssignments().length;

    // -------------------------------------------------------------
    // Step 1: create a user
    // -------------------------------------------------------------
    mockPathname = "/admin/users";
    render(mountTree(<AdminUsersPage />));
    await waitFor(() => expect(screen.getByTestId("users-table")).toBeInTheDocument());

    await user.click(screen.getByTestId("users-add-button"));
    await waitFor(() => expect(screen.getByTestId("user-add-form")).toBeInTheDocument());
    await user.type(screen.getByTestId("user-add-email"), "casey@inspector.test");
    await user.type(screen.getByTestId("user-add-name"), "Casey Inspector");
    await user.click(screen.getByTestId("user-add-submit"));

    await waitFor(() => {
      expect(getMockAdminUsers().length).toBe(initialUserCount + 1);
    });
    const newUser = getMockAdminUsers().find((u) => u.email === "casey@inspector.test")!;
    expect(newUser).toBeTruthy();

    cleanup();

    // -------------------------------------------------------------
    // Step 2: create a group
    // -------------------------------------------------------------
    mockPathname = "/admin/groups";
    render(mountTree(<AdminGroupsPage />));
    await waitFor(() => expect(screen.getByTestId("groups-table")).toBeInTheDocument());

    await user.click(screen.getByTestId("groups-add-button"));
    await waitFor(() => expect(screen.getByTestId("group-add-form")).toBeInTheDocument());
    await user.type(screen.getByTestId("group-add-name"), "Yard A inspectors");
    await user.type(
      screen.getByTestId("group-add-description"),
      "Inspectors covering the East yard.",
    );
    await user.click(screen.getByTestId("group-add-submit"));

    await waitFor(() => {
      expect(getMockAdminGroups().length).toBe(initialGroupCount + 1);
    });
    const newGroup = getMockAdminGroups().find((g) => g.name === "Yard A inspectors")!;
    expect(newGroup).toBeTruthy();

    cleanup();

    // -------------------------------------------------------------
    // Step 3: add the user as a member of the group
    // -------------------------------------------------------------
    mockPathname = `/admin/groups/${newGroup.id}`;
    mockParams = { groupId: newGroup.id };
    render(mountTree(<AdminGroupDetailPage />));
    await waitFor(() =>
      expect(screen.getByTestId("group-add-member-button")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("group-add-member-button"));
    await waitFor(() => expect(screen.getByTestId("picker-list")).toBeInTheDocument());
    // Cross-cache: the user we created in step 1 must appear in the
    // picker (proves MSW seed state propagated).
    await waitFor(() =>
      expect(screen.getByTestId(`picker-row-${newUser.id}`)).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId(`picker-row-${newUser.id}`));
    await user.click(screen.getByTestId("picker-add"));

    await waitFor(() => {
      const updated = getMockAdminGroups().find((g) => g.id === newGroup.id)!;
      expect(updated.member_ids).toContain(newUser.id);
    });

    cleanup();

    // -------------------------------------------------------------
    // Step 4: create an assignment bound to the group
    // -------------------------------------------------------------
    mockPathname = "/admin/assignments";
    mockParams = {};
    mockSearch = new URLSearchParams();
    render(mountTree(<AdminAssignmentsPage />));
    await waitFor(() =>
      expect(screen.getByTestId("assignments-add-button")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("assignments-add-button"));
    await waitFor(() =>
      expect(screen.getByTestId("assignment-editor-form")).toBeInTheDocument(),
    );

    // Pick a per_testee test (has pill_id → bindable per Slice 14
    // Finding #3 absorption). The seed at id ...0001 is "Antifouling —
    // focus" per_testee published.
    const perTesteeTest = getMockAdminTests().find(
      (t) => t.mode === "per_testee" && t.pill_id !== null,
    )!;
    expect(perTesteeTest).toBeTruthy();

    const targetSelect = screen.getByTestId("assignment-target") as HTMLSelectElement;
    const testOption = within(targetSelect)
      .getAllByRole("option")
      .find((o) => o.textContent?.includes(perTesteeTest.name))! as HTMLOptionElement;
    expect(testOption).toBeTruthy();
    await user.selectOptions(targetSelect, testOption.value);

    // Pick the group via the multi-target picker.
    await waitFor(() =>
      expect(screen.getByTestId(`picker-group-${newGroup.id}`)).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId(`picker-group-${newGroup.id}`));

    await user.click(screen.getByTestId("assignment-submit"));

    await waitFor(() => {
      expect(getMockAdminAssignments().length).toBe(initialAssignmentCount + 1);
    });
    const newAssignment = getMockAdminAssignments()[0]!;
    // Backend expands the group into its members (Slice 7 LOCKED behaviour);
    // the new user from step 1 must be in the assignee list.
    expect(newAssignment.assignee_ids).toContain(newUser.id);
    expect(newAssignment.pill_id).toBe(perTesteeTest.pill_id);
  });
});
