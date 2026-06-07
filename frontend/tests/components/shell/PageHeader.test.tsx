import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "@/components/shell/PageHeader";

describe("PageHeader", () => {
  it("renders all four slots when provided", () => {
    render(
      <PageHeader
        eyebrow="DASHBOARD"
        title="Welcome, Asha"
        subtitle="3 pills due"
        actions={<button>New</button>}
      />,
    );
    expect(screen.getByText("DASHBOARD")).toBeInTheDocument();
    expect(screen.getByText("Welcome, Asha")).toBeInTheDocument();
    expect(screen.getByText("3 pills due")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
  });

  it("uses the .eyebrow typography class for the eyebrow", () => {
    render(<PageHeader eyebrow="DASHBOARD" title="x" />);
    expect(screen.getByText("DASHBOARD").className).toContain("eyebrow");
  });

  it("uses the responsive serif typography classes for the title", () => {
    render(<PageHeader title="Operations" />);
    expect(screen.getByText("Operations").className).toContain(
      "font-serif text-[26px] leading-[1.18] tracking-[-0.018em] sm:text-[30px] lg:text-[36px] break-words",
    );
  });

  it("omits the eyebrow when not provided", () => {
    const { container } = render(<PageHeader title="Operations" />);
    expect(container.querySelector(".eyebrow")).toBeNull();
  });

  it("omits the subtitle container when not provided", () => {
    render(<PageHeader title="Title only" />);
    expect(screen.queryByText("subtitle text")).not.toBeInTheDocument();
  });

  it("omits the actions slot when not provided", () => {
    const { container } = render(<PageHeader title="t" />);
    expect(container.querySelector("button")).toBeNull();
  });

  it("stacks vertically by default and only rows at lg (responsive)", () => {
    const { container } = render(<PageHeader title="t" actions={<button>New</button>} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("flex-col");
    expect(root.className).toContain("lg:flex-row");
  });

  it("accepts a ReactNode subtitle (composition with chips)", () => {
    render(
      <PageHeader
        title="t"
        subtitle={
          <>
            <span data-testid="chip">overdue</span> 3 due
          </>
        }
      />,
    );
    expect(screen.getByTestId("chip")).toBeInTheDocument();
    expect(screen.getByText(/3 due/)).toBeInTheDocument();
  });
});
