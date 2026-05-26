"use client";

/**
 * Dev-mode MSW boot guard. Activated by `NEXT_PUBLIC_API_MOCKING=enabled`;
 * otherwise renders children immediately. On the server and on initial
 * client render under the flag, returns `null` until the service worker
 * registers — so identity resolution waits for the mock backend to be
 * ready. No-op in production (the flag is build-time inlined).
 */

import { useEffect, useState, type ReactNode } from "react";

const ENABLED = process.env.NEXT_PUBLIC_API_MOCKING === "enabled";

export function MSWProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!ENABLED);

  useEffect(() => {
    if (!ENABLED) return;
    let cancelled = false;
    void (async () => {
      const { worker } = await import("./browser");
      await worker.start({ onUnhandledRequest: "bypass" });
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}
