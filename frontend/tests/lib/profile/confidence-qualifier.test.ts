import { describe, expect, it } from "vitest";
import { confidenceQualifier } from "@/lib/profile/confidence-qualifier";

describe("confidenceQualifier", () => {
  it("returns 'preliminary' just below the AC-D20 default threshold (n = 19)", () => {
    expect(confidenceQualifier(19)).toBe("preliminary");
  });

  it("returns 'confident' at the AC-D20 default threshold (n = 20)", () => {
    expect(confidenceQualifier(20)).toBe("confident");
  });

  it("returns 'confident' above the threshold (n = 30)", () => {
    expect(confidenceQualifier(30)).toBe("confident");
  });

  it("returns 'preliminary' for n = 0", () => {
    expect(confidenceQualifier(0)).toBe("preliminary");
  });
});
