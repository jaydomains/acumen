/**
 * Playwright configuration (FE-4 §F.2 + plan slice 3).
 *
 * Single-browser (Chromium) at v1 to keep CI minutes minimal —
 * Firefox + WebKit projects are reserved for a v1.x sweep when the
 * E2E surface grows beyond the FE-4 happy path.
 *
 * `webServer` boots `next dev` on port 3000. The dev server picks up
 * `NEXT_PUBLIC_API_MOCKING=disabled` via the Playwright env so the
 * client-side MSW boot guard short-circuits; backend calls are
 * intercepted via Playwright's `page.route` API instead (per spec
 * §D.4 — MSW does not run cleanly under Playwright). The
 * `NEXT_PUBLIC_API_BASE_URL` env keeps the runtime config seed
 * deterministic.
 */

import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // `workers` is a positional positional override; on CI we serialize
  // (1 worker) so the dev server isn't fighting parallel page loads,
  // locally we let Playwright pick. exactOptionalPropertyTypes makes
  // `undefined` invalid here, so omit the key when not setting it.
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: BASE_URL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_API_MOCKING: "disabled",
      NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
    },
  },
});
