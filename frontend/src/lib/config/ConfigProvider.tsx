/**
 * Runtime config boot gate (AC-CD19).
 *
 * Fetches same-origin `/api/config` on mount, stores the result via
 * `setRuntimeConfig`, and primes the API client's runtime base URL.
 * Renders `null` during the brief async window (mirrors MSWProvider's
 * pre-ready gate); renders an error screen if the fetch fails — there
 * is no baked-in fallback because silently routing prod users to
 * `localhost` would be worse than surfacing the problem.
 *
 * Under `NEXT_PUBLIC_API_MOCKING=enabled` the fetch is skipped — MSW
 * tests and the in-browser MSW dev mode use the known static value
 * from `MSW_FALLBACK_CONFIG`.
 */

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { MSW_FALLBACK_CONFIG, setRuntimeConfig, type RuntimeConfig } from "@/lib/config";
import { setApiBaseUrl } from "@/lib/api/client";

const MSW_ENABLED = process.env.NEXT_PUBLIC_API_MOCKING === "enabled";

type Status = "loading" | "ready" | "error";

const applyConfig = (cfg: RuntimeConfig): void => {
  setRuntimeConfig(cfg);
  setApiBaseUrl(cfg.apiBaseUrl);
};

const ConfigErrorScreen = (): React.JSX.Element => (
  <div
    role="alert"
    style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem",
      textAlign: "center",
      fontFamily: "system-ui, sans-serif",
    }}
  >
    <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
      Acumen could not start
    </h1>
    <p style={{ marginBottom: "1rem", maxWidth: "32rem" }}>
      The frontend was unable to fetch its runtime configuration. This usually means the
      deployment is misconfigured — contact your administrator.
    </p>
    <button
      type="button"
      onClick={() => window.location.reload()}
      style={{
        padding: "0.5rem 1rem",
        border: "1px solid currentColor",
        background: "transparent",
        cursor: "pointer",
      }}
    >
      Reload
    </button>
  </div>
);

export const ConfigProvider = ({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element | null => {
  const [status, setStatus] = useState<Status>(MSW_ENABLED ? "ready" : "loading");

  useEffect(() => {
    if (MSW_ENABLED) {
      applyConfig(MSW_FALLBACK_CONFIG);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const resp = await fetch("/api/config", { cache: "no-store" });
        if (!resp.ok) {
          throw new Error(`config probe failed: ${resp.status}`);
        }
        const data = (await resp.json()) as { apiBaseUrl?: unknown };
        if (typeof data.apiBaseUrl !== "string" || !data.apiBaseUrl) {
          throw new Error("config probe returned no apiBaseUrl");
        }
        if (cancelled) return;
        applyConfig({ apiBaseUrl: data.apiBaseUrl });
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error("Config bootstrap failed:", err);
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") return null;
  if (status === "error") return <ConfigErrorScreen />;
  return <>{children}</>;
};
