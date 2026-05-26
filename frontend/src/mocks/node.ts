/**
 * MSW node entrypoint for Vitest (FE-1 §D, AC-CD15).
 *
 * The shared `server` instance is started, reset, and stopped by
 * tests/setup.ts. Individual tests override handlers with
 * `server.use(...)`; `resetHandlers()` between tests restores the
 * Slice A default registry.
 */

import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
