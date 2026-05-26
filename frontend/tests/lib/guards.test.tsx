/**
 * useAuthRedirect coverage (FE-1 §C.4). Five scenarios mirror the
 * posture-matrix rows that FE-1 implements; role-mismatch (posture 4)
 * is FE-2 territory and not exercised here.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const mockReplace = vi.fn();
const mockUseAuth = vi.fn();
let mockPathname = "/some/path";
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/lib/auth/context", () => ({
  useAuth: () => mockUseAuth(),
}));

import { useAuthRedirect } from "@/lib/auth/guards";

describe("useAuthRedirect", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockUseAuth.mockReset();
    mockPathname = "/some/path";
    mockSearchParams = new URLSearchParams();
  });

  it("returns skeleton fallback while auth is loading", () => {
    mockUseAuth.mockReturnValue({
      status: "loading",
      privacy_ack_at: null,
      role: null,
    });
    const { result } = renderHook(() => useAuthRedirect("authed"));
    expect(result.current.allow).toBe(false);
    expect(result.current.fallback).not.toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("allows unauthenticated users on guest surfaces (login etc)", () => {
    mockUseAuth.mockReturnValue({
      status: "unauthenticated",
      privacy_ack_at: null,
      role: null,
    });
    const { result } = renderHook(() => useAuthRedirect("guest"));
    expect(result.current.allow).toBe(true);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users on authed surfaces to /login?next=", () => {
    mockPathname = "/dashboard/inbox";
    mockUseAuth.mockReturnValue({
      status: "unauthenticated",
      privacy_ack_at: null,
      role: null,
    });
    const { result } = renderHook(() => useAuthRedirect("authed"));
    expect(result.current.allow).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith("/login?next=%2Fdashboard%2Finbox");
  });

  it("redirects authenticated un-ack'd users to /privacy from authed surfaces", () => {
    mockUseAuth.mockReturnValue({
      status: "authenticated",
      privacy_ack_at: null,
      role: "testee",
    });
    const { result } = renderHook(() => useAuthRedirect("authed"));
    expect(result.current.allow).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith("/privacy");
  });

  it("allows authenticated ack'd users on authed surfaces", () => {
    mockUseAuth.mockReturnValue({
      status: "authenticated",
      privacy_ack_at: "2026-01-01T00:00:00Z",
      role: "testee",
    });
    const { result } = renderHook(() => useAuthRedirect("authed"));
    expect(result.current.allow).toBe(true);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
