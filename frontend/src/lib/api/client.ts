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
 *
 * The base URL is set at runtime via `setApiBaseUrl` (called by
 * ConfigProvider after /api/config resolves). openapi-fetch is created
 * with `baseUrl: ""` so the paths it concatenates pass through to our
 * fetch as plain "/v1/..." strings, and we prepend the runtime URL.
 */

import createClient from "openapi-fetch";
import { ApiError, apiErrorFromBody } from "@/lib/api/errors";
import { getAccessToken } from "@/lib/auth/storage";
import { refreshAccessToken } from "@/lib/auth/refresh";
import type { paths } from "@/types/api";

/**
 * Placeholder absolute URL used as openapi-fetch's `baseUrl`.
 *
 * openapi-fetch constructs a `Request` before invoking our custom
 * fetch, and `Request` requires an absolute URL. We can't read the
 * real backend URL at module-load time (it's fetched at runtime by
 * ConfigProvider), so we hand openapi-fetch this placeholder and
 * substitute it with `runtimeBaseUrl` inside `authRetryFetch`.
 *
 * The string is intentionally unusable as a real host so a leak
 * (request escaping the substitution path) is obvious in any log.
 */
const PLACEHOLDER_BASE_URL = "http://acumen-runtime-config-unresolved.invalid";

let runtimeBaseUrl: string | null = null;

export const setApiBaseUrl = (url: string): void => {
  runtimeBaseUrl = url.replace(/\/$/, "");
};

export const getApiBaseUrl = (): string => {
  if (!runtimeBaseUrl) {
    throw new Error("API base URL accessed before runtime config resolved");
  }
  return runtimeBaseUrl;
};

const buildHeaders = (init: RequestInit | undefined, token: string | null) => {
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
};

const rewriteUrl = (rawUrl: string): string =>
  rawUrl.startsWith(PLACEHOLDER_BASE_URL)
    ? `${getApiBaseUrl()}${rawUrl.slice(PLACEHOLDER_BASE_URL.length)}`
    : rawUrl;

/**
 * Custom fetch handed to openapi-fetch. Attaches the current in-memory
 * access token; on a 401, kicks the dedup-refresh path and re-issues
 * the original request once with the new token.
 *
 * openapi-fetch constructs a `Request` with the placeholder baseUrl
 * (Request requires an absolute URL at construction time, and the
 * runtime URL is not available yet at module load). We rebuild the
 * Request here with the resolved runtime URL before delegating to
 * the real fetch.
 *
 * The body is buffered into an ArrayBuffer up front so the 401 retry
 * can replay it. `Request.body` is a `ReadableStream` — single-use —
 * so reusing it for the retry would send an empty body on every
 * authenticated mutation (silent: server rejects with 422).
 */
const authRetryFetch: typeof fetch = async (input, init) => {
  const incomingRequest = input instanceof Request ? input : new Request(input, init);
  const targetUrl = rewriteUrl(incomingRequest.url);
  const bodyBytes = incomingRequest.body
    ? await new Response(incomingRequest.body).arrayBuffer()
    : null;

  const issue = async (token: string | null): Promise<Response> =>
    fetch(
      new Request(targetUrl, {
        method: incomingRequest.method,
        headers: buildHeaders({ headers: incomingRequest.headers }, token),
        body: bodyBytes,
        credentials: incomingRequest.credentials,
        cache: incomingRequest.cache,
        redirect: incomingRequest.redirect,
        referrer: incomingRequest.referrer,
        integrity: incomingRequest.integrity,
        signal: incomingRequest.signal,
      }),
    );

  let response = await issue(getAccessToken());

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await issue(refreshed);
    }
  }
  return response;
};

/** Typed openapi-fetch client. The placeholder baseUrl is rewritten
 * to the runtime backend URL inside authRetryFetch. */
export const client = createClient<paths>({
  baseUrl: PLACEHOLDER_BASE_URL,
  fetch: authRetryFetch,
});

/**
 * Throw an `ApiError` (parsed from the uniform error envelope) on a
 * non-ok response; otherwise return the typed `data`.
 *
 * openapi-fetch consumes the response body internally to populate
 * `result.data` / `result.error`, so we MUST build the ApiError from
 * the already-parsed `result.error` rather than re-reading
 * `result.response` (whose body stream is exhausted).
 */
export const unwrap = async <D, E>(
  call: Promise<{ data?: D; error?: E; response: Response }>,
): Promise<D> => {
  const result = await call;
  if (!result.response.ok) {
    throw apiErrorFromBody(
      result.response.status,
      result.response.statusText,
      result.error,
      result.response.headers.get("x-acumen-trace"),
    );
  }
  return result.data as D;
};

export { ApiError };
