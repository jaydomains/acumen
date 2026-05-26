/**
 * MSW request handler registry (FE-1 §D, AC-CD15).
 *
 * Slice A ships only the `/v1/auth/me` 401 default so layouts can
 * resolve identity without a live backend. Later slices append login,
 * password-reset, setup, and privacy handlers; the round-trip test in
 * Slice E layers a stateful scenario on top.
 */

import { http, HttpResponse } from "msw";
import { config } from "@/lib/config";

const API = config.apiBaseUrl;

export const meUnauthenticatedHandler = http.get(`${API}/v1/auth/me`, () =>
  HttpResponse.json(
    {
      error: {
        code: "not_authenticated",
        message: "Not authenticated",
        detail: null,
      },
    },
    { status: 401 },
  ),
);

export const handlers = [meUnauthenticatedHandler];
