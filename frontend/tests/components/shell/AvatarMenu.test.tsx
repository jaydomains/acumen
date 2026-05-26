/**
 * AvatarMenu — covers the three visual states per FE-2-shell.md §B.3:
 *   - closed (avatar circle with initial)
 *   - open   (dropdown rendered via Radix Portal)
 *   - logging-out (pulse-dot + label, trigger disabled, in-flight logout)
 * Plus the §H decision 3 codification: NO role-switch / "View as testee"
 * item in the dropdown — only "Sign out".
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPush = vi.fn();
const mockLogout = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/lib/auth/context", () => ({
  useAuth: () => mockUseAuth(),
}));

import { AvatarMenu } from "@/components/shell/AvatarMenu";

const FIXTURE_USER = {
  id: "u1",
  name: "Asha Patel",
  email: "asha@example.com",
  role: "testee" as const,
  privacy_ack_at: "2026-01-01T00:00:00Z",
};

function withAuth(overrides: Partial<{ status: string; user: unknown }> = {}) {
  mockUseAuth.mockReturnValue({
    status: "authenticated",
    user: FIXTURE_USER,
    role: "testee",
    privacy_ack_at: FIXTURE_USER.privacy_ack_at,
    logout: mockLogout,
    refreshMe: vi.fn(),
    setUserPrivacyAck: vi.fn(),
    ...overrides,
  });
}

describe("AvatarMenu", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockLogout.mockReset();
    mockUseAuth.mockReset();
  });

  it("renders the avatar circle with the user's initial when authenticated", () => {
    withAuth();
    render(<AvatarMenu />);
    const trigger = screen.getByRole("button", { name: /account menu/i });
    expect(trigger).toHaveTextContent("A");
  });

  it("renders a skeleton circle while auth is loading", () => {
    mockUseAuth.mockReturnValue({
      status: "loading",
      user: null,
      role: null,
      privacy_ack_at: null,
      logout: mockLogout,
      refreshMe: vi.fn(),
      setUserPrivacyAck: vi.fn(),
    });
    render(<AvatarMenu />);
    expect(screen.getByTestId("avatar-skeleton")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens the dropdown with a Sign out item on click", async () => {
    withAuth();
    const user = userEvent.setup();
    render(<AvatarMenu />);
    await user.click(screen.getByRole("button", { name: /account menu/i }));
    expect(await screen.findByTestId("avatar-signout")).toBeInTheDocument();
    expect(screen.getByText("Sign out")).toBeInTheDocument();
  });

  it("does NOT render a role-switch / View-as-testee item (FE-2 §H decision 3)", async () => {
    mockUseAuth.mockReturnValue({
      status: "authenticated",
      user: { ...FIXTURE_USER, role: "admin" as const },
      role: "admin",
      privacy_ack_at: FIXTURE_USER.privacy_ack_at,
      logout: mockLogout,
      refreshMe: vi.fn(),
      setUserPrivacyAck: vi.fn(),
    });
    const user = userEvent.setup();
    render(<AvatarMenu />);
    await user.click(screen.getByRole("button", { name: /account menu/i }));
    await screen.findByTestId("avatar-signout");
    expect(screen.queryByText(/view as testee/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/switch role/i)).not.toBeInTheDocument();
    // Confirm Sign out is the only menuitem rendered.
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);
  });

  it("calls logout() and routes to /login when Sign out is selected", async () => {
    withAuth();
    mockLogout.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AvatarMenu />);
    await user.click(screen.getByRole("button", { name: /account menu/i }));
    await user.click(await screen.findByTestId("avatar-signout"));
    await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login"));
  });

  it("routes to /login even when logout() rejects", async () => {
    withAuth();
    mockLogout.mockRejectedValue(new Error("backend unreachable"));
    const user = userEvent.setup();
    render(<AvatarMenu />);
    await user.click(screen.getByRole("button", { name: /account menu/i }));
    await user.click(await screen.findByTestId("avatar-signout"));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login"));
  });
});
