/**
 * SystemGlitchOverlay (FE-5 §D.1, §B.4).
 *
 * Verifies the wave + serif headline + body copy, expand/collapse
 * details, and the resume CTA. Regression-guards the spec lock that
 * pause-budget copy MUST NOT appear here (the comparison table in
 * ``streaming-paused.jsx:196-234`` pins this divergence from
 * FE-4's ``<PauseOverlay>``).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SystemGlitchOverlay } from "@/components/attempt/SystemGlitchOverlay";

afterEach(() => cleanup());

describe("SystemGlitchOverlay · base render", () => {
  it("renders the wave glyph + Connection issue headline + body copy", () => {
    render(
      <SystemGlitchOverlay
        reason="generation_failed"
        failedPosition={5}
        completedPositions={[2, 3, 4]}
        onResume={vi.fn()}
      />,
    );
    const overlay = screen.getByTestId("system-glitch-overlay");
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveAttribute("role", "dialog");
    expect(overlay).toHaveAttribute("data-reason", "generation_failed");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      /Connection.*issue/,
    );
    expect(
      screen.getByText(/We hit a glitch generating your next questions/),
    ).toBeInTheDocument();
    expect(screen.getByTestId("system-glitch-resume")).toHaveTextContent(/Try resuming/);
  });

  it("does NOT include pause-budget copy (regression guard vs PauseOverlay)", () => {
    render(
      <SystemGlitchOverlay
        reason="generation_failed"
        failedPosition={5}
        completedPositions={[2, 3, 4]}
        onResume={vi.fn()}
      />,
    );
    expect(screen.queryByText(/pause remaining today/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No pause window cap/)).not.toBeInTheDocument();
    expect(screen.queryByText(/pause minutes/)).not.toBeInTheDocument();
  });

  it("collapses technical details by default", () => {
    render(
      <SystemGlitchOverlay
        reason="generation_failed"
        failedPosition={5}
        completedPositions={[2, 3, 4]}
        onResume={vi.fn()}
      />,
    );
    expect(screen.getByTestId("system-glitch-details-toggle")).toHaveTextContent(
      /\+ show technical details/,
    );
    expect(screen.queryByTestId("system-glitch-details")).not.toBeInTheDocument();
  });
});

describe("SystemGlitchOverlay · expand details", () => {
  it("reveals reason / trace / buffer when expanded", async () => {
    const user = userEvent.setup();
    render(
      <SystemGlitchOverlay
        reason="generation_failed"
        failedPosition={5}
        completedPositions={[2, 3, 4]}
        traceId="trace-abc"
        onResume={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId("system-glitch-details-toggle"));
    const dl = screen.getByTestId("system-glitch-details");
    expect(within(dl).getByText("generation_failed")).toBeInTheDocument();
    expect(within(dl).getByText("trace-abc")).toBeInTheDocument();
    expect(
      within(dl).getByText(/0 questions ahead .Q5\+ generating/),
    ).toBeInTheDocument();
    // Collapse again
    await user.click(screen.getByTestId("system-glitch-details-toggle"));
    expect(screen.queryByTestId("system-glitch-details")).not.toBeInTheDocument();
  });

  it("renders '—' for trace when not provided", async () => {
    const user = userEvent.setup();
    render(
      <SystemGlitchOverlay
        reason="reconnect_exhausted"
        failedPosition={null}
        completedPositions={[2, 3]}
        onResume={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId("system-glitch-details-toggle"));
    expect(
      within(screen.getByTestId("system-glitch-details")).getByText("—"),
    ).toBeInTheDocument();
  });

  it("uses the completed-positions count copy when failedPosition is null", async () => {
    const user = userEvent.setup();
    render(
      <SystemGlitchOverlay
        reason="reconnect_exhausted"
        failedPosition={null}
        completedPositions={[2, 3]}
        onResume={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId("system-glitch-details-toggle"));
    expect(
      within(screen.getByTestId("system-glitch-details")).getByText(
        /2 positions arrived before drop/,
      ),
    ).toBeInTheDocument();
  });
});

describe("SystemGlitchOverlay · CTA", () => {
  it("invokes onResume on click", async () => {
    const user = userEvent.setup();
    const onResume = vi.fn();
    render(
      <SystemGlitchOverlay
        reason="generation_failed"
        failedPosition={5}
        completedPositions={[2, 3, 4]}
        onResume={onResume}
      />,
    );
    await user.click(screen.getByTestId("system-glitch-resume"));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("disables CTA + shows 'Trying…' while resuming is true", () => {
    render(
      <SystemGlitchOverlay
        reason="generation_failed"
        failedPosition={5}
        completedPositions={[2, 3, 4]}
        resuming
        onResume={vi.fn()}
      />,
    );
    const cta = screen.getByTestId("system-glitch-resume");
    expect(cta).toBeDisabled();
    expect(cta).toHaveTextContent(/Trying/);
  });
});
