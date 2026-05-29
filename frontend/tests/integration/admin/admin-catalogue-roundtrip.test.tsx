/**
 * FE-8 admin-catalogue round-trip integration test (§D.3 of
 * `fe-specs/FE-8-admin-catalogue.md`). Slice 14.
 *
 * Walks the cross-page chain that single-page tests don't cover:
 *
 *   1. /admin/catalogue?tab=subjects — create new subject "Welding QC".
 *   2. /admin/catalogue?tab=pills    — create new pill bound to that
 *                                      subject. Verify the subject
 *                                      shows up in the pill modal's
 *                                      subject dropdown (cross-cache
 *                                      contract).
 *   3. /admin/catalogue?tab=proposals — approve a seeded AI proposal,
 *                                       verify the approved pill is
 *                                       now in the cache.
 *
 * State carries across page transitions via MSW server state
 * (per `tests/setup.ts` Slice 14 admin reset chain). Each step mounts
 * a fresh `QueryClient` per the existing round-trip convention;
 * persistence between steps lives in MSW, not in the cache.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  getMockAdminPills,
  getMockAdminProposals,
  getMockAdminSubjects,
} from "@/mocks/handlers";
import AdminCataloguePage from "@/app/(authed)/(admin)/admin/catalogue/page";

const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockSearch = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
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
  mockPush.mockClear();
  mockReplace.mockClear();
  mockSearch = new URLSearchParams();
});

afterEach(() => {
  cleanup();
});

describe("FE-8 admin catalogue round-trip — subject → pill → proposal", () => {
  it("creates a subject, then a pill bound to it, then approves a seeded proposal", async () => {
    const user = userEvent.setup();
    const initialSubjectCount = getMockAdminSubjects().length;
    const initialPillCount = getMockAdminPills().length;

    // -------------------------------------------------------------
    // Step 1: create a subject
    // -------------------------------------------------------------
    mockSearch = new URLSearchParams("tab=subjects");
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() => expect(screen.getByTestId("subjects-table")).toBeInTheDocument());

    await user.click(screen.getByTestId("subjects-add-button"));
    await waitFor(() =>
      expect(screen.getByTestId("subject-modal-form")).toBeInTheDocument(),
    );
    await user.type(screen.getByTestId("subject-modal-name"), "Welding QC");
    await user.type(
      screen.getByTestId("subject-modal-description"),
      "Weld inspection + NDT discipline.",
    );
    await user.click(screen.getByTestId("subject-modal-submit"));

    await waitFor(() => {
      expect(getMockAdminSubjects().length).toBe(initialSubjectCount + 1);
    });
    const newSubject = getMockAdminSubjects().find((s) => s.name === "Welding QC")!;
    expect(newSubject).toBeTruthy();

    cleanup();

    // -------------------------------------------------------------
    // Step 2: create a pill bound to the new subject
    // -------------------------------------------------------------
    mockSearch = new URLSearchParams("tab=pills");
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() => expect(screen.getByTestId("pills-table")).toBeInTheDocument());

    await user.click(screen.getByTestId("pills-add-button"));
    await waitFor(() =>
      expect(screen.getByTestId("pill-modal-form")).toBeInTheDocument(),
    );
    await user.type(screen.getByTestId("pill-modal-name"), "Weld inspection focus");
    await user.type(
      screen.getByTestId("pill-modal-description"),
      "Inspection technique fundamentals.",
    );
    const subjectSelect = screen.getByTestId("pill-modal-subject") as HTMLSelectElement;
    // The new subject must appear in the cross-page picker — this is the
    // round-trip's load-bearing assertion (MSW seed state visible to the
    // pills tab after the subjects tab persisted it).
    const subjectOption = within(subjectSelect)
      .getAllByRole("option")
      .find((o) => o.textContent?.trim() === "Welding QC")! as HTMLOptionElement;
    expect(subjectOption).toBeTruthy();
    await user.selectOptions(subjectSelect, subjectOption.value);
    await user.click(screen.getByTestId("pill-modal-submit"));

    await waitFor(() => {
      expect(getMockAdminPills().length).toBe(initialPillCount + 1);
    });
    const newPill = getMockAdminPills().find((p) => p.name === "Weld inspection focus")!;
    expect(newPill.subject_id).toBe(newSubject.id);

    cleanup();

    // -------------------------------------------------------------
    // Step 3: approve a seeded AI proposal
    // -------------------------------------------------------------
    mockSearch = new URLSearchParams("tab=proposals");
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByTestId("proposals-table")).toBeInTheDocument(),
    );

    // Find a seeded proposal in "pending" status (admin can act on it).
    const targetProposal = getMockAdminProposals().find((p) => p.status === "pending")!;
    expect(targetProposal).toBeTruthy();

    // Open the drawer for that row.
    await user.click(screen.getByTestId(`proposals-row-${targetProposal.id}`));
    await waitFor(() =>
      expect(screen.getByTestId("proposal-drawer-approve")).toBeInTheDocument(),
    );
    const pillCountBeforeApprove = getMockAdminPills().length;
    await user.click(screen.getByTestId("proposal-drawer-approve"));

    await waitFor(() => {
      // Approving a proposal creates a new pill server-side; the count
      // increments and the proposal status flips off "ready".
      expect(getMockAdminPills().length).toBe(pillCountBeforeApprove + 1);
    });
  });
});
