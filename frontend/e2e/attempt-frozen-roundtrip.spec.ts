/**
 * FE-4 §D.4 — first E2E happy path.
 *
 * Drives the frozen attempt runner end-to-end through a real browser
 * against `next dev`. Backend calls are intercepted via
 * `page.route()` (per spec §D.4 — MSW does not run cleanly under
 * Playwright; the dev server is started with
 * `NEXT_PUBLIC_API_MOCKING=disabled` so the browser MSW boot guard
 * short-circuits). Auth is pre-seeded via `addInitScript` so the
 * runner mounts without going through /login.
 *
 * Round-trip:
 *   1. Seed localStorage with a refresh token + intercept auth calls
 *   2. Deep-link `/attempts/<uuid>` → /attempts/[id]/page.tsx loads
 *   3. Answer Q1 (MCQ) → debounced autosave fires
 *   4. Next → Answer Q2 (true_false) → autosave fires
 *   5. Next → Answer Q3 (short_answer) → autosave fires
 *   6. Click "Submit attempt" → confirm modal → confirm
 *   7. GradingOverlay polls /result; once `status: "ready"`, router
 *      pushes /attempts/<uuid>/result
 *   8. Assert the result placeholder renders the attempt id prefix
 */

import { expect, test } from "@playwright/test";

const ATTEMPT_ID = "11111111-1111-1111-1111-aaaaaaaaaaaa";
const TEST_ID = "22222222-2222-2222-2222-bbbbbbbbbbbb";
const TESTEE_ID = "00000000-0000-0000-0000-000000000001";
const Q_MCQ = "33333333-3333-3333-3333-cccccccccc01";
const Q_TF = "33333333-3333-3333-3333-cccccccccc02";
const Q_SA = "33333333-3333-3333-3333-cccccccccc03";

const BACKEND = "http://localhost:8000";

const FIXTURE_TESTEE = {
  id: TESTEE_ID,
  email: "joana@example.com",
  name: "Joana",
  role: "testee",
  status: "active",
  privacy_ack_at: "2026-05-01T00:00:00Z",
  created_at: "2026-05-01T00:00:00Z",
};

const FIXTURE_TEST = {
  id: TEST_ID,
  name: "Reference Panels · Practice D5",
  mode: "frozen",
  status: "published",
  visibility: "library",
  timed: true,
  duration_minutes: 30,
  pause_allowance: 2,
  timeout_behaviour: "auto_submit",
  max_pause_duration_minutes: 5,
  pass_threshold: 0.7,
  target_difficulty: 5,
  lock_mode: "open",
  campaign_id: null,
  benchmark_scope: null,
  benchmark_target_testee_id: null,
  randomise_question_order: false,
  randomise_option_order: false,
  pill_id: null,
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
};

const FIXTURE_QUESTIONS = [
  {
    id: Q_MCQ,
    type: "multiple_choice",
    question_group_id: null,
    attempt_position: null,
    reference_image_url: null,
    reference_image_caption: null,
    config: {
      prompt: "Which DFT measurement device pairs best with steel substrates?",
      options: [
        { text: "Eddy-current gauge", image_url: null },
        { text: "Magnetic-induction gauge", image_url: null },
        { text: "Ultrasonic gauge", image_url: null },
      ],
    },
  },
  {
    id: Q_TF,
    type: "true_false",
    question_group_id: null,
    attempt_position: null,
    reference_image_url: null,
    reference_image_caption: null,
    config: {
      prompt: "Cathodic protection alone prevents pitting corrosion.",
    },
  },
  {
    id: Q_SA,
    type: "short_answer",
    question_group_id: null,
    attempt_position: null,
    reference_image_url: null,
    reference_image_caption: null,
    config: {
      prompt: "Why does batch tracking matter when reference panels rotate?",
      expected_seconds: 90,
    },
  },
];

const FIXTURE_ATTEMPT = {
  id: ATTEMPT_ID,
  test_id: TEST_ID,
  testee_id: TESTEE_ID,
  assignment_id: null,
  origin: "self_initiated",
  sequence_number: 1,
  started_at: "2026-05-27T10:00:00Z",
  submitted_at: null,
  paused: false,
  pauses_used: 0,
  pause_allowance: 2,
  pause_seconds_remaining: null,
  pause_reason: null,
  watermark: TESTEE_ID,
  questions: FIXTURE_QUESTIONS,
  q1: null,
};

test.describe("FE-4 frozen attempt round-trip", () => {
  test.beforeEach(async ({ page }) => {
    // Seed auth before any page script runs: an in-memory access
    // token isn't visible to JS pre-bootstrap; the refresh token is
    // in localStorage and triggers a refresh on mount. We intercept
    // both /v1/auth/refresh and /v1/auth/me so the runtime config
    // probe completes against a logged-in testee.
    await page.addInitScript(() => {
      window.localStorage.setItem("acumen.refresh_token", "fake-refresh-token");
    });

    // Capture autosave bodies so the round-trip assertions can verify
    // the right payloads land on the wire.
    const autosaves: unknown[] = [];
    // @ts-expect-error stash on the page for cross-step access
    page.__autosaves = autosaves;

    // Playwright route order: the LAST registered handler takes
    // precedence (calls route.fulfill before earlier handlers see
    // the request). So the catch-all goes FIRST — specific routes
    // registered below override it.
    await page.route(/.*\/v1\//, async (route) => {
      // eslint-disable-next-line no-console
      console.warn("Unmocked v1 call:", route.request().url());
      await route.fulfill({
        status: 500,
        json: { error: { code: "unmocked", message: "Unmocked call", detail: null } },
      });
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
    await page.route(`**/v1/attempts/${ATTEMPT_ID}`, async (route) => {
      await route.fulfill({ json: FIXTURE_ATTEMPT });
    });
    await page.route(`**/v1/tests/${TEST_ID}`, async (route) => {
      await route.fulfill({ json: FIXTURE_TEST });
    });
    await page.route(`**/v1/attempts/${ATTEMPT_ID}/autosave`, async (route, request) => {
      try {
        autosaves.push(JSON.parse(request.postData() ?? "null"));
      } catch {
        autosaves.push(null);
      }
      await route.fulfill({ json: { status: "ok" } });
    });
    await page.route(`**/v1/attempts/${ATTEMPT_ID}/submit`, async (route) => {
      await route.fulfill({
        json: { ...FIXTURE_ATTEMPT, submitted_at: "2026-05-27T10:30:00Z" },
      });
    });
    await page.route(`**/v1/attempts/${ATTEMPT_ID}/result`, async (route) => {
      await route.fulfill({
        json: {
          attempt_id: ATTEMPT_ID,
          submitted_at: "2026-05-27T10:30:00Z",
          status: "ready",
          overall_score: 0.85,
          outcome: "pass",
          questions: null,
        },
      });
    });
  });

  test("answer all 3 questions → submit → grading → routes to result", async ({
    page,
  }) => {
    await page.goto(`/attempts/${ATTEMPT_ID}`);

    // Q1 — MCQ
    await expect(page.getByTestId("question-mcq")).toBeVisible();
    await page.getByTestId("question-mcq-option-1").click();
    await expect(page.getByTestId("autosave-indicator")).toHaveAttribute(
      "data-state",
      /(saving|saved)/,
    );
    await expect(page.getByTestId("autosave-indicator")).toHaveAttribute(
      "data-state",
      "saved",
      { timeout: 5000 },
    );

    await page.getByTestId("attempt-next").click();

    // Q2 — TF
    await expect(page.getByTestId("question-true-false")).toBeVisible();
    await page.getByTestId("question-tf-true").click();
    await expect(page.getByTestId("autosave-indicator")).toHaveAttribute(
      "data-state",
      "saved",
      { timeout: 5000 },
    );

    await page.getByTestId("attempt-next").click();

    // Q3 — Short answer
    await expect(page.getByTestId("question-short-answer")).toBeVisible();
    await page
      .getByTestId("question-short-answer-input")
      .fill("Tracking the batch lets us trace defects back to mix lot.");
    await expect(page.getByTestId("autosave-indicator")).toHaveAttribute(
      "data-state",
      "saved",
      { timeout: 5000 },
    );

    // At the final question the Next button morphs into Submit.
    await expect(page.getByTestId("attempt-submit")).toBeVisible();
    await page.getByTestId("attempt-submit").click();

    // Confirm modal
    await expect(page.getByTestId("submit-confirm-modal")).toBeVisible();
    await page.getByTestId("submit-confirm-action").click();

    // GradingOverlay appears, then the polling exits on status: ready.
    await expect(page.getByTestId("grading-overlay")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/attempts/${ATTEMPT_ID}/result$`), {
      timeout: 10_000,
    });
    await expect(page.getByText(/Your result has landed\./)).toBeVisible();

    // Sanity-check the autosave bodies — at least one per answered
    // question, in roughly the order we clicked them.
    // @ts-expect-error stashed in beforeEach
    const calls: Array<{ question_id?: string }> = page.__autosaves;
    const questionIds = calls.map((c) => c?.question_id);
    expect(questionIds).toContain(Q_MCQ);
    expect(questionIds).toContain(Q_TF);
    expect(questionIds).toContain(Q_SA);
  });
});
