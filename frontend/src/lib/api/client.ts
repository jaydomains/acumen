/**
 * Typed fetch wrapper over the backend's OpenAPI surface (AC-CD19).
 *
 * The generated `paths` type at `@/types/api` is the source of truth
 * for endpoint URLs, methods, request bodies, and response shapes.
 * This wrapper is a thin adapter that:
 *
 *  - attaches the in-memory access token to every request,
 *  - parses the uniform error envelope into typed `ApiError` instances,
 *  - de-duplicates refresh on 401 via `refreshAccessToken`,
 *  - retries a single time after a successful refresh.
 *
 * Endpoints accept a path-template string typed against `paths`; the
 * caller passes `body` and `query` when the endpoint expects them.
 */

import { config } from "@/lib/config";
import { ApiError, parseError } from "@/lib/api/errors";
import { getAccessToken } from "@/lib/auth/storage";
import { refreshAccessToken } from "@/lib/auth/refresh";
import type { paths } from "@/types/api";

type Method = "get" | "post" | "patch" | "delete";

type RequestOptions = {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  signal?: AbortSignal;
};

const buildUrl = (path: string, query?: RequestOptions["query"]): string => {
  const url = new URL(`${config.apiBaseUrl}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
};

const doFetch = async (
  method: Method,
  url: string,
  opts: RequestOptions,
  bearer: string | null,
): Promise<Response> => {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (bearer) headers["Authorization"] = `Bearer ${bearer}`;

  const init: RequestInit = { method: method.toUpperCase(), headers };
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
  if (opts.signal) init.signal = opts.signal;
  return fetch(url, init);
};

const request = async <T>(
  method: Method,
  path: string,
  opts: RequestOptions = {},
): Promise<T> => {
  const url = buildUrl(path, opts.query);
  let resp = await doFetch(method, url, opts, getAccessToken());

  if (resp.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      resp = await doFetch(method, url, opts, refreshed);
    }
  }

  if (!resp.ok) throw await parseError(resp);
  if (resp.status === 204) return undefined as T;

  const text = await resp.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
};

/**
 * Strongly-typed verb helpers. Each takes a path key from the generated
 * `paths` type so the URL string is checked at compile time.
 */
export const api = {
  get: <P extends keyof paths>(path: P, opts?: RequestOptions): Promise<unknown> =>
    request("get", path as string, opts),
  post: <P extends keyof paths>(path: P, opts?: RequestOptions): Promise<unknown> =>
    request("post", path as string, opts),
  patch: <P extends keyof paths>(path: P, opts?: RequestOptions): Promise<unknown> =>
    request("patch", path as string, opts),
  delete: <P extends keyof paths>(path: P, opts?: RequestOptions): Promise<unknown> =>
    request("delete", path as string, opts),
} as const;

export { ApiError };
