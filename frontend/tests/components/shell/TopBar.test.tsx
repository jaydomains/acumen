/**
 * TopBar covers (a) role-aware search placeholder, (b) default breadcrumb
 * derived from usePathname() with the "SiteMesh / Acumen / {page}"
 * convention, (c) ⌘K hint chip presence, (d) caller-provided crumb
 * override, (e) the rightSlot composition, and (f) the §H decision 3
 * codification: NO role-switch control rendered at the TopBar level.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseAuth = vi.fn();
let mockPathname: string | null = "/";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => mockPathname,
}));

vi.mock("@/lib/auth/context", () => ({
  useAuth: () => mockUseAuth(),
}));

import { TopBar } from "@/components/shell/TopBar";

const FIXTURE_TESTEE = {
  status: "authenticated" as const,
  user: {
    id: "u1",
    name: "Asha Patel",
    email: "asha@example.com",
    role: "testee" as const,
    privacy_ack_at: "2026-01-01T00:00:00Z",
  },
  role: "testee" as const,
  privacy_ack_at: "2026-01-01T00:00:00Z",
  logout: vi.fn(),
  refreshMe: vi.fn(),
  setUserPrivacyAck: vi.fn(),
};

const FIXTURE_ADMIN = {
  ...FIXTURE_TESTEE,
  user: { ...FIXTURE_TESTEE.user, role: "admin" as const },
  role: "admin" as const,
};

describe("TopBar", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockPathname = "/";
  });

  it("shows the testee search placeholder for a testee", () => {
    mockUseAuth.mockReturnValue(FIXTURE_TESTEE);
    render(<TopBar />);
    expect(screen.getByPlaceholderText("Search pills…")).toBeInTheDocument();
  });

  it("shows the admin search placeholder for an admin", () => {
    mockUseAuth.mockReturnValue(FIXTURE_ADMIN);
    mockPathname = "/ops";
    render(<TopBar />);
    expect(
      screen.getByPlaceholderText("Search pills, testees, attempts…"),
    ).toBeInTheDocument();
  });

  it("derives Dashboard from / for testee", () => {
    mockUseAuth.mockReturnValue(FIXTURE_TESTEE);
    mockPathname = "/";
    render(<TopBar />);
    const crumbs = screen.getByTestId("topbar-crumbs");
    expect(crumbs).toHaveTextContent("SiteMesh");
    expect(crumbs).toHaveTextContent("Acumen");
    expect(crumbs).toHaveTextContent("Dashboard");
  });

  it("derives Operations from /ops for admin", () => {
    mockUseAuth.mockReturnValue(FIXTURE_ADMIN);
    mockPathname = "/ops";
    render(<TopBar />);
    expect(screen.getByTestId("topbar-crumbs")).toHaveTextContent("Operations");
  });

  it("renders the ⌘K hint chip in the search stub", () => {
    mockUseAuth.mockReturnValue(FIXTURE_TESTEE);
    render(<TopBar />);
    expect(screen.getByText("⌘K")).toBeInTheDocument();
  });

  it("uses a caller-provided crumb override", () => {
    mockUseAuth.mockReturnValue(FIXTURE_TESTEE);
    render(<TopBar crumb={[{ label: "Custom" }, { label: "Page" }]} />);
    const crumbs = screen.getByTestId("topbar-crumbs");
    expect(crumbs).toHaveTextContent("Custom");
    expect(crumbs).toHaveTextContent("Page");
    expect(crumbs).not.toHaveTextContent("SiteMesh");
  });

  it("renders content passed via rightSlot", () => {
    mockUseAuth.mockReturnValue(FIXTURE_TESTEE);
    render(<TopBar rightSlot={<button>Custom action</button>} />);
    expect(screen.getByRole("button", { name: "Custom action" })).toBeInTheDocument();
  });

  it("does NOT render a role-switch control (§H decision 3)", () => {
    mockUseAuth.mockReturnValue(FIXTURE_ADMIN);
    render(<TopBar />);
    expect(screen.queryByText(/testee/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/admin/i)).not.toBeInTheDocument();
  });

  it("renders an avatar skeleton when auth is loading", () => {
    mockUseAuth.mockReturnValue({
      status: "loading",
      user: null,
      role: null,
      privacy_ack_at: null,
      logout: vi.fn(),
      refreshMe: vi.fn(),
      setUserPrivacyAck: vi.fn(),
    });
    render(<TopBar />);
    expect(screen.getByTestId("avatar-skeleton")).toBeInTheDocument();
  });
});
