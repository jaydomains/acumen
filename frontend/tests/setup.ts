/**
 * Vitest global setup (FE-1 §D, AC-CD15).
 *
 * Boots a single MSW node server shared across all test files. Default
 * handlers from `src/mocks/handlers.ts` are restored between tests; a
 * test can override per-call with `server.use(...)`.
 *
 * Tests must not hit the network (AC-CD15 conftest mirror) — the
 * `onUnhandledRequest: "error"` mode enforces this. Runtime config is
 * primed synchronously here (matching `MSW_FALLBACK_CONFIG`) so tests
 * that mount AuthProvider directly don't need a ConfigProvider wrapper.
 */

import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "@/mocks/node";
import {
  resetMockAttemptState,
  resetMockAuthState,
  resetMockCatalogue,
  resetMockMeAttempts,
  resetMockMeCompetence,
} from "@/mocks/handlers";
import { MSW_FALLBACK_CONFIG, setRuntimeConfig } from "@/lib/config";
import { setApiBaseUrl } from "@/lib/api/client";

beforeAll(() => {
  setRuntimeConfig(MSW_FALLBACK_CONFIG);
  setApiBaseUrl(MSW_FALLBACK_CONFIG.apiBaseUrl);
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
  resetMockAuthState();
  resetMockCatalogue();
  resetMockAttemptState();
  resetMockMeCompetence();
  resetMockMeAttempts();
});

afterAll(() => {
  server.close();
});
