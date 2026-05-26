import { describe, expect, it } from "vitest";
import {
  parseFilterState,
  serializeFilterState,
  isFilterStateEmpty,
} from "@/lib/catalogue/url-state";

const sp = (s: string) => new URLSearchParams(s);

describe("parseFilterState", () => {
  it("returns empty state for an empty URLSearchParams", () => {
    expect(parseFilterState(sp(""))).toEqual({});
  });

  it("extracts search trimmed", () => {
    expect(parseFilterState(sp("search=%20anti%20"))).toEqual({ search: "anti" });
  });

  it("extracts subject from ?subject= (URL short form → subject_id field)", () => {
    expect(parseFilterState(sp("subject=marine"))).toEqual({
      subject_id: "marine",
    });
  });

  it("extracts numeric difficulty within [1,10]", () => {
    expect(parseFilterState(sp("difficulty=7"))).toEqual({ difficulty: 7 });
  });

  it("drops difficulty outside [1,10] or NaN", () => {
    expect(parseFilterState(sp("difficulty=0"))).toEqual({});
    expect(parseFilterState(sp("difficulty=11"))).toEqual({});
    expect(parseFilterState(sp("difficulty=abc"))).toEqual({});
  });

  it("combines all three", () => {
    expect(parseFilterState(sp("search=anti&subject=marine&difficulty=5"))).toEqual({
      search: "anti",
      subject_id: "marine",
      difficulty: 5,
    });
  });
});

describe("serializeFilterState", () => {
  it("returns '' for empty state", () => {
    expect(serializeFilterState({})).toBe("");
  });

  it("omits empty fields", () => {
    expect(serializeFilterState({ search: "" })).toBe("");
  });

  it("emits subject as ?subject= (not subject_id)", () => {
    expect(serializeFilterState({ subject_id: "marine" })).toBe("?subject=marine");
  });

  it("emits difficulty as integer string", () => {
    expect(serializeFilterState({ difficulty: 3 })).toBe("?difficulty=3");
  });

  it("round-trips parse → serialize for a populated state", () => {
    const input = "search=anti&subject=marine&difficulty=5";
    const state = parseFilterState(sp(input));
    const qs = serializeFilterState(state);
    expect(new URLSearchParams(qs.slice(1)).toString()).toEqual(
      new URLSearchParams(input).toString(),
    );
  });
});

describe("isFilterStateEmpty", () => {
  it("true for {}", () => {
    expect(isFilterStateEmpty({})).toBe(true);
  });
  it("false when any field is populated", () => {
    expect(isFilterStateEmpty({ search: "a" })).toBe(false);
    expect(isFilterStateEmpty({ subject_id: "x" })).toBe(false);
    expect(isFilterStateEmpty({ difficulty: 1 })).toBe(false);
  });
});
