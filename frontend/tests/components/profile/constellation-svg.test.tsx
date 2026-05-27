import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConstellationSVG } from "@/components/profile/constellation-svg";
import type { ConstellationSubject } from "@/lib/profile/layout-constellation";
import type { MeCompetencePill } from "@/lib/queries/me";

afterEach(() => cleanup());

const SUBJECT_MARINE = "11111111-1111-1111-1111-000000000111";
const SUBJECT_PAINT = "11111111-1111-1111-1111-000000000222";

const PILL_A = "aaaaaaaa-aaaa-aaaa-aaaa-000000000001";
const PILL_B = "bbbbbbbb-bbbb-bbbb-bbbb-000000000002";
const PILL_C = "cccccccc-cccc-cccc-cccc-000000000003";

const makePill = (
  input: Partial<MeCompetencePill> & { pill_id: string },
): MeCompetencePill => ({
  pill_name: "Pill",
  subject_id: SUBJECT_MARINE,
  competence_estimate: 5.0,
  band: "working",
  n: 10,
  confidence: "preliminary",
  last_activity_at: "2026-05-01T00:00:00Z",
  related_pill_ids: [],
  safety_relevant: false,
  ...input,
});

const SUBJECTS: ConstellationSubject[] = [
  { id: SUBJECT_MARINE, name: "Marine", color: "#3a5b8c" },
  { id: SUBJECT_PAINT, name: "Paint QA", color: "#b8743a" },
];

describe("ConstellationSVG", () => {
  it("renders one star group per pill with pill_id + band data attributes", () => {
    const pills = [
      makePill({ pill_id: PILL_A, pill_name: "Antifouling", band: "advanced" }),
      makePill({
        pill_id: PILL_B,
        pill_name: "DFT",
        band: "working",
        subject_id: SUBJECT_PAINT,
      }),
      makePill({ pill_id: PILL_C, pill_name: "Adhesion", subject_id: SUBJECT_PAINT }),
    ];
    render(
      <ConstellationSVG
        pills={pills}
        subjects={SUBJECTS}
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    const stars = screen.getAllByTestId("constellation-star");
    expect(stars).toHaveLength(3);
    expect(stars.map((s) => s.getAttribute("data-pill-id"))).toEqual([
      PILL_A,
      PILL_B,
      PILL_C,
    ]);
    expect(stars[0]).toHaveAttribute("data-band", "advanced");
  });

  it("mounts the selected-ring only on the pill that matches selectedId", () => {
    const pills = [
      makePill({ pill_id: PILL_A }),
      makePill({ pill_id: PILL_B, subject_id: SUBJECT_PAINT }),
    ];
    render(
      <ConstellationSVG
        pills={pills}
        subjects={SUBJECTS}
        selectedId={PILL_B}
        onSelect={() => {}}
      />,
    );
    const rings = screen.getAllByTestId("constellation-selected-ring");
    expect(rings).toHaveLength(1);
    const starB = screen
      .getAllByTestId("constellation-star")
      .find((s) => s.getAttribute("data-pill-id") === PILL_B);
    expect(starB).toHaveAttribute("data-selected", "true");
  });

  it("calls onSelect(pill_id) when a star is clicked", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const pills = [makePill({ pill_id: PILL_A }), makePill({ pill_id: PILL_B })];
    render(
      <ConstellationSVG
        pills={pills}
        subjects={SUBJECTS}
        selectedId={null}
        onSelect={onSelect}
      />,
    );
    const starB = screen
      .getAllByTestId("constellation-star")
      .find((s) => s.getAttribute("data-pill-id") === PILL_B);
    if (!starB) throw new Error("missing star for PILL_B");
    await user.click(starB);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(PILL_B);
  });

  it("confidence-ring strokeDasharray scales with n (n=15 → ~50, n=30 → 100)", () => {
    const pills = [
      makePill({ pill_id: PILL_A, n: 15 }),
      makePill({ pill_id: PILL_B, n: 30, subject_id: SUBJECT_PAINT }),
    ];
    render(
      <ConstellationSVG
        pills={pills}
        subjects={SUBJECTS}
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    const rings = screen.getAllByTestId("constellation-confidence-ring");
    const [ring0, ring1] = rings;
    if (!ring0 || !ring1) throw new Error("missing confidence rings");
    expect(ring0.getAttribute("stroke-dasharray")).toBe("50 100");
    expect(ring1.getAttribute("stroke-dasharray")).toBe("100 100");
  });

  it("safety-marked pills render the danger-coloured dot", () => {
    const pills = [
      makePill({ pill_id: PILL_A, safety_relevant: true }),
      makePill({ pill_id: PILL_B }),
    ];
    render(
      <ConstellationSVG
        pills={pills}
        subjects={SUBJECTS}
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    const safetyMarks = screen.getAllByTestId("constellation-safety-mark");
    expect(safetyMarks).toHaveLength(1);
    expect(safetyMarks[0]).toHaveAttribute("fill", "var(--danger)");
  });

  it("renders edges only for related pairs with both endpoints present, de-duped via p.id < rid", () => {
    // PILL_A < PILL_B < PILL_C — so A→B and B→C should each render once;
    // a reciprocal A.related=[B] + B.related=[A] declaration must NOT
    // produce two A-B edges.
    const pills = [
      makePill({ pill_id: PILL_A, related_pill_ids: [PILL_B] }),
      makePill({
        pill_id: PILL_B,
        subject_id: SUBJECT_PAINT,
        related_pill_ids: [PILL_A, PILL_C],
      }),
      makePill({ pill_id: PILL_C, subject_id: SUBJECT_PAINT, related_pill_ids: [] }),
    ];
    render(
      <ConstellationSVG
        pills={pills}
        subjects={SUBJECTS}
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    const edges = screen.getAllByTestId("constellation-edge");
    // A→B (once, despite reciprocal declaration) + B→C = 2 edges.
    expect(edges).toHaveLength(2);
  });

  it("ignores related_pill_ids pointing to pills not in the layout (silent dangling reference)", () => {
    const pills = [
      makePill({
        pill_id: PILL_A,
        related_pill_ids: ["zzzzzzzz-zzzz-zzzz-zzzz-deadbeefdead"],
      }),
    ];
    render(
      <ConstellationSVG
        pills={pills}
        subjects={SUBJECTS}
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    expect(screen.queryByTestId("constellation-edge")).toBeNull();
  });

  it("labels render for the selected pill and for pills with competence_estimate > 7.5", () => {
    const pills = [
      makePill({
        pill_id: PILL_A,
        pill_name: "Low",
        competence_estimate: 4.0,
      }),
      makePill({
        pill_id: PILL_B,
        pill_name: "High",
        competence_estimate: 8.0,
        subject_id: SUBJECT_PAINT,
      }),
    ];
    render(
      <ConstellationSVG
        pills={pills}
        subjects={SUBJECTS}
        selectedId={PILL_A}
        onSelect={() => {}}
      />,
    );
    const labels = screen.getAllByTestId("constellation-label").map((t) => t.textContent);
    expect(labels).toContain("Low"); // selected
    expect(labels).toContain("High"); // > 7.5
  });
});
