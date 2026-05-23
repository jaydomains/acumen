/**
 * Typed API client (AC-CD19).
 *
 * Wraps `openapi-fetch` with the project's two cross-cutting concerns:
 *  - attach the in-memory access token to every outbound request,
 *  - on a 401, dedup-refresh and re-issue the request once with the
 *    new token.
 *
 * Callers use `client.GET` / `client.POST` / `client.PATCH` /
 * `client.DELETE` — endpoint paths, path/query params, request bodies,
 * and response shapes are all typed directly from the generated
 * `paths`. Wrap a call in `unwrap` to throw an `ApiError` on non-ok
 * responses and receive the typed `data` on ok.
 *
 *   const me = await unwrap(client.GET("/v1/auth/me"));
 *   // me is typed as UserResponse — no cast needed.
 */

import createClient from "openapi-fetch";
import { config } from "@/lib/config";
import { ApiError, parseError } from "@/lib/api/errors";
import { getAccessToken } from "@/lib/auth/storage";
import { refreshAccessToken } from "@/lib/auth/refresh";
import type { paths } from "@/types/api";

const buildHeaders = (init: RequestInit | undefined, token: string | null) => {
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
};

/**
 * Custom fetch handed to openapi-fetch. Attaches the current in-memory
 * access token; on a 401, kicks the dedup-refresh path and re-issues
 * the original request once with the new token. openapi-fetch passes
 * a string URL and a JSON-stringified body, so the retry can reuse
 * `init` verbatim.
 */
const authRetryFetch: typeof fetch = async (input, init) => {
  let response = await fetch(input, {
    ...init,
    headers: buildHeaders(init, getAccessToken()),
  });

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await fetch(input, {
        ...init,
        headers: buildHeaders(init, refreshed),
      });
    }
  }
  return response;
};

/** Typed openapi-fetch client. */
export const client = createClient<paths>({
  baseUrl: config.apiBaseUrl,
  fetch: authRetryFetch,
});

/**
 * Throw an `ApiError` (parsed from the uniform error envelope) on a
 * non-ok response; otherwise return the typed `data`.
 */
export const unwrap = async <D, E>(
  call: Promise<{ data?: D; error?: E; response: Response }>,
): Promise<D> => {
  const result = await call;
  if (!result.response.ok) throw await parseError(result.response);
  return result.data as D;
};

export { ApiError };
