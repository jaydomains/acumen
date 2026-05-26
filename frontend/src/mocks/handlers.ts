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
];
