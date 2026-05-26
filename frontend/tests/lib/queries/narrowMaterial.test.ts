import { describe, expect, it } from "vitest";
import { narrowMaterial } from "@/lib/queries";
import type { LearningMaterialResponse } from "@/lib/queries";

const base = {
  id: "lm-1",
  pill_id: "p-1",
  served_at: "2026-05-01T00:00:00Z",
  created_at: "2026-05-01T00:00:00Z",
  cached: false,
} satisfies Omit<LearningMaterialResponse, "source" | "content" | "safety_links">;

describe("narrowMaterial", () => {
  it("narrows ai_generated → kind 'ai' with content", () => {
    const m = narrowMaterial({
      ...base,
      source: "ai_generated",
      content: "Hello",
      safety_links: null,
    });
    expect(m.kind).toBe("ai");
    if (m.kind === "ai") expect(m.content).toBe("Hello");
  });

  it("throws when ai_generated lacks content", () => {
    expect(() =>
      narrowMaterial({
        ...base,
        source: "ai_generated",
        content: null,
        safety_links: null,
      }),
    ).toThrow(/missing content/);
  });

  it("narrows curated_safety_links → kind 'safety' with links", () => {
    const m = narrowMaterial({
      ...base,
      source: "curated_safety_links",
      content: null,
      safety_links: [
        {
          url: "https://example.org",
          title: "Ref",
          source: "Body",
          last_verified_at: "2026-05-01T00:00:00Z",
        },
      ],
    });
    expect(m.kind).toBe("safety");
    if (m.kind === "safety") expect(m.links).toHaveLength(1);
  });

  it("treats null safety_links as empty array (still safety branch)", () => {
    const m = narrowMaterial({
      ...base,
      source: "curated_safety_links",
      content: null,
      safety_links: null,
    });
    expect(m.kind).toBe("safety");
    if (m.kind === "safety") expect(m.links).toEqual([]);
  });

  it("throws on unknown source", () => {
    expect(() =>
      narrowMaterial({
        ...base,
        source: "mystery",
        content: null,
        safety_links: null,
      }),
    ).toThrow(/unknown source/);
  });
});
