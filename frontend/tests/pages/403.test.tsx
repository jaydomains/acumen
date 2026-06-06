/**
 * /403 landing — fired by the (testee)/(admin) role-mismatch redirect.
 * Per FE-2 §B.17 the v1 copy is statically scoped to "administrators"
 * (the only realistic mismatch in v1 is testee → admin).
 *
 * The denied route rides along via ?from= so the footer shows what
 * was actually denied, not "/403" (which is what usePathname() would
 * return after the redirect).
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => "/403",
  useSearchParams: () => mockSearchParams,
}));

// The recovery CTA (DashboardLink) is role-aware (audit V1); default to a
// testee so "Go to dashboard" targets "/". The /ops admin case is covered in
// tests/components/shell/recovery-cta.test.tsx.
vi.mock("@/lib/auth/context", () => ({
  useAuth: () => ({ role: "testee", status: "authenticated", privacy_ack_at: "x" }),
}));

import ForbiddenPage from "@/app/403/page";

describe("/403", () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
  });

  it("renders the NO ACCESS eyebrow", async () => {
    render(<ForbiddenPage />);
    expect(await screen.findByText("NO ACCESS")).toBeInTheDocument();
  });

  it("defaults to 'administrators' phrasing when ?required= is absent", async () => {
    render(<ForbiddenPage />);
    expect(await screen.findByRole("heading")).toHaveTextContent(/for administrators/i);
  });

  it("switches to 'testees' when ?required=testee (admin hits testee route)", async () => {
    mockSearchParams = new URLSearchParams({ from: "/", required: "testee" });
    render(<ForbiddenPage />);
    expect(await screen.findByRole("heading")).toHaveTextContent(/for testees/i);
    expect(screen.queryByText(/for administrators/i)).not.toBeInTheDocument();
  });

  it("shows the required role in the footer dynamically", async () => {
    mockSearchParams = new URLSearchParams({ from: "/secret", required: "testee" });
    const user = userEvent.setup();
    render(<ForbiddenPage />);
    await user.click(await screen.findByTestId("boundary-details-toggle"));
    const details = await screen.findByTestId("boundary-details");
    expect(details).toHaveTextContent("/secret");
    expect(details).toHaveTextContent("testee");
    expect(details).not.toHaveTextContent(/\badmin\b/);
  });

  it("links back to /", async () => {
    render(<ForbiddenPage />);
    const link = await screen.findByRole("link", { name: /go to dashboard/i });
    expect(link).toHaveAttribute("href", "/");
  });

  it("surfaces the denied route from ?from= in the footer", async () => {
    mockSearchParams = new URLSearchParams({ from: "/ops" });
    const user = userEvent.setup();
    render(<ForbiddenPage />);
    await user.click(await screen.findByTestId("boundary-details-toggle"));
    const details = await screen.findByTestId("boundary-details");
    expect(details).toHaveTextContent("/ops");
    expect(details).toHaveTextContent("admin");
  });

  it("falls back to '/' when ?from= is absent (direct nav)", async () => {
    const user = userEvent.setup();
    render(<ForbiddenPage />);
    await user.click(await screen.findByTestId("boundary-details-toggle"));
    const details = await screen.findByTestId("boundary-details");
    expect(details).toHaveTextContent("/");
    // Should NOT show "/403" — that was the original bug (usePathname
    // returns "/403" after the redirect, so the route line was
    // tautological).
    expect(details).not.toHaveTextContent("/403");
  });
});
