/**
 * FE-8 admin-authoring E2E (Slice 14).
 *
 * Drives the admin test-authoring chain in a real browser against
 * `next dev`. Backend calls are intercepted via `page.route()` per
 * the FE-5 + FE-6 E2E precedent (MSW does not run under Playwright;
 * the dev server boots with `NEXT_PUBLIC_API_MOCKING=disabled` so the
 * browser MSW boot guard short-circuits).
 *
 * Scope (per Slice 14 drift sweep Finding #4 + Finding #5):
 *
 *   - Verify the admin authoring chain end-to-end in a real browser:
 *     /admin/tests list → /admin/tests/new/edit → save draft → URL
 *     flips → /admin/tests/{newId}/edit → click Publish → status
 *     pill flips to Published.
 *   - Skip the testee-dashboard terminal step (no `/v1/me/assignments`
 *     endpoint exists — tracked as a v1.x gap per drift sweep
 *     Finding #4; the round-trip Vitest suite walks the bindable-in-
 *     picker proxy instead).
 *   - Skip the full done-when chain (catalogue → identity → tests →
 *     dashboard) because each cross-domain hop requires ~10 new
 *     `page.route` stubs and the chain's value is already covered by
 *     the three Vitest round-trip integration tests in
 *     `tests/integration/admin/`.
 *
 * What this proves over the Vitest round-trip: real browser, real
 * Next.js router, real navigation between pages (vs simulated remount
 * + mocked `next/navigation`).
 */

import { expect, test } from "@playwright/test";

const BACKEND = "http://localhost:8000";

const ADMIN_USER_ID = "00000000-0000-0000-0000-00000000ADM1";
const NEW_TEST_ID = "ffff5555-ffff-ffff-ffff-000000000099";
const PILL_ID = "eeeeeeee-eeee-eeee-eeee-000000000001";
const SUBJECT_ID = "dddddddd-dddd-dddd-dddd-000000000001";

const FIXTURE_ADMIN = {
  id: ADMIN_USER_ID,
  email: "admin@acumen.test",
  name: "Admin User",
  role: "admin",
  status: "active",
  privacy_ack_at: "2026-05-01T00:00:00Z",
  created_at: "2026-05-01T00:00:00Z",
};

const FIXTURE_PILL = {
  id: PILL_ID,
  subject_id: SUBJECT_ID,
  name: "Antifouling Systems",
  description: "Anti-corrosion and antifouling coatings.",
  available_difficulty_min: 1,
  available_difficulty_max: 10,
  discoverable: true,
  safety_relevant: false,
  safety_relevant_overridden_at: null,
  estimated_minutes: null,
  retired_at: null,
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
};

let mockTestState: Record<string, unknown> = {
  id: NEW_TEST_ID,
  name: "",
  mode: "per_testee",
  status: "draft",
  visibility: "library",
  timed: true,
  duration_minutes: null,
  pause_allowance: null,
  timeout_behaviour: "auto_submit",
  max_pause_duration_minutes: 30,
  pass_threshold: 0.7,
  target_difficulty: 6,
  lock_mode: "open",
  campaign_id: null,
  benchmark_scope: null,
  benchmark_target_testee_id: null,
  randomise_question_order: false,
  randomise_option_order: false,
  pill_id: PILL_ID,
  created_at: "2026-05-29T00:00:00Z",
  updated_at: "2026-05-29T00:00:00Z",
};

test.describe("FE-8 admin authoring", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("acumen.refresh_token", "fake-refresh-token");
    });

    // Reset state per test.
    mockTestState = { ...mockTestState, status: "draft", name: "" };

    // Catch-all 500 logger goes first; specific overrides win.
    await page.route(/.*\/v1\//, async (route) => {
      // eslint-disable-next-line no-console
      console.warn("Unmocked v1 call:", route.request().url());
      await route.fulfill({
        status: 500,
        json: {
          error: { code: "unmocked", message: "Unmocked call", detail: null },
        },
      });
    });

    await page.route("**/api/config", async (route) => {
      await route.fulfill({ json: { apiBaseUrl: BACKEND } });
    });
    await page.route("**/v1/auth/refresh", async (route) => {
      await route.fulfill({ json: { access_token: "fake-access-token" } });
    });
    await page.route("**/v1/auth/me", async (route) => {
      await route.fulfill({ json: FIXTURE_ADMIN });
    });

    // Pills list — consumed by the editor's per_testee section.
    await page.route("**/v1/pills?**", async (route) => {
      await route.fulfill({
        json: { data: [FIXTURE_PILL], meta: { next_cursor: null } },
      });
    });
    await page.route("**/v1/pills", async (route) => {
      await route.fulfill({
        json: { data: [FIXTURE_PILL], meta: { next_cursor: null } },
      });
    });

    // Tests list — initially empty so the empty-state CTA is visible.
    await page.route("**/v1/tests?**", async (route) => {
      await route.fulfill({
        json: {
          data: (mockTestState.name as string).trim() !== "" ? [mockTestState] : [],
          meta: { next_cursor: null },
        },
      });
    });
    await page.route("**/v1/tests", async (route) => {
      const req = route.request();
      if (req.method() === "POST") {
        const body = JSON.parse(req.postData() ?? "{}") as Record<string, unknown>;
        mockTestState = {
          ...mockTestState,
          name: String(body.name ?? ""),
          mode: String(body.mode ?? "per_testee"),
          pill_id: (body.pill_id as string) ?? PILL_ID,
          target_difficulty: (body.target_difficulty as number) ?? 6,
          status: "draft",
        };
        await route.fulfill({ status: 201, json: mockTestState });
        return;
      }
      await route.fulfill({
        json: {
          data: [],
          meta: { next_cursor: null },
        },
      });
    });

    // GET single test.
    await page.route(`**/v1/tests/${NEW_TEST_ID}`, async (route) => {
      const req = route.request();
      if (req.method() === "PATCH") {
        const body = JSON.parse(req.postData() ?? "{}") as Record<string, unknown>;
        if (typeof body.name === "string") mockTestState.name = body.name;
        await route.fulfill({ json: mockTestState });
        return;
      }
      await route.fulfill({ json: mockTestState });
    });

    // Publish.
    await page.route(`**/v1/tests/${NEW_TEST_ID}/publish`, async (route) => {
      mockTestState = { ...mockTestState, status: "published" };
      await route.fulfill({ json: mockTestState });
    });

    // Empty pool for the (per_testee) test — sampled at attempt-start so
    // no pool is needed; handler returns empty regardless.
    await page.route("**/v1/tests/*/questions", async (route) => {
      await route.fulfill({
        json: { data: [], meta: { next_cursor: null } },
      });
    });

    // FE-8 read-side admin domains the editor consumes but doesn't
    // mutate: subjects, paths, users, groups, assignments. Return empty
    // pages so the queries resolve cleanly.
    for (const path of [
      "**/v1/subjects**",
      "**/v1/learning-paths**",
      "**/v1/users**",
      "**/v1/groups**",
      "**/v1/assignments**",
      "**/v1/pill-proposals**",
    ]) {
      await page.route(path, async (route) => {
        await route.fulfill({
          json: { data: [], meta: { next_cursor: null } },
        });
      });
    }
  });

  test("admin creates a per_testee test and publishes it", async ({ page }) => {
    // -------------------------------------------------------------
    // /admin/tests — empty list, click +New
    // -------------------------------------------------------------
    await page.goto("/admin/tests");
    await expect(page.getByTestId("tests-empty")).toBeVisible();
    await page.getByTestId("tests-add-button").click();

    // -------------------------------------------------------------
    // /admin/tests/new/edit — fill form, save draft
    // -------------------------------------------------------------
    await expect(page).toHaveURL(/\/admin\/tests\/new\/edit/);
    await expect(page.getByTestId("test-editor-form")).toBeVisible();
    await page.getByTestId("test-editor-name").fill("Antifouling — e2e");
    await page
      .getByTestId("per-testee-pill-select")
      .selectOption({ label: "Antifouling Systems" });
    await page.getByTestId("difficulty-picker-6").click();
    await page.getByTestId("publish-controls-save").click();

    // URL flips to /admin/tests/{newId}/edit
    await expect(page).toHaveURL(new RegExp(`/admin/tests/${NEW_TEST_ID}/edit`));

    // -------------------------------------------------------------
    // /admin/tests/{newId}/edit — click Publish
    // -------------------------------------------------------------
    await expect(page.getByTestId("publish-controls-publish")).toBeVisible();
    await expect(page.getByTestId("publish-controls-publish")).toBeEnabled();
    await page.getByTestId("publish-controls-publish").click();

    // Status flips to published — warn banner + Lock control mount.
    await expect(page.getByTestId("warn-banner-published")).toBeVisible();
    await expect(page.getByTestId("publish-controls-lock")).toBeVisible();
    // Lock button ships disabled in v1 per Slice 12 drift Finding #1.
    await expect(page.getByTestId("publish-controls-lock")).toBeDisabled();
  });
});
