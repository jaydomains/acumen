/**
 * JITQueue (FE-5 §D.1).
 *
 * Exercises the per-item state matrix, the streaming pulse indicator,
 * the buffer-ahead chip, and click semantics (ready/done navigable,
 * current/generating ignored).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JITQueue } from "@/components/attempt/JITQueue";

afterEach(() => cleanup());

const QIDS = ["q-1", "q-2", "q-3", "q-4"];

describe("JITQueue · per-item state classification", () => {
  it("renders done / current / ready items based on currentIndex", () => {
    render(
      <JITQueue
        questionIds={QIDS}
        currentIndex={1}
        arrivedIdx={4}
        answeredQuestionIds={new Set(["q-1"])}
        status="done"
      />,
    );
    expect(screen.getByTestId("jit-queue-item-0")).toHaveAttribute("data-state", "done");
    expect(screen.getByTestId("jit-queue-item-1")).toHaveAttribute(
      "data-state",
      "current",
    );
    expect(screen.getByTestId("jit-queue-item-2")).toHaveAttribute("data-state", "ready");
    expect(screen.getByTestId("jit-queue-item-3")).toHaveAttribute("data-state", "ready");
    expect(screen.getByTestId("jit-queue-item-0")).toHaveAttribute(
      "data-answered",
      "true",
    );
  });

  it("renders the streaming pulse dot while status is 'streaming'", () => {
    render(
      <JITQueue
        questionIds={["q-1"]}
        currentIndex={0}
        arrivedIdx={1}
        answeredQuestionIds={new Set()}
        status="streaming"
      />,
    );
    expect(screen.getByTestId("jit-queue-pulse")).toBeInTheDocument();
    expect(screen.queryByTestId("jit-queue-done")).not.toBeInTheDocument();
    expect(screen.getByTestId("jit-queue-generating")).toBeInTheDocument();
  });

  it("renders the done indicator (no pulse) when status is 'done'", () => {
    render(
      <JITQueue
        questionIds={QIDS}
        currentIndex={3}
        arrivedIdx={4}
        answeredQuestionIds={new Set(QIDS)}
        status="done"
      />,
    );
    expect(screen.queryByTestId("jit-queue-pulse")).not.toBeInTheDocument();
    expect(screen.getByTestId("jit-queue-done")).toHaveTextContent("done · 4 arrived");
    expect(screen.queryByTestId("jit-queue-generating")).not.toBeInTheDocument();
  });
});

describe("JITQueue · buffer-ahead chip", () => {
  it("colours the count warn when <2 ready ahead during streaming", () => {
    render(
      <JITQueue
        questionIds={["q-1", "q-2"]}
        currentIndex={0}
        arrivedIdx={2}
        answeredQuestionIds={new Set()}
        status="streaming"
      />,
    );
    const chip = screen.getByTestId("jit-queue-ahead-count");
    expect(chip).toHaveTextContent("1 ready");
    expect(chip).toHaveClass("text-warn");
  });

  it("colours the count ink when 2+ ready ahead", () => {
    render(
      <JITQueue
        questionIds={QIDS}
        currentIndex={0}
        arrivedIdx={4}
        answeredQuestionIds={new Set()}
        status="streaming"
      />,
    );
    const chip = screen.getByTestId("jit-queue-ahead-count");
    expect(chip).toHaveTextContent("3 ready");
    expect(chip).toHaveClass("text-ink");
  });

  it("uses ink (not warn) at the done terminus even when 0 ahead", () => {
    render(
      <JITQueue
        questionIds={QIDS}
        currentIndex={3}
        arrivedIdx={4}
        answeredQuestionIds={new Set(QIDS)}
        status="done"
      />,
    );
    const chip = screen.getByTestId("jit-queue-ahead-count");
    expect(chip).toHaveTextContent("0 ready");
    expect(chip).toHaveClass("text-ink");
  });
});

describe("JITQueue · click semantics", () => {
  it("invokes onPick for ready / done items", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(
      <JITQueue
        questionIds={QIDS}
        currentIndex={1}
        arrivedIdx={4}
        answeredQuestionIds={new Set(["q-1"])}
        status="done"
        onPick={onPick}
      />,
    );
    await user.click(screen.getByTestId("jit-queue-item-0"));
    expect(onPick).toHaveBeenLastCalledWith(0);
    await user.click(screen.getByTestId("jit-queue-item-2"));
    expect(onPick).toHaveBeenLastCalledWith(2);
  });

  it("does NOT invoke onPick for the current item", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(
      <JITQueue
        questionIds={QIDS}
        currentIndex={1}
        arrivedIdx={4}
        answeredQuestionIds={new Set()}
        status="streaming"
        onPick={onPick}
      />,
    );
    const current = screen.getByTestId("jit-queue-item-1");
    expect(current.tagName).toBe("DIV");
    await user.click(current);
    expect(onPick).not.toHaveBeenCalled();
  });

  it("does NOT invoke onPick when onPick is undefined", async () => {
    const user = userEvent.setup();
    render(
      <JITQueue
        questionIds={QIDS}
        currentIndex={1}
        arrivedIdx={4}
        answeredQuestionIds={new Set()}
        status="streaming"
      />,
    );
    // No buttons rendered when onPick is omitted.
    const readyItem = screen.getByTestId("jit-queue-item-2");
    expect(readyItem.tagName).toBe("DIV");
    await user.click(readyItem);
    // No assertion possible beyond "no error" — the test asserts the
    // DOM doesn't render a button for navigable rows when onPick is
    // absent.
  });
});

describe("JITQueue · streaming generating row", () => {
  it("includes a pulse row when arrivedIdx exceeds the known buffer", () => {
    render(
      <JITQueue
        questionIds={["q-1"]}
        currentIndex={0}
        arrivedIdx={3}
        answeredQuestionIds={new Set()}
        status="connecting"
      />,
    );
    const row = screen.getByTestId("jit-queue-generating");
    expect(within(row).getByText(/Generating/)).toBeInTheDocument();
  });
});
