/**
 * Vitest global setup (FE-1 §D, AC-CD15).
 *
 * Boots a single MSW node server shared across all test files. Default
 * handlers from `src/mocks/handlers.ts` are restored between tests; a
 * test can override per-call with `server.use(...)`.
 *
 * Tests must not hit the network (AC-CD15 conftest mirror) — the
 * `onUnhandledRequest: "error"` mode enforces this. The
 * `NEXT_PUBLIC_API_BASE_URL` env var is injected by vitest.config.ts
 * because module imports hoist above any top-level statements here.
 */

import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "@/mocks/node";
import { resetMockAuthState } from "@/mocks/handlers";

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
  resetMockAuthState();
});

afterAll(() => {
  server.close();
});
