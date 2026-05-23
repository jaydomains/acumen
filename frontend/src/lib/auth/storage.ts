/**
 * Token storage adapter (AC-CD19).
 *
 * The access token lives in JS memory (a module-level variable
 * intentionally not exposed). The refresh token lives in localStorage
 * so the user stays logged in across reloads. AC-CD19's v1.x upgrade
 * path replaces this whole file with cookie-based attachment.
 *
 * SSR safety: `window` is undefined during server rendering, so every
 * localStorage call is guarded.
 */

const REFRESH_KEY = "acumen.refresh_token";

let accessTokenInMemory: string | null = null;

export const setAccessToken = (token: string | null): void => {
  accessTokenInMemory = token;
};

export const getAccessToken = (): string | null => accessTokenInMemory;

export const setRefreshToken = (token: string | null): void => {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(REFRESH_KEY, token);
  } else {
    window.localStorage.removeItem(REFRESH_KEY);
  }
};

export const getRefreshToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_KEY);
};

export const clearTokens = (): void => {
  setAccessToken(null);
  setRefreshToken(null);
};
