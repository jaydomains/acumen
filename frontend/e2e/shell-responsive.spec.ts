/**
 * Responsive shell — mobile nav drawer (PR 1 / audit Phase 1).
 *
 * Drives the authed (testee) shell at a 375px mobile viewport and
 * asserts the drawer interaction model the audit requires:
 *   - the desktop sidebar Rail is NOT visible on mobile;
 *   - a hamburger in the TopBar opens a left-anchored drawer;
 *   - the drawer dismisses via its close button, backdrop tap, Esc,
 *     and a route change (link tap).
 *
 * Auth + backend mocking mirror the FE-4 happy-path pattern
 * (`addInitScript` refresh-token seed + `page.route` interception;
 * the dev server runs with NEXT_PUBLIC_API_MOCKING=disabled). The
 * second describe block re-captures the shell at 375 / 768 / 1280px
 * and writes the PNGs under `docs/screenshots/` for PR spot-check.
 */

import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const BACKEND = "http://localhost:8000";
const SCREENSHOT_DIR = join(process.cwd(), "..", "docs", "screenshots");

const FIXTURE_TESTEE = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "joana@example.com",
  name: "Joana Reyes",
  role: "testee",
  status: "active",
  privacy_ack_at: "2026-05-01T00:00:00Z",
  created_at: "2026-05-01T00:00:00Z",
};

/**
 * Seed auth + intercept the calls the (testee) shell makes on mount so
 * the Gate resolves to a logged-in testee and the dashboard renders its
 * drift-mode placeholders (only `GET /v1/attempts` is live).
 */
async function mockAuthedTestee(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("acumen.refresh_token", "fake-refresh-token");
  });

  // Catch-all first (last-registered wins in Playwright); benign empty
  // body so any stray drift-mode call resolves instead of 500-ing.
  await page.route(/.*\/v1\//, async (route) => {
    await route.fulfill({ json: {} });
  });
  await page.route("**/api/config", async (route) => {
    await route.fulfill({ json: { apiBaseUrl: BACKEND } });
  });
  await page.route("**/v1/auth/refresh", async (route) => {
    await route.fulfill({ json: { access_token: "fake-access-token" } });
  });
  await page.route("**/v1/auth/me", async (route) => {
    await route.fulfill({ json: FIXTURE_TESTEE });
  });
  await page.route("**/v1/attempts**", async (route) => {
    await route.fulfill({ json: [] });
  });
}

test.describe("responsive shell — mobile drawer @375px", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    await mockAuthedTestee(page);
  });

  test("desktop sidebar is hidden; hamburger is the nav entry point", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("topbar")).toBeVisible();

    // The sidebar Rail (lg:flex) collapses below lg, so no nav link is
    // on screen until the drawer opens.
    await expect(page.getByTestId("topbar-menu")).toBeVisible();
    await expect(page.getByTestId("nav-drawer-close")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Discover" })).toHaveCount(0);
  });

  test("hamburger opens the drawer with the testee nav", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("topbar-menu").click();

    await expect(page.getByTestId("nav-drawer-close")).toBeVisible();
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Discover" })).toBeVisible();
  });

  test("close button dismisses the drawer", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("topbar-menu").click();
    await expect(page.getByTestId("nav-drawer-close")).toBeVisible();

    await page.getByTestId("nav-drawer-close").click();
    await expect(page.getByTestId("nav-drawer-close")).toHaveCount(0);
  });

  test("Escape dismisses the drawer", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("topbar-menu").click();
    await expect(page.getByTestId("nav-drawer-close")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("nav-drawer-close")).toHaveCount(0);
  });

  test("tapping the backdrop (outside the panel) dismisses the drawer", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("topbar-menu").click();
    await expect(page.getByTestId("nav-drawer-close")).toBeVisible();

    // Panel is 288px wide on the left edge; click well to its right to
    // land on the Radix overlay.
    await page.mouse.click(350, 400);
    await expect(page.getByTestId("nav-drawer-close")).toHaveCount(0);
  });

  test("a route change (nav tap) closes the drawer and navigates", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("topbar-menu").click();
    await expect(page.getByTestId("nav-drawer-close")).toBeVisible();

    await page.getByRole("link", { name: "Discover" }).click();
    await expect(page).toHaveURL(/\/catalogue$/);
    await expect(page.getByTestId("nav-drawer-close")).toHaveCount(0);
  });
});

test.describe("responsive shell — screenshots for PR spot-check", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthedTestee(page);
  });

  test("capture testee shell at 375 / 768 / 1280px", async ({ page }) => {
    // Mobile — closed (hamburger visible) then drawer open.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await expect(page.getByTestId("topbar-menu")).toBeVisible();
    await page.screenshot({ path: join(SCREENSHOT_DIR, "shell-375-closed.png") });

    await page.getByTestId("topbar-menu").click();
    await expect(page.getByTestId("nav-drawer-close")).toBeVisible();
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "shell-375-drawer-open.png"),
    });
    await page.keyboard.press("Escape");

    // Tablet — still hamburger-driven (rail is desktop-only at lg+).
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");
    await expect(page.getByTestId("topbar-menu")).toBeVisible();
    await page.screenshot({ path: join(SCREENSHOT_DIR, "shell-768.png") });

    // Desktop — persistent sidebar, no hamburger.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await expect(page.getByTestId("topbar-menu")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Discover" })).toBeVisible();
    await page.screenshot({ path: join(SCREENSHOT_DIR, "shell-1280.png") });
  });
});
