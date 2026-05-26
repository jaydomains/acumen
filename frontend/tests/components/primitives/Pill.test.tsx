import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pill } from "@/components/primitives/Pill";
import type { PillTone } from "@/components/primitives/pill-tone";

type ToneCase = {
  tone: PillTone;
  bgClass: string;
  fgClass: string;
};

const TONE_CASES: ToneCase[] = [
  { tone: "default", bgClass: "bg-bg-deep", fgClass: "text-ink-2" },
  { tone: "accent", bgClass: "bg-accent-soft", fgClass: "text-accent-ink" },
  { tone: "ok", bgClass: "bg-ok-soft", fgClass: "text-ok" },
  { tone: "warn", bgClass: "bg-warn-soft", fgClass: "text-warn" },
  { tone: "danger", bgClass: "bg-danger-soft", fgClass: "text-danger" },
  { tone: "info", bgClass: "bg-info-soft", fgClass: "text-info" },
];

describe("Pill", () => {
  it.each(TONE_CASES)(
    "tone=$tone uses $bgClass + $fgClass",
    ({ tone, bgClass, fgClass }) => {
      render(<Pill tone={tone}>label</Pill>);
      const el = screen.getByText("label");
      expect(el.className).toContain(bgClass);
      expect(el.className).toContain(fgClass);
    },
  );

  it("renders default tone when no prop is given", () => {
    render(<Pill>v1</Pill>);
    const el = screen.getByText("v1");
    expect(el.className).toContain("bg-bg-deep");
    expect(el.className).toContain("text-ink-2");
  });

  it("uses the mono font when mono is true", () => {
    render(<Pill mono>3.14</Pill>);
    const el = screen.getByText("3.14");
    expect(el.className).toContain("font-mono");
  });

  it("does not use the mono font by default", () => {
    render(<Pill>plain</Pill>);
    const el = screen.getByText("plain");
    expect(el.className).not.toContain("font-mono");
  });

  it("accepts ReactNode children (icon + text composition)", () => {
    render(
      <Pill tone="ok">
        <span data-testid="icon">✓</span> Done
      </Pill>,
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByText(/Done/)).toBeInTheDocument();
  });
});
