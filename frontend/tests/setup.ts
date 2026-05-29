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

// Radix Select uses Pointer Events APIs that jsdom doesn't implement
// (`hasPointerCapture` / `releasePointerCapture` / `scrollIntoView`).
// Patch them as no-ops so Radix-driven dropdowns work under user-event
// in Slice 3+ tests. See radix-ui/primitives#2034.
if (typeof Element !== "undefined") {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}
import { server } from "@/mocks/node";
import {
  resetMockAdminAssignments,
  resetMockAdminGroups,
  resetMockAdminPaths,
  resetMockAdminPills,
  resetMockAdminProposals,
  resetMockAdminQuestions,
  resetMockAdminSubjects,
  resetMockAdminTests,
  resetMockAdminUsers,
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
  // FE-8 admin seeds — Slice 14 fix per drift sweep Finding #2. Without
  // these the round-trip tests leak state into the next test file (or
  // vice versa) because Slice 12+ added stateful CRUD handlers (tests,
  // questions) on top of the existing admin domains. Each page test
  // resets locally; round-trips mount multiple pages and mutate
  // multiple seeds.
  resetMockAdminSubjects();
  resetMockAdminPills();
  resetMockAdminProposals();
  resetMockAdminPaths();
  resetMockAdminUsers();
  resetMockAdminGroups();
  resetMockAdminTests();
  resetMockAdminAssignments();
  resetMockAdminQuestions();
});

afterAll(() => {
  server.close();
});
