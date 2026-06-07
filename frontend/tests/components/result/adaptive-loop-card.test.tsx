import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdaptiveLoopCard } from "@/components/result/adaptive-loop-card";
import type { components } from "@/lib/api/types";

type LoopStep = components["schemas"]["LoopStep"];

vi.mock("next/link", () => ({
  // Plain anchor so the test can introspect href without next/link's
  // SSR routing intercepts.
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => cleanup());

function step(overrides: Partial<LoopStep> = {}): LoopStep {
  return {
    type: "explainer",
    target_pill_id: "p-1",
    target_pill_name: "Antifouling",
    title: "Read this explainer on Antifouling",
    description: "A short read.",
    cta_label: "Open",
    route_href: "/pills/p-1",
    status: "ready",
    queued_for: null,
    step_down_hint: false,
    ...overrides,
  };
}

describe("AdaptiveLoopCard", () => {
  it("hides when status is not 'ready'", () => {
    const { container } = render(
      <AdaptiveLoopCard steps={[step()]} status="review_pending" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("hides when steps array is empty", () => {
    const { container } = render(<AdaptiveLoopCard steps={[]} status="ready" />);
    expect(container.firstChild).toBeNull();
  });

  it("explainer step → internal Link with the pill route", () => {
    render(<AdaptiveLoopCard steps={[step()]} status="ready" />);
    const cta = screen.getByTestId("loop-step-cta");
    expect(cta.getAttribute("href")).toBe("/pills/p-1");
    expect(cta.getAttribute("target")).toBeNull();
  });

  it("external_link_set → external anchor with target=_blank + rel security", () => {
    render(
      <AdaptiveLoopCard
        steps={[
          step({
            type: "external_link_set",
            route_href: "https://drive.example.com/safety",
            cta_label: "Open Drive",
            status: "optional",
          }),
        ]}
        status="ready"
      />,
    );
    const cta = screen.getByTestId("loop-step-cta");
    expect(cta.getAttribute("href")).toBe("https://drive.example.com/safety");
    expect(cta.getAttribute("target")).toBe("_blank");
    expect(cta.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("retest_queued → Defer button (v1 no-op) + queued copy", () => {
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    render(
      <AdaptiveLoopCard
        steps={[
          step({
            type: "retest_queued",
            title: "Re-test on Antifouling",
            cta_label: "Defer",
            status: "queued",
            queued_for: future,
          }),
        ]}
        status="ready"
      />,
    );
    const cta = screen.getByTestId("loop-step-cta");
    expect(cta.tagName).toBe("BUTTON");
    expect(cta).toHaveTextContent("Defer");
    expect(screen.getByText(/in 3 days/)).toBeInTheDocument();
  });

  it("step_down_hint surfaces the step-down sub-line (no anchor leak)", () => {
    const { container } = render(
      <AdaptiveLoopCard steps={[step({ step_down_hint: true })]} status="ready" />,
    );
    expect(screen.getByText(/Stepped difficulty down/)).toBeInTheDocument();
    // V2 (testee-facing): the sub-line dropped its "· AC-D6" decoration.
    expect(container.textContent ?? "").not.toMatch(/AC-D\d/);
  });

  it("renders status pill labels for each tone", () => {
    render(
      <AdaptiveLoopCard
        steps={[
          step({ status: "ready", title: "A" }),
          step({ status: "optional", title: "B" }),
          step({ status: "queued", title: "C" }),
        ]}
        status="ready"
      />,
    );
    expect(screen.getByText("READY")).toBeInTheDocument();
    expect(screen.getByText("OPTIONAL")).toBeInTheDocument();
    expect(screen.getByText("QUEUED")).toBeInTheDocument();
  });
});
