/**
 * Frontend runtime config (AC-CD19).
 *
 * Values are fetched at app boot from same-origin /api/config rather
 * than baked in at build time. The same Docker image deploys against
 * any backend by changing the frontend container's runtime env — no
 * rebuild needed (multi-tenant).
 *
 * Flow: ConfigProvider mounts → fetches /api/config → calls
 * `setRuntimeConfig` → children render. By construction no component
 * reads config before it is set. The "accessed before bootstrap"
 * throw exists to make a sequencing regression LOUD, not silent.
 *
 * NOTE: React Server Components must NOT call `getRuntimeConfig()` —
 * the runtime store is per-process and unset on the server. RSCs that
 * need the backend URL should read `process.env.API_BASE_URL` directly.
 */

export type RuntimeConfig = {
  apiBaseUrl: string;
};

let resolved: RuntimeConfig | null = null;

export const setRuntimeConfig = (cfg: RuntimeConfig): void => {
  resolved = cfg;
};

export const getRuntimeConfig = (): RuntimeConfig => {
  if (!resolved) {
    throw new Error("Runtime config accessed before bootstrap resolved");
  }
  return resolved;
};

/**
 * MSW dev/test escape hatch. In `NEXT_PUBLIC_API_MOCKING=enabled`
 * mode and under Vitest, the API base URL is a known static value;
 * ConfigProvider short-circuits to this and never fetches.
 */
export const MSW_FALLBACK_CONFIG: RuntimeConfig = {
  apiBaseUrl: "http://localhost:8000",
};
