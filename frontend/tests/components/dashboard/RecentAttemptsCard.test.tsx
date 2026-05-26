import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecentAttemptsCard } from "@/components/dashboard/RecentAttemptsCard";

describe("RecentAttemptsCard", () => {
  it("renders nothing when flags.recentAttemptsWidget is false (v1 default)", () => {
    const { container } = render(<RecentAttemptsCard />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("recent-attempts-card")).not.toBeInTheDocument();
  });

  it("renders the layout placeholder when the flag is flipped on", async () => {
    vi.resetModules();
    vi.doMock("@/lib/flags", () => ({
      flags: { recentAttemptsWidget: true } as const,
    }));
    const { RecentAttemptsCard: Real } = await import(
      "@/components/dashboard/RecentAttemptsCard"
    );
    render(<Real />);
    expect(screen.getByTestId("recent-attempts-card")).toBeInTheDocument();
    expect(screen.getByText(/Pending/i)).toBeInTheDocument();
    vi.doUnmock("@/lib/flags");
    vi.resetModules();
  });
});
