import { describe, expect, it } from "vitest";
import { formatDelta } from "@/lib/result/format-delta";

describe("formatDelta", () => {
  it("positive → +1.2 with ok tone", () => {
    expect(formatDelta(1.2)).toEqual({ display: "+1.2", tone: "ok" });
  });
  it("negative → -0.5 with danger tone", () => {
    expect(formatDelta(-0.5)).toEqual({ display: "-0.5", tone: "danger" });
  });
  it("zero → 0.0 with ink tone", () => {
    expect(formatDelta(0)).toEqual({ display: "0.0", tone: "ink" });
  });
  it("null → — with ink-dim tone (AC-D9 null-handling)", () => {
    expect(formatDelta(null)).toEqual({ display: "—", tone: "ink-dim" });
    expect(formatDelta(undefined)).toEqual({ display: "—", tone: "ink-dim" });
  });
  it("NaN guard → — with ink-dim tone", () => {
    expect(formatDelta(Number.NaN)).toEqual({ display: "—", tone: "ink-dim" });
  });
});
