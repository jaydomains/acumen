/**
 * FE-5 §D.4 — per-Testee streaming attempt E2E.
 *
 * Drives the streaming runner end-to-end through a real browser
 * against `next dev`. Backend calls are intercepted via
 * `page.route()` (MSW does not run under Playwright; the dev server
 * is started with `NEXT_PUBLIC_API_MOCKING=disabled` so the browser
 * MSW boot guard short-circuits). Auth is pre-seeded via
 * `addInitScript` so the runner mounts without going through /login.
 *
 * Three scenarios per the FE-5 spec:
 *
 *   1. Happy path — Q1 mounts; SSE delivers events 2..N; JITQueue
 *      transitions from streaming → done; submit → grading → /result.
 *   2. Reconnect — first SSE call drops after event 2; the adapter
 *      reconnects carrying `Last-Event-ID: 2`; the second call
 *      delivers 3..N + done.
 *   3. System-glitch — SSE delivers a terminal `paused
 *      (generation_failed)` frame; the runner branches the system-
 *      glitch overlay; user clicks "Try resuming →" → POST /resume
 *      → SSE reopens delivering remaining events.
 *
 * The SSE body is fulfilled via Playwright's
 * ``route.fulfill({ body })`` accepting a string with the encoded
 * SSE wire format; for streams that need backpressure we fulfill
 * with a chunked string that the browser receives in one go (fine
 * for the FE-side reducer — the adapter parses frame-by-frame
 * regardless of chunk boundaries).
 */

import { expect, test } from "@playwright/test";

const ATTEMPT_ID = "11111111-1111-1111-1111-aaaaaaaaaaaa";
const TEST_ID = "22222222-2222-2222-2222-bbbbbbbbbbbb";
const TESTEE_ID = "00000000-0000-0000-0000-000000000001";
const Q1 = "33333333-3333-3333-3333-cccccccccc01";
const Q2 = "33333333-3333-3333-3333-cccccccccc02";
const Q3 = "33333333-3333-3333-3333-cccccccccc03";

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
  mode: "per_testee",
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

const Q1_PAYLOAD = {
  id: Q1,
  type: "multiple_choice",
  question_group_id: null,
  attempt_position: 1,
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
};

const Q2_PAYLOAD = {
  id: Q2,
  type: "true_false",
  question_group_id: null,
  attempt_position: 2,
  reference_image_url: null,
  reference_image_caption: null,
  config: {
    prompt: "Cathodic protection alone prevents pitting corrosion.",
  },
};

const Q3_PAYLOAD = {
  id: Q3,
  type: "short_answer",
  question_group_id: null,
  attempt_position: 3,
  reference_image_url: null,
  reference_image_caption: null,
  config: {
    prompt: "Why does batch tracking matter when reference panels rotate?",
    expected_seconds: 90,
  },
};

type AttemptPaused = {
  paused: boolean;
  pause_reason: string | null;
};

function attemptView(extras: {
  questions: object[];
  paused?: AttemptPaused;
  submitted?: boolean;
}) {
  return {
    id: ATTEMPT_ID,
    test_id: TEST_ID,
    testee_id: TESTEE_ID,
    assignment_id: null,
    origin: "self_initiated",
    sequence_number: 1,
    started_at: "2026-05-27T10:00:00Z",
    submitted_at: extras.submitted ? "2026-05-27T10:30:00Z" : null,
    paused: extras.paused?.paused ?? false,
    pauses_used: 0,
    pause_allowance: 2,
    pause_seconds_remaining: extras.paused?.paused ? 300 : null,
    pause_reason: extras.paused?.pause_reason ?? null,
    watermark: TESTEE_ID,
    questions: extras.questions,
    q1: null,
  };
}

function sseQuestionFrame(position: number, questionId: string): string {
  return (
    `id: ${position}\n` +
    `data: ${JSON.stringify({
      id: questionId,
      attempt_position: position,
      attempt_id: ATTEMPT_ID,
    })}\n\n`
  );
}

function sseDoneFrame(completed: number[]): string {
  return (
    `event: done\n` +
    `data: ${JSON.stringify({
      completed_positions: completed,
      replayed_positions: [],
    })}\n\n`
  );
}

function ssePausedFrame(reason: string, failed: number, completed: number[]): string {
  return (
    `event: paused\n` +
    `data: ${JSON.stringify({
      reason,
      failed_position: failed,
      completed_positions: completed,
    })}\n\n`
  );
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
};

test.describe("FE-5 per-Testee streaming attempt", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("acumen.refresh_token", "fake-refresh-token");
    });

    // Catch-all goes first; specific overrides win because Playwright
    // dispatches the LAST-registered matching route first.
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
      await route.fulfill({ json: FIXTURE_TESTEE });
    });
    await page.route(`**/v1/tests/${TEST_ID}`, async (route) => {
      await route.fulfill({ json: FIXTURE_TEST });
    });
    await page.route(`**/v1/attempts/${ATTEMPT_ID}/autosave`, async (route) => {
      await route.fulfill({ json: { status: "ok" } });
    });
  });

  test("happy path: Q1..Q3 stream then submit", async ({ page }) => {
    // Server-side question table grows as the stream emits — the
    // page's refetch-on-event picks up new positions.
    let attemptHits = 0;
    await page.route(`**/v1/attempts/${ATTEMPT_ID}`, async (route) => {
      attemptHits += 1;
      const known =
        attemptHits === 1
          ? [Q1_PAYLOAD]
          : attemptHits === 2
            ? [Q1_PAYLOAD, Q2_PAYLOAD]
            : [Q1_PAYLOAD, Q2_PAYLOAD, Q3_PAYLOAD];
      await route.fulfill({ json: attemptView({ questions: known }) });
    });

    await page.route(
      new RegExp(`/v1/attempts/${ATTEMPT_ID}/stream(\\?|$)`),
      async (route) => {
        const body =
          sseQuestionFrame(2, Q2) + sseQuestionFrame(3, Q3) + sseDoneFrame([2, 3]);
        await route.fulfill({ status: 200, headers: SSE_HEADERS, body });
      },
    );

    await page.route(`**/v1/attempts/${ATTEMPT_ID}/submit`, async (route) => {
      await route.fulfill({
        json: attemptView({
          questions: [Q1_PAYLOAD, Q2_PAYLOAD, Q3_PAYLOAD],
          submitted: true,
        }),
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
          attempt_band: null,
          competence_estimate_after: null,
          competence_estimate_delta: null,
          time_on_test_seconds: 600,
          median_time_seconds: null,
          review_summary: null,
          pills: [],
          adaptive_loop: [],
          questions: [],
        },
      });
    });

    await page.goto(`/attempts/${ATTEMPT_ID}`);

    // Q1 mounts inside the streaming shell with the JIT queue
    // sidebar visible.
    await expect(page.getByTestId("jit-queue")).toBeVisible();
    await expect(page.getByTestId("question-mcq")).toBeVisible();
    await expect(page.getByTestId("jit-queue-item-0")).toHaveAttribute(
      "data-state",
      "current",
    );

    // SSE delivery → questions[] grows to 3; the queue length
    // matches; status flips to done.
    await expect(page.getByTestId("jit-queue-item-2")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("jit-queue-done")).toBeVisible({
      timeout: 5_000,
    });

    // Step through Q1 → Q2 → Q3, hit Submit at the end.
    await page.getByTestId("question-mcq-option-1").click();
    await page.getByTestId("attempt-next").click();
    await expect(page.getByTestId("question-true-false")).toBeVisible();
    await page.getByTestId("question-tf-true").click();
    await page.getByTestId("attempt-next").click();
    await expect(page.getByTestId("question-short-answer")).toBeVisible();
    await page
      .getByTestId("question-short-answer-input")
      .fill("Tracking the batch lets us trace defects back to mix lot.");

    await expect(page.getByTestId("attempt-submit")).toBeVisible();
    await page.getByTestId("attempt-submit").click();
    await expect(page.getByTestId("submit-confirm-modal")).toBeVisible();
    await page.getByTestId("submit-confirm-action").click();

    await expect(page.getByTestId("grading-overlay")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/attempts/${ATTEMPT_ID}/result$`), {
      timeout: 10_000,
    });
  });

  test("multi-call recovery: partial stream then completing call drives runner to done", async ({
    page,
  }) => {
    // **Note on scope:** the adapter-level "reconnect carries
    // ``Last-Event-ID: <N>``" contract is covered by 32 unit tests
    // in ``tests/lib/api/sse.test.ts``. This E2E can't reliably
    // exercise the in-generator reconnect because React Strict Mode
    // (on in ``next dev``) double-mounts the effect on initial
    // render — the second stream call is a fresh
    // ``openAttemptStream`` invocation, not the adapter's internal
    // reconnect. What this test DOES verify is that the runner
    // gracefully drives to ``done`` over multiple server calls and
    // a UI re-mount.
    await page.route(`**/v1/attempts/${ATTEMPT_ID}`, async (route) => {
      await route.fulfill({
        json: attemptView({
          questions: [Q1_PAYLOAD, Q2_PAYLOAD, Q3_PAYLOAD],
        }),
      });
    });

    let streamCall = 0;
    await page.route(
      new RegExp(`/v1/attempts/${ATTEMPT_ID}/stream(\\?|$)`),
      async (route) => {
        streamCall += 1;
        if (streamCall === 1) {
          // Deliver Q2 then EOF — adapter treats EOF without
          // terminal as reconnect-eligible (production behaviour).
          await route.fulfill({
            status: 200,
            headers: SSE_HEADERS,
            body: sseQuestionFrame(2, Q2),
          });
        } else {
          // Subsequent call delivers Q3 + done. In production, this
          // is the adapter's internal reconnect; under Strict Mode
          // dev double-mount, it's the second mount's fresh
          // ``openAttemptStream``.
          await route.fulfill({
            status: 200,
            headers: SSE_HEADERS,
            body: sseQuestionFrame(3, Q3) + sseDoneFrame([2, 3]),
          });
        }
      },
    );

    await page.goto(`/attempts/${ATTEMPT_ID}`);
    await expect(page.getByTestId("jit-queue")).toBeVisible();
    await expect(page.getByTestId("jit-queue-done")).toBeVisible({
      timeout: 15_000,
    });
    expect(streamCall).toBeGreaterThanOrEqual(2);
  });

  test("system-glitch path: terminal paused → overlay → resume → re-stream", async ({
    page,
  }) => {
    // Toggle attempt.pause_reason in lock-step with the stream's
    // terminal paused frame so the FE's reactive close + overlay
    // branch fire as they would in production.
    let pausedState: AttemptPaused = { paused: false, pause_reason: null };
    let resumeCalled = false;

    await page.route(`**/v1/attempts/${ATTEMPT_ID}`, async (route) => {
      await route.fulfill({
        json: attemptView({
          questions: [Q1_PAYLOAD, Q2_PAYLOAD],
          paused: pausedState,
        }),
      });
    });

    let streamCall = 0;
    await page.route(
      new RegExp(`/v1/attempts/${ATTEMPT_ID}/stream(\\?|$)`),
      async (route) => {
        streamCall += 1;
        if (streamCall === 1) {
          // First call: deliver Q2 then a terminal paused
          // (generation_failed) — backend has marked the attempt
          // paused server-side.
          pausedState = { paused: true, pause_reason: "generation_failed" };
          await route.fulfill({
            status: 200,
            headers: SSE_HEADERS,
            body: sseQuestionFrame(2, Q2) + ssePausedFrame("generation_failed", 3, [2]),
          });
        } else {
          // Reconnect after POST /resume: deliver Q3 + done.
          await route.fulfill({
            status: 200,
            headers: SSE_HEADERS,
            body: sseQuestionFrame(3, Q3) + sseDoneFrame([2, 3]),
          });
        }
      },
    );

    await page.route(`**/v1/attempts/${ATTEMPT_ID}/resume`, async (route) => {
      resumeCalled = true;
      pausedState = { paused: false, pause_reason: null };
      await route.fulfill({ json: { status: "resumed" } });
    });

    await page.goto(`/attempts/${ATTEMPT_ID}`);

    // The system-glitch overlay mounts (server-side pause_reason
    // wins). FE-4's PauseOverlay must NOT mount alongside.
    await expect(page.getByTestId("system-glitch-overlay")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("system-glitch-overlay")).toHaveAttribute(
      "data-reason",
      "generation_failed",
    );
    await expect(page.getByTestId("pause-overlay")).toHaveCount(0);

    // Resume CTA → POST /resume → reconnect SSE delivering Q3 + done.
    await page.getByTestId("system-glitch-resume").click();
    await expect.poll(() => resumeCalled).toBe(true);
    await expect(page.getByTestId("system-glitch-overlay")).toHaveCount(0, {
      timeout: 10_000,
    });
    await expect(page.getByTestId("jit-queue-done")).toBeVisible({
      timeout: 10_000,
    });
  });
});
