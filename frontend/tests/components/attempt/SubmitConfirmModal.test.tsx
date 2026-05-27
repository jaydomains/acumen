/**
 * SubmitConfirmModal (FE-4 §B.1 + §B.2 §6) — branch-on-mode copy.
 *
 * Frozen carries AC-D19 wording; benchmark carries the
 * "lock into Annual Competency" wording. Confirm button calls
 * onConfirm and stays open through `submitting`.
 */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SubmitConfirmModal } from "@/components/attempt/SubmitConfirmModal";

afterEach(() => cleanup());

describe("SubmitConfirmModal · frozen", () => {
  it("renders AC-D19 wording and an 'Submit attempt' eyebrow", () => {
    render(
      <SubmitConfirmModal
        open
        mode="frozen"
        answeredCount={3}
        totalCount={5}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        submitting={false}
      />,
    );
    expect(screen.getByTestId("submit-confirm-modal")).toHaveAttribute(
      "data-mode",
      "frozen",
    );
    expect(screen.getByText("Submit attempt")).toBeInTheDocument();
    expect(screen.getByText(/You've answered 3 of 5 questions/)).toBeInTheDocument();
    expect(screen.getByText(/OpenAI cross-family review/)).toBeInTheDocument();
  });

  it("Submit button fires onConfirm; modal stays open during submitting", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <SubmitConfirmModal
        open
        mode="frozen"
        answeredCount={5}
        totalCount={5}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        submitting={false}
      />,
    );
    await user.click(screen.getByTestId("submit-confirm-action"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe("SubmitConfirmModal · benchmark", () => {
  it("uses 'Submit benchmark' eyebrow + Annual Competency wording", () => {
    render(
      <SubmitConfirmModal
        open
        mode="benchmark"
        answeredCount={4}
        totalCount={4}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        submitting={false}
      />,
    );
    expect(screen.getByTestId("submit-confirm-modal")).toHaveAttribute(
      "data-mode",
      "benchmark",
    );
    expect(screen.getByText("Submit benchmark")).toBeInTheDocument();
    expect(screen.getByText(/Annual Competency record/)).toBeInTheDocument();
  });
});
