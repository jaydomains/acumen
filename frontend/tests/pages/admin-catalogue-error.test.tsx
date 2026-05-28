/**
 * Catalogue Pattern C boundary test (FE-8 §B.1 §5 `error` row + §C.8).
 * Renders `error.tsx` directly with synthetic error + reset props —
 * mirrors `frontend/tests/pages/not-found.test.tsx`'s shape.
 */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import CatalogueError from "@/app/(authed)/(admin)/catalogue/error";

const mockPush = vi.fn();

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

beforeEach(() => {
  mockPush.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("catalogue error boundary", () => {
  it("renders the BoundaryFrame with the localised catalogue copy", () => {
    const reset = vi.fn();
    render(<CatalogueError error={new Error("boom")} reset={reset} />);
    expect(screen.getByTestId("boundary-frame")).toBeInTheDocument();
    // Title splits the copy across nodes; scope to the h1 so the
    // body sentence with "the catalogue" doesn't collide on the match.
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(/Couldn['’]t load/i);
    expect(heading).toHaveTextContent(/the catalogue/i);
  });

  it("invokes reset() when 'Try again' is clicked", async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    render(<CatalogueError error={new Error("boom")} reset={reset} />);
    await user.click(screen.getByRole("button", { name: /Try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("routes to /ops when 'Go to admin dashboard' is clicked", async () => {
    const user = userEvent.setup();
    render(<CatalogueError error={new Error("boom")} reset={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Go to admin dashboard/i }));
    expect(mockPush).toHaveBeenCalledWith("/ops");
  });

  it("surfaces ApiError code + traceId in the collapsible details footer", async () => {
    const user = userEvent.setup();
    const apiErr = new ApiError(
      503,
      "upstream_unavailable",
      "Down for maintenance.",
      null,
      "trace-abc-123",
    );
    render(<CatalogueError error={apiErr} reset={vi.fn()} />);
    await user.click(screen.getByTestId("boundary-details-toggle"));
    expect(screen.getByText("upstream_unavailable")).toBeInTheDocument();
    expect(screen.getByText("trace-abc-123")).toBeInTheDocument();
  });
});
