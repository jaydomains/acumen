/**
 * PauseOverlay (FE-4 §B.1 §6).
 *
 * Asserts: AC-D11 copy renders; Resume button fires; pause-remaining
 * footer renders both the "no cap" and "Nm remaining" branches.
 */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PauseOverlay } from "@/components/attempt/PauseOverlay";

afterEach(() => cleanup());

describe("PauseOverlay", () => {
  it("renders the paused dialog with AC-D11 copy", () => {
    render(<PauseOverlay remainingMinutes={4} onResume={vi.fn()} />);
    const overlay = screen.getByTestId("pause-overlay");
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveAttribute("role", "dialog");
    expect(screen.getByTestId("pause-overlay-remaining")).toHaveTextContent(
      "4m pause remaining today",
    );
    expect(
      screen.getByText(/We've hidden the question while you're paused/),
    ).toBeInTheDocument();
  });

  it("renders 'No pause window cap' when remainingMinutes is null", () => {
    render(<PauseOverlay remainingMinutes={null} onResume={vi.fn()} />);
    expect(screen.getByTestId("pause-overlay-remaining")).toHaveTextContent(
      "No pause window cap",
    );
  });

  it("Resume click fires onResume", async () => {
    const user = userEvent.setup();
    const onResume = vi.fn();
    render(<PauseOverlay remainingMinutes={3} onResume={onResume} />);
    await user.click(screen.getByTestId("pause-overlay-resume"));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("disables Resume while resumePending is true", () => {
    render(<PauseOverlay remainingMinutes={3} onResume={vi.fn()} resumePending />);
    expect(screen.getByTestId("pause-overlay-resume")).toBeDisabled();
  });
});
