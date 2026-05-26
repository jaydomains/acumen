/**
 * ConfigProvider boot integration test (AC-CD19).
 *
 * Three cases:
 *  - happy path: /api/config returns {apiBaseUrl}; children render
 *    and the API client's runtime base URL is primed
 *  - error path: /api/config returns 500; the error screen renders
 *    with a reload button
 *  - module load: src/lib/config has no `required()` at import time
 *    (this was the original /_not-found prerender regression)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/node";
import { ConfigProvider } from "@/lib/config/ConfigProvider";
import { getApiBaseUrl, setApiBaseUrl } from "@/lib/api/client";

beforeEach(() => {
  // Force the boot fetch path by clearing what tests/setup.ts primed.
  // Using a deliberately bogus URL so a leak (something calling the
  // backend before ConfigProvider resolves) is obvious in the test log.
  setApiBaseUrl("http://__not-set__");
});

afterEach(() => {
  cleanup();
});

describe("ConfigProvider", () => {
  it("renders children after /api/config resolves and primes the API base URL", async () => {
    server.use(
      http.get("/api/config", () =>
        HttpResponse.json({ apiBaseUrl: "https://api.tenant-x.example" }),
      ),
    );

    render(
      <ConfigProvider>
        <div data-testid="child">ready</div>
      </ConfigProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("child")).toBeInTheDocument();
    });
    expect(getApiBaseUrl()).toBe("https://api.tenant-x.example");
  });

  it("renders the error screen when /api/config fails", async () => {
    server.use(
      http.get("/api/config", () =>
        HttpResponse.json(
          { error: { code: "config_missing", message: "no", detail: null } },
          { status: 500 },
        ),
      ),
    );

    render(
      <ConfigProvider>
        <div data-testid="child">should not render</div>
      </ConfigProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /reload/i })).toBeInTheDocument();
    });
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
  });
});

describe("src/lib/config", () => {
  it("imports cleanly without throwing when NEXT_PUBLIC_API_BASE_URL is unset", async () => {
    // The original bug: src/lib/config.ts called required() at module
    // load, which crashed /_not-found prerender during `pnpm build`
    // inside the Dockerfile (where no NEXT_PUBLIC_* is injected). The
    // module must now load cleanly without any env vars set.
    const original = process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    try {
      await expect(import("@/lib/config")).resolves.toBeDefined();
    } finally {
      if (original !== undefined) {
        process.env.NEXT_PUBLIC_API_BASE_URL = original;
      }
    }
  });
});
