"use client";

/**
 * Dev-mode MSW boot guard. Activated by `NEXT_PUBLIC_API_MOCKING=enabled`;
 * otherwise renders children immediately. On the server and on initial
 * client render under the flag, returns `null` until the service worker
 * registers — so identity resolution waits for the mock backend to be
 * ready. If registration throws (missing /public/mockServiceWorker.js,
 * blocked scope, etc.), the error is logged and children render anyway
 * so the dev sees the real backend's response instead of a blank page.
 * No-op in production (the flag is build-time inlined to anything other
 * than "enabled").
 */

import { useEffect, useState, type ReactNode } from "react";

const ENABLED = process.env.NEXT_PUBLIC_API_MOCKING === "enabled";

export function MSWProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!ENABLED);

  useEffect(() => {
    if (!ENABLED) return;
    let cancelled = false;
    void (async () => {
      try {
        const { worker } = await import("./browser");
        await worker.start({ onUnhandledRequest: "bypass" });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(
          "MSW worker failed to start; falling through to real backend:",
          err,
        );
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}
