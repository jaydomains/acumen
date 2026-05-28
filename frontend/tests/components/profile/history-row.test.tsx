import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryRow } from "@/components/profile/history-row";
import type { AttemptListItem } from "@/lib/queries/me";

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

const ATTEMPT_ID = "cccccccc-cccc-cccc-cccc-000000000001";
const PILL_ID = "11111111-1111-1111-1111-aaaaaaaaaaaa";

const makeRow = (overrides: Partial<AttemptListItem> = {}): AttemptListItem => ({
  attempt_id: ATTEMPT_ID,
  pill_id: PILL_ID,
  pill_name: "Antifouling Systems",
  submitted_at: "2026-05-26T09:00:00Z",
  score_percent: 72.5,
  band: "working",
  origin: "assignment_driven",
  competence_delta: null,
  ...overrides,
});

function renderRow(row: AttemptListItem) {
  return render(
    <table>
      <tbody>
        <HistoryRow row={row} />
      </tbody>
    </table>,
  );
}

beforeEach(() => {
  routerPush.mockClear();
});

afterEach(() => cleanup());

describe("HistoryRow", () => {
  it("renders origin chip with the live LOCK-4 long-form enum value as the content + data attr", () => {
    renderRow(makeRow({ origin: "loop_driven" }));
    const tr = screen.getByTestId("history-row");
    expect(tr).toHaveAttribute("data-origin", "loop_driven");
    expect(screen.getByText("loop_driven")).toBeInTheDocument();
  });

  it("rounds score_percent to the nearest integer", () => {
    renderRow(makeRow({ score_percent: 72.5 }));
    expect(screen.getByText("73%")).toBeInTheDocument();
  });

  it("renders competence_delta=null as an em-dash in the ink-dim tone", () => {
    renderRow(makeRow({ competence_delta: null }));
    const delta = screen.getByTestId("history-row-delta");
    expect(delta).toHaveTextContent("—");
    expect(delta).toHaveStyle({ color: "var(--ink-3)" });
  });

  it("renders positive competence_delta with a '+' prefix in the --ok tone", () => {
    renderRow(makeRow({ competence_delta: 0.4 }));
    const delta = screen.getByTestId("history-row-delta");
    expect(delta).toHaveTextContent("+0.4");
    expect(delta).toHaveStyle({ color: "var(--ok)" });
  });

  it("renders negative competence_delta with native '-' in the --danger tone", () => {
    renderRow(makeRow({ competence_delta: -0.5 }));
    const delta = screen.getByTestId("history-row-delta");
    expect(delta).toHaveTextContent("-0.5");
    expect(delta).toHaveStyle({ color: "var(--danger)" });
  });

  it("clicking the row routes via router.push to /attempts/{attempt_id}/result", async () => {
    const user = userEvent.setup();
    renderRow(makeRow({}));
    await user.click(screen.getByTestId("history-row"));
    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(routerPush).toHaveBeenCalledWith(`/attempts/${ATTEMPT_ID}/result`);
  });

  it("Enter / Space on the focused row also navigates (keyboard parity)", async () => {
    const user = userEvent.setup();
    renderRow(makeRow({}));
    const row = screen.getByTestId("history-row");
    row.focus();
    await user.keyboard("{Enter}");
    expect(routerPush).toHaveBeenLastCalledWith(`/attempts/${ATTEMPT_ID}/result`);
    routerPush.mockClear();
    await user.keyboard(" ");
    expect(routerPush).toHaveBeenLastCalledWith(`/attempts/${ATTEMPT_ID}/result`);
  });
});
