import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SafetyLinks } from "@/components/pill-detail/SafetyLinks";
import { SafetyEmpty } from "@/components/pill-detail/SafetyEmpty";

const link = (i: number) => ({
  url: `https://example.org/${i}`,
  title: `Title ${i}`,
  source: `Source ${i}`,
  last_verified_at: "2026-01-15T00:00:00Z",
});

describe("SafetyLinks", () => {
  it("renders one anchor per link with external + secure attributes", () => {
    render(<SafetyLinks links={[link(0), link(1), link(2)]} />);
    const anchors = screen.getAllByRole("link");
    expect(anchors).toHaveLength(3);
    anchors.forEach((a) => {
      expect(a).toHaveAttribute("target", "_blank");
      expect(a).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  it("renders the curated-sources eyebrow header", () => {
    render(<SafetyLinks links={[link(0)]} />);
    expect(screen.getByText(/Curated industry sources/i)).toBeInTheDocument();
  });

  it("emits the source label when present, falls back gracefully when absent", () => {
    render(
      <SafetyLinks
        links={[
          link(0),
          { ...link(1), source: null, title: null, last_verified_at: null },
        ]}
      />,
    );
    expect(screen.getByText("Source 0")).toBeInTheDocument();
    // No title → renders the url as link text.
    expect(screen.getByText("https://example.org/1")).toBeInTheDocument();
  });
});

describe("SafetyEmpty", () => {
  it("renders the safety-disclaimer footer copy", () => {
    render(<SafetyEmpty />);
    expect(
      screen.getByText("Acumen never generates safety teaching content."),
    ).toBeInTheDocument();
  });
});
