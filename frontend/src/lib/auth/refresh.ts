/**
 * Refresh-flow coordinator (AC-CD19).
 *
 * The backend's refresh token does not rotate, so a single shared
 * in-flight promise is enough to dedupe concurrent 401s. Callers race
 * for the same `Promise<string | null>`: the winner kicks off the
 * actual `/v1/auth/refresh` call; the rest await the same promise.
 *
 * Returns the new access token on success, or `null` on failure (in
 * which case the caller should clear identity and route to login).
 */

import { config } from "@/lib/config";
import { clearTokens, getRefreshToken, setAccessToken } from "@/lib/auth/storage";

let inflight: Promise<string | null> | null = null;

const doRefresh = async (): Promise<string | null> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const resp = await fetch(`${config.apiBaseUrl}/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!resp.ok) {
    clearTokens();
    return null;
  }

  const data = (await resp.json()) as { access_token: string };
  setAccessToken(data.access_token);
  return data.access_token;
};

export const refreshAccessToken = (): Promise<string | null> => {
  if (!inflight) {
    inflight = doRefresh().finally(() => {
      inflight = null;
    });
  }
  return inflight;
};
