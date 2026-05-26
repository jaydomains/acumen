/**
 * client.ts regression tests.
 *
 * The 401-refresh-retry path consumes the request body twice — once
 * for the initial fetch, once for the retry. `Request.body` is a
 * single-use `ReadableStream`, so client.ts buffers the body into an
 * ArrayBuffer up front. Without that, the retry sends an empty body
 * and every authenticated mutation silently fails server-side with a
 * 422 (caught by Gitar on PR #53).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/node";
import { client } from "@/lib/api/client";
import { clearTokens, setAccessToken, setRefreshToken } from "@/lib/auth/storage";

beforeEach(() => {
  window.localStorage.clear();
  clearTokens();
});

afterEach(() => {
  clearTokens();
});

describe("client 401 retry preserves request body", () => {
  it("replays the original POST body on the refresh-retry call", async () => {
    setAccessToken("stale-token");
    setRefreshToken("refresh-token");

    const seenBodies: { token: string | null; body: unknown }[] = [];

    server.use(
      http.post("http://localhost:8000/v1/auth/refresh", () =>
        HttpResponse.json({ access_token: "fresh-token", token_type: "bearer" }),
      ),
      http.post("http://localhost:8000/v1/auth/login", async ({ request }) => {
        const auth = request.headers.get("Authorization");
        const token = auth?.replace(/^Bearer /, "") ?? null;
        const body = await request.json();
        seenBodies.push({ token, body });
        if (token === "stale-token") {
          return HttpResponse.json(
            {
              error: {
                code: "not_authenticated",
                message: "stale",
                detail: null,
              },
            },
            { status: 401 },
          );
        }
        return HttpResponse.json({
          access_token: "x",
          refresh_token: "y",
          token_type: "bearer",
        });
      }),
    );

    const result = await client.POST("/v1/auth/login", {
      body: { email: "user@example.com", password: "hunter2" },
    });

    expect(result.response.status).toBe(200);
    expect(seenBodies).toHaveLength(2);
    // Both attempts must carry the same body — the retry was empty
    // before the bodyBytes buffering fix.
    expect(seenBodies[0]).toEqual({
      token: "stale-token",
      body: { email: "user@example.com", password: "hunter2" },
    });
    expect(seenBodies[1]).toEqual({
      token: "fresh-token",
      body: { email: "user@example.com", password: "hunter2" },
    });
  });
});
