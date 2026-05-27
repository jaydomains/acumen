/**
 * FE-6 §D.4 — results page end-to-end.
 *
 * Picks up where the FE-4 round-trips left off: lands on the deep
 * link `/attempts/<id>/result` (the GradingOverlay redirect target),
 * asserts the full §B composition renders, exercises the PDF export
 * happy path, and validates the spec's flagged-Q anchor scroll.
 *
 * Backend calls are intercepted via `page.route()` per the existing
 * Playwright convention. Two scenarios:
 *   1. Rich review_pending → ready transition (a single result fetch
 *      returns the rich §B payload with one flagged Q + one weak pill
 *      + one explainer step + a couple of grades).
 *   2. PDF export — clicking the button posts a synthetic download.
 *      The test asserts the `download` event fires.
 */

import { expect, test } from "@playwright/test";

const ATTEMPT_ID = "11111111-1111-1111-1111-aaaaaaaaaaaa";
const TEST_ID = "22222222-2222-2222-2222-bbbbbbbbbbbb";
const TESTEE_ID = "00000000-0000-0000-0000-000000000001";
const PILL_ID = "44444444-4444-4444-4444-dddddddddddd";
const Q1_ID = "55555555-5555-5555-5555-eeeeeeeeeee1";
const Q2_ID = "55555555-5555-5555-5555-eeeeeeeeeee2";

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

const FIXTURE_ATTEMPT = {
  id: ATTEMPT_ID,
  test_id: TEST_ID,
  testee_id: TESTEE_ID,
  assignment_id: null,
  origin: "self_initiated",
  sequence_number: 1,
  started_at: "2026-05-27T10:00:00Z",
  submitted_at: "2026-05-27T10:30:00Z",
  paused: false,
  pauses_used: 0,
  pause_allowance: 2,
  pause_seconds_remaining: null,
  pause_reason: null,
  watermark: TESTEE_ID,
  questions: [
    {
      id: Q1_ID,
      attempt_position: 1,
      type: "multiple_choice",
      config: { prompt: "Which DFT pairs best with steel?" },
      realism_flagged_by_me: false,
      realism_flag_note: null,
      realism_flagged_at: null,
    },
    {
      id: Q2_ID,
      attempt_position: 2,
      type: "scenario",
      config: { prompt: "Describe inspection workflow." },
      realism_flagged_by_me: true,
      realism_flag_note: "Felt generated.",
      realism_flagged_at: "2026-05-27T10:25:00Z",
    },
  ],
  q1: null,
};

const FIXTURE_RESULT_READY = {
  attempt_id: ATTEMPT_ID,
  submitted_at: "2026-05-27T10:30:00Z",
  status: "ready",
  overall_score: 0.85,
  outcome: "pass",
  attempt_band: "working",
  competence_estimate_after: 6.4,
  competence_estimate_delta: 0.6,
  time_on_test_seconds: 1_440,
  median_time_seconds: 1_500,
  review_summary: {
    ai_grader_model: "claude-sonnet-4-5",
    reviewer_model: "openai gpt-4o-mini",
    flagged_count: 1,
    flagged_question_positions: [2],
    review_duration_ms: 4_200,
  },
  pills: [
    {
      pill_id: PILL_ID,
      pill_name: "Antifouling",
      subject_id: null,
      score_percent: 50,
      missed_count: 1,
      total_count: 2,
      band: null,
      competence_estimate: 4.2,
      n: 12,
      confidence: "preliminary",
      severity: "severe",
      is_safety_tagged: false,
    },
  ],
  adaptive_loop: [
    {
      type: "explainer",
      target_pill_id: PILL_ID,
      target_pill_name: "Antifouling",
      title: "Read this explainer on Antifouling",
      description: "A short read.",
      cta_label: "Open",
      route_href: `/pills/${PILL_ID}`,
      status: "ready",
      queued_for: null,
      step_down_hint: false,
    },
  ],
  questions: [
    {
      question_id: Q1_ID,
      attempt_position: 1,
      prompt_text: "Which DFT pairs best with steel?",
      question_type: "multiple_choice",
      has_figure: false,
      is_ai_graded: false,
      status: null,
      response: { answer_payload: { choice: 1 } },
      grade: {
        is_correct: true,
        points_awarded: 1,
        points_possible: 1,
        source: "auto",
        ai_grader_model: null,
        ai_reasoning: null,
        review_verdict: null,
        review_reasoning: null,
        reviewer_model: null,
      },
    },
    {
      question_id: Q2_ID,
      attempt_position: 2,
      prompt_text: "Describe inspection workflow.",
      question_type: "scenario",
      has_figure: false,
      is_ai_graded: true,
      status: null,
      response: { answer_payload: { text: "Sequence: prep, anchor, DFT." } },
      grade: {
        is_correct: true,
        points_awarded: 1,
        points_possible: 1,
        source: "ai",
        ai_grader_model: "claude-sonnet-4-5",
        ai_reasoning: "Workflow is correct.",
        review_verdict: "flagged",
        review_reasoning: "Borderline rubric match.",
        reviewer_model: "openai gpt-4o-mini",
      },
    },
  ],
};

test.describe("FE-6 results page", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("acumen.refresh_token", "fake-refresh-token");
    });

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
    await page.route(`**/v1/attempts/${ATTEMPT_ID}/result`, async (route) => {
      await route.fulfill({ json: FIXTURE_RESULT_READY });
    });
  });

  test("ready result renders full composition + flagged anchor + adaptive loop", async ({
    page,
  }) => {
    await page.goto(`/attempts/${ATTEMPT_ID}/result`);

    // Hero + REVIEW COMPLETE banner (review_summary present).
    await expect(page.getByText(/Your attempt result/)).toBeVisible();
    await expect(page.getByText("REVIEW COMPLETE")).toBeVisible();
    await expect(page.getByText(/in 4\.2s/)).toBeVisible();

    // By-pill card with one severe row, preliminary confidence.
    // Scope the "Antifouling" text-match to the card — the loop step's
    // title "Read this explainer on Antifouling" matches too, which
    // trips Playwright's strict mode.
    await expect(page.getByTestId("by-pill-card")).toBeVisible();
    await expect(page.getByTestId("by-pill-card").getByText("Antifouling")).toBeVisible();
    await expect(page.getByText("SEVERE")).toBeVisible();

    // By-question card with both rows; row 2 surfaces "Admin reviewing".
    await expect(page.getByTestId("by-question-card")).toBeVisible();
    await expect(page.getByText("Admin reviewing")).toBeVisible();

    // Adaptive loop has the explainer CTA.
    await expect(page.getByTestId("adaptive-loop-card")).toBeVisible();
    await expect(page.getByTestId("loop-step-cta")).toHaveAttribute(
      "href",
      `/pills/${PILL_ID}`,
    );

    // Transparency block with one flagged anchor.
    await expect(page.getByTestId("transparency-block")).toBeVisible();
    await expect(page.getByText(/claude-sonnet-4-5/)).toBeVisible();
    await expect(page.getByText(/openai gpt-4o-mini/)).toBeVisible();
    await expect(page.getByTestId("transparency-flagged-anchor")).toHaveText("Q2");

    // Realism aggregate — one row for Q2.
    await expect(page.getByTestId("realism-aggregate-card")).toBeVisible();
    await expect(page.getByText("YOU FLAGGED 1 QUESTION")).toBeVisible();
    await expect(page.getByText("Felt generated.")).toBeVisible();

    // PDF export button is idle (status === ready).
    await expect(page.getByTestId("pdf-export-button")).toHaveAttribute(
      "data-state",
      "idle",
    );
  });

  test("PDF export → browser download fires", async ({ page }) => {
    await page.route(`**/v1/attempts/${ATTEMPT_ID}/export.pdf`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        headers: {
          // `Access-Control-Expose-Headers` is required so the
          // cross-origin (localhost:3000 → localhost:8000) `fetch()`
          // reads the filename via response.headers.get(). Without it
          // browsers hide non-safelisted response headers and the
          // PdfExportButton's `parseContentDisposition` returns null —
          // the button falls back to `attempt-<prefix>.pdf`.
          "Access-Control-Expose-Headers": "Content-Disposition",
          "Content-Disposition": `attachment; filename="acumen-attempt-${ATTEMPT_ID}.pdf"`,
        },
        body: Buffer.from("%PDF-1.4\n%mock\n"),
      });
    });

    await page.goto(`/attempts/${ATTEMPT_ID}/result`);
    await expect(page.getByTestId("pdf-export-button")).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("pdf-export-button").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`acumen-attempt-${ATTEMPT_ID}.pdf`);
  });
});
