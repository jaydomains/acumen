/**
 * Frontend runtime config (AC-CD19).
 *
 * Two flavours of env var: `NEXT_PUBLIC_*` is shipped to the browser
 * (and inlined at build time); the rest is server-only.
 *
 * The browser uses `apiBaseUrl`; server components / route handlers
 * may use `apiBaseUrlServer` to talk to the backend via the compose
 * network. The two are the same on a developer's laptop and diverge
 * inside docker compose.
 */

const required = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
};

export const config = {
  apiBaseUrl: required(process.env.NEXT_PUBLIC_API_BASE_URL, "NEXT_PUBLIC_API_BASE_URL"),
  apiBaseUrlServer: process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL,
} as const;
