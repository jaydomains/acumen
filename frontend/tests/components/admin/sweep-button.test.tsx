/**
 * SweepButton — state-machine transitions: idle → running → done →
 * idle, and error → idle (FE-9 admin-ops §C.4 / §D.1).
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SweepButton } from "@/components/admin/sweep-button";

/** A promise whose resolve/reject we control from the test body. */
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("SweepButton", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("idle: renders the label, enabled", () => {
    render(<SweepButton label="Run sweep now" onRun={() => Promise.resolve()} />);
    const btn = screen.getByRole("button", { name: "Run sweep now" });
    expect(btn).toBeEnabled();
    expect(btn).toHaveAttribute("data-state", "idle");
  });

  it("disabled prop blocks the run", async () => {
    const onRun = vi.fn(() => Promise.resolve());
    const user = userEvent.setup();
    render(<SweepButton label="Run sweep now" disabled onRun={onRun} />);
    const btn = screen.getByTestId("sweep-button");
    expect(btn).toBeDisabled();
    await user.click(btn);
    expect(onRun).not.toHaveBeenCalled();
  });

  it("click → running (disabled + runningLabel) → done (check + Done) → idle", async () => {
    const d = deferred();
    const onRun = vi.fn(() => d.promise);
    const user = userEvent.setup();
    render(<SweepButton label="Run sweep now" runningLabel="Sweeping…" onRun={onRun} />);

    await user.click(screen.getByTestId("sweep-button"));

    // running
    const running = screen.getByTestId("sweep-button");
    expect(running).toHaveAttribute("data-state", "running");
    expect(running).toBeDisabled();
    expect(screen.getByText("Sweeping…")).toBeInTheDocument();
    expect(onRun).toHaveBeenCalledTimes(1);

    // resolve → done
    await act(async () => {
      d.resolve();
      await d.promise;
    });
    await waitFor(() =>
      expect(screen.getByTestId("sweep-button")).toHaveAttribute("data-state", "done"),
    );
    expect(screen.getByText("Done")).toBeInTheDocument();

    // 1500ms → back to idle
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    await waitFor(() =>
      expect(screen.getByTestId("sweep-button")).toHaveAttribute("data-state", "idle"),
    );
    expect(screen.getByText("Run sweep now")).toBeInTheDocument();
  });

  it("error: reverts straight to idle (no done flash)", async () => {
    const d = deferred();
    const onRun = vi.fn(() => d.promise);
    const user = userEvent.setup();
    render(<SweepButton label="Run sweep now" runningLabel="Sweeping…" onRun={onRun} />);

    await user.click(screen.getByTestId("sweep-button"));
    expect(screen.getByTestId("sweep-button")).toHaveAttribute("data-state", "running");

    await act(async () => {
      d.reject(new Error("boom"));
      await d.promise.catch(() => {});
    });

    await waitFor(() =>
      expect(screen.getByTestId("sweep-button")).toHaveAttribute("data-state", "idle"),
    );
    expect(screen.getByText("Run sweep now")).toBeInTheDocument();
  });

  it("re-click during done cancels the stale reset timer (no mid-run revert)", async () => {
    const d1 = deferred();
    const d2 = deferred();
    const onRun = vi
      .fn<() => Promise<void>>()
      .mockReturnValueOnce(d1.promise)
      .mockReturnValueOnce(d2.promise);
    const user = userEvent.setup();
    render(<SweepButton label="Run sweep now" runningLabel="Sweeping…" onRun={onRun} />);

    // First run → done (arms the 1500ms done→idle reset timer).
    await user.click(screen.getByTestId("sweep-button"));
    await act(async () => {
      d1.resolve();
      await d1.promise;
    });
    await waitFor(() =>
      expect(screen.getByTestId("sweep-button")).toHaveAttribute("data-state", "done"),
    );

    // Re-click within the done window kicks off a second run.
    await user.click(screen.getByTestId("sweep-button"));
    expect(screen.getByTestId("sweep-button")).toHaveAttribute("data-state", "running");
    expect(onRun).toHaveBeenCalledTimes(2);

    // The first run's reset timer must have been cleared — advancing well
    // past 1500ms leaves the button running, not bounced back to idle.
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByTestId("sweep-button")).toHaveAttribute("data-state", "running");

    // Second run resolves → done.
    await act(async () => {
      d2.resolve();
      await d2.promise;
    });
    await waitFor(() =>
      expect(screen.getByTestId("sweep-button")).toHaveAttribute("data-state", "done"),
    );
  });
});
