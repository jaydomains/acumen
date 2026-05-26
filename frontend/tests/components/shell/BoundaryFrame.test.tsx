import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { BoundaryFrame } from "@/components/shell/BoundaryFrame";

describe("BoundaryFrame", () => {
  it("renders glyph + eyebrow + title + body + actions", () => {
    render(
      <BoundaryFrame
        glyph={<span data-testid="glyph">!</span>}
        eyebrow="NOT FOUND"
        title="That page doesn't exist"
        body="The link may be old or mistyped."
        actions={<button>Go home</button>}
      />,
    );
    expect(screen.getByTestId("glyph")).toBeInTheDocument();
    expect(screen.getByText("NOT FOUND")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "That page doesn't exist" }),
    ).toBeInTheDocument();
    expect(screen.getByText("The link may be old or mistyped.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go home" })).toBeInTheDocument();
  });

  it("omits the footer toggle when no footer is provided", () => {
    render(
      <BoundaryFrame
        glyph={<span>!</span>}
        eyebrow="X"
        title="X"
        body="X"
        actions={<span />}
      />,
    );
    expect(screen.queryByTestId("boundary-details-toggle")).not.toBeInTheDocument();
  });

  it("expands and collapses the footer details", async () => {
    const user = userEvent.setup();
    render(
      <BoundaryFrame
        glyph={<span>!</span>}
        eyebrow="X"
        title="X"
        body="X"
        actions={<span />}
        footer={<code>trace: abc123</code>}
      />,
    );
    expect(screen.queryByTestId("boundary-details")).not.toBeInTheDocument();
    const toggle = screen.getByTestId("boundary-details-toggle");
    expect(toggle).toHaveTextContent("+ show details");
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);
    expect(screen.getByTestId("boundary-details")).toBeInTheDocument();
    expect(toggle).toHaveTextContent("— hide details");
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    await user.click(toggle);
    expect(screen.queryByTestId("boundary-details")).not.toBeInTheDocument();
  });
});
