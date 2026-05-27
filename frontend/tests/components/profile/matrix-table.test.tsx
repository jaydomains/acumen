import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatrixTable } from "@/components/profile/matrix-table";
import type { ConstellationSubject } from "@/lib/profile/layout-constellation";
import type { MeCompetencePill } from "@/lib/queries/me";

afterEach(() => cleanup());

const SUBJECT_MARINE = "subj-marine";
const SUBJECT_PAINT = "subj-paint";

const PILL_A = "11111111-1111-1111-1111-aaaaaaaaaaaa";
const PILL_B = "22222222-2222-2222-2222-bbbbbbbbbbbb";

const SUBJECTS: ConstellationSubject[] = [
  { id: SUBJECT_MARINE, name: "Marine", color: "#3a5b8c" },
  { id: SUBJECT_PAINT, name: "Paint QA", color: "#b8743a" },
];

const makePill = (input: Partial<MeCompetencePill>): MeCompetencePill => ({
  pill_id: PILL_A,
  pill_name: "Antifouling",
  subject_id: SUBJECT_MARINE,
  competence_estimate: 6.7,
  band: "working",
  n: 12,
  confidence: "preliminary",
  last_activity_at: null,
  related_pill_ids: [],
  safety_relevant: false,
  ...input,
});

describe("MatrixTable", () => {
  it("renders the header row + 10 difficulty headers (D1..D10)", () => {
    render(
      <MatrixTable
        pills={[makePill({})]}
        subjects={SUBJECTS}
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByTestId("matrix-header-pill")).toBeInTheDocument();
    for (let d = 1; d <= 10; d++) {
      expect(screen.getByTestId(`matrix-header-d${d}`)).toHaveTextContent(`D${d}`);
    }
  });

  it("renders 10 cells per pill row and only the rounded-estimate cell shows the float", () => {
    const pill = makePill({
      pill_id: PILL_A,
      competence_estimate: 6.7, // → round = 7 → here-cell at D7
    });
    render(
      <MatrixTable
        pills={[pill]}
        subjects={SUBJECTS}
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    const cells = screen.getAllByTestId("matrix-cell");
    expect(cells).toHaveLength(10);
    // D1..D7 filled; D8..D10 unfilled.
    for (let i = 0; i < 10; i++) {
      const cell = cells[i];
      if (!cell) throw new Error("missing cell");
      const filled = cell.getAttribute("data-filled");
      if (i < 7) expect(filled).toBe("true");
      else expect(filled).toBeNull();
    }
    const here = cells.find((c) => c.getAttribute("data-here") === "true");
    expect(here?.getAttribute("data-difficulty")).toBe("7");
    expect(here).toHaveTextContent("6.7");
  });

  it("clicking a row or a cell calls onSelect with the pill id", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const pill = makePill({ pill_id: PILL_A });
    render(
      <MatrixTable
        pills={[pill]}
        subjects={SUBJECTS}
        selectedId={null}
        onSelect={onSelect}
      />,
    );
    await user.click(screen.getByTestId("matrix-row-name"));
    expect(onSelect).toHaveBeenLastCalledWith(PILL_A);
    onSelect.mockClear();
    const firstCell = screen.getAllByTestId("matrix-cell")[0];
    if (!firstCell) throw new Error("missing first cell");
    await user.click(firstCell);
    expect(onSelect).toHaveBeenLastCalledWith(PILL_A);
  });

  it("the selected row carries data-selected and the accent-soft background class", () => {
    const pill = makePill({ pill_id: PILL_A });
    render(
      <MatrixTable
        pills={[pill]}
        subjects={SUBJECTS}
        selectedId={PILL_A}
        onSelect={() => {}}
      />,
    );
    const row = screen.getByTestId("matrix-row-name");
    expect(row).toHaveAttribute("data-selected", "true");
    expect(row.className).toMatch(/bg-accent-soft/);
  });

  it("groups pills by subject in the supplied subject order, then by pill_name ascending within subject", () => {
    const pills = [
      makePill({
        pill_id: "p-paint-z",
        pill_name: "Zinc Primer",
        subject_id: SUBJECT_PAINT,
      }),
      makePill({
        pill_id: "p-marine-z",
        pill_name: "Zinc Anode",
        subject_id: SUBJECT_MARINE,
      }),
      makePill({
        pill_id: "p-marine-a",
        pill_name: "Antifouling",
        subject_id: SUBJECT_MARINE,
      }),
      makePill({
        pill_id: "p-paint-a",
        pill_name: "Adhesion",
        subject_id: SUBJECT_PAINT,
      }),
    ];
    render(
      <MatrixTable
        pills={pills}
        subjects={SUBJECTS}
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    const rows = screen
      .getAllByTestId("matrix-row-name")
      .map((r) => r.getAttribute("data-pill-id"));
    expect(rows).toEqual(["p-marine-a", "p-marine-z", "p-paint-a", "p-paint-z"]);
  });

  it("renders pills with unknown subject_id under the orphan bucket so they don't vanish", () => {
    const pills = [
      makePill({ pill_id: PILL_A }),
      makePill({
        pill_id: PILL_B,
        pill_name: "Mystery Pill",
        subject_id: "subj-unknown",
      }),
    ];
    render(
      <MatrixTable
        pills={pills}
        subjects={SUBJECTS}
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    const rows = screen.getAllByTestId("matrix-row-name");
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.getAttribute("data-pill-id"))).toContain(PILL_B);
  });
});
