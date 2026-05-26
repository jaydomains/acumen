import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MaterialReady } from "@/components/pill-detail/MaterialReady";

describe("MaterialReady", () => {
  it("splits content into paragraphs on blank lines", () => {
    render(
      <MaterialReady
        content={"First para.\n\nSecond para.\n\nThird para."}
        cached={false}
        served_at={null}
        onRegenerate={vi.fn()}
        regenerating={false}
      />,
    );
    expect(screen.getByText("First para.")).toBeInTheDocument();
    expect(screen.getByText("Second para.")).toBeInTheDocument();
    expect(screen.getByText("Third para.")).toBeInTheDocument();
  });

  it("shows 'cached' or 'fresh' per the cached flag", () => {
    const { rerender } = render(
      <MaterialReady
        content="x"
        cached={true}
        served_at={null}
        onRegenerate={vi.fn()}
        regenerating={false}
      />,
    );
    expect(screen.getByText(/cached/)).toBeInTheDocument();
    rerender(
      <MaterialReady
        content="x"
        cached={false}
        served_at={null}
        onRegenerate={vi.fn()}
        regenerating={false}
      />,
    );
    expect(screen.getByText(/fresh/)).toBeInTheDocument();
  });

  it("disables the Regenerate button and surfaces the regenerating badge while pending", () => {
    render(
      <MaterialReady
        content="x"
        cached={true}
        served_at={null}
        onRegenerate={vi.fn()}
        regenerating={true}
      />,
    );
    expect(screen.getByTestId("material-regenerate")).toBeDisabled();
    expect(screen.getByTestId("material-regenerating-badge")).toBeInTheDocument();
  });

  it("fires onRegenerate when the button is clicked (not pending)", async () => {
    const user = userEvent.setup();
    const onRegenerate = vi.fn();
    render(
      <MaterialReady
        content="x"
        cached={true}
        served_at={null}
        onRegenerate={onRegenerate}
        regenerating={false}
      />,
    );
    await user.click(screen.getByTestId("material-regenerate"));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });
});
