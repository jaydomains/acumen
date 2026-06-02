import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Rail, TESTEE_NAV, ADMIN_NAV } from "@/components/shell/Rail";

describe("Rail", () => {
  it("renders the testee nav for a testee", () => {
    render(<Rail role="testee" activeRoute="/" />);
    TESTEE_NAV.forEach((item) => {
      expect(screen.getByText(item.label)).toBeInTheDocument();
    });
    expect(screen.queryByText("Operations")).not.toBeInTheDocument();
    expect(screen.queryByText("Grade Review")).not.toBeInTheDocument();
  });

  it("renders the admin nav for an admin", () => {
    render(<Rail role="admin" activeRoute="/ops" />);
    ADMIN_NAV.forEach((item) => {
      expect(screen.getByText(item.label)).toBeInTheDocument();
    });
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Discover")).not.toBeInTheDocument();
  });

  it("marks the active item via data-active=true", () => {
    render(<Rail role="testee" activeRoute="/" />);
    const dashboard = screen.getByText("Dashboard").closest("a");
    expect(dashboard?.getAttribute("data-active")).toBe("true");

    const discover = screen.getByText("Discover").closest("a");
    expect(discover?.getAttribute("data-active")).toBe("false");
  });

  it("matches active route exactly (not by prefix)", () => {
    render(<Rail role="testee" activeRoute="/catalogue" />);
    const dashboard = screen.getByText("Dashboard").closest("a");
    expect(dashboard?.getAttribute("data-active")).toBe("false");
    const discover = screen.getByText("Discover").closest("a");
    expect(discover?.getAttribute("data-active")).toBe("true");
  });

  it("hides the badge chip when count is 0 (default)", () => {
    // The only count-carrying testee item (In Progress) was removed in v1, so
    // the chip-hidden-at-0 behavior is now covered via the admin review item
    // (count: 0) — same guard, a still-present count item.
    render(<Rail role="admin" activeRoute="/ops" />);
    expect(screen.queryByTestId("rail-badge-review")).not.toBeInTheDocument();
  });

  it("renders the brand block with the testee tag", () => {
    render(<Rail role="testee" activeRoute="/" />);
    expect(screen.getByText("Acumen")).toBeInTheDocument();
    expect(screen.getByText("Testee")).toBeInTheDocument();
  });

  it("renders the brand block with the administrator tag", () => {
    render(<Rail role="admin" activeRoute="/ops" />);
    expect(screen.getByText("Administrator")).toBeInTheDocument();
  });

  it("renders the SiteMesh footer", () => {
    render(<Rail role="testee" activeRoute="/" />);
    expect(screen.getByText(/SiteMesh · v1\.8/)).toBeInTheDocument();
  });

  it("defaults to the sticky sidebar variant", () => {
    render(<Rail role="testee" activeRoute="/" />);
    const aside = screen.getByLabelText("Testee navigation");
    expect(aside.getAttribute("data-variant")).toBe("sidebar");
    expect(aside.className).toContain("sticky");
  });

  it("drops sticky framing in the drawer variant (Sheet supplies it)", () => {
    render(<Rail role="testee" activeRoute="/" variant="drawer" />);
    const aside = screen.getByLabelText("Testee navigation");
    expect(aside.getAttribute("data-variant")).toBe("drawer");
    expect(aside.className).not.toContain("sticky");
  });

  it("locks the testee nav order + hrefs (v1 model — In Progress removed, D3)", () => {
    expect(TESTEE_NAV.map((n) => n.href)).toEqual([
      "/",
      "/catalogue",
      "/results",
      "/profile",
      "/history",
    ]);
    // No dead In-Progress item.
    expect(TESTEE_NAV.map((n) => n.href)).not.toContain("/attempts");
    expect(TESTEE_NAV.map((n) => n.label)).not.toContain("In Progress");
  });

  // 11-item ADMIN_NAV locked in FE-8 catalogue spec §C.2
  // (`fe-specs/FE-8-admin-catalogue.md:1162–1170`), extended to 13 by the
  // FE-9 close-out (§H(b) item 14 / §F.4) which appends `calibration` +
  // `system`. FE-8 unbundles the historic single `users` row into `users`
  // + `groups`, and adds `paths`, `tests`, `assignments`.
  it("locks the admin nav order + hrefs", () => {
    expect(ADMIN_NAV.map((n) => n.href)).toEqual([
      "/ops",
      "/review",
      "/engagement",
      "/admin/catalogue",
      "/admin/paths",
      "/admin/tests",
      "/admin/users",
      "/admin/groups",
      "/admin/assignments",
      "/cost",
      "/loop",
      "/calibration",
      "/system",
    ]);
  });

  it("locks the admin nav ids + labels (FE-8 §C.2 lock + FE-9 extension)", () => {
    expect(ADMIN_NAV.map((n) => ({ id: n.id, label: n.label }))).toEqual([
      { id: "ops", label: "Operations" },
      { id: "review", label: "Grade Review" },
      { id: "engagement", label: "Engagement" },
      { id: "catalogue-admin", label: "Catalogue" },
      { id: "paths", label: "Paths" },
      { id: "tests", label: "Tests" },
      // Unbundled from the historic "Users & Groups" row.
      { id: "users", label: "Users" },
      { id: "groups", label: "Groups" },
      { id: "assignments", label: "Assignments" },
      { id: "cost", label: "AI Cost" },
      { id: "loop", label: "Loops" },
      // FE-9 close-out extension.
      { id: "calibration", label: "Calibration" },
      { id: "system", label: "System" },
    ]);
  });
});
