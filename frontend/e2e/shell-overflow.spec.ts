/**
 * Horizontal-overflow sweep (PR 2 / audit Phase 2+3, AC #7).
 *
 * At a 375px mobile viewport, no core route should produce horizontal
 * scroll. We assert the document never grows wider than the viewport
 * (a 1px rounding tolerance). Covers the shared shell + PageHeader on
 * testee routes plus the unauthenticated auth surface.
 *
 * Auth + mocking mirror the FE-4 / shell-responsive pattern: a seeded
 * refresh token + `page.route` interception (the dev server runs with
 * NEXT_PUBLIC_API_MOCKING=disabled). Pages that 500 against the benign
 * catch-all still render the shell/boundary, which is what we measure.
 */

import { expect, test, type Page } from "@playwright/test";

const BACKEND = "http://localhost:8000";

const FIXTURE_TESTEE = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "joana@example.com",
  name: "Joana Reyes",
  role: "testee",
  status: "active",
  privacy_ack_at: "2026-05-01T00:00:00Z",
  created_at: "2026-05-01T00:00:00Z",
};

async function mockAuthedTestee(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("acumen.refresh_token", "fake-refresh-token");
  });
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

async function expectNoHorizontalOverflow(page: Page) {
  // Measure the settled layout. The big serif headings render wider in
  // the fallback font, so a pre-swap measurement reports a transient
  // overflow that resolves once the web fonts + any in-flight requests
  // land; waiting here measures the real (post-swap) layout.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle");
  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe("no horizontal overflow @375px", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    await mockAuthedTestee(page);
  });

  for (const path of ["/", "/catalogue", "/profile", "/history"]) {
    test(`testee route ${path} does not overflow`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByTestId("topbar")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }

  test("loading skeleton (drawer open over content) does not overflow", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("topbar-menu").click();
    await expect(page.getByTestId("nav-drawer-close")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  for (const path of ["/login", "/privacy"]) {
    test(`auth surface ${path} does not overflow`, async ({ page }) => {
      await page.goto(path);
      await expectNoHorizontalOverflow(page);
    });
  }
});
