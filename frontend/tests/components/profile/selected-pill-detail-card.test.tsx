import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SelectedPillDetailCard } from "@/components/profile/selected-pill-detail-card";
import type { MeCompetencePill } from "@/lib/queries/me";

const routerPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

const PILL_A = "11111111-1111-1111-1111-aaaaaaaaaaaa";
const PILL_B = "22222222-2222-2222-2222-bbbbbbbbbbbb";

const SUBJECT = { name: "Marine", color: "#3a5b8c" };

const makePill = (input: Partial<MeCompetencePill>): MeCompetencePill => ({
  pill_id: PILL_A,
  pill_name: "Antifouling Systems",
  subject_id: "subj-marine",
  competence_estimate: 6.7,
  band: "working",
  n: 22,
  confidence: "confident",
  last_activity_at: "2026-05-26T09:00:00Z",
  related_pill_ids: [],
  safety_relevant: false,
  ...input,
});

beforeEach(() => {
  routerPush.mockClear();
});

afterEach(() => cleanup());

describe("SelectedPillDetailCard", () => {
  it("renders the subject eyebrow, pill name, and 2-Stat grid with the float + confidence", () => {
    const pill = makePill({});
    render(
      <SelectedPillDetailCard
        pill={pill}
        subject={SUBJECT}
        sparklineValues={[3, 4, 5, 6, 6.5, 6.7]}
        pillsById={{ [pill.pill_id]: pill }}
        onSelectRelated={() => {}}
      />,
    );
    expect(screen.getByTestId("detail-subject-eyebrow")).toHaveTextContent("Marine");
    expect(screen.getByTestId("detail-pill-name")).toHaveTextContent(
      /Antifouling Systems/,
    );
    expect(screen.getByText("6.7")).toBeInTheDocument();
    expect(screen.getByText("22")).toBeInTheDocument();
    expect(screen.getByText(/ATTEMPTS · confident/i)).toBeInTheDocument();
  });

  it("renders the safety pill when safety_relevant is true and hides it otherwise", () => {
    const safety = makePill({ safety_relevant: true });
    const { rerender } = render(
      <SelectedPillDetailCard
        pill={safety}
        subject={SUBJECT}
        sparklineValues={[]}
        pillsById={{ [safety.pill_id]: safety }}
        onSelectRelated={() => {}}
      />,
    );
    expect(screen.getByTestId("detail-safety-pill")).toBeInTheDocument();
    rerender(
      <SelectedPillDetailCard
        pill={makePill({ safety_relevant: false })}
        subject={SUBJECT}
        sparklineValues={[]}
        pillsById={{ [PILL_A]: makePill({ safety_relevant: false }) }}
        onSelectRelated={() => {}}
      />,
    );
    expect(screen.queryByTestId("detail-safety-pill")).toBeNull();
  });

  it("shows 'No related pills yet.' when related_pill_ids is empty", () => {
    render(
      <SelectedPillDetailCard
        pill={makePill({})}
        subject={SUBJECT}
        sparklineValues={[]}
        pillsById={{ [PILL_A]: makePill({}) }}
        onSelectRelated={() => {}}
      />,
    );
    expect(screen.getByTestId("detail-related-empty")).toHaveTextContent(
      /No related pills yet/i,
    );
    expect(screen.queryByTestId("detail-related-chips")).toBeNull();
  });

  it("renders a chip per related pill and calls onSelectRelated on click", async () => {
    const onSelectRelated = vi.fn();
    const user = userEvent.setup();
    const pill = makePill({ related_pill_ids: [PILL_B] });
    const related = makePill({ pill_id: PILL_B, pill_name: "Cathodic Protection" });
    render(
      <SelectedPillDetailCard
        pill={pill}
        subject={SUBJECT}
        sparklineValues={[]}
        pillsById={{ [PILL_A]: pill, [PILL_B]: related }}
        onSelectRelated={onSelectRelated}
      />,
    );
    const chip = screen.getByTestId("detail-related-chip");
    expect(chip).toHaveTextContent(/Cathodic Protection/);
    expect(chip).toHaveAttribute("data-pill-id", PILL_B);
    await user.click(chip);
    expect(onSelectRelated).toHaveBeenCalledTimes(1);
    expect(onSelectRelated).toHaveBeenCalledWith(PILL_B);
  });

  it("CTAs route to FE-3 pill detail with the rounded difficulty (estimate=6.7 → D7 / D8)", async () => {
    const pill = makePill({ pill_id: PILL_A, competence_estimate: 6.7 });
    const user = userEvent.setup();
    render(
      <SelectedPillDetailCard
        pill={pill}
        subject={SUBJECT}
        sparklineValues={[]}
        pillsById={{ [PILL_A]: pill }}
        onSelectRelated={() => {}}
      />,
    );
    await user.click(screen.getByTestId("detail-cta-practice"));
    expect(routerPush).toHaveBeenLastCalledWith(`/pills/${PILL_A}?d=7`);
    await user.click(screen.getByTestId("detail-cta-step-up"));
    expect(routerPush).toHaveBeenLastCalledWith(`/pills/${PILL_A}?d=8`);
  });

  it("step-up CTA clamps at D10 when the rounded estimate is already 10", async () => {
    const pill = makePill({ competence_estimate: 9.6 });
    const user = userEvent.setup();
    render(
      <SelectedPillDetailCard
        pill={pill}
        subject={SUBJECT}
        sparklineValues={[]}
        pillsById={{ [PILL_A]: pill }}
        onSelectRelated={() => {}}
      />,
    );
    await user.click(screen.getByTestId("detail-cta-step-up"));
    // 9.6 → round = 10 → step up clamped to 10.
    expect(routerPush).toHaveBeenLastCalledWith(`/pills/${PILL_A}?d=10`);
  });
});
