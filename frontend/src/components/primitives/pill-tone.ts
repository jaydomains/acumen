/**
 * Pill tone contract — locked at FE-2 Slice 1. Co-located so the union does
 * not get redeclared by every consumer (Pill primitive in Slice 2, plus any
 * FE-3+ surface that takes a tone prop).
 */

export type PillTone = "accent" | "ok" | "warn" | "danger" | "info" | "default";
