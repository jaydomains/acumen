/**
 * Repo-level 404 (FE-2 §B.15). Renders with the BoundaryFrame copy
 * matching the prototype's NotFound mock. Full-page posture (no shell)
 * because it covers unauth and authed unmatched routes.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The recovery CTA (DashboardLink) is role-aware (audit V1); default to a
// testee so "Go to dashboard" targets "/". The /ops admin case is covered in
// tests/components/shell/recovery-cta.test.tsx.
vi.mock("@/lib/auth/context", () => ({
  useAuth: () => ({ role: "testee", status: "authenticated", privacy_ack_at: "x" }),
}));

import NotFound from "@/app/not-found";

describe("/not-found", () => {
  it("renders the NOT FOUND eyebrow", () => {
    render(<NotFound />);
    expect(screen.getByText("NOT FOUND")).toBeInTheDocument();
  });

  it("renders the title with the .serif-it span", () => {
    const { container } = render(<NotFound />);
    expect(container.querySelector(".serif-it")).not.toBeNull();
    expect(screen.getByRole("heading")).toHaveTextContent("That page doesn't exist");
  });

  it("renders the 404 glyph", () => {
    render(<NotFound />);
    expect(screen.getByText("404")).toBeInTheDocument();
  });

  it("renders the dashboard link", () => {
    render(<NotFound />);
    const link = screen.getByRole("link", { name: /go to dashboard/i });
    expect(link).toHaveAttribute("href", "/");
  });
});
