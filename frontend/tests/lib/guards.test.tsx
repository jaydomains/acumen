/**
 * useAuthRedirect coverage (FE-1 §C.4). Covers the posture-matrix
 * rows FE-1 implements (1, 2, 3, 5) plus the two security fixes from
 * Slice A code review (open-redirect rejection, empty-next handling).
 * Role-mismatch (posture 4) is FE-2 territory and not exercised here.
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

import { useAuthRedirect, isSafeRedirectPath } from "@/lib/auth/guards";

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

  it("redirects authenticated un-ack'd users away from guest surfaces to /privacy (posture 3)", () => {
    mockUseAuth.mockReturnValue({
      status: "authenticated",
      privacy_ack_at: null,
      role: "testee",
    });
    const { result } = renderHook(() => useAuthRedirect("guest"));
    expect(result.current.allow).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith("/privacy");
  });

  it("honors a safe ?next= path for authed ack'd users on guest surfaces", () => {
    mockSearchParams = new URLSearchParams("next=/dashboard/inbox");
    mockUseAuth.mockReturnValue({
      status: "authenticated",
      privacy_ack_at: "2026-01-01T00:00:00Z",
      role: "testee",
    });
    renderHook(() => useAuthRedirect("guest"));
    expect(mockReplace).toHaveBeenCalledWith("/dashboard/inbox");
  });

  it("rejects an open-redirect ?next= and falls back to the role dashboard", () => {
    mockSearchParams = new URLSearchParams("next=https://evil.example.com/phish");
    mockUseAuth.mockReturnValue({
      status: "authenticated",
      privacy_ack_at: "2026-01-01T00:00:00Z",
      role: "testee",
    });
    renderHook(() => useAuthRedirect("guest"));
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalledWith("https://evil.example.com/phish");
    expect(mockReplace.mock.calls[0]?.[0]).not.toMatch(/^https?:/);
  });

  it("rejects a protocol-relative ?next= and falls back to the role dashboard", () => {
    mockSearchParams = new URLSearchParams("next=//evil.example.com/phish");
    mockUseAuth.mockReturnValue({
      status: "authenticated",
      privacy_ack_at: "2026-01-01T00:00:00Z",
      role: "testee",
    });
    renderHook(() => useAuthRedirect("guest"));
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace.mock.calls[0]?.[0]).not.toMatch(/evil\.example\.com/);
  });

  it("ignores an empty ?next= and falls back to the role dashboard", () => {
    mockSearchParams = new URLSearchParams("next=");
    mockUseAuth.mockReturnValue({
      status: "authenticated",
      privacy_ack_at: "2026-01-01T00:00:00Z",
      role: "testee",
    });
    renderHook(() => useAuthRedirect("guest"));
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace.mock.calls[0]?.[0]).not.toBe("");
  });

  // Privacy posture: bypass subgate. The only authed route an
  // un-ack'd user can hit; ack'd users get bounced away so the
  // /privacy page can't be a leak path back to the legal copy.

  it("allows authenticated un-ack'd users on the privacy posture", () => {
    mockUseAuth.mockReturnValue({
      status: "authenticated",
      privacy_ack_at: null,
      role: "testee",
    });
    const { result } = renderHook(() => useAuthRedirect("privacy"));
    expect(result.current.allow).toBe(true);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("redirects authenticated ack'd users away from /privacy to the role dashboard", () => {
    mockUseAuth.mockReturnValue({
      status: "authenticated",
      privacy_ack_at: "2026-01-01T00:00:00Z",
      role: "testee",
    });
    const { result } = renderHook(() => useAuthRedirect("privacy"));
    expect(result.current.allow).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("redirects unauthenticated visitors away from /privacy to /login", () => {
    mockUseAuth.mockReturnValue({
      status: "unauthenticated",
      privacy_ack_at: null,
      role: null,
    });
    const { result } = renderHook(() => useAuthRedirect("privacy"));
    expect(result.current.allow).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });
});

describe("isSafeRedirectPath", () => {
  it("accepts a same-origin path", () => {
    expect(isSafeRedirectPath("/dashboard")).toBe(true);
    expect(isSafeRedirectPath("/a/b?x=1")).toBe(true);
  });

  it("rejects an absolute URL", () => {
    expect(isSafeRedirectPath("https://evil.example.com/x")).toBe(false);
    expect(isSafeRedirectPath("http://x.example.com")).toBe(false);
  });

  it("rejects a protocol-relative URL", () => {
    expect(isSafeRedirectPath("//evil.example.com/x")).toBe(false);
  });

  it("rejects backslash and javascript: tricks", () => {
    expect(isSafeRedirectPath("/\\evil")).toBe(false);
    expect(isSafeRedirectPath("javascript:alert(1)")).toBe(false);
  });

  it("rejects empty, null, and undefined", () => {
    expect(isSafeRedirectPath("")).toBe(false);
    expect(isSafeRedirectPath("/")).toBe(false);
    expect(isSafeRedirectPath(null)).toBe(false);
    expect(isSafeRedirectPath(undefined)).toBe(false);
  });
});
