/**
 * parse-proposal-payload unit tests (FE-8 §D.1 +
 * `fe-specs/FE-8-admin-catalogue.md:1242,1283,1355`).
 *
 * The helper is a LOCKED v1 contract — these tests pin its shape so
 * Slice 4's drawer (and any future consumers) can rely on it.
 */

import { describe, expect, it } from "vitest";
import {
  deriveProposalStatus,
  parseProposalPayload,
} from "@/lib/proposals/parse-proposal-payload";

describe("deriveProposalStatus", () => {
  it("returns 'pending' for wire status pending or running", () => {
    expect(deriveProposalStatus({ status: "pending" })).toBe("pending");
    expect(deriveProposalStatus({ status: "running" })).toBe("pending");
  });

  it("returns 'failed' for wire status failed", () => {
    expect(deriveProposalStatus({ status: "failed" })).toBe("failed");
  });

  it("returns 'approved' when status=done and payload.decision='approved'", () => {
    expect(
      deriveProposalStatus({
        status: "done",
        payload: { decision: "approved" },
      }),
    ).toBe("approved");
  });

  it("returns 'rejected' when status=done and payload.decision='rejected'", () => {
    expect(
      deriveProposalStatus({
        status: "done",
        payload: { decision: "rejected" },
      }),
    ).toBe("rejected");
  });

  it("falls back to 'approved' for status=done with no decision (tolerance for historical rows)", () => {
    expect(deriveProposalStatus({ status: "done" })).toBe("approved");
    expect(deriveProposalStatus({ status: "done", payload: {} })).toBe("approved");
  });
});

describe("parseProposalPayload — structured rendering", () => {
  it("reads recognised fields from payload.proposal.{...} (backend persisted shape)", () => {
    const result = parseProposalPayload({
      proposal: {
        name: "Cathodic Protection",
        description: "Inspect anode placement.",
        subject_id: "abc-uuid",
        available_difficulty_min: 4,
        available_difficulty_max: 8,
      },
    });
    expect(result.kind).toBe("structured");
    if (result.kind !== "structured") return;
    const byKey = Object.fromEntries(result.rows.map((r) => [r.key, r.value]));
    expect(byKey.name).toBe("Cathodic Protection");
    expect(byKey.description).toBe("Inspect anode placement.");
    expect(byKey.subject_id).toBe("abc-uuid");
    expect(byKey.available_difficulty_min).toBe("4");
    expect(byKey.available_difficulty_max).toBe("8");
  });

  it("also reads hint-shaped fields at the top level (future-AI shape)", () => {
    const result = parseProposalPayload({
      name: "Top-level pill",
      subject_hint: "Paint QA",
      difficulty_hint: "intermediate",
    });
    expect(result.kind).toBe("structured");
    if (result.kind !== "structured") return;
    const byKey = Object.fromEntries(result.rows.map((r) => [r.key, r.value]));
    expect(byKey.name).toBe("Top-level pill");
    expect(byKey.subject_hint).toBe("Paint QA");
    expect(byKey.difficulty_hint).toBe("intermediate");
  });

  it("joins related_pill_ids array with commas", () => {
    const result = parseProposalPayload({
      proposal: {
        name: "Pill",
        related_pill_ids: ["pill-1", "pill-2", "pill-3"],
      },
    });
    expect(result.kind).toBe("structured");
    if (result.kind !== "structured") return;
    const related = result.rows.find((r) => r.key === "related_pill_ids");
    expect(related?.value).toBe("pill-1, pill-2, pill-3");
  });

  it("prefers nested proposal.{...} over top-level when both supply the same key", () => {
    const result = parseProposalPayload({
      name: "Top-level name",
      proposal: { name: "Nested name" },
    });
    expect(result.kind).toBe("structured");
    if (result.kind !== "structured") return;
    const name = result.rows.find((r) => r.key === "name");
    expect(name?.value).toBe("Nested name");
  });
});

describe("parseProposalPayload — raw fallback", () => {
  it("falls back to formatted JSON for null payload", () => {
    const result = parseProposalPayload(null);
    expect(result.kind).toBe("raw");
  });

  it("falls back to formatted JSON when no recognised fields are present", () => {
    const result = parseProposalPayload({
      unknown_field_a: "x",
      unknown_field_b: 42,
    });
    expect(result.kind).toBe("raw");
    if (result.kind !== "raw") return;
    expect(result.json).toContain("unknown_field_a");
    expect(result.json).toContain("42");
  });
});
