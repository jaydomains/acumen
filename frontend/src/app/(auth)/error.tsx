"use client";

/**
 * (auth)-group error boundary (FE-1 §C.6). Re-exports the root
 * `app/error.tsx` so /login, /forgot, /reset/[token], /setup/[token]
 * use the same Pattern C card; Next 15 picks up the closest
 * `error.tsx` to the failing segment, so duplicating the re-export
 * here keeps the (auth) tree covered when the boundary needs to
 * differ from the root (e.g., suppress the "Go to dashboard" button
 * for unauthed users). For FE-1 the copy is identical to root so we
 * delegate.
 */

export { default } from "@/app/error";
