/**
 * Figure / InlineFigure / ChoiceFigure — v1 contract is null render
 * (AC-CD24). Component prop types must accept the QuestionResponse +
 * ChoiceResponse image-fields without widening or `as` casts, so the
 * compile-time `expectTypeOf` block guards that contract — Slice 2
 * locks the shapes; FE-4 question components consume them mechanically.
 */

import { render } from "@testing-library/react";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  ChoiceFigure,
  Figure,
  InlineFigure,
  type ChoiceFigureProps,
  type FigureProps,
  type InlineFigureProps,
} from "@/components/primitives/figure";
import type { components } from "@/types/api";

describe("Figure / InlineFigure / ChoiceFigure (typed stubs)", () => {
  it("Figure returns no DOM when url is null", () => {
    const { container } = render(<Figure url={null} caption={null} alt={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("Figure returns no DOM when url is undefined", () => {
    const { container } = render(<Figure />);
    expect(container.firstChild).toBeNull();
  });

  it("Figure returns no DOM even when url is a non-null string (v1 stub)", () => {
    // Per AC-CD24 the v1 stub renders null unconditionally; v1.x will
    // light up the body without touching question-component contracts.
    const { container } = render(
      <Figure url="https://example.com/x.png" caption="cap" alt="alt" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("InlineFigure returns null", () => {
    const { container } = render(<InlineFigure url={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("ChoiceFigure returns null", () => {
    const { container } = render(<ChoiceFigure url={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("Figure prop types accept the QuestionResponse image fields without widening", () => {
    type QuestionResponse = components["schemas"]["QuestionResponse"];
    expectTypeOf<QuestionResponse["reference_image_url"]>().toMatchTypeOf<
      FigureProps["url"]
    >();
    expectTypeOf<QuestionResponse["reference_image_caption"]>().toMatchTypeOf<
      FigureProps["caption"]
    >();
  });

  it("InlineFigure prop types mirror Figure", () => {
    expectTypeOf<InlineFigureProps>().toEqualTypeOf<FigureProps>();
  });

  it("ChoiceFigure prop shape is locked (url + alt only, no caption)", () => {
    expectTypeOf<ChoiceFigureProps>().toMatchTypeOf<{
      url?: string | null;
      alt?: string | null;
    }>();
  });
});
