/**
 * Re-export of generated OpenAPI types (AC-CD19).
 *
 * Callers should import endpoint/schema shapes from here rather than
 * the raw `@/types/api` so the generation seam is centralised.
 */

export type { paths, components, operations } from "@/types/api";

import type { components } from "@/types/api";

/** Convenience aliases for the most-used response shapes. */
export type UserResponse = components["schemas"]["UserResponse"];
export type TokenPair = components["schemas"]["TokenPair"];
export type AccessToken = components["schemas"]["AccessToken"];
export type LoginRequest = components["schemas"]["LoginRequest"];
