import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AssignmentsCard } from "@/components/dashboard/AssignmentsCard";

describe("AssignmentsCard", () => {
  it("renders the v1.x-pending placeholder body (no /v1/me/assignments query is fired)", () => {
    render(<AssignmentsCard />);
    expect(screen.getByTestId("assignments-placeholder")).toBeInTheDocument();
    expect(
      screen.getByText(/assignments appear here when the backend endpoint lands/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/GET \/v1\/me\/assignments/i)).toBeInTheDocument();
  });

  it("the segmented control defaults to All and toggles via user clicks", async () => {
    const user = userEvent.setup();
    render(<AssignmentsCard />);
    const all = screen.getByTestId("assignments-tab-all");
    const mandatory = screen.getByTestId("assignments-tab-mandatory");
    const followups = screen.getByTestId("assignments-tab-followups");

    expect(all.getAttribute("data-active")).toBe("true");
    expect(mandatory.getAttribute("data-active")).toBe("false");
    expect(followups.getAttribute("data-active")).toBe("false");

    await user.click(mandatory);
    expect(mandatory.getAttribute("data-active")).toBe("true");
    expect(all.getAttribute("data-active")).toBe("false");

    await user.click(followups);
    expect(followups.getAttribute("data-active")).toBe("true");
    expect(mandatory.getAttribute("data-active")).toBe("false");
  });
});
