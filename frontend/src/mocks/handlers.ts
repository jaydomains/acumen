/**
 * MSW request handler registry (FE-1 §D, AC-CD15).
 *
 * The default scenario is "anonymous user can sign in", powering both
 * dev-mode walk-throughs (`NEXT_PUBLIC_API_MOCKING=enabled pnpm dev`)
 * and a no-frills baseline for tests. Tests typically call
 * `server.use(...)` to override specific endpoints per Gherkin
 * scenario.
 *
 * Slice B handlers:
 *  - GET /v1/auth/me  → 200 if mockSignedInAs is set; 401 otherwise.
 *  - POST /v1/auth/login → 200 with fixture tokens; flips mockSignedInAs
 *    to a stub user matching the submitted email.
 *  - POST /v1/auth/logout → 200; clears mockSignedInAs.
 *
 * Later slices (C, D, E) append handlers for password-reset, setup,
 * privacy/acknowledge, and the round-trip stateful scenarios.
 */

import { http, HttpResponse } from "msw";
import type { UserResponse, components } from "@/lib/api/types";
import {
  buildSseResponse,
  sseStreamFixture,
  type SseFixtureFrame,
  type SseFixtureOpts,
} from "@/mocks/sse-fixtures";

// MSW only runs in dev / test, where the backend URL is known and
// matches `MSW_FALLBACK_CONFIG` in src/lib/config.ts. Hardcoded here
// so handler registration does not depend on the runtime config store
// (which is populated asynchronously by ConfigProvider).
const API = "http://localhost:8000";

const baseFixtureUser: UserResponse = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "dev@example.com",
  name: "Dev User",
  role: "testee",
  status: "active",
  privacy_ack_at: null,
  created_at: "2026-01-01T00:00:00Z",
};

let mockSignedInAs: UserResponse | null = null;

export const setMockUser = (user: UserResponse | null): void => {
  mockSignedInAs = user;
};

export const resetMockAuthState = (): void => {
  mockSignedInAs = null;
};

export const getMockUser = (): UserResponse | null => mockSignedInAs;

const unauthEnvelope = {
  error: {
    code: "not_authenticated",
    message: "Not authenticated",
    detail: null,
  },
};

export const meHandler = http.get(`${API}/v1/auth/me`, () => {
  if (mockSignedInAs) {
    return HttpResponse.json(mockSignedInAs);
  }
  return HttpResponse.json(unauthEnvelope, { status: 401 });
});

export const loginHandler = http.post(`${API}/v1/auth/login`, async ({ request }) => {
  let body: { email?: unknown; password?: unknown } | null = null;
  try {
    body = (await request.json()) as { email?: unknown; password?: unknown };
  } catch {
    return HttpResponse.json(
      {
        error: {
          code: "bad_request",
          message: "Invalid JSON body.",
          detail: null,
        },
      },
      { status: 400 },
    );
  }
  const detail: { loc: string[]; msg: string; type: string }[] = [];
  if (typeof body?.email !== "string" || !body.email) {
    detail.push({ loc: ["body", "email"], msg: "field required", type: "missing" });
  }
  if (typeof body?.password !== "string" || !body.password) {
    detail.push({
      loc: ["body", "password"],
      msg: "field required",
      type: "missing",
    });
  }
  if (detail.length > 0) {
    return HttpResponse.json({ detail }, { status: 422 });
  }
  mockSignedInAs = {
    ...baseFixtureUser,
    email: body.email as string,
  };
  return HttpResponse.json({
    access_token: "mock_access_token",
    refresh_token: "mock_refresh_token",
    token_type: "bearer",
  });
});

export const logoutHandler = http.post(`${API}/v1/auth/logout`, () => {
  mockSignedInAs = null;
  return HttpResponse.json({ status: "ok" });
});

/**
 * Password lifecycle handlers (Slice C).
 *
 * Defaults are stateless happy-path:
 *  - /password-reset/request → always 200 (privacy-preserving per spec)
 *  - /password-reset/consume → 200 ok
 *  - /setup/{token}/preview → 200 with a fixture email
 *  - /setup/consume → 200 ok
 *
 * Tests override per-scenario via `server.use(...)` to inject
 * invalid_token, weak-password, and transient failures.
 */

export const passwordResetRequestHandler = http.post(
  `${API}/v1/auth/password-reset/request`,
  () => HttpResponse.json({ status: "ok" }),
);

export const passwordResetConsumeHandler = http.post(
  `${API}/v1/auth/password-reset/consume`,
  () => HttpResponse.json({ status: "ok" }),
);

export const setupPreviewHandler = http.get(`${API}/v1/auth/setup/:token/preview`, () =>
  HttpResponse.json({ email: "invitee@example.com" }),
);

export const setupConsumeHandler = http.post(`${API}/v1/auth/setup/consume`, () =>
  HttpResponse.json({ status: "ok" }),
);

/**
 * Privacy acknowledge handler (Slice D, §B.5).
 *
 * Returns the canonical {privacy_ack_at, status} shape. If a mock
 * user is currently signed in, mutates its privacy_ack_at in lock-
 * step so subsequent /v1/auth/me requests reflect the ack — keeps
 * the round-trip integration test (Slice E) coherent without a
 * separate scenario preset.
 */

export const privacyAcknowledgeHandler = http.post(
  `${API}/v1/auth/privacy/acknowledge`,
  () => {
    const ackedAt = "2026-05-26T09:30:00Z";
    if (mockSignedInAs) {
      mockSignedInAs = { ...mockSignedInAs, privacy_ack_at: ackedAt };
    }
    return HttpResponse.json({ privacy_ack_at: ackedAt, status: "ok" });
  },
);

/**
 * Catalogue + pill detail + learning-material handlers (FE-3 §B.2/§B.3/§B.4).
 *
 * The fixture catalogue is exposed via `setMockCatalogue([...])` so
 * individual tests can shape the list (subject mix, safety pills, empty
 * state). The default population mirrors the prototype's PILLS array
 * shape — same subject ids consumed by the subject-colour helper.
 *
 * Pagination is cursor-based per AC-CD21 + FE-3 §C.5: pages of up to
 * `limit` (default 50) pills; `meta.next_cursor` is the index of the
 * next slice's first item, or null when exhausted.
 */

type PillResponse = components["schemas"]["PillResponse"];
type LearningMaterialResponse = components["schemas"]["LearningMaterialResponse"];
type SafetyLinkResponse = components["schemas"]["SafetyLinkResponse"];

const ISO_2026 = "2026-05-01T00:00:00Z";

// Stable UUIDs so tests can match by id without computing them.
const pillId = (n: number): string =>
  `aaaaaaaa-aaaa-aaaa-aaaa-${String(n).padStart(12, "0")}`;

// MSW returns subject_id as the bare slug so that `subjectById()`
// (lib/catalogue/subjects.ts) resolves to a populated name + colour
// instead of the unknown fallback. Real backend will emit a UUID;
// when that lands we either inject a name into the catalogue page
// or extend subjectById to accept UUID → slug mappings.
const subjectUuid = (slug: string): string => slug;

const buildFixturePill = (input: {
  n: number;
  subject_slug: string;
  name: string;
  safety_relevant?: boolean;
  description?: string | null;
  min?: number;
  max?: number;
}): PillResponse => ({
  id: pillId(input.n),
  subject_id: subjectUuid(input.subject_slug),
  name: input.name,
  description: input.description ?? `Practice and learning for ${input.name}.`,
  available_difficulty_min: input.min ?? 1,
  available_difficulty_max: input.max ?? 10,
  discoverable: true,
  safety_relevant: input.safety_relevant ?? false,
  safety_relevant_overridden_at: null,
  estimated_minutes: 8,
  retired_at: null,
  created_at: ISO_2026,
  updated_at: ISO_2026,
});

const DEFAULT_FIXTURE_PILLS: PillResponse[] = [
  buildFixturePill({ n: 1, subject_slug: "paint-qa", name: "Reference Panels" }),
  buildFixturePill({ n: 2, subject_slug: "paint-qa", name: "Batch Tracking" }),
  buildFixturePill({ n: 3, subject_slug: "paint-qa", name: "DFT Measurement" }),
  buildFixturePill({ n: 4, subject_slug: "paint-qa", name: "Adhesion Testing" }),
  buildFixturePill({ n: 5, subject_slug: "marine", name: "Antifouling Systems" }),
  buildFixturePill({ n: 6, subject_slug: "marine", name: "Immersion Service" }),
  buildFixturePill({ n: 7, subject_slug: "marine", name: "Cathodic Protection" }),
  buildFixturePill({ n: 8, subject_slug: "nace", name: "Corrosion Mechanisms" }),
  buildFixturePill({ n: 9, subject_slug: "nace", name: "Passivation" }),
  buildFixturePill({ n: 10, subject_slug: "qs", name: "BoQ Preparation" }),
  buildFixturePill({ n: 11, subject_slug: "qs", name: "Take-offs" }),
  buildFixturePill({
    n: 12,
    subject_slug: "safety",
    name: "Confined Space Entry",
    safety_relevant: true,
    description: "Safety-tagged: curated industry sources only (AC-D21).",
  }),
  buildFixturePill({
    n: 13,
    subject_slug: "safety",
    name: "Working at Height",
    safety_relevant: true,
    description: "Safety-tagged: curated industry sources only (AC-D21).",
  }),
  buildFixturePill({ n: 14, subject_slug: "pm", name: "RFI Management" }),
  buildFixturePill({ n: 15, subject_slug: "pm", name: "Site Coordination" }),
];

let mockCatalogue: PillResponse[] = [...DEFAULT_FIXTURE_PILLS];

export const setMockCatalogue = (pills: PillResponse[]): void => {
  mockCatalogue = [...pills];
};

export const resetMockCatalogue = (): void => {
  mockCatalogue = [...DEFAULT_FIXTURE_PILLS];
};

export const getMockCatalogue = (): PillResponse[] => [...mockCatalogue];

const matchesFilter = (
  pill: PillResponse,
  filter: { subject_id: string | null; difficulty: number | null; search: string | null },
): boolean => {
  if (filter.subject_id && pill.subject_id !== filter.subject_id) return false;
  if (filter.difficulty !== null) {
    if (
      filter.difficulty < pill.available_difficulty_min ||
      filter.difficulty > pill.available_difficulty_max
    )
      return false;
  }
  if (filter.search) {
    if (!pill.name.toLowerCase().includes(filter.search.toLowerCase())) return false;
  }
  return true;
};

export const cataloguePillsHandler = http.get(
  `${API}/v1/catalogue/pills`,
  ({ request }) => {
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? Math.min(200, Math.max(1, Number(limitRaw))) : 50;
    const filter = {
      subject_id: url.searchParams.get("subject_id"),
      difficulty: url.searchParams.get("difficulty")
        ? Number(url.searchParams.get("difficulty"))
        : null,
      search: url.searchParams.get("search"),
    };

    const matched = mockCatalogue
      .filter((p) => p.discoverable)
      .filter((p) => matchesFilter(p, filter));

    const start = cursor ? Number(cursor) : 0;
    const slice = matched.slice(start, start + limit);
    const nextStart = start + slice.length;
    const next_cursor = nextStart < matched.length ? String(nextStart) : null;

    return HttpResponse.json({ data: slice, meta: { next_cursor } });
  },
);

export const cataloguePillDetailHandler = http.get(
  `${API}/v1/catalogue/pills/:pill_id`,
  ({ params }) => {
    const pill = mockCatalogue.find(
      (p) => p.id === params.pill_id && p.discoverable && p.retired_at === null,
    );
    if (!pill) {
      return HttpResponse.json(
        {
          error: {
            code: "not_found",
            message: "Pill not found.",
            detail: null,
          },
        },
        { status: 404 },
      );
    }
    return HttpResponse.json(pill);
  },
);

const defaultAiContent = (pillName: string): string =>
  `## What this pill covers\n\n${pillName} is a core competency. This is the v1 fixture explainer surfaced via POST /v1/pills/{id}/learning-material.\n\nThe response carries \`source: 'ai_generated'\` and the rendered prose lives in \`content\`. Regenerating fires the same POST with \`?regenerate=true\` to bypass the cache.`;

const defaultSafetyLinks = (): SafetyLinkResponse[] => [
  {
    url: "https://www.osha.gov/confined-spaces",
    title: "OSHA · Confined Spaces overview",
    source: "OSHA",
    last_verified_at: ISO_2026,
  },
  {
    url: "https://www.hse.gov.uk/confinedspace/",
    title: "HSE · Confined spaces approved code of practice",
    source: "HSE UK",
    last_verified_at: ISO_2026,
  },
  {
    url: "https://www.nfpa.org/codes-and-standards/1/3/0/nfpa-350",
    title: "NFPA 350 · Guide for safe confined space entry",
    source: "NFPA",
    last_verified_at: ISO_2026,
  },
];

export const learningMaterialHandler = http.post(
  `${API}/v1/pills/:pill_id/learning-material`,
  ({ params, request }) => {
    const pill = mockCatalogue.find((p) => p.id === params.pill_id);
    const url = new URL(request.url);
    const regenerate = url.searchParams.get("regenerate") === "true";
    if (!pill) {
      return HttpResponse.json(
        {
          error: {
            code: "not_found",
            message: "Pill not found.",
            detail: null,
          },
        },
        { status: 404 },
      );
    }
    const body: LearningMaterialResponse = pill.safety_relevant
      ? {
          id: `lm-${pill.id}`,
          pill_id: pill.id,
          source: "curated_safety_links",
          content: null,
          safety_links: defaultSafetyLinks(),
          served_at: ISO_2026,
          created_at: ISO_2026,
          cached: !regenerate,
        }
      : {
          id: `lm-${pill.id}`,
          pill_id: pill.id,
          source: "ai_generated",
          content: defaultAiContent(pill.name),
          safety_links: null,
          served_at: ISO_2026,
          created_at: ISO_2026,
          cached: !regenerate,
        };
    return HttpResponse.json(body);
  },
);

// =====================================================================
// FE-4 attempt-runner handlers (slice 1: GET /attempts/{id} +
// GET /tests/{id} + POST /autosave + POST /flag-realism).
// State lives in module-scope so test scenarios can pre-seed via
// `setMockAttempt(...)` / `setMockTest(...)`. The default fixture is a
// 3-question frozen-mode attempt that exercises MCQ + true/false +
// short_answer — enough for the page integration test in slice 1.
// =====================================================================

type AttemptViewSchema = components["schemas"]["AttemptView"];
type TestResponseSchema = components["schemas"]["TestResponse"];

const FIXTURE_TESTEE = "00000000-0000-0000-0000-000000000001";
const FIXTURE_ATTEMPT_ID = "11111111-1111-1111-1111-000000000001";
const FIXTURE_TEST_ID = "22222222-2222-2222-2222-000000000001";

const Q_MCQ_ID = "33333333-3333-3333-3333-000000000001";
const Q_TF_ID = "33333333-3333-3333-3333-000000000002";
const Q_SA_ID = "33333333-3333-3333-3333-000000000003";

const DEFAULT_QUESTIONS = [
  {
    id: Q_MCQ_ID,
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
        { text: "Hartmann field meter", image_url: null },
      ],
    },
  },
  {
    id: Q_TF_ID,
    type: "true_false",
    question_group_id: null,
    attempt_position: null,
    reference_image_url: null,
    reference_image_caption: null,
    config: {
      prompt:
        "Cathodic protection alone prevents pitting corrosion in immersion service.",
    },
  },
  {
    id: Q_SA_ID,
    type: "short_answer",
    question_group_id: null,
    attempt_position: null,
    reference_image_url: null,
    reference_image_caption: null,
    config: {
      prompt:
        "In one paragraph, explain why batch tracking matters when reference panels rotate across shifts.",
      expected_seconds: 90,
    },
  },
];

const DEFAULT_ATTEMPT: AttemptViewSchema = {
  id: FIXTURE_ATTEMPT_ID,
  test_id: FIXTURE_TEST_ID,
  testee_id: FIXTURE_TESTEE,
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
  watermark: FIXTURE_TESTEE,
  // `questions` is typed `Record<string, never>[]` on the wire schema
  // (the FastAPI Pydantic model declares `list[dict]` so openapi-
  // typescript can't infer a richer shape). The FE narrows via
  // `narrowPresented` at the dispatch boundary; cast here is the
  // single place we widen the untyped wire shape into our fixture.
  questions: DEFAULT_QUESTIONS as unknown as Record<string, never>[],
  q1: null,
};

const DEFAULT_TEST: TestResponseSchema = {
  id: FIXTURE_TEST_ID,
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

let mockAttempts: Map<string, AttemptViewSchema> = new Map([
  [DEFAULT_ATTEMPT.id, DEFAULT_ATTEMPT],
]);
let mockTests: Map<string, TestResponseSchema> = new Map([
  [DEFAULT_TEST.id, DEFAULT_TEST],
]);

export const setMockAttempt = (attempt: AttemptViewSchema): void => {
  mockAttempts.set(attempt.id, attempt);
};
export const setMockTest = (test: TestResponseSchema): void => {
  mockTests.set(test.id, test);
};
export const resetMockAttemptState = (): void => {
  mockAttempts = new Map([[DEFAULT_ATTEMPT.id, DEFAULT_ATTEMPT]]);
  mockTests = new Map([[DEFAULT_TEST.id, DEFAULT_TEST]]);
  mockAutosaveCalls.length = 0;
  mockFlaggedQuestions.clear();
  resetMockAttemptResults();
  resetMockBenchmark();
  resetMockStream();
};
export const getMockAttempt = (id: string): AttemptViewSchema | undefined =>
  mockAttempts.get(id);
export const getMockTest = (id: string): TestResponseSchema | undefined =>
  mockTests.get(id);

export type AutosaveLogEntry = {
  attempt_id: string;
  question_id: string;
  answer_payload: unknown;
  time_ms: number | null;
};
export const mockAutosaveCalls: AutosaveLogEntry[] = [];
export const mockFlaggedQuestions = new Set<string>();

const attemptNotFound = HttpResponse.json(
  {
    error: {
      code: "not_found",
      message: "Attempt not found.",
      detail: null,
    },
  },
  { status: 404 },
);

export const getAttemptHandler = http.get(
  `${API}/v1/attempts/:attempt_id`,
  ({ params }) => {
    const attempt = mockAttempts.get(String(params.attempt_id));
    if (!attempt) return attemptNotFound;
    return HttpResponse.json(attempt);
  },
);

export const getTestHandler = http.get(`${API}/v1/tests/:test_id`, ({ params }) => {
  const test = mockTests.get(String(params.test_id));
  if (!test) {
    return HttpResponse.json(
      { error: { code: "not_found", message: "Test not found.", detail: null } },
      { status: 404 },
    );
  }
  return HttpResponse.json(test);
});

export const autosaveHandler = http.post(
  `${API}/v1/attempts/:attempt_id/autosave`,
  async ({ params, request }) => {
    const attempt = mockAttempts.get(String(params.attempt_id));
    if (!attempt) return attemptNotFound;
    const body = (await request.json().catch(() => null)) as {
      question_id?: string;
      answer_payload?: unknown;
      time_ms?: number | null;
    } | null;
    if (!body || typeof body.question_id !== "string") {
      return HttpResponse.json(
        {
          error: { code: "bad_request", message: "Missing question_id.", detail: null },
        },
        { status: 400 },
      );
    }
    mockAutosaveCalls.push({
      attempt_id: attempt.id,
      question_id: body.question_id,
      answer_payload: body.answer_payload ?? null,
      time_ms: body.time_ms ?? null,
    });
    return HttpResponse.json({ status: "ok" });
  },
);

export const flagRealismHandler = http.post(
  `${API}/v1/attempts/:attempt_id/questions/:question_id/flag-realism`,
  ({ params }) => {
    const attempt = mockAttempts.get(String(params.attempt_id));
    if (!attempt) return attemptNotFound;
    const questionId = String(params.question_id);
    const key = `${attempt.id}:${questionId}`;
    const wasFlagged = mockFlaggedQuestions.has(key);
    if (!wasFlagged) mockFlaggedQuestions.add(key);
    return HttpResponse.json({
      realism_flag_id: `flag-${key}`,
      question_id: questionId,
      testee_id: attempt.testee_id,
      created: !wasFlagged,
    });
  },
);

// =====================================================================
// FE-5 SSE stream handler — ``GET /v1/attempts/:id/stream``.
// Default behaviour: emit a single terminal ``done`` (empty buffer).
// Tests that need richer event sequences install a custom stream
// builder via ``setMockStreamHandler(...)``; the helper signature
// matches MSW's resolver shape so callers can read the cursor /
// header.
// =====================================================================

export type MockStreamHandler = (args: {
  request: Request;
  attempt_id: string;
  since: number | null;
  lastEventId: string | null;
}) => Response | Promise<Response>;

let mockStreamHandler: MockStreamHandler | null = null;

export const setMockStreamHandler = (fn: MockStreamHandler | null): void => {
  mockStreamHandler = fn;
};

export const resetMockStream = (): void => {
  mockStreamHandler = null;
};

/**
 * Convenience: stand up a one-shot fixture-driven stream handler.
 *
 *   setMockStreamFixture([
 *     { kind: "question", id: 2, attempt_position: 2, attempt_id: ATTEMPT_ID },
 *     { kind: "done", completed_positions: [2] },
 *   ]);
 *
 * The default is reset by ``resetMockAttemptState`` between tests.
 */
export const setMockStreamFixture = (
  frames: SseFixtureFrame[],
  opts?: SseFixtureOpts,
): void => {
  mockStreamHandler = () => buildSseResponse(frames, opts);
};

export const streamAttemptHandler = http.get(
  `${API}/v1/attempts/:attempt_id/stream`,
  async ({ request, params }) => {
    const attemptId = String(params.attempt_id);
    const url = new URL(request.url);
    const sinceRaw = url.searchParams.get("since");
    const since = sinceRaw !== null ? Number(sinceRaw) : null;
    const lastEventId = request.headers.get("Last-Event-ID");

    if (mockStreamHandler) {
      return mockStreamHandler({
        request,
        attempt_id: attemptId,
        since,
        lastEventId,
      });
    }

    const attempt = mockAttempts.get(attemptId);
    if (!attempt) return attemptNotFound;

    // Default fixture: nothing to orchestrate; emit a terminal done
    // with whatever cursor the FE sent so the iterator exits cleanly.
    const body = sseStreamFixture([
      {
        kind: "done",
        completed_positions: [],
        replayed_positions: [],
      },
    ]);
    return new HttpResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  },
);

// =====================================================================
// FE-4 slice 2 handlers — pause / resume / submit / result polling /
// benchmark `next` / start-attempt / resolve-test. State lives in the
// same module-scope `mockAttempts` / `mockTests` maps as slice 1.
// =====================================================================

type AttemptResultSchema = components["schemas"]["AttemptResultResponse"];
type AttemptStartRequestSchema = components["schemas"]["AttemptStartRequest"];

// Per-attempt result state — drives the GradingOverlay polling.
// Default: "ready" so a test that submits + polls finds the result on
// the first poll. Tests can override via setMockAttemptResult().
const mockAttemptResults: Map<string, AttemptResultSchema> = new Map();

export const setMockAttemptResult = (
  attemptId: string,
  result: AttemptResultSchema,
): void => {
  mockAttemptResults.set(attemptId, result);
};

export const resetMockAttemptResults = (): void => {
  mockAttemptResults.clear();
};

const defaultResult = (attemptId: string): AttemptResultSchema => ({
  attempt_id: attemptId,
  submitted_at: "2026-05-27T10:30:00Z",
  status: "ready",
  overall_score: 0.8,
  outcome: "pass",
  attempt_band: null,
  competence_estimate_after: null,
  competence_estimate_delta: null,
  time_on_test_seconds: null,
  median_time_seconds: null,
  review_summary: null,
  pills: [],
  adaptive_loop: [],
  questions: null,
});

/**
 * FE-6 §B fixtures — richer per-state result payloads tests can set
 * via `setMockAttemptResult(attemptId, makeRichResult(...))`.
 * Kept append-only per the hard rule; no existing handler / fixture
 * is rewritten.
 */
export type RichResultOverrides = Partial<AttemptResultSchema>;

export const makeRichResult = (
  attemptId: string,
  overrides: RichResultOverrides = {},
): AttemptResultSchema => ({
  attempt_id: attemptId,
  submitted_at: "2026-05-27T10:30:00Z",
  status: "ready",
  overall_score: 0.82,
  outcome: "pass",
  attempt_band: "working",
  competence_estimate_after: 6.4,
  competence_estimate_delta: 0.6,
  time_on_test_seconds: 1_440,
  median_time_seconds: 1_500,
  review_summary: {
    ai_grader_model: "claude-sonnet-4-5",
    reviewer_model: "openai gpt-4o-mini",
    flagged_count: 0,
    flagged_question_positions: [],
    review_duration_ms: 4_200,
  },
  pills: [],
  adaptive_loop: [],
  questions: [],
  ...overrides,
});

export const pauseAttemptHandler = http.post(
  `${API}/v1/attempts/:attempt_id/pause`,
  ({ params }) => {
    const attempt = mockAttempts.get(String(params.attempt_id));
    if (!attempt) return attemptNotFound;
    const updated: AttemptViewSchema = {
      ...attempt,
      paused: true,
      pause_seconds_remaining: 300,
      pause_reason: null,
    };
    mockAttempts.set(attempt.id, updated);
    return HttpResponse.json({ status: "paused" });
  },
);

export const resumeAttemptHandler = http.post(
  `${API}/v1/attempts/:attempt_id/resume`,
  ({ params }) => {
    const attempt = mockAttempts.get(String(params.attempt_id));
    if (!attempt) return attemptNotFound;
    const updated: AttemptViewSchema = {
      ...attempt,
      paused: false,
      pause_seconds_remaining: null,
      pause_reason: null,
      pauses_used: attempt.pauses_used + 1,
    };
    mockAttempts.set(attempt.id, updated);
    return HttpResponse.json({ status: "resumed" });
  },
);

export const submitAttemptHandler = http.post(
  `${API}/v1/attempts/:attempt_id/submit`,
  ({ params }) => {
    const attempt = mockAttempts.get(String(params.attempt_id));
    if (!attempt) return attemptNotFound;
    const updated: AttemptViewSchema = {
      ...attempt,
      submitted_at: "2026-05-27T10:30:00Z",
    };
    mockAttempts.set(attempt.id, updated);
    return HttpResponse.json(updated);
  },
);

export const attemptResultHandler = http.get(
  `${API}/v1/attempts/:attempt_id/result`,
  ({ params }) => {
    const attemptId = String(params.attempt_id);
    const attempt = mockAttempts.get(attemptId);
    if (!attempt) return attemptNotFound;
    const result = mockAttemptResults.get(attemptId) ?? defaultResult(attemptId);
    return HttpResponse.json(result);
  },
);

// Benchmark `next` mock — a small in-memory walker. Returns Q2..N
// from `DEFAULT_QUESTIONS` then `{ done: true }` after the last.
const benchmarkPositions = new Map<string, number>();

export const resetMockBenchmark = (): void => {
  benchmarkPositions.clear();
};

export const benchmarkNextHandler = http.post(
  `${API}/v1/attempts/:attempt_id/next`,
  ({ params }) => {
    const attempt = mockAttempts.get(String(params.attempt_id));
    if (!attempt) return attemptNotFound;
    const pos = (benchmarkPositions.get(attempt.id) ?? 0) + 1;
    benchmarkPositions.set(attempt.id, pos);
    const questions = DEFAULT_QUESTIONS;
    if (pos >= questions.length) {
      return HttpResponse.json({ done: true, step: pos, asked: pos });
    }
    return HttpResponse.json({
      done: false,
      step: pos + 1,
      asked: pos + 1,
      question: questions[pos],
    });
  },
);

const startAttemptHandler = http.post(`${API}/v1/attempts`, async ({ request }) => {
  const body = (await request
    .json()
    .catch(() => null)) as AttemptStartRequestSchema | null;
  if (!body || typeof body.test_id !== "string") {
    return HttpResponse.json(
      {
        error: {
          code: "bad_request",
          message: "test_id required.",
          detail: null,
        },
      },
      { status: 400 },
    );
  }
  const test = mockTests.get(body.test_id);
  if (!test) {
    return HttpResponse.json(
      {
        error: {
          code: "not_found",
          message: "Test not found.",
          detail: null,
        },
      },
      { status: 404 },
    );
  }
  // Synthesise a fresh attempt id so test assertions on the redirect
  // path can distinguish it from the default fixture.
  const newId = `11111111-1111-1111-1111-${String(Date.now()).padStart(12, "0")}`;
  const created: AttemptViewSchema = {
    ...DEFAULT_ATTEMPT,
    id: newId,
    test_id: test.id,
  };
  mockAttempts.set(newId, created);
  return HttpResponse.json(created, { status: 201 });
});

// `GET /v1/tests/resolve?pill_id&difficulty` — 200 with the default
// test id if the pill_id matches our fixture pattern; 404 otherwise.
// Tests override per-scenario via `server.use(...)`.
export const resolveTestHandler = http.get(`${API}/v1/tests/resolve`, ({ request }) => {
  const url = new URL(request.url);
  const pillId = url.searchParams.get("pill_id");
  if (!pillId) {
    return HttpResponse.json(
      { error: { code: "bad_request", message: "pill_id required.", detail: null } },
      { status: 400 },
    );
  }
  // Default behaviour: any pill resolves to the default fixture
  // test. Tests that want a 404 (no matching test at difficulty)
  // can override via `server.use(...)`.
  return HttpResponse.json({ test_id: FIXTURE_TEST_ID });
});

// =====================================================================
// FE-7 me-domain handlers — GET /v1/me/competence + GET /v1/attempts.
// Fixtures key off `subject_id` UUIDs (not slugs) per the live wire
// contract; the FE's `subjectById` helper resolves UUIDs to a neutral
// unknown-fallback, which is acceptable per the FE-7 plan-mode handover
// note (subject-colour halos render neutral grey until
// GET /v1/catalogue/subjects lands per FE-3 §H(b) item 5).
// =====================================================================

type MeCompetencePill = components["schemas"]["MeCompetencePill"];
type AttemptListItem = components["schemas"]["AttemptListItem"];
type MeCompetenceResponse = components["schemas"]["MeCompetenceResponse"];
type AttemptsPage = components["schemas"]["Page_AttemptListItem_"];

const FE7_SUBJECT_PAINT = "11111111-1111-1111-1111-000000000111";
const FE7_SUBJECT_MARINE = "11111111-1111-1111-1111-000000000222";
const FE7_SUBJECT_SAFETY = "11111111-1111-1111-1111-000000000333";

const fe7PillId = (slug: string): string =>
  `bbbbbbbb-bbbb-bbbb-bbbb-${slug.padStart(12, "0")}`;

const FE7_DEFAULT_PILLS: MeCompetencePill[] = [
  {
    pill_id: fe7PillId("antifouling"),
    pill_name: "Antifouling Systems",
    subject_id: FE7_SUBJECT_MARINE,
    competence_estimate: 6.7,
    band: "working",
    n: 22,
    confidence: "confident",
    last_activity_at: "2026-05-25T09:00:00Z",
    related_pill_ids: [fe7PillId("cathodic"), fe7PillId("immersion")],
    safety_relevant: false,
  },
  {
    pill_id: fe7PillId("cathodic"),
    pill_name: "Cathodic Protection",
    subject_id: FE7_SUBJECT_MARINE,
    competence_estimate: 5.2,
    band: "working",
    n: 14,
    confidence: "preliminary",
    last_activity_at: "2026-05-20T09:00:00Z",
    related_pill_ids: [fe7PillId("antifouling")],
    safety_relevant: false,
  },
  {
    pill_id: fe7PillId("immersion"),
    pill_name: "Immersion Service",
    subject_id: FE7_SUBJECT_MARINE,
    competence_estimate: 4.3,
    band: "junior",
    n: 8,
    confidence: "preliminary",
    last_activity_at: "2026-05-15T09:00:00Z",
    related_pill_ids: [fe7PillId("antifouling")],
    safety_relevant: false,
  },
  {
    pill_id: fe7PillId("dft"),
    pill_name: "DFT Measurement",
    subject_id: FE7_SUBJECT_PAINT,
    competence_estimate: 7.8,
    band: "advanced",
    n: 30,
    confidence: "confident",
    last_activity_at: "2026-05-26T11:00:00Z",
    related_pill_ids: [fe7PillId("adhesion")],
    safety_relevant: false,
  },
  {
    pill_id: fe7PillId("adhesion"),
    pill_name: "Adhesion Testing",
    subject_id: FE7_SUBJECT_PAINT,
    competence_estimate: 6.1,
    band: "working",
    n: 18,
    confidence: "preliminary",
    last_activity_at: "2026-05-24T11:00:00Z",
    related_pill_ids: [fe7PillId("dft")],
    safety_relevant: false,
  },
  {
    pill_id: fe7PillId("confined"),
    pill_name: "Confined Space Entry",
    subject_id: FE7_SUBJECT_SAFETY,
    competence_estimate: 8.6,
    band: "expert",
    n: 26,
    confidence: "confident",
    last_activity_at: "2026-05-27T09:00:00Z",
    related_pill_ids: [],
    safety_relevant: true,
  },
];

let mockMeCompetence: MeCompetenceResponse = { pills: [...FE7_DEFAULT_PILLS] };
let meCompetenceStatus: number = 200;

export const setMockMeCompetence = (pills: MeCompetencePill[]): void => {
  mockMeCompetence = { pills: [...pills] };
};

export const setMockMeCompetenceStatus = (status: number): void => {
  meCompetenceStatus = status;
};

export const resetMockMeCompetence = (): void => {
  mockMeCompetence = { pills: [...FE7_DEFAULT_PILLS] };
  meCompetenceStatus = 200;
};

export const meCompetenceHandler = http.get(`${API}/v1/me/competence`, () => {
  if (meCompetenceStatus !== 200) {
    return HttpResponse.json(
      {
        error: {
          code: meCompetenceStatus === 404 ? "not_found" : "internal",
          message: "Me competence unavailable.",
          detail: null,
        },
      },
      { status: meCompetenceStatus },
    );
  }
  return HttpResponse.json(mockMeCompetence);
});

const fe7AttemptId = (n: number): string =>
  `cccccccc-cccc-cccc-cccc-${String(n).padStart(12, "0")}`;

const buildFe7Attempt = (input: {
  n: number;
  pill_id: string;
  pill_name: string;
  submitted_at: string;
  score_percent: number;
  band: AttemptListItem["band"];
  origin: AttemptListItem["origin"];
  competence_delta?: number | null;
}): AttemptListItem => ({
  attempt_id: fe7AttemptId(input.n),
  pill_id: input.pill_id,
  pill_name: input.pill_name,
  submitted_at: input.submitted_at,
  score_percent: input.score_percent,
  band: input.band,
  origin: input.origin,
  competence_delta: input.competence_delta ?? null,
});

const FE7_DEFAULT_ATTEMPTS: AttemptListItem[] = [
  buildFe7Attempt({
    n: 1,
    pill_id: fe7PillId("antifouling"),
    pill_name: "Antifouling Systems",
    submitted_at: "2026-05-26T09:00:00Z",
    score_percent: 78,
    band: "advanced",
    origin: "assignment_driven",
  }),
  buildFe7Attempt({
    n: 2,
    pill_id: fe7PillId("antifouling"),
    pill_name: "Antifouling Systems",
    submitted_at: "2026-05-20T09:00:00Z",
    score_percent: 62,
    band: "working",
    origin: "self_initiated",
  }),
  buildFe7Attempt({
    n: 3,
    pill_id: fe7PillId("dft"),
    pill_name: "DFT Measurement",
    submitted_at: "2026-05-26T11:00:00Z",
    score_percent: 86,
    band: "expert",
    origin: "loop_driven",
  }),
  buildFe7Attempt({
    n: 4,
    pill_id: fe7PillId("dft"),
    pill_name: "DFT Measurement",
    submitted_at: "2026-05-22T11:00:00Z",
    score_percent: 71,
    band: "working",
    origin: "self_initiated",
  }),
  buildFe7Attempt({
    n: 5,
    pill_id: fe7PillId("immersion"),
    pill_name: "Immersion Service",
    submitted_at: "2026-05-15T09:00:00Z",
    score_percent: 47,
    band: "junior",
    origin: "self_initiated",
  }),
];

let mockMeAttempts: AttemptListItem[] = [...FE7_DEFAULT_ATTEMPTS];
let meAttemptsStatus: number = 200;

export const setMockMeAttempts = (attempts: AttemptListItem[]): void => {
  mockMeAttempts = [...attempts];
};

export const setMockMeAttemptsStatus = (status: number): void => {
  meAttemptsStatus = status;
};

export const resetMockMeAttempts = (): void => {
  mockMeAttempts = [...FE7_DEFAULT_ATTEMPTS];
  meAttemptsStatus = 200;
};

export const meAttemptsListHandler = http.get(`${API}/v1/attempts`, ({ request }) => {
  if (meAttemptsStatus !== 200) {
    return HttpResponse.json(
      {
        error: {
          code: meAttemptsStatus === 404 ? "not_found" : "internal",
          message: "Attempts list unavailable.",
          detail: null,
        },
      },
      { status: meAttemptsStatus },
    );
  }
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Math.min(200, Math.max(1, Number(limitRaw))) : 50;
  const start = cursor ? Number(cursor) : 0;
  const slice = mockMeAttempts.slice(start, start + limit);
  const nextStart = start + slice.length;
  const next_cursor = nextStart < mockMeAttempts.length ? String(nextStart) : null;
  const page: AttemptsPage = { data: slice, meta: { next_cursor } };
  return HttpResponse.json(page);
});

export const handlers = [
  meHandler,
  loginHandler,
  logoutHandler,
  passwordResetRequestHandler,
  passwordResetConsumeHandler,
  setupPreviewHandler,
  setupConsumeHandler,
  privacyAcknowledgeHandler,
  cataloguePillsHandler,
  cataloguePillDetailHandler,
  learningMaterialHandler,
  getAttemptHandler,
  // `resolveTestHandler` MUST come before `getTestHandler` — both
  // match the path `/v1/tests/resolve` (the latter interprets
  // `resolve` as a `:test_id` path param). MSW dispatches in handler-
  // array order, so resolve-first preserves the literal route.
  resolveTestHandler,
  getTestHandler,
  autosaveHandler,
  flagRealismHandler,
  pauseAttemptHandler,
  resumeAttemptHandler,
  submitAttemptHandler,
  attemptResultHandler,
  benchmarkNextHandler,
  // `meAttemptsListHandler` (GET /v1/attempts) MUST precede
  // `startAttemptHandler` (POST /v1/attempts) in this array. They share
  // the same path; MSW dispatches in array order, and although the
  // method discriminates correctly today, keeping GET-before-POST
  // mirrors the FE-4 resolve-before-detail handler-order trap so the
  // ordering remains intentional and reviewer-visible.
  meAttemptsListHandler,
  startAttemptHandler,
  streamAttemptHandler,
  meCompetenceHandler,
];
