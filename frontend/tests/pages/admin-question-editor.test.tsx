/**
 * Question editor modal + frozen pool integration tests (FE-8
 * admin-tests §B.3 §6 Gherkin). Slice 13.
 *
 * Mounts `/admin/tests/[testId]/edit` against the per-testee draft
 * MSW seed so the frozen pool surface is reachable. Then exercises:
 * - Pool table rendering from the seed.
 * - Add question modal → MCQ flow with single-correct invariant.
 * - Edit question modal → prefill via cached list.
 * - Save & next / Save & previous nav.
 * - Cancel-dirty confirm.
 * - Delete confirm + DELETE round-trip.
 */

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/mocks/node";
import {
  getMockAdminQuestions,
  resetMockAdminPaths,
  resetMockAdminPills,
  resetMockAdminQuestions,
  resetMockAdminSubjects,
  resetMockAdminTests,
  setMockAdminTests,
} from "@/mocks/handlers";
import TestEditorPage from "@/app/(authed)/(admin)/admin/tests/[testId]/edit/page";

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

const FROZEN_DRAFT_ID = "ffff5555-ffff-ffff-ffff-000000000003";
const PER_TESTEE_PUBLISHED_ID = "ffff5555-ffff-ffff-ffff-000000000001";

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
  mockParams = { testId: FROZEN_DRAFT_ID };
  server.resetHandlers();
  resetMockAdminTests();
  resetMockAdminPills();
  resetMockAdminSubjects();
  resetMockAdminPaths();
  resetMockAdminQuestions();
});

afterEach(() => {
  cleanup();
});

describe("frozen section — pool rendering", () => {
  it("renders the seeded pool rows + recommend hint", async () => {
    render(mountTree(<TestEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("frozen-section-table")).toBeInTheDocument(),
    );
    // Two seeded questions on the frozen draft test.
    const seeded = getMockAdminQuestions().filter((q) => q.test_id === FROZEN_DRAFT_ID);
    expect(seeded).toHaveLength(2);
    for (const q of seeded) {
      expect(screen.getByTestId(`frozen-section-row-${q.id}`)).toBeInTheDocument();
    }
    // 8 recommended − 2 seeded = 6 more needed
    expect(screen.getByTestId("frozen-section-recommend-hint")).toHaveTextContent(
      "Add at least 6 more questions",
    );
  });

  it("shows empty state when no questions exist", async () => {
    // Drop all seeded questions for the target test.
    const remaining = getMockAdminQuestions().filter(
      (q) => q.test_id !== FROZEN_DRAFT_ID,
    );
    // mock setter not exported as `setMockAdminQuestions` here — reuse
    // reset and re-seed manually via the existing helper.
    resetMockAdminQuestions();
    for (const q of getMockAdminQuestions()) {
      if (q.test_id === FROZEN_DRAFT_ID) {
        // Skip — we want it gone
      }
    }
    // Easier: just navigate to a test that has no seeded questions.
    mockParams = { testId: PER_TESTEE_PUBLISHED_ID };
    // Need the per_testee test seed to be a draft so frozen is renderable;
    // but the test renders per_testee section, not frozen, when mode is
    // per_testee. Switch the per_testee seed's mode to frozen so the
    // frozen pool renders for an empty-pool view.
    setMockAdminTests([
      {
        ...(remaining.length === 0 ? remaining[0] : (() => ({}))()),
      } as never,
    ]);
    // Simpler: stub the test to a frozen draft with no questions.
    const draftStub = {
      id: "ffff5555-ffff-ffff-ffff-0000000000bb",
      name: "Empty pool",
      mode: "frozen" as const,
      status: "draft" as const,
      visibility: "library" as const,
      timed: true,
      duration_minutes: 30,
      pause_allowance: 2,
      timeout_behaviour: "auto_submit" as const,
      max_pause_duration_minutes: 5,
      pass_threshold: 0.7,
      target_difficulty: 5,
      lock_mode: "open",
      campaign_id: null,
      benchmark_scope: null,
      benchmark_target_testee_id: null,
      randomise_question_order: false,
      randomise_option_order: false,
      pill_id: null,
      created_at: "2026-05-28T00:00:00Z",
      updated_at: "2026-05-28T00:00:00Z",
    };
    setMockAdminTests([draftStub]);
    mockParams = { testId: draftStub.id };
    render(mountTree(<TestEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("frozen-section-empty")).toBeInTheDocument(),
    );
  });
});

describe("question editor modal — create flow", () => {
  it("opens on Add question, type chooser starts on MCQ default", async () => {
    const user = userEvent.setup();
    render(mountTree(<TestEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("frozen-section-add")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("frozen-section-add"));
    await waitFor(() =>
      expect(screen.getByTestId("question-editor-form")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("question-type-card-multiple_choice")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("creates a true_false question and the pool refetches", async () => {
    const user = userEvent.setup();
    render(mountTree(<TestEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("frozen-section-add")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("frozen-section-add"));
    await waitFor(() =>
      expect(screen.getByTestId("question-editor-form")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("question-type-card-true_false"));
    const select = screen.getByTestId("question-pill-select") as HTMLSelectElement;
    const firstPill = within(select).getAllByRole("option")[1] as HTMLOptionElement;
    await user.selectOptions(select, firstPill.value);
    await user.click(screen.getByTestId("question-difficulty-3"));
    await user.type(screen.getByTestId("question-body"), "Is water wet?");
    await user.click(screen.getByTestId("tf-choice-false"));
    await user.click(screen.getByTestId("question-modal-save"));

    await waitFor(() => {
      const allQs = getMockAdminQuestions().filter((q) => q.test_id === FROZEN_DRAFT_ID);
      expect(allQs.length).toBe(3);
      expect(allQs.find((q) => q.type === "true_false")).toBeTruthy();
    });
  });

  it("MCQ requires exactly one correct choice (zod refine)", async () => {
    const user = userEvent.setup();
    render(mountTree(<TestEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("frozen-section-add")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("frozen-section-add"));
    await waitFor(() =>
      expect(screen.getByTestId("question-editor-form")).toBeInTheDocument(),
    );
    const select = screen.getByTestId("question-pill-select") as HTMLSelectElement;
    const firstPill = within(select).getAllByRole("option")[1] as HTMLOptionElement;
    await user.selectOptions(select, firstPill.value);
    await user.click(screen.getByTestId("question-difficulty-5"));
    await user.type(screen.getByTestId("question-body"), "Pick one.");
    await user.type(screen.getByTestId("mcq-choice-text-0"), "First");
    await user.type(screen.getByTestId("mcq-choice-text-1"), "Second");
    // Don't pick any correct — submit and expect refine error.
    await user.click(screen.getByTestId("question-modal-save"));
    await waitFor(() =>
      expect(screen.getByText("Mark exactly one choice as correct.")).toBeInTheDocument(),
    );
  });

  it("adds and removes MCQ choices (min 2 / max 6 enforced)", async () => {
    const user = userEvent.setup();
    render(mountTree(<TestEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("frozen-section-add")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("frozen-section-add"));
    await waitFor(() =>
      expect(screen.getByTestId("question-editor-form")).toBeInTheDocument(),
    );
    // Two default choices
    expect(screen.getByTestId("mcq-choice-row-0")).toBeInTheDocument();
    expect(screen.getByTestId("mcq-choice-row-1")).toBeInTheDocument();
    expect(screen.queryByTestId("mcq-choice-row-2")).not.toBeInTheDocument();
    // Remove on the two existing choices must be disabled.
    expect(screen.getByTestId("mcq-choice-remove-0")).toBeDisabled();
    // Add to 3.
    await user.click(screen.getByTestId("mcq-choice-add"));
    expect(screen.getByTestId("mcq-choice-row-2")).toBeInTheDocument();
    // Remove is now enabled.
    expect(screen.getByTestId("mcq-choice-remove-0")).not.toBeDisabled();
    // Add until 6, then Add is disabled.
    await user.click(screen.getByTestId("mcq-choice-add")); // 4
    await user.click(screen.getByTestId("mcq-choice-add")); // 5
    await user.click(screen.getByTestId("mcq-choice-add")); // 6
    expect(screen.getByTestId("mcq-choice-add")).toBeDisabled();
  });

  it("scenario type reuses the SA rubric subcomponent", async () => {
    const user = userEvent.setup();
    render(mountTree(<TestEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("frozen-section-add")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("frozen-section-add"));
    await waitFor(() =>
      expect(screen.getByTestId("question-editor-form")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("question-type-card-scenario"));
    expect(screen.getByTestId("sa-grading-rubric")).toBeInTheDocument();
  });
});

describe("question editor modal — edit flow", () => {
  it("prefills from the cached pool row and locks the type chooser", async () => {
    const user = userEvent.setup();
    render(mountTree(<TestEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("frozen-section-table")).toBeInTheDocument(),
    );
    const seededMcq = getMockAdminQuestions().find(
      (q) => q.test_id === FROZEN_DRAFT_ID && q.type === "multiple_choice",
    )!;
    await user.click(screen.getByTestId(`frozen-section-edit-${seededMcq.id}`));
    await waitFor(() =>
      expect(screen.getByTestId("question-editor-form")).toBeInTheDocument(),
    );
    // Type chooser disabled in edit mode.
    expect(screen.getByTestId("question-type-card-multiple_choice")).toBeDisabled();
    expect(screen.getByTestId("question-type-card-true_false")).toBeDisabled();
    // Body prefilled.
    expect(screen.getByTestId("question-body")).toHaveValue(
      "Which mechanism best describes sacrificial anode cathodic protection?",
    );
  });

  it("Save & next advances to the next pool question (2/2 visible after click)", async () => {
    const user = userEvent.setup();
    render(mountTree(<TestEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("frozen-section-table")).toBeInTheDocument(),
    );
    // Open the first question (MCQ).
    const mcq = getMockAdminQuestions().find(
      (q) => q.test_id === FROZEN_DRAFT_ID && q.type === "multiple_choice",
    )!;
    await user.click(screen.getByTestId(`frozen-section-edit-${mcq.id}`));
    await waitFor(() =>
      expect(screen.getByText(/EDIT QUESTION · 1 OF 2/)).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("question-modal-save-next"));
    await waitFor(() =>
      expect(screen.getByText(/EDIT QUESTION · 2 OF 2/)).toBeInTheDocument(),
    );
    // Save & previous becomes enabled on the second question.
    expect(screen.getByTestId("question-modal-save-prev")).not.toBeDisabled();
  });
});

describe("question editor modal — cancel + delete flows", () => {
  it("Cancel on a dirty form prompts the discard confirm modal", async () => {
    const user = userEvent.setup();
    render(mountTree(<TestEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("frozen-section-add")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("frozen-section-add"));
    await waitFor(() =>
      expect(screen.getByTestId("question-editor-form")).toBeInTheDocument(),
    );
    // Dirty the form.
    await user.type(screen.getByTestId("question-body"), "Dirty.");
    await user.click(screen.getByTestId("question-modal-cancel"));
    await waitFor(() =>
      expect(screen.getByTestId("question-modal-discard-confirm")).toBeInTheDocument(),
    );
  });

  it("Delete from the row removes the question after confirm", async () => {
    const user = userEvent.setup();
    render(mountTree(<TestEditorPage />));
    await waitFor(() =>
      expect(screen.getByTestId("frozen-section-table")).toBeInTheDocument(),
    );
    const target = getMockAdminQuestions().find(
      (q) => q.test_id === FROZEN_DRAFT_ID && q.type === "true_false",
    )!;
    await user.click(screen.getByTestId(`frozen-section-delete-${target.id}`));
    await waitFor(() =>
      expect(screen.getByTestId("frozen-section-delete-confirm")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("frozen-section-delete-confirm"));
    await waitFor(() => {
      const remaining = getMockAdminQuestions().filter(
        (q) => q.test_id === FROZEN_DRAFT_ID,
      );
      expect(remaining.length).toBe(1);
    });
  });
});

describe("frozen section — lock states", () => {
  it("Add/Edit/Delete buttons disable when sectionLocked (locked test)", async () => {
    // Use the locked seed (hand_authored + campaign-locked).
    mockParams = { testId: "ffff5555-ffff-ffff-ffff-000000000004" };
    render(mountTree(<TestEditorPage />));
    await waitFor(() => expect(screen.getByTestId("frozen-section")).toBeInTheDocument());
    // Pool is empty on this seed (no questions), so Add is the
    // canonical disabled signal.
    expect(screen.getByTestId("frozen-section-add")).toBeDisabled();
  });

  it("Add/Edit/Delete disable when poolLocked (published test)", async () => {
    // Promote the frozen draft seed to published — poolLocked=true,
    // sectionLocked=false.
    setMockAdminTests(
      ((await import("@/mocks/handlers")) as typeof import("@/mocks/handlers"))
        .getMockAdminTests()
        .map((t) =>
          t.id === FROZEN_DRAFT_ID ? { ...t, status: "published" as const } : t,
        ),
    );
    render(mountTree(<TestEditorPage />));
    await waitFor(() => expect(screen.getByTestId("frozen-section")).toBeInTheDocument());
    expect(screen.getByTestId("frozen-section-add")).toBeDisabled();
    const seededMcq = getMockAdminQuestions().find(
      (q) => q.test_id === FROZEN_DRAFT_ID && q.type === "multiple_choice",
    )!;
    expect(screen.getByTestId(`frozen-section-edit-${seededMcq.id}`)).toBeDisabled();
  });
});
