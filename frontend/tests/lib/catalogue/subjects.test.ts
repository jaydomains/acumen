import { describe, expect, it } from "vitest";
import { subjectById, SUBJECT_LIST } from "@/lib/catalogue/subjects";

describe("subject-colour helper", () => {
  it("resolves a known id with name + hex colour + short label", () => {
    const s = subjectById("safety");
    expect(s.name).toBe("Safety & Compliance");
    expect(s.colour).toMatch(/^#[0-9a-f]{6}$/i);
    expect(s.shortLabel).toBe("SAFETY");
  });

  it("returns a neutral fallback for unknown ids (keeps the unknown id)", () => {
    const s = subjectById("not-a-subject");
    expect(s.id).toBe("not-a-subject");
    expect(s.name).toBe("Subject");
    expect(s.colour).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("SUBJECT_LIST holds the canonical six-subject ordering", () => {
    expect(SUBJECT_LIST.map((s) => s.id)).toEqual([
      "paint-qa",
      "marine",
      "nace",
      "qs",
      "safety",
      "pm",
    ]);
  });
});
