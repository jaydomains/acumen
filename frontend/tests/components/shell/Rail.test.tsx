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
    render(<Rail role="testee" activeRoute="/" />);
    expect(screen.queryByTestId("rail-badge-attempt")).not.toBeInTheDocument();
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

  it("locks the testee nav order + hrefs", () => {
    expect(TESTEE_NAV.map((n) => n.href)).toEqual([
      "/",
      "/attempts",
      "/catalogue",
      "/results",
      "/profile",
      "/history",
    ]);
  });

  // Updated to the 11-item ADMIN_NAV locked in FE-8 catalogue spec §C.2
  // (`fe-specs/FE-8-admin-catalogue.md:1162–1170`). FE-8 unbundles the
  // historic single `users` row into `users` + `groups`, and adds
  // `paths`, `tests`, `assignments` as top-level rail entries.
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
    ]);
  });

  it("locks the admin nav ids + labels (FE-8 §C.2 lock)", () => {
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
    ]);
  });
});
