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

// =====================================================================
// FE-8 admin stub handlers (Slice 1) — empty `Page<T>` for every
// admin-facing GET-list endpoint so admin pages don't 404 in tests /
// dev before each domain slice ships its full CRUD. Each later FE-8
// slice replaces the corresponding stub with a stateful handler.
//
// Append-only per the existing handler-array convention (FE-1 §D).
// =====================================================================

// FE-8 Slice 2 — stateful Subjects CRUD (per §B.3). Replaces the
// Slice-1 empty stub. Module-scope state so tests can `setMockSubjects`
// / `resetMockSubjects` between scenarios. Stub pattern from
// `mockAttempts` above.

type SubjectResponseSchema = components["schemas"]["SubjectResponse"];
type SubjectCreateSchema = components["schemas"]["SubjectCreate"];
type SubjectUpdateSchema = components["schemas"]["SubjectUpdate"];

const ADMIN_SUBJECT_ISO = "2026-04-01T00:00:00Z";

// Hex-only suffix so `z.string().uuid()` accepts these in form-driven
// flows (e.g. PillModal's `subject_id` field). Earlier slug-suffixed
// shape ("0000paint-qa") parsed as text but failed uuid validation.
const adminSubjectId = (n: number): string =>
  `dddddddd-dddd-dddd-dddd-${String(n).padStart(12, "0")}`;

const ADMIN_SUBJECT_IDS = {
  paintQa: adminSubjectId(1),
  marine: adminSubjectId(2),
  nace: adminSubjectId(3),
  safety: adminSubjectId(4),
} as const;

const DEFAULT_ADMIN_SUBJECTS: SubjectResponseSchema[] = [
  {
    id: ADMIN_SUBJECT_IDS.paintQa,
    name: "Paint QA",
    description: "Paint application quality assurance.",
    created_at: ADMIN_SUBJECT_ISO,
    updated_at: ADMIN_SUBJECT_ISO,
  },
  {
    id: ADMIN_SUBJECT_IDS.marine,
    name: "Marine coatings",
    description: "Marine and immersion-service coating systems.",
    created_at: ADMIN_SUBJECT_ISO,
    updated_at: ADMIN_SUBJECT_ISO,
  },
  {
    id: ADMIN_SUBJECT_IDS.nace,
    name: "NACE corrosion",
    description: null,
    created_at: ADMIN_SUBJECT_ISO,
    updated_at: ADMIN_SUBJECT_ISO,
  },
  {
    id: ADMIN_SUBJECT_IDS.safety,
    name: "Site safety",
    description: "Safety-tagged subject.",
    created_at: ADMIN_SUBJECT_ISO,
    updated_at: ADMIN_SUBJECT_ISO,
  },
];

let mockAdminSubjects: SubjectResponseSchema[] = [...DEFAULT_ADMIN_SUBJECTS];
let nextAdminSubjectSeq = DEFAULT_ADMIN_SUBJECTS.length + 1;

export const setMockAdminSubjects = (subjects: SubjectResponseSchema[]): void => {
  mockAdminSubjects = [...subjects];
};

export const resetMockAdminSubjects = (): void => {
  mockAdminSubjects = [...DEFAULT_ADMIN_SUBJECTS];
  nextAdminSubjectSeq = DEFAULT_ADMIN_SUBJECTS.length + 1;
};

export const getMockAdminSubjects = (): SubjectResponseSchema[] => [...mockAdminSubjects];

const adminSubjectsListHandler = http.get(`${API}/v1/subjects`, ({ request }) => {
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Math.min(200, Math.max(1, Number(limitRaw))) : 50;
  const start = cursor ? Number(cursor) : 0;
  const slice = mockAdminSubjects.slice(start, start + limit);
  const nextStart = start + slice.length;
  const next_cursor = nextStart < mockAdminSubjects.length ? String(nextStart) : null;
  return HttpResponse.json({ data: slice, meta: { next_cursor } });
});

const adminSubjectCreateHandler = http.post(`${API}/v1/subjects`, async ({ request }) => {
  const body = (await request.json().catch(() => null)) as SubjectCreateSchema | null;
  if (!body || typeof body.name !== "string" || body.name.trim() === "") {
    return HttpResponse.json(
      {
        detail: [
          { loc: ["body", "name"], msg: "Subject name is required.", type: "missing" },
        ],
      },
      { status: 422 },
    );
  }
  const created: SubjectResponseSchema = {
    id: adminSubjectId(nextAdminSubjectSeq),
    name: body.name,
    description: body.description ?? null,
    created_at: ADMIN_SUBJECT_ISO,
    updated_at: ADMIN_SUBJECT_ISO,
  };
  nextAdminSubjectSeq += 1;
  mockAdminSubjects = [created, ...mockAdminSubjects];
  return HttpResponse.json(created, { status: 201 });
});

const adminSubjectUpdateHandler = http.patch(
  `${API}/v1/subjects/:subject_id`,
  async ({ params, request }) => {
    const idx = mockAdminSubjects.findIndex((s) => s.id === String(params.subject_id));
    const existing = idx >= 0 ? mockAdminSubjects[idx] : undefined;
    if (idx < 0 || !existing) {
      return HttpResponse.json(
        { error: { code: "not_found", message: "Subject not found.", detail: null } },
        { status: 404 },
      );
    }
    const body = (await request.json().catch(() => null)) as SubjectUpdateSchema | null;
    const next: SubjectResponseSchema = {
      ...existing,
      name: body?.name ?? existing.name,
      description:
        body && "description" in body ? (body.description ?? null) : existing.description,
    };
    mockAdminSubjects = [
      ...mockAdminSubjects.slice(0, idx),
      next,
      ...mockAdminSubjects.slice(idx + 1),
    ];
    return HttpResponse.json(next);
  },
);

const adminSubjectDeleteHandler = http.delete(
  `${API}/v1/subjects/:subject_id`,
  ({ params }) => {
    const before = mockAdminSubjects.length;
    mockAdminSubjects = mockAdminSubjects.filter(
      (s) => s.id !== String(params.subject_id),
    );
    if (mockAdminSubjects.length === before) {
      return HttpResponse.json(
        { error: { code: "not_found", message: "Subject not found.", detail: null } },
        { status: 404 },
      );
    }
    return new HttpResponse(null, { status: 204 });
  },
);

const adminSubjectsHandlers = [
  adminSubjectsListHandler,
  adminSubjectCreateHandler,
  adminSubjectUpdateHandler,
  adminSubjectDeleteHandler,
];

// Removed in Slice 13 — `adminTestQuestionsListHandler` no longer
// stubs an empty page; it now reads from `mockAdminQuestions` so the
// frozen pool table renders real rows. Kept the comment as a marker
// in case another admin domain wants the helper back.

// FE-8 Slice 3 — stateful Pills CRUD (per §B.2). Replaces the Slice-1
// empty-page stub. Mirrors the Subjects pattern from Slice 2.

type PillCreateSchema = components["schemas"]["PillCreate"];
type PillUpdateSchema = components["schemas"]["PillUpdate"];
type PillSafetyOverrideSchema = components["schemas"]["PillSafetyOverride"];

const ADMIN_PILL_ISO = "2026-04-05T00:00:00Z";

// Hex-only suffix — same rationale as `adminSubjectId`.
const adminPillId = (n: number): string =>
  `eeeeeeee-eeee-eeee-eeee-${String(n).padStart(12, "0")}`;

const buildAdminPill = (input: {
  n: number;
  name: string;
  subject_id: string;
  description?: string | null;
  discoverable?: boolean;
  safety_relevant?: boolean;
  available_difficulty_min?: number;
  available_difficulty_max?: number;
  retired?: boolean;
  /** Override the auto-derived `safety_relevant_overridden_at`. Pass
   *  `null` to model an auto-tagged safety pill (no admin override).
   *  Default: ADMIN_PILL_ISO when safety_relevant is true (admin
   *  override), null otherwise. */
  safety_overridden_at?: string | null;
}): PillResponse => ({
  id: adminPillId(input.n),
  subject_id: input.subject_id,
  name: input.name,
  description: input.description ?? `Practice and learning for ${input.name}.`,
  available_difficulty_min: input.available_difficulty_min ?? 1,
  available_difficulty_max: input.available_difficulty_max ?? 10,
  discoverable: input.discoverable ?? true,
  safety_relevant: input.safety_relevant ?? false,
  safety_relevant_overridden_at:
    input.safety_overridden_at !== undefined
      ? input.safety_overridden_at
      : input.safety_relevant
        ? ADMIN_PILL_ISO
        : null,
  estimated_minutes: null,
  retired_at: input.retired ? ADMIN_PILL_ISO : null,
  created_at: ADMIN_PILL_ISO,
  updated_at: ADMIN_PILL_ISO,
});

const DEFAULT_ADMIN_PILLS: PillResponse[] = [
  buildAdminPill({
    n: 1,
    name: "Reference Panels",
    subject_id: ADMIN_SUBJECT_IDS.paintQa,
    available_difficulty_min: 2,
    available_difficulty_max: 8,
  }),
  buildAdminPill({
    n: 2,
    name: "DFT Measurement",
    subject_id: ADMIN_SUBJECT_IDS.paintQa,
    available_difficulty_min: 3,
    available_difficulty_max: 9,
  }),
  buildAdminPill({
    n: 3,
    name: "Antifouling Systems",
    subject_id: ADMIN_SUBJECT_IDS.marine,
  }),
  buildAdminPill({
    n: 4,
    name: "Cathodic Protection",
    subject_id: ADMIN_SUBJECT_IDS.marine,
    discoverable: false, // draft
  }),
  buildAdminPill({
    n: 5,
    name: "Confined Space Entry",
    subject_id: ADMIN_SUBJECT_IDS.safety,
    safety_relevant: true,
    // Admin override (default) — exercises Slice 5 §B.5 §5
    // `row_override_source_admin` state.
  }),
  buildAdminPill({
    n: 6,
    name: "Working at Height",
    subject_id: ADMIN_SUBJECT_IDS.safety,
    safety_relevant: true,
    // Auto-tagged at create — exercises Slice 5 §B.5 §5
    // `row_override_source_auto` state.
    safety_overridden_at: null,
  }),
];

let mockAdminPills: PillResponse[] = [...DEFAULT_ADMIN_PILLS];
let nextAdminPillSeq = DEFAULT_ADMIN_PILLS.length + 1;

export const setMockAdminPills = (pills: PillResponse[]): void => {
  mockAdminPills = [...pills];
};

export const resetMockAdminPills = (): void => {
  mockAdminPills = [...DEFAULT_ADMIN_PILLS];
  nextAdminPillSeq = DEFAULT_ADMIN_PILLS.length + 1;
};

export const getMockAdminPills = (): PillResponse[] => [...mockAdminPills];

const adminPillsListHandler = http.get(`${API}/v1/pills`, ({ request }) => {
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Math.min(200, Math.max(1, Number(limitRaw))) : 50;
  const start = cursor ? Number(cursor) : 0;
  const slice = mockAdminPills.slice(start, start + limit);
  const nextStart = start + slice.length;
  const next_cursor = nextStart < mockAdminPills.length ? String(nextStart) : null;
  // FE-9 count meta: full collection size, independent of cursor/limit.
  const count = mockAdminPills.length;
  return HttpResponse.json({ data: slice, meta: { next_cursor, count } });
});

const adminPillCreateHandler = http.post(`${API}/v1/pills`, async ({ request }) => {
  const body = (await request.json().catch(() => null)) as PillCreateSchema | null;
  const detail: { loc: (string | number)[]; msg: string; type: string }[] = [];
  if (!body || typeof body.name !== "string" || body.name.trim() === "") {
    detail.push({ loc: ["body", "name"], msg: "Title is required.", type: "missing" });
  }
  if (!body || typeof body.subject_id !== "string" || body.subject_id === "") {
    detail.push({
      loc: ["body", "subject_id"],
      msg: "Pick a subject.",
      type: "missing",
    });
  }
  if (detail.length > 0) {
    return HttpResponse.json({ detail }, { status: 422 });
  }
  const created: PillResponse = {
    id: adminPillId(nextAdminPillSeq),
    subject_id: body!.subject_id,
    name: body!.name,
    description: body!.description ?? null,
    available_difficulty_min: body!.available_difficulty_min ?? 1,
    available_difficulty_max: body!.available_difficulty_max ?? 10,
    discoverable: body!.discoverable ?? true,
    safety_relevant: false,
    safety_relevant_overridden_at: null,
    estimated_minutes: body!.estimated_minutes ?? null,
    retired_at: null,
    created_at: ADMIN_PILL_ISO,
    updated_at: ADMIN_PILL_ISO,
  };
  nextAdminPillSeq += 1;
  mockAdminPills = [created, ...mockAdminPills];
  return HttpResponse.json(created, { status: 201 });
});

const adminPillUpdateHandler = http.patch(
  `${API}/v1/pills/:pill_id`,
  async ({ params, request }) => {
    const idx = mockAdminPills.findIndex((p) => p.id === String(params.pill_id));
    const existing = idx >= 0 ? mockAdminPills[idx] : undefined;
    if (idx < 0 || !existing) {
      return HttpResponse.json(
        { error: { code: "not_found", message: "Pill not found.", detail: null } },
        { status: 404 },
      );
    }
    const body = (await request.json().catch(() => null)) as PillUpdateSchema | null;
    const next: PillResponse = {
      ...existing,
      name: body?.name ?? existing.name,
      description:
        body && "description" in body ? (body.description ?? null) : existing.description,
      available_difficulty_min:
        body?.available_difficulty_min ?? existing.available_difficulty_min,
      available_difficulty_max:
        body?.available_difficulty_max ?? existing.available_difficulty_max,
      discoverable: body?.discoverable ?? existing.discoverable,
      estimated_minutes:
        body && "estimated_minutes" in body
          ? (body.estimated_minutes ?? null)
          : existing.estimated_minutes,
    };
    mockAdminPills = [
      ...mockAdminPills.slice(0, idx),
      next,
      ...mockAdminPills.slice(idx + 1),
    ];
    return HttpResponse.json(next);
  },
);

const adminPillSafetyHandler = http.patch(
  `${API}/v1/pills/:pill_id/safety`,
  async ({ params, request }) => {
    const idx = mockAdminPills.findIndex((p) => p.id === String(params.pill_id));
    const existing = idx >= 0 ? mockAdminPills[idx] : undefined;
    if (idx < 0 || !existing) {
      return HttpResponse.json(
        { error: { code: "not_found", message: "Pill not found.", detail: null } },
        { status: 404 },
      );
    }
    const body = (await request
      .json()
      .catch(() => null)) as PillSafetyOverrideSchema | null;
    if (!body || typeof body.safety_relevant !== "boolean") {
      return HttpResponse.json(
        {
          detail: [
            {
              loc: ["body", "safety_relevant"],
              msg: "field required",
              type: "missing",
            },
          ],
        },
        { status: 422 },
      );
    }
    const next: PillResponse = {
      ...existing,
      safety_relevant: body.safety_relevant,
      safety_relevant_overridden_at: ADMIN_PILL_ISO,
    };
    mockAdminPills = [
      ...mockAdminPills.slice(0, idx),
      next,
      ...mockAdminPills.slice(idx + 1),
    ];
    return HttpResponse.json(next);
  },
);

const adminPillsHandlers = [
  adminPillsListHandler,
  adminPillCreateHandler,
  adminPillUpdateHandler,
  adminPillSafetyHandler,
];

// FE-8 Slice 4 — stateful pill-proposals (per §B.4). Replaces the
// Slice-1 empty-page stub. Wire shape: `ProcessingTaskStatus`
// (pending|running|done|failed) on `status`; admin decision stashed
// in `payload.decision` ("approved" | "rejected") per backend at
// `app/domain/catalogue.py:594,620`. Approve also mutates
// `mockAdminPills` so the §D.3 round-trip (approve → pill visible
// in Pills tab) works end-to-end.

type PillProposalResponseSchema = components["schemas"]["PillProposalResponse"];
// OpenAPI typings narrow `payload` to `Record<string, never> | null` which
// rejects arbitrary keys. The real wire shape is "arbitrary JSON object"
// (`app/schemas.py:292`), so we widen on the way in via this cast helper.
const asProposalPayload = (
  p: Record<string, unknown>,
): PillProposalResponseSchema["payload"] => p as PillProposalResponseSchema["payload"];

const ADMIN_PROPOSAL_ISO = "2026-04-10T00:00:00Z";

const adminProposalId = (n: number): string =>
  `ffffffff-ffff-ffff-ffff-${String(n).padStart(12, "0")}`;

const DEFAULT_ADMIN_PROPOSALS: PillProposalResponseSchema[] = [
  {
    id: adminProposalId(1),
    status: "pending",
    payload: asProposalPayload({
      proposal: {
        name: "Cathodic Protection Field Inspection",
        description:
          "Inspect anode placement, take potential readings, and document deviations per ISO 15589-1.",
        subject_id: ADMIN_SUBJECT_IDS.marine,
        available_difficulty_min: 4,
        available_difficulty_max: 8,
      },
    }),
    created_at: ADMIN_PROPOSAL_ISO,
  },
  {
    id: adminProposalId(2),
    status: "pending",
    payload: asProposalPayload({
      proposal: {
        name: "Adhesion Pull-Off Test",
        description: "ISO 4624 pull-off adhesion test on cured coatings.",
        subject_id: ADMIN_SUBJECT_IDS.paintQa,
        available_difficulty_min: 2,
        available_difficulty_max: 6,
      },
    }),
    created_at: ADMIN_PROPOSAL_ISO,
  },
  {
    id: adminProposalId(3),
    status: "done",
    payload: asProposalPayload({
      decision: "approved",
      proposal: {
        name: "Reference Panels (historic)",
        description: "Already-approved proposal — populates the Approved filter.",
        subject_id: ADMIN_SUBJECT_IDS.paintQa,
      },
    }),
    created_at: ADMIN_PROPOSAL_ISO,
  },
];

let mockAdminProposals: PillProposalResponseSchema[] = [...DEFAULT_ADMIN_PROPOSALS];

export const setMockAdminProposals = (proposals: PillProposalResponseSchema[]): void => {
  mockAdminProposals = [...proposals];
};

export const resetMockAdminProposals = (): void => {
  mockAdminProposals = [...DEFAULT_ADMIN_PROPOSALS];
};

export const getMockAdminProposals = (): PillProposalResponseSchema[] => [
  ...mockAdminProposals,
];

const adminPillProposalsListHandler = http.get(
  `${API}/v1/pill-proposals`,
  ({ request }) => {
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? Math.min(200, Math.max(1, Number(limitRaw))) : 50;
    const start = cursor ? Number(cursor) : 0;
    const slice = mockAdminProposals.slice(start, start + limit);
    const nextStart = start + slice.length;
    const next_cursor = nextStart < mockAdminProposals.length ? String(nextStart) : null;
    return HttpResponse.json({ data: slice, meta: { next_cursor } });
  },
);

const adminPillProposalApproveHandler = http.post(
  `${API}/v1/pill-proposals/:proposal_id/approve`,
  ({ params }) => {
    const idx = mockAdminProposals.findIndex((p) => p.id === String(params.proposal_id));
    const existing = idx >= 0 ? mockAdminProposals[idx] : undefined;
    if (idx < 0 || !existing) {
      return HttpResponse.json(
        {
          error: { code: "not_found", message: "Proposal not found.", detail: null },
        },
        { status: 404 },
      );
    }
    if (existing.status !== "pending") {
      return HttpResponse.json(
        {
          error: {
            code: "proposal_not_pending",
            message: "This proposal is already resolved.",
            detail: null,
          },
        },
        { status: 409 },
      );
    }
    // Flip the proposal to done/approved.
    const payload = (existing.payload as Record<string, unknown>) ?? {};
    const proposalPayload = (payload.proposal as Record<string, unknown>) ?? {};
    const next: PillProposalResponseSchema = {
      ...existing,
      status: "done",
      payload: asProposalPayload({ ...payload, decision: "approved" }),
    };
    mockAdminProposals = [
      ...mockAdminProposals.slice(0, idx),
      next,
      ...mockAdminProposals.slice(idx + 1),
    ];
    // Cross-resource mutation: approved proposal becomes a real pill.
    const subjectId =
      typeof proposalPayload.subject_id === "string"
        ? proposalPayload.subject_id
        : ADMIN_SUBJECT_IDS.paintQa;
    const newPillName =
      typeof proposalPayload.name === "string"
        ? proposalPayload.name
        : "Untitled approved pill";
    const minRaw = proposalPayload.available_difficulty_min;
    const maxRaw = proposalPayload.available_difficulty_max;
    const newPill: PillResponse = {
      id: adminPillId(nextAdminPillSeq),
      subject_id: subjectId,
      name: newPillName,
      description:
        typeof proposalPayload.description === "string"
          ? proposalPayload.description
          : null,
      available_difficulty_min: typeof minRaw === "number" ? minRaw : 1,
      available_difficulty_max: typeof maxRaw === "number" ? maxRaw : 10,
      discoverable: true,
      safety_relevant: false,
      safety_relevant_overridden_at: null,
      estimated_minutes: null,
      retired_at: null,
      created_at: ADMIN_PROPOSAL_ISO,
      updated_at: ADMIN_PROPOSAL_ISO,
    };
    nextAdminPillSeq += 1;
    mockAdminPills = [newPill, ...mockAdminPills];
    return HttpResponse.json(newPill, { status: 201 });
  },
);

const adminPillProposalRejectHandler = http.post(
  `${API}/v1/pill-proposals/:proposal_id/reject`,
  ({ params }) => {
    const idx = mockAdminProposals.findIndex((p) => p.id === String(params.proposal_id));
    const existing = idx >= 0 ? mockAdminProposals[idx] : undefined;
    if (idx < 0 || !existing) {
      return HttpResponse.json(
        {
          error: { code: "not_found", message: "Proposal not found.", detail: null },
        },
        { status: 404 },
      );
    }
    if (existing.status !== "pending") {
      return HttpResponse.json(
        {
          error: {
            code: "proposal_not_pending",
            message: "This proposal is already resolved.",
            detail: null,
          },
        },
        { status: 409 },
      );
    }
    const payload = (existing.payload as Record<string, unknown>) ?? {};
    const next: PillProposalResponseSchema = {
      ...existing,
      status: "done",
      payload: asProposalPayload({ ...payload, decision: "rejected" }),
    };
    mockAdminProposals = [
      ...mockAdminProposals.slice(0, idx),
      next,
      ...mockAdminProposals.slice(idx + 1),
    ];
    return HttpResponse.json(next);
  },
);

const adminProposalsHandlers = [
  adminPillProposalsListHandler,
  adminPillProposalApproveHandler,
  adminPillProposalRejectHandler,
];

// FE-8 Slice 6 — stateful Learning Paths CRUD (per §B.6). Replaces the
// Slice-1 empty-page stub. Full CRUD shipped now even though the list
// page only consumes list + delete + (CTA-navigates) so Slice 7 doesn't
// need to revisit this file.

type LearningPathResponseSchema = components["schemas"]["LearningPathResponse"];
type LearningPathCreateSchema = components["schemas"]["LearningPathCreate"];
type LearningPathUpdateSchema = components["schemas"]["LearningPathUpdate"];

const ADMIN_PATH_ISO_CREATED = "2026-03-01T00:00:00Z";
const ADMIN_PATH_ISO_UPDATED = "2026-04-15T00:00:00Z";

const adminPathId = (n: number): string =>
  `cccc1111-cccc-cccc-cccc-${String(n).padStart(12, "0")}`;

const DEFAULT_ADMIN_PATHS: LearningPathResponseSchema[] = [
  {
    id: adminPathId(1),
    name: "Paint QA induction",
    description: "Reference panels, batch tracking, DFT — the QA starter set.",
    is_private: false,
    owner_user_id: null,
    pill_ids: [adminPillId(1), adminPillId(2)],
    created_at: ADMIN_PATH_ISO_CREATED,
    updated_at: ADMIN_PATH_ISO_UPDATED,
  },
  {
    id: adminPathId(2),
    name: "Marine coatings refresher",
    description: "Antifouling + cathodic protection deep dive.",
    is_private: false,
    owner_user_id: null,
    pill_ids: [adminPillId(3), adminPillId(4)],
    created_at: ADMIN_PATH_ISO_CREATED,
    updated_at: ADMIN_PATH_ISO_UPDATED,
  },
  {
    id: adminPathId(3),
    name: "Site safety primer",
    description: null,
    is_private: false,
    owner_user_id: null,
    pill_ids: [adminPillId(5)],
    created_at: ADMIN_PATH_ISO_CREATED,
    updated_at: ADMIN_PATH_ISO_UPDATED,
  },
];

let mockAdminPaths: LearningPathResponseSchema[] = [...DEFAULT_ADMIN_PATHS];
let nextAdminPathSeq = DEFAULT_ADMIN_PATHS.length + 1;

export const setMockAdminPaths = (paths: LearningPathResponseSchema[]): void => {
  mockAdminPaths = [...paths];
};

export const resetMockAdminPaths = (): void => {
  mockAdminPaths = [...DEFAULT_ADMIN_PATHS];
  nextAdminPathSeq = DEFAULT_ADMIN_PATHS.length + 1;
};

export const getMockAdminPaths = (): LearningPathResponseSchema[] => [...mockAdminPaths];

const adminPathsListHandler = http.get(`${API}/v1/learning-paths`, ({ request }) => {
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Math.min(200, Math.max(1, Number(limitRaw))) : 50;
  const start = cursor ? Number(cursor) : 0;
  const slice = mockAdminPaths.slice(start, start + limit);
  const nextStart = start + slice.length;
  const next_cursor = nextStart < mockAdminPaths.length ? String(nextStart) : null;
  return HttpResponse.json({ data: slice, meta: { next_cursor } });
});

const adminPathCreateHandler = http.post(
  `${API}/v1/learning-paths`,
  async ({ request }) => {
    const body = (await request
      .json()
      .catch(() => null)) as LearningPathCreateSchema | null;
    if (!body || typeof body.name !== "string" || body.name.trim() === "") {
      return HttpResponse.json(
        {
          detail: [
            { loc: ["body", "name"], msg: "Path name is required.", type: "missing" },
          ],
        },
        { status: 422 },
      );
    }
    const created: LearningPathResponseSchema = {
      id: adminPathId(nextAdminPathSeq),
      name: body.name,
      description: body.description ?? null,
      is_private: false,
      owner_user_id: null,
      pill_ids: Array.isArray(body.pill_ids) ? body.pill_ids : [],
      created_at: ADMIN_PATH_ISO_CREATED,
      updated_at: ADMIN_PATH_ISO_CREATED,
    };
    nextAdminPathSeq += 1;
    mockAdminPaths = [created, ...mockAdminPaths];
    return HttpResponse.json(created, { status: 201 });
  },
);

const adminPathGetHandler = http.get(
  `${API}/v1/learning-paths/:path_id`,
  ({ params }) => {
    const path = mockAdminPaths.find((p) => p.id === String(params.path_id));
    if (!path) {
      return HttpResponse.json(
        { error: { code: "not_found", message: "Path not found.", detail: null } },
        { status: 404 },
      );
    }
    return HttpResponse.json(path);
  },
);

const adminPathUpdateHandler = http.patch(
  `${API}/v1/learning-paths/:path_id`,
  async ({ params, request }) => {
    const idx = mockAdminPaths.findIndex((p) => p.id === String(params.path_id));
    const existing = idx >= 0 ? mockAdminPaths[idx] : undefined;
    if (idx < 0 || !existing) {
      return HttpResponse.json(
        { error: { code: "not_found", message: "Path not found.", detail: null } },
        { status: 404 },
      );
    }
    const body = (await request
      .json()
      .catch(() => null)) as LearningPathUpdateSchema | null;
    const next: LearningPathResponseSchema = {
      ...existing,
      name: body?.name ?? existing.name,
      description:
        body && "description" in body ? (body.description ?? null) : existing.description,
      pill_ids: Array.isArray(body?.pill_ids) ? body.pill_ids : existing.pill_ids,
      updated_at: ADMIN_PATH_ISO_UPDATED,
    };
    mockAdminPaths = [
      ...mockAdminPaths.slice(0, idx),
      next,
      ...mockAdminPaths.slice(idx + 1),
    ];
    return HttpResponse.json(next);
  },
);

const adminPathDeleteHandler = http.delete(
  `${API}/v1/learning-paths/:path_id`,
  ({ params }) => {
    const before = mockAdminPaths.length;
    mockAdminPaths = mockAdminPaths.filter((p) => p.id !== String(params.path_id));
    if (mockAdminPaths.length === before) {
      return HttpResponse.json(
        { error: { code: "not_found", message: "Path not found.", detail: null } },
        { status: 404 },
      );
    }
    return new HttpResponse(null, { status: 204 });
  },
);

const adminPathsHandlers = [
  adminPathsListHandler,
  adminPathCreateHandler,
  adminPathGetHandler,
  adminPathUpdateHandler,
  adminPathDeleteHandler,
];

// FE-8 Slice 8 — stateful Users CRUD (per admin-identity §B.1).
// Replaces the Slice-1 empty-page stub.

type UserResponseSchema = components["schemas"]["UserResponse"];
type AdminCreateUserRequestSchema = components["schemas"]["AdminCreateUserRequest"];
type UserUpdateSchema = components["schemas"]["UserUpdate"];

const ADMIN_USER_ISO = "2026-03-15T00:00:00Z";

const adminUserId = (n: number): string =>
  `aaaa2222-aaaa-aaaa-aaaa-${String(n).padStart(12, "0")}`;

const DEFAULT_ADMIN_USERS: UserResponseSchema[] = [
  {
    id: adminUserId(1),
    email: "jay@sitemesh.co",
    name: "Jay Phillips",
    // Real backend enum (`app/permissions.py:65` ROLE_ADMINISTRATOR). The
    // mock previously emitted the FE-only literal `"admin"`, leaving the
    // whole FE cohort self-consistent on the wrong literal (audit A3-L1 /
    // X2-#3) — flipped to the canon so the role seam is exercised honestly.
    role: "administrator",
    status: "active",
    privacy_ack_at: ADMIN_USER_ISO,
    created_at: ADMIN_USER_ISO,
  },
  {
    id: adminUserId(2),
    email: "lerato@sitemesh.co",
    name: "Lerato Dlamini",
    role: "testee",
    status: "active",
    privacy_ack_at: ADMIN_USER_ISO,
    created_at: ADMIN_USER_ISO,
  },
  // Invited heuristic: active + privacy_ack_at=null (§B.1 §7).
  {
    id: adminUserId(3),
    email: "kabelo@sitemesh.co",
    name: "Kabelo Mokoena",
    role: "testee",
    status: "active",
    privacy_ack_at: null,
    created_at: ADMIN_USER_ISO,
  },
  {
    id: adminUserId(4),
    email: "themba@sitemesh.co",
    name: "Themba Nkosi",
    role: "testee",
    status: "deactivated",
    privacy_ack_at: ADMIN_USER_ISO,
    created_at: ADMIN_USER_ISO,
  },
];

let mockAdminUsers: UserResponseSchema[] = [...DEFAULT_ADMIN_USERS];
let nextAdminUserSeq = DEFAULT_ADMIN_USERS.length + 1;

export const setMockAdminUsers = (users: UserResponseSchema[]): void => {
  mockAdminUsers = [...users];
};

export const resetMockAdminUsers = (): void => {
  mockAdminUsers = [...DEFAULT_ADMIN_USERS];
  nextAdminUserSeq = DEFAULT_ADMIN_USERS.length + 1;
};

export const getMockAdminUsers = (): UserResponseSchema[] => [...mockAdminUsers];

const adminUsersListHandler = http.get(`${API}/v1/users`, ({ request }) => {
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Math.min(200, Math.max(1, Number(limitRaw))) : 50;
  const role = url.searchParams.get("role");
  const status = url.searchParams.get("status");
  const filtered = mockAdminUsers.filter((u) => {
    if (role && u.role !== role) return false;
    if (status && u.status !== status) return false;
    return true;
  });
  const start = cursor ? Number(cursor) : 0;
  const slice = filtered.slice(start, start + limit);
  const nextStart = start + slice.length;
  const next_cursor = nextStart < filtered.length ? String(nextStart) : null;
  return HttpResponse.json({ data: slice, meta: { next_cursor } });
});

const adminUserCreateHandler = http.post(`${API}/v1/users`, async ({ request }) => {
  const body = (await request
    .json()
    .catch(() => null)) as AdminCreateUserRequestSchema | null;
  const detail: { loc: (string | number)[]; msg: string; type: string }[] = [];
  if (!body || typeof body.email !== "string" || !body.email.includes("@")) {
    detail.push({
      loc: ["body", "email"],
      msg: "valid email required",
      type: "value_error",
    });
  }
  if (!body || typeof body.name !== "string" || body.name.trim() === "") {
    detail.push({ loc: ["body", "name"], msg: "name required", type: "missing" });
  }
  // Mirror the backend's VALID_ROLES (`app/permissions.py:67` —
  // {"administrator", "testee"}). The mock previously accepted the FE-only
  // literal `"admin"`; the role seam now posts the canonical
  // `"administrator"`, so the mock validates the same literal the real
  // server does (audit A3-L1 / X2-#3).
  if (!body || (body.role !== "administrator" && body.role !== "testee")) {
    detail.push({
      loc: ["body", "role"],
      msg: "role must be administrator or testee",
      type: "value_error",
    });
  }
  if (detail.length > 0) {
    return HttpResponse.json({ detail }, { status: 422 });
  }
  if (mockAdminUsers.some((u) => u.email === body!.email)) {
    return HttpResponse.json(
      {
        detail: [
          {
            loc: ["body", "email"],
            msg: "email already exists",
            type: "value_error",
          },
        ],
      },
      { status: 422 },
    );
  }
  const created: UserResponseSchema = {
    id: adminUserId(nextAdminUserSeq),
    email: body!.email,
    name: body!.name,
    role: body!.role,
    status: "active",
    privacy_ack_at: null,
    created_at: ADMIN_USER_ISO,
  };
  nextAdminUserSeq += 1;
  mockAdminUsers = [created, ...mockAdminUsers];
  return HttpResponse.json(created, { status: 201 });
});

const adminUserGetHandler = http.get(`${API}/v1/users/:user_id`, ({ params }) => {
  const u = mockAdminUsers.find((x) => x.id === String(params.user_id));
  if (!u) {
    return HttpResponse.json(
      { error: { code: "not_found", message: "User not found.", detail: null } },
      { status: 404 },
    );
  }
  return HttpResponse.json(u);
});

const adminUserUpdateHandler = http.patch(
  `${API}/v1/users/:user_id`,
  async ({ params, request }) => {
    const idx = mockAdminUsers.findIndex((x) => x.id === String(params.user_id));
    const existing = idx >= 0 ? mockAdminUsers[idx] : undefined;
    if (idx < 0 || !existing) {
      return HttpResponse.json(
        { error: { code: "not_found", message: "User not found.", detail: null } },
        { status: 404 },
      );
    }
    const body = (await request.json().catch(() => null)) as UserUpdateSchema | null;
    const next: UserResponseSchema = {
      ...existing,
      name: body?.name ?? existing.name,
      role: body?.role ?? existing.role,
    };
    mockAdminUsers = [
      ...mockAdminUsers.slice(0, idx),
      next,
      ...mockAdminUsers.slice(idx + 1),
    ];
    return HttpResponse.json(next);
  },
);

const adminUserDeactivateHandler = http.post(
  `${API}/v1/users/:user_id/deactivate`,
  ({ params }) => {
    const idx = mockAdminUsers.findIndex((x) => x.id === String(params.user_id));
    const existing = idx >= 0 ? mockAdminUsers[idx] : undefined;
    if (idx < 0 || !existing) {
      return HttpResponse.json(
        { error: { code: "not_found", message: "User not found.", detail: null } },
        { status: 404 },
      );
    }
    const next: UserResponseSchema = { ...existing, status: "deactivated" };
    mockAdminUsers = [
      ...mockAdminUsers.slice(0, idx),
      next,
      ...mockAdminUsers.slice(idx + 1),
    ];
    return HttpResponse.json(next);
  },
);

const adminUserReactivateHandler = http.post(
  `${API}/v1/users/:user_id/reactivate`,
  ({ params }) => {
    const idx = mockAdminUsers.findIndex((x) => x.id === String(params.user_id));
    const existing = idx >= 0 ? mockAdminUsers[idx] : undefined;
    if (idx < 0 || !existing) {
      return HttpResponse.json(
        { error: { code: "not_found", message: "User not found.", detail: null } },
        { status: 404 },
      );
    }
    const next: UserResponseSchema = { ...existing, status: "active" };
    mockAdminUsers = [
      ...mockAdminUsers.slice(0, idx),
      next,
      ...mockAdminUsers.slice(idx + 1),
    ];
    return HttpResponse.json(next);
  },
);

const adminUsersHandlers = [
  adminUsersListHandler,
  adminUserCreateHandler,
  adminUserGetHandler,
  adminUserUpdateHandler,
  adminUserDeactivateHandler,
  adminUserReactivateHandler,
];

// FE-8 Slice 9 — stateful Groups CRUD (per admin-identity §B.2 + §B.3).
// Replaces the Slice-1 empty-page stubs. Includes 2 system groups +
// 2 custom groups; `add member` POST is single-user per wire shape.

type GroupResponseSchema = components["schemas"]["GroupResponse"];
type GroupCreateSchema = components["schemas"]["GroupCreate"];
type GroupUpdateSchema = components["schemas"]["GroupUpdate"];
type GroupMemberRequestSchema = components["schemas"]["GroupMemberRequest"];

const ADMIN_GROUP_ISO = "2026-03-01T00:00:00Z";

const adminGroupId = (n: number): string =>
  `bbbb3333-bbbb-bbbb-bbbb-${String(n).padStart(12, "0")}`;

const DEFAULT_ADMIN_GROUPS: GroupResponseSchema[] = [
  {
    id: adminGroupId(1),
    name: "All Users",
    description: "Every user on the platform — managed automatically.",
    is_system: true,
    // Reference the seed admin users (Slice 8).
    member_ids: [adminUserId(1), adminUserId(2), adminUserId(3), adminUserId(4)],
    created_at: ADMIN_GROUP_ISO,
    updated_at: ADMIN_GROUP_ISO,
  },
  {
    id: adminGroupId(2),
    name: "All Testees",
    description: "Every testee user.",
    is_system: true,
    member_ids: [adminUserId(2), adminUserId(3), adminUserId(4)],
    created_at: ADMIN_GROUP_ISO,
    updated_at: ADMIN_GROUP_ISO,
  },
  {
    id: adminGroupId(3),
    name: "Q3 2026 induction",
    description: "Onboarding cohort for the Q3 hiring wave.",
    is_system: false,
    member_ids: [adminUserId(2)],
    created_at: ADMIN_GROUP_ISO,
    updated_at: ADMIN_GROUP_ISO,
  },
  {
    id: adminGroupId(4),
    name: "Seniors",
    description: null,
    is_system: false,
    member_ids: [],
    created_at: ADMIN_GROUP_ISO,
    updated_at: ADMIN_GROUP_ISO,
  },
];

// Deep-clone each group so tests that mutate `member_ids` in place
// (via the resolver shape) don't leak across tests through the shared
// fixture object identity.
const cloneAdminGroups = (): GroupResponseSchema[] =>
  DEFAULT_ADMIN_GROUPS.map((g) => ({ ...g, member_ids: [...g.member_ids] }));

let mockAdminGroups: GroupResponseSchema[] = cloneAdminGroups();
let nextAdminGroupSeq = DEFAULT_ADMIN_GROUPS.length + 1;

export const setMockAdminGroups = (groups: GroupResponseSchema[]): void => {
  mockAdminGroups = groups.map((g) => ({ ...g, member_ids: [...g.member_ids] }));
};

export const resetMockAdminGroups = (): void => {
  mockAdminGroups = cloneAdminGroups();
  nextAdminGroupSeq = DEFAULT_ADMIN_GROUPS.length + 1;
};

export const getMockAdminGroups = (): GroupResponseSchema[] => mockAdminGroups;

const adminGroupsListHandler = http.get(`${API}/v1/groups`, ({ request }) => {
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Math.min(200, Math.max(1, Number(limitRaw))) : 50;
  const start = cursor ? Number(cursor) : 0;
  const slice = mockAdminGroups.slice(start, start + limit);
  const nextStart = start + slice.length;
  const next_cursor = nextStart < mockAdminGroups.length ? String(nextStart) : null;
  return HttpResponse.json({ data: slice, meta: { next_cursor } });
});

const adminGroupGetHandler = http.get(`${API}/v1/groups/:group_id`, ({ params }) => {
  const g = mockAdminGroups.find((x) => x.id === String(params.group_id));
  if (!g) {
    return HttpResponse.json(
      {
        error: { code: "not_found", message: "Group not found.", detail: null },
      },
      { status: 404 },
    );
  }
  return HttpResponse.json(g);
});

const adminGroupCreateHandler = http.post(`${API}/v1/groups`, async ({ request }) => {
  const body = (await request.json().catch(() => null)) as GroupCreateSchema | null;
  if (!body || typeof body.name !== "string" || body.name.trim() === "") {
    return HttpResponse.json(
      {
        detail: [
          { loc: ["body", "name"], msg: "Group name is required.", type: "missing" },
        ],
      },
      { status: 422 },
    );
  }
  const created: GroupResponseSchema = {
    id: adminGroupId(nextAdminGroupSeq),
    name: body.name,
    description: body.description ?? null,
    is_system: false,
    member_ids: [],
    created_at: ADMIN_GROUP_ISO,
    updated_at: ADMIN_GROUP_ISO,
  };
  nextAdminGroupSeq += 1;
  mockAdminGroups = [created, ...mockAdminGroups];
  return HttpResponse.json(created, { status: 201 });
});

const adminGroupUpdateHandler = http.patch(
  `${API}/v1/groups/:group_id`,
  async ({ params, request }) => {
    const idx = mockAdminGroups.findIndex((x) => x.id === String(params.group_id));
    const existing = idx >= 0 ? mockAdminGroups[idx] : undefined;
    if (idx < 0 || !existing) {
      return HttpResponse.json(
        { error: { code: "not_found", message: "Group not found.", detail: null } },
        { status: 404 },
      );
    }
    if (existing.is_system) {
      return HttpResponse.json(
        {
          error: {
            code: "system_group_immutable",
            message: "System groups are immutable (AC-D15).",
            detail: null,
          },
        },
        { status: 422 },
      );
    }
    const body = (await request.json().catch(() => null)) as GroupUpdateSchema | null;
    const next: GroupResponseSchema = {
      ...existing,
      name: body?.name ?? existing.name,
      description:
        body && "description" in body ? (body.description ?? null) : existing.description,
      updated_at: ADMIN_GROUP_ISO,
    };
    mockAdminGroups = [
      ...mockAdminGroups.slice(0, idx),
      next,
      ...mockAdminGroups.slice(idx + 1),
    ];
    return HttpResponse.json(next);
  },
);

const adminGroupAddMemberHandler = http.post(
  `${API}/v1/groups/:group_id/members`,
  async ({ params, request }) => {
    const idx = mockAdminGroups.findIndex((x) => x.id === String(params.group_id));
    const existing = idx >= 0 ? mockAdminGroups[idx] : undefined;
    if (idx < 0 || !existing) {
      return HttpResponse.json(
        { error: { code: "not_found", message: "Group not found.", detail: null } },
        { status: 404 },
      );
    }
    if (existing.is_system) {
      return HttpResponse.json(
        {
          error: {
            code: "system_group_immutable",
            message: "System groups are immutable (AC-D15).",
            detail: null,
          },
        },
        { status: 422 },
      );
    }
    const body = (await request
      .json()
      .catch(() => null)) as GroupMemberRequestSchema | null;
    if (!body || typeof body.user_id !== "string") {
      return HttpResponse.json(
        {
          detail: [
            { loc: ["body", "user_id"], msg: "user_id required", type: "missing" },
          ],
        },
        { status: 422 },
      );
    }
    if (existing.member_ids.includes(body.user_id)) {
      return HttpResponse.json(
        {
          error: {
            code: "member_already",
            message: "User is already a member of this group.",
            detail: null,
          },
        },
        { status: 409 },
      );
    }
    const next: GroupResponseSchema = {
      ...existing,
      member_ids: [...existing.member_ids, body.user_id],
      updated_at: ADMIN_GROUP_ISO,
    };
    mockAdminGroups = [
      ...mockAdminGroups.slice(0, idx),
      next,
      ...mockAdminGroups.slice(idx + 1),
    ];
    return HttpResponse.json(next, { status: 201 });
  },
);

const adminGroupRemoveMemberHandler = http.delete(
  `${API}/v1/groups/:group_id/members/:user_id`,
  ({ params }) => {
    const idx = mockAdminGroups.findIndex((x) => x.id === String(params.group_id));
    const existing = idx >= 0 ? mockAdminGroups[idx] : undefined;
    if (idx < 0 || !existing) {
      return HttpResponse.json(
        { error: { code: "not_found", message: "Group not found.", detail: null } },
        { status: 404 },
      );
    }
    if (existing.is_system) {
      return HttpResponse.json(
        {
          error: {
            code: "system_group_immutable",
            message: "System groups are immutable (AC-D15).",
            detail: null,
          },
        },
        { status: 422 },
      );
    }
    const next: GroupResponseSchema = {
      ...existing,
      member_ids: existing.member_ids.filter((id) => id !== String(params.user_id)),
      updated_at: ADMIN_GROUP_ISO,
    };
    mockAdminGroups = [
      ...mockAdminGroups.slice(0, idx),
      next,
      ...mockAdminGroups.slice(idx + 1),
    ];
    return new HttpResponse(null, { status: 204 });
  },
);

// N2 — single batched members list. Resolves `member_ids` against the
// mock users directory and cursor-paginates (index-based, like the other
// admin list handlers). 404s on an unknown group, mirroring the backend.
const adminGroupMembersListHandler = http.get(
  `${API}/v1/groups/:group_id/members`,
  ({ params, request }) => {
    const group = mockAdminGroups.find((x) => x.id === String(params.group_id));
    if (!group) {
      return HttpResponse.json(
        {
          error: { code: "not_found", message: "Group not found.", detail: null },
        },
        { status: 404 },
      );
    }
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? Math.min(200, Math.max(1, Number(limitRaw))) : 50;
    const byId = new Map(mockAdminUsers.map((u) => [u.id, u]));
    const members = group.member_ids
      .map((id) => byId.get(id))
      .filter((u): u is UserResponseSchema => u !== undefined);
    const start = cursor ? Number(cursor) : 0;
    const slice = members.slice(start, start + limit);
    const nextStart = start + slice.length;
    const next_cursor = nextStart < members.length ? String(nextStart) : null;
    return HttpResponse.json({ data: slice, meta: { next_cursor } });
  },
);

const adminGroupsHandlers = [
  adminGroupsListHandler,
  adminGroupGetHandler,
  adminGroupMembersListHandler,
  adminGroupCreateHandler,
  adminGroupUpdateHandler,
  adminGroupAddMemberHandler,
  adminGroupRemoveMemberHandler,
];
// FE-8 Slice 10 — stateful Assignments CRUD (per admin-identity §B.4).
// Replaces the Slice-1 empty-page stub. v1 LOCKED: create + delete
// only (no PATCH on the wire; §E item 9 drops edit-flow from v1).
// Also: thin stateful Tests list seed (Slice 11 extends with full CRUD).

type AssignmentResponseSchema = components["schemas"]["AssignmentResponse"];
type AssignmentCreateSchema = components["schemas"]["AssignmentCreate"];

const ADMIN_ASSIGNMENT_ISO = "2026-04-20T00:00:00Z";
const adminAssignmentId = (n: number): string =>
  `eeee4444-eeee-eeee-eeee-${String(n).padStart(12, "0")}`;

// Tests seed — Slice 10 shipped 2; Slice 11 extends to 4 covering
// every display-status branch + every authored mode (per_testee
// published, frozen draft, hand_authored published, per_testee
// locked via lock_mode="campaign-locked"). Benchmark mode authoring
// is deferred per §E.8; no benchmark seed.
const adminTestId = (n: number): string =>
  `ffff5555-ffff-ffff-ffff-${String(n).padStart(12, "0")}`;
const DEFAULT_ADMIN_TESTS: TestResponseSchema[] = [
  {
    id: adminTestId(1),
    name: "Antifouling — focus",
    mode: "per_testee",
    status: "published",
    visibility: "library",
    timed: true,
    duration_minutes: 30,
    pause_allowance: 2,
    timeout_behaviour: "auto_submit",
    max_pause_duration_minutes: 5,
    pass_threshold: 0.7,
    target_difficulty: 6,
    lock_mode: "open",
    campaign_id: null,
    benchmark_scope: null,
    benchmark_target_testee_id: null,
    randomise_question_order: false,
    randomise_option_order: false,
    pill_id: adminPillId(3),
    created_at: ADMIN_ASSIGNMENT_ISO,
    updated_at: ADMIN_ASSIGNMENT_ISO,
  },
  {
    id: adminTestId(2),
    name: "Reference Panels D5",
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
    pill_id: adminPillId(1),
    created_at: ADMIN_ASSIGNMENT_ISO,
    updated_at: ADMIN_ASSIGNMENT_ISO,
  },
  // Frozen-mode draft — exercises Slice 11 status filter "draft" + the
  // em-dash pill column (frozen tests have no single pill_id).
  {
    id: adminTestId(3),
    name: "Q1 Cohort baseline",
    mode: "frozen",
    status: "draft",
    visibility: "library",
    timed: true,
    duration_minutes: 45,
    pause_allowance: 1,
    timeout_behaviour: "auto_submit",
    max_pause_duration_minutes: 5,
    pass_threshold: 0.65,
    target_difficulty: 5,
    lock_mode: "open",
    campaign_id: null,
    benchmark_scope: null,
    benchmark_target_testee_id: null,
    randomise_question_order: true,
    randomise_option_order: true,
    pill_id: null,
    created_at: ADMIN_ASSIGNMENT_ISO,
    updated_at: ADMIN_ASSIGNMENT_ISO,
  },
  // Campaign-locked — exercises the deriveDisplayStatus 'locked' branch
  // + the lock-icon prefix on the status pill (Slice 11 drift Finding #7).
  {
    id: adminTestId(4),
    name: "ISO 9001 audit walk-through",
    mode: "hand_authored",
    status: "published",
    visibility: "library",
    timed: false,
    duration_minutes: 60,
    pause_allowance: 0,
    timeout_behaviour: "auto_submit",
    max_pause_duration_minutes: 0,
    pass_threshold: 0.8,
    target_difficulty: 7,
    lock_mode: "campaign-locked",
    campaign_id: "00000000-0000-0000-0000-000000000abc",
    benchmark_scope: null,
    benchmark_target_testee_id: null,
    randomise_question_order: false,
    randomise_option_order: false,
    pill_id: null,
    created_at: ADMIN_ASSIGNMENT_ISO,
    updated_at: ADMIN_ASSIGNMENT_ISO,
  },
];
let nextAdminTestSeq = DEFAULT_ADMIN_TESTS.length + 1;

let mockAdminTests: TestResponseSchema[] = [...DEFAULT_ADMIN_TESTS];
export const setMockAdminTests = (tests: TestResponseSchema[]): void => {
  mockAdminTests = [...tests];
};
export const resetMockAdminTests = (): void => {
  mockAdminTests = [...DEFAULT_ADMIN_TESTS];
  nextAdminTestSeq = DEFAULT_ADMIN_TESTS.length + 1;
};
export const getMockAdminTests = (): TestResponseSchema[] => [...mockAdminTests];

const DEFAULT_ADMIN_ASSIGNMENTS: AssignmentResponseSchema[] = [
  {
    id: adminAssignmentId(1),
    assigner_id: adminUserId(1),
    pill_id: adminPillId(3),
    learning_path_id: null,
    difficulty: 6,
    deadline: "2026-06-12T17:00:00Z",
    is_mandatory: false,
    loop_mode: "autonomous",
    assignee_ids: [adminUserId(2)],
    created_at: ADMIN_ASSIGNMENT_ISO,
    updated_at: ADMIN_ASSIGNMENT_ISO,
  },
  {
    id: adminAssignmentId(2),
    assigner_id: adminUserId(1),
    pill_id: null,
    learning_path_id: adminPathId(1),
    difficulty: 5,
    deadline: null,
    is_mandatory: true,
    loop_mode: "admin_reviewed",
    assignee_ids: [adminUserId(2), adminUserId(3)],
    created_at: ADMIN_ASSIGNMENT_ISO,
    updated_at: ADMIN_ASSIGNMENT_ISO,
  },
];

let mockAdminAssignments: AssignmentResponseSchema[] = [...DEFAULT_ADMIN_ASSIGNMENTS];
let nextAdminAssignmentSeq = DEFAULT_ADMIN_ASSIGNMENTS.length + 1;

export const setMockAdminAssignments = (
  assignments: AssignmentResponseSchema[],
): void => {
  mockAdminAssignments = [...assignments];
};

export const resetMockAdminAssignments = (): void => {
  mockAdminAssignments = [...DEFAULT_ADMIN_ASSIGNMENTS];
  nextAdminAssignmentSeq = DEFAULT_ADMIN_ASSIGNMENTS.length + 1;
};

export const getMockAdminAssignments = (): AssignmentResponseSchema[] => [
  ...mockAdminAssignments,
];

const adminAssignmentsListHandler = http.get(`${API}/v1/assignments`, ({ request }) => {
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const limitRaw = url.searchParams.get("limit");
  const assignerId = url.searchParams.get("assigner_id");
  const limit = limitRaw ? Math.min(200, Math.max(1, Number(limitRaw))) : 50;
  const filtered = mockAdminAssignments.filter((a) => {
    if (assignerId && a.assigner_id !== assignerId) return false;
    return true;
  });
  const start = cursor ? Number(cursor) : 0;
  const slice = filtered.slice(start, start + limit);
  const nextStart = start + slice.length;
  const next_cursor = nextStart < filtered.length ? String(nextStart) : null;
  return HttpResponse.json({ data: slice, meta: { next_cursor } });
});

const adminAssignmentCreateHandler = http.post(
  `${API}/v1/assignments`,
  async ({ request }) => {
    const body = (await request
      .json()
      .catch(() => null)) as AssignmentCreateSchema | null;
    if (!body || typeof body.difficulty !== "number") {
      return HttpResponse.json(
        {
          detail: [
            { loc: ["body", "difficulty"], msg: "difficulty required", type: "missing" },
          ],
        },
        { status: 422 },
      );
    }
    // Server-side dedup of testee+group expansion (matches the FE-side
    // dedup contract; spec §H(b) item 16 LOCKED v1 behaviour).
    const assigneeSet = new Set<string>(body.testee_ids ?? []);
    for (const gid of body.group_ids ?? []) {
      const g = mockAdminGroups.find((x) => x.id === gid);
      if (g) for (const m of g.member_ids) assigneeSet.add(m);
    }
    const created: AssignmentResponseSchema = {
      id: adminAssignmentId(nextAdminAssignmentSeq),
      assigner_id: adminUserId(1),
      pill_id: body.pill_id ?? null,
      learning_path_id: body.learning_path_id ?? null,
      difficulty: body.difficulty,
      deadline: body.deadline ?? null,
      is_mandatory: body.is_mandatory ?? false,
      loop_mode: body.loop_mode ?? "autonomous",
      assignee_ids: Array.from(assigneeSet),
      created_at: ADMIN_ASSIGNMENT_ISO,
      updated_at: ADMIN_ASSIGNMENT_ISO,
    };
    nextAdminAssignmentSeq += 1;
    mockAdminAssignments = [created, ...mockAdminAssignments];
    return HttpResponse.json(created, { status: 201 });
  },
);

const adminAssignmentGetHandler = http.get(
  `${API}/v1/assignments/:assignment_id`,
  ({ params }) => {
    const a = mockAdminAssignments.find((x) => x.id === String(params.assignment_id));
    if (!a) {
      return HttpResponse.json(
        {
          error: { code: "not_found", message: "Assignment not found.", detail: null },
        },
        { status: 404 },
      );
    }
    return HttpResponse.json(a);
  },
);

const adminAssignmentDeleteHandler = http.delete(
  `${API}/v1/assignments/:assignment_id`,
  ({ params }) => {
    const before = mockAdminAssignments.length;
    mockAdminAssignments = mockAdminAssignments.filter(
      (a) => a.id !== String(params.assignment_id),
    );
    if (mockAdminAssignments.length === before) {
      return HttpResponse.json(
        {
          error: { code: "not_found", message: "Assignment not found.", detail: null },
        },
        { status: 404 },
      );
    }
    return new HttpResponse(null, { status: 204 });
  },
);

const adminAssignmentsHandlers = [
  adminAssignmentsListHandler,
  adminAssignmentCreateHandler,
  adminAssignmentGetHandler,
  adminAssignmentDeleteHandler,
];

type TestCreateSchema = components["schemas"]["TestCreate"];
type TestUpdateSchema = components["schemas"]["TestUpdate"];

const adminTestsListHandler = http.get(`${API}/v1/tests`, ({ request }) => {
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Math.min(200, Math.max(1, Number(limitRaw))) : 50;
  const start = cursor ? Number(cursor) : 0;
  const slice = mockAdminTests.slice(start, start + limit);
  const nextStart = start + slice.length;
  const next_cursor = nextStart < mockAdminTests.length ? String(nextStart) : null;
  return HttpResponse.json({ data: slice, meta: { next_cursor } });
});

// `/v1/tests/:test_id` is owned by *both* the testee `getTestHandler`
// (mockTests map, FE-4 attempt runner) and the admin editor. Slice 12
// registers `adminTestGetHandler` *before* the testee handler in the
// `handlers` array and returns `undefined` here on miss so MSW falls
// through to the testee handler — that way admin seed IDs resolve to
// the admin shape and any other ID resolves via the testee handler
// (which 404s if absent, preserving existing FE-4 + Slice 11 behaviour).
const adminTestGetHandler = http.get(`${API}/v1/tests/:test_id`, ({ params }) => {
  const t = mockAdminTests.find((x) => x.id === String(params.test_id));
  if (!t) return undefined;
  return HttpResponse.json(t);
});

const adminTestCreateHandler = http.post(`${API}/v1/tests`, async ({ request }) => {
  const body = (await request.json().catch(() => null)) as TestCreateSchema | null;
  if (!body || typeof body.name !== "string" || body.name.trim() === "") {
    return HttpResponse.json(
      {
        detail: [
          { loc: ["body", "name"], msg: "Test name is required.", type: "missing" },
        ],
      },
      { status: 422 },
    );
  }
  const created: TestResponseSchema = {
    id: adminTestId(nextAdminTestSeq),
    name: body.name,
    mode: body.mode ?? "per_testee",
    status: "draft",
    visibility: body.visibility ?? "library",
    timed: body.timed ?? true,
    duration_minutes: body.duration_minutes ?? 30,
    pause_allowance: body.pause_allowance ?? 2,
    timeout_behaviour: body.timeout_behaviour ?? "auto_submit",
    max_pause_duration_minutes: body.max_pause_duration_minutes ?? 5,
    pass_threshold: body.pass_threshold ?? 0.7,
    target_difficulty: body.target_difficulty ?? 5,
    lock_mode: "open",
    campaign_id: null,
    benchmark_scope: body.benchmark_scope ?? null,
    benchmark_target_testee_id: body.benchmark_target_testee_id ?? null,
    randomise_question_order: body.randomise_question_order ?? false,
    randomise_option_order: body.randomise_option_order ?? false,
    pill_id: body.pill_id ?? null,
    created_at: ADMIN_ASSIGNMENT_ISO,
    updated_at: ADMIN_ASSIGNMENT_ISO,
  };
  nextAdminTestSeq += 1;
  mockAdminTests = [created, ...mockAdminTests];
  return HttpResponse.json(created, { status: 201 });
});

const adminTestUpdateHandler = http.patch(
  `${API}/v1/tests/:test_id`,
  async ({ params, request }) => {
    const idx = mockAdminTests.findIndex((x) => x.id === String(params.test_id));
    const existing = idx >= 0 ? mockAdminTests[idx] : undefined;
    if (idx < 0 || !existing) {
      return HttpResponse.json(
        { error: { code: "not_found", message: "Test not found.", detail: null } },
        { status: 404 },
      );
    }
    const body = (await request.json().catch(() => null)) as TestUpdateSchema | null;
    // TestUpdate doesn't carry `mode` or `status` — those are immutable
    // post-create on the wire. Only `name` + a handful of options are
    // PATCH-able.
    const next: TestResponseSchema = {
      ...existing,
      name: body?.name ?? existing.name,
      updated_at: ADMIN_ASSIGNMENT_ISO,
    };
    if (body && "pill_id" in body) {
      next.pill_id = body.pill_id ?? null;
    }
    mockAdminTests = [
      ...mockAdminTests.slice(0, idx),
      next,
      ...mockAdminTests.slice(idx + 1),
    ];
    return HttpResponse.json(next);
  },
);

const adminTestDeleteHandler = http.delete(`${API}/v1/tests/:test_id`, ({ params }) => {
  const before = mockAdminTests.length;
  mockAdminTests = mockAdminTests.filter((t) => t.id !== String(params.test_id));
  if (mockAdminTests.length === before) {
    return HttpResponse.json(
      { error: { code: "not_found", message: "Test not found.", detail: null } },
      { status: 404 },
    );
  }
  return new HttpResponse(null, { status: 204 });
});

const replaceMockTest = (next: TestResponseSchema): void => {
  const idx = mockAdminTests.findIndex((x) => x.id === next.id);
  if (idx < 0) return;
  mockAdminTests = [
    ...mockAdminTests.slice(0, idx),
    next,
    ...mockAdminTests.slice(idx + 1),
  ];
};

// `POST /v1/tests/{test_id}/publish` flips status draft → published.
const adminTestPublishHandler = http.post(
  `${API}/v1/tests/:test_id/publish`,
  ({ params }) => {
    const t = mockAdminTests.find((x) => x.id === String(params.test_id));
    if (!t) {
      return HttpResponse.json(
        { error: { code: "not_found", message: "Test not found.", detail: null } },
        { status: 404 },
      );
    }
    const next: TestResponseSchema = {
      ...t,
      status: "published",
      updated_at: ADMIN_ASSIGNMENT_ISO,
    };
    replaceMockTest(next);
    return HttpResponse.json(next);
  },
);

// `POST /v1/tests/{test_id}/lock` — wire surface only; ships disabled
// in v1 (Slice 12 drift Finding #1 — no `/v1/campaigns` endpoint to
// feed `CampaignLockRequest.campaign_id`). The handler still records
// the campaign-locked state so seed-based fixtures can exercise the
// derived "locked" status without going through the UI button.
const adminTestLockHandler = http.post(
  `${API}/v1/tests/:test_id/lock`,
  async ({ params, request }) => {
    const t = mockAdminTests.find((x) => x.id === String(params.test_id));
    if (!t) {
      return HttpResponse.json(
        { error: { code: "not_found", message: "Test not found.", detail: null } },
        { status: 404 },
      );
    }
    const body = (await request.json().catch(() => null)) as {
      campaign_id?: string;
    } | null;
    if (!body || typeof body.campaign_id !== "string") {
      return HttpResponse.json(
        {
          detail: [
            {
              loc: ["body", "campaign_id"],
              msg: "campaign_id required",
              type: "missing",
            },
          ],
        },
        { status: 422 },
      );
    }
    const next: TestResponseSchema = {
      ...t,
      lock_mode: "campaign-locked",
      campaign_id: body.campaign_id,
      updated_at: ADMIN_ASSIGNMENT_ISO,
    };
    replaceMockTest(next);
    return HttpResponse.json(next);
  },
);

const adminTestUnlockHandler = http.post(
  `${API}/v1/tests/:test_id/unlock`,
  ({ params }) => {
    const t = mockAdminTests.find((x) => x.id === String(params.test_id));
    if (!t) {
      return HttpResponse.json(
        { error: { code: "not_found", message: "Test not found.", detail: null } },
        { status: 404 },
      );
    }
    const next: TestResponseSchema = {
      ...t,
      lock_mode: "open",
      campaign_id: null,
      updated_at: ADMIN_ASSIGNMENT_ISO,
    };
    replaceMockTest(next);
    return HttpResponse.json(next);
  },
);

// `adminTestGetHandler` is registered separately in the `handlers`
// array (before `getTestHandler`) so it has first-dibs on `/v1/tests/
// :test_id` and falls through to the testee handler on a miss.
const adminTestsHandlers = [
  adminTestsListHandler,
  adminTestCreateHandler,
  adminTestUpdateHandler,
  adminTestDeleteHandler,
  adminTestPublishHandler,
  adminTestLockHandler,
  adminTestUnlockHandler,
];
// =============================================================
// Admin questions (FE-8 Slice 13 — §B.3 question editor modal)
// =============================================================
//
// `GET /v1/tests/{test_id}/questions` accepts no query params on the
// wire (Slice 13 drift sweep Finding #2) — the handler returns the
// whole pool in one call.
//
// The admin seed gives the frozen draft (id ...000000000003) two
// pre-existing questions so list + edit flows have something to
// exercise. Other seeded tests start with empty pools.

type QuestionResponseSchema = components["schemas"]["QuestionResponse"];
type QuestionCreateSchema = components["schemas"]["QuestionCreate"];
type QuestionUpdateSchema = components["schemas"]["QuestionUpdate"];

const adminQuestionId = (n: number): string =>
  `aaaa6666-aaaa-aaaa-aaaa-${String(n).padStart(12, "0")}`;

const frozenDraftTestId = adminTestId(3);
const DEFAULT_ADMIN_QUESTIONS: QuestionResponseSchema[] = [
  {
    id: adminQuestionId(1),
    test_id: frozenDraftTestId,
    type: "multiple_choice",
    config: {
      body: "Which mechanism best describes sacrificial anode cathodic protection?",
      pill_id: adminPillId(1),
      is_anchor: false,
      choices: [
        {
          id: "A",
          text: "Galvanic potential drives current from anode to cathode.",
          correct: true,
        },
        {
          id: "B",
          text: "Hydrogen overvoltage shifts the corrosion potential cathodically.",
          correct: false,
        },
        {
          id: "C",
          text: "Oxide film passivation eliminates anodic dissolution.",
          correct: false,
        },
      ],
    } as unknown as Record<string, never>,
    assigned_difficulty: 6,
    question_group_id: null,
    reference_image_url: null,
    reference_image_caption: null,
    created_at: ADMIN_ASSIGNMENT_ISO,
    updated_at: ADMIN_ASSIGNMENT_ISO,
  },
  {
    id: adminQuestionId(2),
    test_id: frozenDraftTestId,
    type: "true_false",
    config: {
      body: "Impressed current cathodic protection requires an external DC power source.",
      pill_id: adminPillId(1),
      is_anchor: true,
      correct: true,
    } as unknown as Record<string, never>,
    assigned_difficulty: 4,
    question_group_id: null,
    reference_image_url: null,
    reference_image_caption: null,
    created_at: ADMIN_ASSIGNMENT_ISO,
    updated_at: ADMIN_ASSIGNMENT_ISO,
  },
];

let mockAdminQuestions: QuestionResponseSchema[] = [...DEFAULT_ADMIN_QUESTIONS];
let nextAdminQuestionSeq = DEFAULT_ADMIN_QUESTIONS.length + 1;

export const setMockAdminQuestions = (qs: QuestionResponseSchema[]): void => {
  mockAdminQuestions = [...qs];
};
export const resetMockAdminQuestions = (): void => {
  mockAdminQuestions = [...DEFAULT_ADMIN_QUESTIONS];
  nextAdminQuestionSeq = DEFAULT_ADMIN_QUESTIONS.length + 1;
};
export const getMockAdminQuestions = (): QuestionResponseSchema[] => [
  ...mockAdminQuestions,
];

export const adminTestQuestionsListHandler = http.get(
  `${API}/v1/tests/:test_id/questions`,
  ({ params }) => {
    const testId = String(params.test_id);
    const data = mockAdminQuestions.filter((q) => q.test_id === testId);
    return HttpResponse.json({ data, meta: { next_cursor: null } });
  },
);

const adminQuestionCreateHandler = http.post(
  `${API}/v1/tests/:test_id/questions`,
  async ({ params, request }) => {
    const testId = String(params.test_id);
    const body = (await request.json().catch(() => null)) as QuestionCreateSchema | null;
    if (!body || typeof body.type !== "string") {
      return HttpResponse.json(
        { detail: [{ loc: ["body", "type"], msg: "type required", type: "missing" }] },
        { status: 422 },
      );
    }
    const created: QuestionResponseSchema = {
      id: adminQuestionId(nextAdminQuestionSeq),
      test_id: testId,
      type: body.type,
      config: body.config ?? ({} as Record<string, never>),
      assigned_difficulty: body.assigned_difficulty ?? 5,
      question_group_id: body.question_group_id ?? null,
      reference_image_url: null,
      reference_image_caption: null,
      created_at: ADMIN_ASSIGNMENT_ISO,
      updated_at: ADMIN_ASSIGNMENT_ISO,
    };
    nextAdminQuestionSeq += 1;
    mockAdminQuestions = [...mockAdminQuestions, created];
    return HttpResponse.json(created, { status: 201 });
  },
);

const adminQuestionUpdateHandler = http.patch(
  `${API}/v1/tests/:test_id/questions/:question_id`,
  async ({ params, request }) => {
    const idx = mockAdminQuestions.findIndex((q) => q.id === String(params.question_id));
    const existing = idx >= 0 ? mockAdminQuestions[idx] : undefined;
    if (idx < 0 || !existing) {
      return HttpResponse.json(
        { error: { code: "not_found", message: "Question not found.", detail: null } },
        { status: 404 },
      );
    }
    const body = (await request.json().catch(() => null)) as QuestionUpdateSchema | null;
    const next: QuestionResponseSchema = {
      ...existing,
      config: (body?.config ?? existing.config) as Record<string, never>,
      assigned_difficulty: body?.assigned_difficulty ?? existing.assigned_difficulty,
      question_group_id:
        body && "question_group_id" in body
          ? (body.question_group_id ?? null)
          : existing.question_group_id,
      updated_at: ADMIN_ASSIGNMENT_ISO,
    };
    mockAdminQuestions = [
      ...mockAdminQuestions.slice(0, idx),
      next,
      ...mockAdminQuestions.slice(idx + 1),
    ];
    return HttpResponse.json(next);
  },
);

const adminQuestionDeleteHandler = http.delete(
  `${API}/v1/tests/:test_id/questions/:question_id`,
  ({ params }) => {
    const before = mockAdminQuestions.length;
    mockAdminQuestions = mockAdminQuestions.filter(
      (q) => q.id !== String(params.question_id),
    );
    if (mockAdminQuestions.length === before) {
      return HttpResponse.json(
        { error: { code: "not_found", message: "Question not found.", detail: null } },
        { status: 404 },
      );
    }
    return new HttpResponse(null, { status: 204 });
  },
);

const adminQuestionsHandlers = [
  adminTestQuestionsListHandler,
  adminQuestionCreateHandler,
  adminQuestionUpdateHandler,
  adminQuestionDeleteHandler,
];

// ── FE-9 engagement (admin-ops §B.4) ──
// Enriched row + sweep shapes (§H(a) item 1 contract; landed in schema).
const mockEngagementRows: components["schemas"]["EngagementWidgetItem"][] = [
  {
    assignment_id: "00000000-0000-0000-0000-0000000eea01",
    testee_id: "00000000-0000-0000-0000-0000000eeb01",
    testee_name: "Naledi P.",
    pill_or_test_name: "Confined Space Entry",
    assigner_name: "Gys M.",
    created_at: "2026-04-25T09:00:00Z",
    deadline: "2026-05-02T09:00:00Z",
    is_mandatory: true,
    days_stale: 34,
    reminders_sent: 2,
    escalated: true,
  },
  {
    assignment_id: "00000000-0000-0000-0000-0000000eea02",
    testee_id: "00000000-0000-0000-0000-0000000eeb02",
    testee_name: "Kabelo R.",
    pill_or_test_name: "Antifouling Systems",
    assigner_name: "Jay V.",
    created_at: "2026-05-15T09:00:00Z",
    deadline: "2026-05-22T09:00:00Z",
    is_mandatory: true,
    days_stale: 14,
    reminders_sent: 1,
    escalated: false,
  },
];

const engagementPendingHandler = http.get(`${API}/v1/admin/engagement/pending`, () =>
  HttpResponse.json<components["schemas"]["EngagementWidgetResponse"]>({
    data: mockEngagementRows,
  }),
);

const engagementSweepHandler = http.post(`${API}/v1/admin/engagement/sweep`, () =>
  HttpResponse.json<components["schemas"]["SweepResult"]>({
    reminders_sent: 3,
    escalations_sent: 1,
    first_reminders_sent: 2,
    second_reminders_sent: 1,
    assignments_processed: 4,
    duration_ms: 312,
    last_swept_at: new Date().toISOString(),
  }),
);

const adminEngagementHandlers = [engagementPendingHandler, engagementSweepHandler];

// ── FE-9 grade reviews (admin-ops §B.2) ──
const mockGradeReviews: components["schemas"]["FlaggedGradeReviewItem"][] = [
  {
    grade_review_id: "00000000-0000-0000-0000-0000000d0a01",
    grade_id: "00000000-0000-0000-0000-0000000d0b01",
    attempt_id: "00000000-0000-0000-0000-0000000d0c01",
    question_id: "00000000-0000-0000-0000-0000000d0d01",
    testee_name: "Naledi P.",
    pill_name: "Confined Space Entry",
    question_prompt: "Describe the atmospheric tests required before entry.",
    rubric_extract: "Full credit: names O2, LEL, and toxic-gas tests in sequence.",
    testee_response: "Check oxygen levels and gas before going in.",
    band: 3,
    ai_score: 0.6,
    ai_verdict: "partial",
    ai_reasoning: "Mentions oxygen + gas but omits the LEL/sequence detail.",
    review_reasoning: "Response is too vague to credit partial — no sequence named.",
    created_at: "2026-05-27T09:00:00Z",
  },
  {
    grade_review_id: "00000000-0000-0000-0000-0000000d0a02",
    grade_id: "00000000-0000-0000-0000-0000000d0b02",
    attempt_id: "00000000-0000-0000-0000-0000000d0c02",
    question_id: "00000000-0000-0000-0000-0000000d0d02",
    testee_name: "Kabelo R.",
    pill_name: "Antifouling Systems",
    question_prompt:
      "Why is surface preparation critical before antifouling application?",
    rubric_extract: "Full credit: links adhesion failure to inadequate prep.",
    testee_response: "If you don't prep the surface the paint won't stick properly.",
    band: 2,
    ai_score: 1.0,
    ai_verdict: "full",
    ai_reasoning: "Correctly links prep to adhesion.",
    review_reasoning: "Answer lacks the corrosion-pathway depth the rubric expects.",
    created_at: "2026-05-28T14:30:00Z",
  },
];

const gradeReviewsFlaggedHandler = http.get(
  `${API}/v1/admin/grade-reviews/flagged`,
  ({ request }) => {
    const verdict = new URL(request.url).searchParams.get("verdict") ?? "flagged";
    // Mock view: confirmed is empty at baseline; flagged/all return the rows.
    const data = verdict === "confirmed" ? [] : mockGradeReviews;
    return HttpResponse.json<components["schemas"]["FlaggedGradeReviewListResponse"]>({
      data,
    });
  },
);

const gradeReviewResolveHandler = http.post(
  `${API}/v1/admin/grade-reviews/:grade_review_id/resolve`,
  async ({ params, request }) => {
    const id = String(params.grade_review_id);
    const row = mockGradeReviews.find((r) => r.grade_review_id === id);
    const body = (await request.json().catch(() => null)) as
      | components["schemas"]["GradeReviewResolveRequest"]
      | null;
    if (!row) {
      return HttpResponse.json(
        {
          error: {
            code: "REVIEW_ALREADY_RESOLVED",
            message: "This review was already resolved.",
            detail: null,
          },
        },
        { status: 409 },
      );
    }
    const action = body?.action ?? "keep_ai";
    const gradeScore =
      action === "accept_reviewer"
        ? 0
        : action === "substitute"
          ? (body?.score ?? row.ai_score)
          : row.ai_score;
    const gradeVerdict =
      action === "accept_reviewer"
        ? "none"
        : action === "substitute"
          ? (body?.verdict ?? row.ai_verdict)
          : row.ai_verdict;
    return HttpResponse.json<components["schemas"]["GradeReviewResolveResult"]>({
      grade_review_id: id,
      grade_id: row.grade_id,
      attempt_id: row.attempt_id,
      action,
      grade_score: gradeScore,
      grade_verdict: gradeVerdict,
      attempt_overall_score: 0.72,
      attempt_outcome: "pass",
    });
  },
);

const adminGradeReviewHandlers = [gradeReviewsFlaggedHandler, gradeReviewResolveHandler];

// ── FE-9 loop queue (admin-ops §B.3) ──
const mockLoopRows: components["schemas"]["LoopQueueItem"][] = [
  {
    weakness_report_id: "00000000-0000-0000-0000-0000000100a1",
    attempt_id: "00000000-0000-0000-0000-0000000100b1",
    testee_id: "00000000-0000-0000-0000-0000000100c1",
    testee_name: "Naledi P.",
    pill_id: "00000000-0000-0000-0000-0000000100d1",
    pill_name: "Confined Space Entry",
    overall_score: 0.42,
    weak_pill_ids: [
      "00000000-0000-0000-0000-0000000100d1",
      "00000000-0000-0000-0000-0000000100d2",
    ],
    loop_mode: "admin_reviewed",
    iteration: "1 of 1",
    last_attempt_at: "2026-05-28T10:00:00Z",
    status: "review",
    created_at: "2026-05-28T10:05:00Z",
  },
  {
    weakness_report_id: "00000000-0000-0000-0000-0000000100a2",
    attempt_id: "00000000-0000-0000-0000-0000000100b2",
    testee_id: "00000000-0000-0000-0000-0000000100c2",
    testee_name: "Kabelo R.",
    pill_id: "00000000-0000-0000-0000-0000000100d3",
    pill_name: "Antifouling Systems",
    overall_score: 0.55,
    weak_pill_ids: ["00000000-0000-0000-0000-0000000100d3"],
    loop_mode: "admin_reviewed",
    iteration: "2 of ∞",
    last_attempt_at: "2026-05-27T16:30:00Z",
    status: "queued",
    created_at: "2026-05-27T16:35:00Z",
  },
];

const loopQueueHandler = http.get(`${API}/v1/admin/loop/queue`, ({ request }) => {
  const status = new URL(request.url).searchParams.get("status");
  const data = status ? mockLoopRows.filter((r) => r.status === status) : mockLoopRows;
  return HttpResponse.json<components["schemas"]["LoopQueueListResponse"]>({ data });
});

const loopApproveHandler = http.post(
  `${API}/v1/admin/loop/queue/:weakness_report_id/approve`,
  ({ params }) => {
    const id = String(params.weakness_report_id);
    const row = mockLoopRows.find((r) => r.weakness_report_id === id);
    if (!row) {
      return HttpResponse.json(
        {
          error: {
            code: "LOOP_ALREADY_RESOLVED",
            message: "This loop was already resolved.",
            detail: null,
          },
        },
        { status: 409 },
      );
    }
    return HttpResponse.json<components["schemas"]["LoopApproveResult"]>({
      weakness_report_id: id,
      follow_up_count: row.weak_pill_ids.length || 1,
    });
  },
);

const loopRejectHandler = http.post(
  `${API}/v1/admin/loop/queue/:weakness_report_id/reject`,
  ({ params }) => {
    const id = String(params.weakness_report_id);
    if (!mockLoopRows.some((r) => r.weakness_report_id === id)) {
      return HttpResponse.json(
        {
          error: {
            code: "LOOP_ALREADY_RESOLVED",
            message: "This loop was already resolved.",
            detail: null,
          },
        },
        { status: 409 },
      );
    }
    return HttpResponse.json<components["schemas"]["LoopRejectResult"]>({
      weakness_report_id: id,
    });
  },
);

const adminLoopHandlers = [loopQueueHandler, loopApproveHandler, loopRejectHandler];

// ── FE-9 cost dashboard (admin-systems §B.1) ──
// The endpoint returns an untyped inline dict; the shape mirrors the
// locked `CostSummaryResponse` in `lib/queries/admin-cost.ts`.
const costSummaryHandler = http.get(`${API}/v1/admin/cost/summary`, () =>
  HttpResponse.json({
    since: "2026-05-01T00:00:00Z",
    year_month: "2026-05",
    total_usd: 14.32,
    by_provider: { anthropic: 12.1, openai: 2.22 },
    by_model: {
      "claude-sonnet-4-5": 12.1,
      "gpt-4o-mini": 1.5,
      "text-embedding-3-small": 0.72,
    },
    monthly_budget: 20.0,
    percent_of_budget: 71.6,
    alerts_fired_this_month: [50],
  }),
);

const adminCostHandlers = [costSummaryHandler];

// ── FE-9 anchor calibration (admin-systems §B.2) ──
const mockFlaggedAnchors: components["schemas"]["FlaggedAnchorItem"][] = [
  {
    anchor_question_id: "00000000-0000-0000-0000-0000000ca0a1",
    pill_id: "00000000-0000-0000-0000-0000000ca0p1",
    pill_name: "Cathodic Protection",
    band: 3,
    type: "mcq",
    config: {},
    assigned_difficulty: 6,
    regeneration_attempts: 2,
    excluded: true,
    excluded_reason: "Failed review: ambiguous correct option after 2 regenerations.",
    created_at: "2026-05-26T08:00:00Z",
  },
  {
    anchor_question_id: "00000000-0000-0000-0000-0000000ca0a2",
    pill_id: "00000000-0000-0000-0000-0000000ca0p1",
    pill_name: "Cathodic Protection",
    band: 4,
    type: "short_answer",
    config: {},
    assigned_difficulty: 8,
    regeneration_attempts: 1,
    excluded: true,
    excluded_reason: "Rubric drift flagged during generate-and-review.",
    created_at: "2026-05-26T09:00:00Z",
  },
  {
    anchor_question_id: "00000000-0000-0000-0000-0000000ca0a3",
    pill_id: "00000000-0000-0000-0000-0000000ca0p2",
    pill_name: "Antifouling Systems",
    band: 2,
    type: "mcq",
    config: {},
    assigned_difficulty: 4,
    regeneration_attempts: 3,
    excluded: true,
    excluded_reason: "Exhausted regeneration attempts.",
    created_at: "2026-05-26T10:00:00Z",
  },
];

const anchorsFlaggedHandler = http.get(`${API}/v1/admin/anchors/flagged`, () =>
  HttpResponse.json<components["schemas"]["FlaggedAnchorListResponse"]>({
    data: mockFlaggedAnchors,
  }),
);

const calibrationRunHandler = http.post(`${API}/v1/admin/calibration/run`, () =>
  HttpResponse.json<components["schemas"]["CalibrationSweepResult"]>({
    anchors_processed: 2740,
    anchors_updated: 142,
    anchors_skipped_no_observations: 18,
    mean_n: 12.4,
    mean_effective_difficulty: 5.6,
  }),
);

const anchorResolveHandler = http.post(
  `${API}/v1/admin/anchors/:anchor_id/resolve`,
  async ({ params, request }) => {
    const id = String(params.anchor_id);
    const row = mockFlaggedAnchors.find((r) => r.anchor_question_id === id);
    const body = (await request.json().catch(() => null)) as
      | components["schemas"]["AnchorResolveRequest"]
      | null;
    if (!row) {
      return HttpResponse.json(
        {
          error: {
            code: "ANCHOR_ALREADY_RESOLVED",
            message: "Anchor was already resolved.",
            detail: null,
          },
        },
        { status: 409 },
      );
    }
    const action = body?.action ?? "keep";
    return HttpResponse.json<components["schemas"]["AnchorResolveResult"]>({
      anchor_question_id: id,
      action,
      excluded: action === "reject",
      needs_admin_attention: false,
      regeneration_attempts: row.regeneration_attempts,
    });
  },
);

const adminCalibrationHandlers = [
  anchorsFlaggedHandler,
  calibrationRunHandler,
  anchorResolveHandler,
];

// ── FE-9 system operations (admin-systems §B.3) ──
const driveIndexHandler = http.get(`${API}/v1/admin/drive/index`, () =>
  HttpResponse.json<components["schemas"]["DriveIndexStatus"]>({
    chunks: 4120,
    files: 412,
    last_indexed_at: "2026-05-29T18:00:00Z",
  }),
);

const driveIngestRunHandler = http.post(`${API}/v1/admin/drive/ingest`, () =>
  HttpResponse.json<components["schemas"]["DriveIngestResult"]>({
    files_seen: 412,
    files_unchanged: 402,
    files_added: 7,
    files_changed: 3,
    files_deleted: 0,
    files_failed: 0,
    chunks_added: 84,
    chunks_deleted: 0,
    embed_calls: 84,
  }),
);

const realismStatusHandler = http.get(`${API}/v1/admin/realism/status`, () =>
  HttpResponse.json<components["schemas"]["RealismStatusResponse"]>({
    last_aggregated_at: "2026-05-29T02:00:00Z",
    flags_processed_last_run: 38,
    below_threshold_count: 4,
    auto_suppressed_count: 1,
    total_flag_count_active: 52,
  }),
);

const realismAggregateRunHandler = http.post(`${API}/v1/admin/realism/aggregate`, () =>
  HttpResponse.json<components["schemas"]["RealismAggregationResult"]>({
    flags_processed: 38,
    questions_updated: 6,
    anchors_excluded: 1,
    anchor_questions_seen: 240,
  }),
);

const safetyLinkCheckRunHandler = http.post(`${API}/v1/admin/safety-links/check`, () =>
  HttpResponse.json<components["schemas"]["SafetyLinkCheckResult"]>({
    links_checked: 96,
    links_broken_replaced: 2,
    links_drift_flagged: 3,
    links_unchanged: 91,
  }),
);

const bootstrapRunHandler = http.post(`${API}/v1/admin/bootstrap/run`, () =>
  HttpResponse.json<components["schemas"]["BootstrapRunResult"]>({
    pills_processed: 137,
    anchors_generated: 2740,
    anchors_excluded: 14,
    safety_pills_curated: 18,
    safety_links_added: 54,
    drive_step_ran: true,
    drive_files_seen: 412,
    drive_files_changed: 3,
    drive_files_added: 7,
    drive_files_deleted: 0,
    duration_seconds: 184,
  }),
);

const adminSystemHandlers = [
  driveIndexHandler,
  driveIngestRunHandler,
  realismStatusHandler,
  realismAggregateRunHandler,
  safetyLinkCheckRunHandler,
  bootstrapRunHandler,
];

// --- N4: GET /v1/me/assignments (testee-scoped) ----------------------
// Append-only. Default empty list; tests inject rows via
// setMockMeAssignments / force errors via setMeAssignmentsStatus.
// Inline import types so no top-of-file import edit is required.
type MeAssignmentsPage =
  import("@/lib/api/types").components["schemas"]["Page_AssignmentResponse_"];
type MeAssignmentItem =
  import("@/lib/api/types").components["schemas"]["AssignmentResponse"];

let mockMeAssignments: MeAssignmentsPage = {
  data: [],
  meta: { next_cursor: null },
};
let meAssignmentsStatus = 200;

export const setMockMeAssignments = (data: MeAssignmentItem[]): void => {
  mockMeAssignments = { data, meta: { next_cursor: null } };
};

export const setMeAssignmentsStatus = (status: number): void => {
  meAssignmentsStatus = status;
};

export const resetMockMeAssignments = (): void => {
  mockMeAssignments = { data: [], meta: { next_cursor: null } };
  meAssignmentsStatus = 200;
};

export const getMockMeAssignments = (): MeAssignmentsPage => mockMeAssignments;

export const meAssignmentsHandler = http.get(`${API}/v1/me/assignments`, () => {
  if (meAssignmentsStatus !== 200) {
    return HttpResponse.json(
      {
        error: {
          code: meAssignmentsStatus === 404 ? "not_found" : "internal",
          message: "Me assignments unavailable.",
          detail: null,
        },
      },
      { status: meAssignmentsStatus },
    );
  }
  return HttpResponse.json(mockMeAssignments);
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
  // `adminTestGetHandler` (admin editor) shares `/v1/tests/:test_id`
  // with `getTestHandler` (testee attempt runner). Slice 12 registers
  // the admin variant first; it returns `undefined` on a miss against
  // the admin seed, letting MSW fall through to the testee handler.
  // Admin seed IDs are `ffff5555-…`; testee seed IDs are distinct, so
  // both surfaces stay isolated.
  adminTestGetHandler,
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
  meAssignmentsHandler,
  // FE-8 admin stubs — order doesn't matter (no path collisions with
  // the testee surfaces above; `/v1/pills` differs from
  // `/v1/catalogue/pills`, etc.). `adminTestsListHandler` (`/v1/tests`)
  // sits AFTER `resolveTestHandler` + `getTestHandler` for the same
  // resolve-before-list discipline.
  ...adminPillsHandlers,
  ...adminSubjectsHandlers,
  ...adminProposalsHandlers,
  ...adminPathsHandlers,
  ...adminUsersHandlers,
  ...adminGroupsHandlers,
  ...adminAssignmentsHandlers,
  ...adminTestsHandlers,
  ...adminQuestionsHandlers,
  ...adminEngagementHandlers,
  ...adminGradeReviewHandlers,
  ...adminLoopHandlers,
  ...adminCostHandlers,
  ...adminCalibrationHandlers,
  ...adminSystemHandlers,
];
