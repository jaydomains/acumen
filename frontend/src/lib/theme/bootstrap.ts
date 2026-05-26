/**
 * Theme bootstrap — the sub-300-byte inline script that pre-applies a
 * stored `acumen.theme` to <html data-theme="…"> before React hydrates,
 * killing FOUC on returning carbon users.
 *
 * Exported as a string so:
 *   (a) `app/layout.tsx` injects it via `dangerouslySetInnerHTML` in <head>.
 *   (b) the discipline test can exec the same source against jsdom and
 *       assert behavior + byte budget.
 *
 * try/catch wraps localStorage — private-browsing modes can throw.
 */

export const THEME_STORAGE_KEY = "acumen.theme";

export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var t=localStorage.getItem("acumen.theme");if(t==="carbon"||t==="paper"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;
