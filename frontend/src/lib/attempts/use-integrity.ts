"use client";

/**
 * Integrity surface for the attempt runner (AC-D4 layers #1, #2, #3).
 *
 * Layer ownership inside FE-4:
 *   - #1 frictional deterrents (contextmenu / selectstart / copy /
 *     paste / cut / Ctrl-Cmd+C/V) → installed here on mount; cleanup
 *     on unmount restores defaults.
 *   - #2 watermark → owned by the `<Watermark>` component, not this
 *     hook (kept separate so the hook stays a pure side-effect mount).
 *   - #3 focus / tab-switch tracking → installed here, but **local
 *     only** in v1: `POST /v1/attempts/{id}/focus-events` does not
 *     exist on the backend (verified — table `attempt_focus_event`
 *     ships at `app/models.py:1097` but no router serves it).
 *     Plan-mode decision F-a: ship `visibilitychange` listener that
 *     drives the IntegrityBadge's `tab-switches: N` counter via the
 *     reducer; do not POST. Surfaced as a backend follow-up.
 *
 * `paused` gates the focus listener — per AC-D11 / AC-D4 implications,
 * focus events while paused are not signal (the testee deliberately
 * stepped away). Counter does not advance during pause.
 *
 * The hook returns the live counter so the IntegrityBadge can
 * display it; the reducer doesn't need to know about focus events
 * for any other purpose in v1.
 */

import { useCallback, useEffect, useRef, useState } from "react";

type Listener<E extends Event = Event> = (event: E) => void;

const SUPPRESSED_KEYS = new Set(["c", "v", "x", "a"]);

function preventDefault(event: Event): void {
  event.preventDefault();
}

function suppressCopyPasteShortcut(event: KeyboardEvent): void {
  const cmdOrCtrl = event.metaKey || event.ctrlKey;
  if (!cmdOrCtrl) return;
  if (SUPPRESSED_KEYS.has(event.key.toLowerCase())) {
    event.preventDefault();
    event.stopPropagation();
  }
}

export type UseIntegrityOptions = {
  paused: boolean;
  /**
   * Test-only escape hatch — Vitest jsdom's `document.execCommand`
   * harness fires `copy` events even when `selection.toString()` is
   * empty, which would otherwise prevent every reload-helper from
   * working under test. Real callers don't set this.
   */
  disable?: boolean;
};

export type IntegrityState = {
  tabSwitches: number;
  resetTabSwitches: () => void;
};

export function useIntegrity({
  paused,
  disable = false,
}: UseIntegrityOptions): IntegrityState {
  const [tabSwitches, setTabSwitches] = useState(0);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const resetTabSwitches = useCallback(() => setTabSwitches(0), []);

  useEffect(() => {
    if (disable || typeof document === "undefined") return;

    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    const contextMenu: Listener = preventDefault;
    const selectStart: Listener = preventDefault;
    const copy: Listener = preventDefault;
    const paste: Listener = preventDefault;
    const cut: Listener = preventDefault;
    const keyDown: Listener<KeyboardEvent> = suppressCopyPasteShortcut;
    const onVisibility: Listener = () => {
      if (pausedRef.current) return;
      if (document.visibilityState === "hidden") {
        setTabSwitches((n) => n + 1);
      }
    };

    document.addEventListener("contextmenu", contextMenu);
    document.addEventListener("selectstart", selectStart);
    document.addEventListener("copy", copy);
    document.addEventListener("paste", paste);
    document.addEventListener("cut", cut);
    document.addEventListener("keydown", keyDown, true);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.removeEventListener("contextmenu", contextMenu);
      document.removeEventListener("selectstart", selectStart);
      document.removeEventListener("copy", copy);
      document.removeEventListener("paste", paste);
      document.removeEventListener("cut", cut);
      document.removeEventListener("keydown", keyDown, true);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [disable]);

  return { tabSwitches, resetTabSwitches };
}
