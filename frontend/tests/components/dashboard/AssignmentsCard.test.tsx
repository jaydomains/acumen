import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AssignmentsCard } from "@/components/dashboard/AssignmentsCard";
import {
  setMockMeAssignments,
  setMeAssignmentsStatus,
  resetMockMeAssignments,
} from "@/mocks/handlers";
import type { AssignmentResponse } from "@/lib/queries/me";

// pill_ids that won't exist in the catalogue default fixture, so name
// resolution deterministically exercises the `Pill {id8}…` fallback (N4
// approved fallback). The E2E asserts the resolved-name happy path.
const PILL_A = "aaaaaaaa-1111-1111-1111-111111111111";
const PILL_B = "bbbbbbbb-2222-2222-2222-222222222222";

function makeAssignment(over: Partial<AssignmentResponse>): AssignmentResponse {
  return {
    id: "00000000-0000-0000-0000-0000000000a1",
    assigner_id: "00000000-0000-0000-0000-0000000000ad",
    pill_id: PILL_A,
    learning_path_id: null,
    difficulty: 4,
    deadline: null,
    is_mandatory: false,
    loop_mode: "autonomous",
    assignee_ids: ["00000000-0000-0000-0000-0000000000c1"],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

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
  resetMockMeAssignments();
});

afterEach(() => {
  cleanup();
});

describe("AssignmentsCard", () => {
  it("renders assignment rows from /v1/me/assignments", async () => {
    setMockMeAssignments([
      makeAssignment({ id: "00000000-0000-0000-0000-0000000000a1", pill_id: PILL_A }),
      makeAssignment({ id: "00000000-0000-0000-0000-0000000000a2", pill_id: PILL_B }),
    ]);
    render(mountTree(<AssignmentsCard />));
    const rows = await screen.findAllByTestId("assignment-row");
    expect(rows).toHaveLength(2);
  });

  it("falls back to a `Pill {id8}` label when a pill_id is not in the catalogue", async () => {
    setMockMeAssignments([makeAssignment({ pill_id: PILL_A })]);
    render(mountTree(<AssignmentsCard />));
    await screen.findByTestId("assignment-row");
    expect(screen.getByText(/Pill aaaaaaaa/)).toBeInTheDocument();
  });

  it("the Mandatory tab filters to mandatory assignments", async () => {
    setMockMeAssignments([
      makeAssignment({ id: "00000000-0000-0000-0000-0000000000a1", is_mandatory: true }),
      makeAssignment({
        id: "00000000-0000-0000-0000-0000000000a2",
        pill_id: PILL_B,
        is_mandatory: false,
      }),
    ]);
    render(mountTree(<AssignmentsCard />));
    await waitFor(() => expect(screen.getAllByTestId("assignment-row")).toHaveLength(2));

    await userEvent.click(screen.getByTestId("assignments-tab-mandatory"));
    expect(screen.getAllByTestId("assignment-row")).toHaveLength(1);
    expect(screen.getByTestId("assignment-mandatory-tag")).toBeInTheDocument();
  });

  it("the Follow-ups tab is gone; only All and Mandatory remain", async () => {
    setMockMeAssignments([makeAssignment({})]);
    render(mountTree(<AssignmentsCard />));
    await screen.findByTestId("assignment-row");
    expect(screen.getByTestId("assignments-tab-all")).toBeInTheDocument();
    expect(screen.getByTestId("assignments-tab-mandatory")).toBeInTheDocument();
    expect(screen.queryByTestId("assignments-tab-followups")).not.toBeInTheDocument();
  });

  it("renders the empty state when nothing is assigned", async () => {
    render(mountTree(<AssignmentsCard />));
    expect(await screen.findByTestId("assignments-empty")).toBeInTheDocument();
  });

  it("renders an inline error when the endpoint fails", async () => {
    setMeAssignmentsStatus(500);
    render(mountTree(<AssignmentsCard />));
    expect(await screen.findByTestId("assignments-error")).toBeInTheDocument();
  });
});
