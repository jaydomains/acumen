/**
 * Scaffold smoke (AC-CD19).
 *
 * Asserts the foundation modules import cleanly and that the token-
 * storage adapter behaves correctly in the SSR-safe path. Real
 * component coverage lands when real pages do.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from "@/lib/auth/storage";
import { ApiError, apiErrorFromBody, parseError } from "@/lib/api/errors";
import { MSW_FALLBACK_CONFIG, getRuntimeConfig, setRuntimeConfig } from "@/lib/config";

describe("auth/storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearTokens();
  });

  it("round-trips the in-memory access token", () => {
    expect(getAccessToken()).toBeNull();
    setAccessToken("abc");
    expect(getAccessToken()).toBe("abc");
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });

  it("persists the refresh token to localStorage", () => {
    expect(getRefreshToken()).toBeNull();
    setRefreshToken("xyz");
    expect(window.localStorage.getItem("acumen.refresh_token")).toBe("xyz");
    expect(getRefreshToken()).toBe("xyz");
    setRefreshToken(null);
    expect(window.localStorage.getItem("acumen.refresh_token")).toBeNull();
  });

  it("clearTokens wipes both stores", () => {
    setAccessToken("a");
    setRefreshToken("r");
    clearTokens();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});

describe("api/errors", () => {
  it("parses the backend error envelope into a typed ApiError", async () => {
    const body = {
      error: { code: "invalid_credentials", message: "no", detail: null },
    };
    const resp = new Response(JSON.stringify(body), { status: 401 });
    const err = await parseError(resp);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(err.code).toBe("invalid_credentials");
    expect(err.message).toBe("no");
  });

  it("falls back to an unknown-code error when the body is not enveloped", async () => {
    const resp = new Response("plain text", { status: 500 });
    const err = await parseError(resp);
    expect(err.code).toBe("unknown");
    expect(err.status).toBe(500);
  });

  it("apiErrorFromBody constructs an ApiError from an already-parsed envelope", () => {
    // Path used by client.unwrap(): openapi-fetch has already consumed
    // the response body into `result.error`, so we build the ApiError
    // from the pre-parsed body rather than re-reading the response.
    const body = {
      error: { code: "invalid_credentials", message: "no", detail: { hint: "x" } },
    };
    const err = apiErrorFromBody(401, "Unauthorized", body);
    expect(err.status).toBe(401);
    expect(err.code).toBe("invalid_credentials");
    expect(err.message).toBe("no");
    expect(err.detail).toEqual({ hint: "x" });
  });

  it("apiErrorFromBody falls back to unknown-code on a non-enveloped body", () => {
    const err = apiErrorFromBody(500, "Internal Server Error", "plain string");
    expect(err.code).toBe("unknown");
    expect(err.status).toBe(500);
    expect(err.detail).toBe("plain string");
  });
});

describe("config", () => {
  it("getRuntimeConfig returns the value set by setRuntimeConfig", () => {
    setRuntimeConfig({ apiBaseUrl: "https://example.test" });
    expect(getRuntimeConfig().apiBaseUrl).toBe("https://example.test");
    // Restore for downstream tests — tests/setup.ts primes the fallback
    // in beforeAll; reset it here so per-file ordering doesn't matter.
    setRuntimeConfig(MSW_FALLBACK_CONFIG);
  });
});
