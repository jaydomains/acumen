/**
 * Role-aware recovery CTAs (audit V1, Slice 3).
 *
 * The root 404 / 403 / 500 recovery surfaces previously routed "Go to
 * dashboard" to `/`, which is testee-gated — so an admin who hit any of
 * them bounced `/` → `/403` → `/` forever. Each surface must now target
 * the role's home: `/ops` for admins, `/` for testees.
 */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  role: "testee" as "admin" | "testee" | null,
  push: vi.fn(),
}));

vi.mock("@/lib/auth/context", () => ({
  useAuth: () => ({
    role: h.role,
    status: "authenticated",
    privacy_ack_at: "2026-01-01T00:00:00Z",
    user: null,
    logout: vi.fn(),
    refreshMe: vi.fn(),
    setUserPrivacyAck: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: h.push,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/some/deep/route",
}));

import { DashboardLink } from "@/components/shell/DashboardLink";
import GlobalError from "@/app/error";
import ForbiddenPage from "@/app/403/page";
import NotFound from "@/app/not-found";

afterEach(() => {
  cleanup();
  h.push.mockClear();
  h.role = "testee";
});

describe("DashboardLink · role-aware target", () => {
  it("targets /ops for admins", () => {
    h.role = "admin";
    render(<DashboardLink />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/ops");
  });

  it("targets / for testees", () => {
    h.role = "testee";
    render(<DashboardLink />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/");
  });

  it("falls back to / when the role is null", () => {
    h.role = null;
    render(<DashboardLink />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/");
  });
});

describe("Root 500 boundary · recovery CTA", () => {
  it("routes an admin to /ops (no /  ->  /403 loop)", async () => {
    h.role = "admin";
    render(<GlobalError error={new Error("boom")} reset={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /go to dashboard/i }));
    expect(h.push).toHaveBeenCalledWith("/ops");
  });

  it("routes a testee to /", async () => {
    h.role = "testee";
    render(<GlobalError error={new Error("boom")} reset={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /go to dashboard/i }));
    expect(h.push).toHaveBeenCalledWith("/");
  });
});

describe("403 page · recovery CTA", () => {
  it("targets /ops for admins", async () => {
    h.role = "admin";
    render(<ForbiddenPage />);
    expect(await screen.findByRole("link", { name: /go to dashboard/i })).toHaveAttribute(
      "href",
      "/ops",
    );
  });

  it("targets / for testees", async () => {
    h.role = "testee";
    render(<ForbiddenPage />);
    expect(await screen.findByRole("link", { name: /go to dashboard/i })).toHaveAttribute(
      "href",
      "/",
    );
  });
});

describe("404 page · recovery CTA", () => {
  it("targets /ops for admins (server component → client CTA)", () => {
    h.role = "admin";
    render(<NotFound />);
    expect(screen.getByRole("link", { name: /go to dashboard/i })).toHaveAttribute(
      "href",
      "/ops",
    );
  });

  it("targets / for testees", () => {
    h.role = "testee";
    render(<NotFound />);
    expect(screen.getByRole("link", { name: /go to dashboard/i })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
