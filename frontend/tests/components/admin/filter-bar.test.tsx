/**
 * FilterBar — debounce timing (FE-8 catalogue §C.4 + §D.1 :1230).
 *
 * Per spec: typing 5 chars within 300ms fires onSearchChange once with
 * the final value; pausing >300ms between chars fires once per pause.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { FilterBar } from "@/components/admin/filter-bar";

describe("FilterBar — search debounce (300ms)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires onSearchChange once when 5 chars are typed within 300ms", async () => {
    const onSearchChange = vi.fn<(next: string) => void>();
    const { rerender } = render(
      <FilterBar searchValue="" onSearchChange={onSearchChange} />,
    );

    const input = screen.getByTestId("filter-bar-search") as HTMLInputElement;

    // Simulate 5 keystrokes within 200ms — each fires an onChange that
    // updates the draft, but the 300ms timer keeps resetting. Only the
    // final value should land.
    const chars = ["a", "an", "ant", "anti", "antif"];
    for (let i = 0; i < chars.length; i++) {
      await act(async () => {
        fireEvent.change(input, { target: { value: chars[i]! } });
        await vi.advanceTimersByTimeAsync(40); // 5 * 40 = 200ms total
      });
    }
    expect(input.value).toBe("antif");
    // Still within the debounce window.
    expect(onSearchChange).not.toHaveBeenCalled();

    // Advance past the debounce.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(onSearchChange).toHaveBeenCalledTimes(1);
    expect(onSearchChange).toHaveBeenCalledWith("antif");

    // Confirm the rerender doesn't double-fire.
    rerender(<FilterBar searchValue="antif" onSearchChange={onSearchChange} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(onSearchChange).toHaveBeenCalledTimes(1);
  });

  it("fires onSearchChange 5 times when 5 chars are typed with 350ms gaps", async () => {
    const onSearchChange = vi.fn<(next: string) => void>();
    render(<FilterBar searchValue="" onSearchChange={onSearchChange} />);

    const input = screen.getByTestId("filter-bar-search") as HTMLInputElement;

    const chars = ["a", "an", "ant", "anti", "antif"];
    for (let i = 0; i < chars.length; i++) {
      await act(async () => {
        fireEvent.change(input, { target: { value: chars[i]! } });
        await vi.advanceTimersByTimeAsync(350); // gap > 300ms
      });
    }

    expect(onSearchChange).toHaveBeenCalledTimes(5);
    expect(onSearchChange).toHaveBeenNthCalledWith(1, "a");
    expect(onSearchChange).toHaveBeenNthCalledWith(5, "antif");
  });

  it("does not reset the debounce timer when the parent re-renders with a fresh callback identity (regression: Gitar #65)", async () => {
    const stable = vi.fn<(next: string) => void>();
    const { rerender } = render(
      <FilterBar searchValue="" onSearchChange={() => stable("inline")} />,
    );

    const input = screen.getByTestId("filter-bar-search") as HTMLInputElement;

    // Type one char inside the debounce window.
    await act(async () => {
      fireEvent.change(input, { target: { value: "a" } });
      await vi.advanceTimersByTimeAsync(100);
    });

    // Parent re-renders with a NEW inline callback — common React idiom.
    // Pre-fix, this tore down + re-installed the debounce timer; the
    // 300ms window restarted from 0 and the search never fired even
    // after the user paused. Post-fix, the ref stabilises the call site
    // so the timer keeps counting down from the keystroke.
    rerender(<FilterBar searchValue="" onSearchChange={() => stable("inline")} />);
    rerender(<FilterBar searchValue="" onSearchChange={() => stable("inline")} />);

    // Advance to just past the original debounce.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(220);
    });

    expect(stable).toHaveBeenCalledTimes(1);
    expect(stable).toHaveBeenCalledWith("inline");
  });

  it("does not fire when searchValue is externally hydrated", async () => {
    const onSearchChange = vi.fn<(next: string) => void>();
    const { rerender } = render(
      <FilterBar searchValue="" onSearchChange={onSearchChange} />,
    );

    // External hydration (e.g. URL bootstrap) updates searchValue; the
    // draft mirrors it but onSearchChange should NOT fire (would create
    // a feedback loop).
    rerender(<FilterBar searchValue="loaded" onSearchChange={onSearchChange} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(onSearchChange).not.toHaveBeenCalled();
  });
});

describe("FilterBar — segments", () => {
  it("renders a segmented group with toggle aria-pressed state", async () => {
    const onChange = vi.fn<(next: string) => void>();
    render(
      <FilterBar
        segments={[
          {
            label: "Status",
            value: "draft",
            options: [
              { label: "Draft", value: "draft" },
              { label: "Published", value: "published" },
            ],
            onChange,
          },
        ]}
      />,
    );

    const draftBtn = screen.getByRole("button", { name: "Draft" });
    const publishedBtn = screen.getByRole("button", { name: "Published" });

    expect(draftBtn).toHaveAttribute("aria-pressed", "true");
    expect(publishedBtn).toHaveAttribute("aria-pressed", "false");

    publishedBtn.click();
    expect(onChange).toHaveBeenCalledWith("published");
  });
});
