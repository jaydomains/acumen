import { describe, expect, it } from "vitest";
import { parseContentDisposition } from "@/lib/result/parse-content-disposition";

describe("parseContentDisposition", () => {
  it("quoted filename", () => {
    expect(parseContentDisposition('attachment; filename="acumen-attempt-abc.pdf"')).toBe(
      "acumen-attempt-abc.pdf",
    );
  });
  it("unquoted token filename", () => {
    expect(parseContentDisposition("attachment; filename=foo.pdf")).toBe("foo.pdf");
  });
  it("RFC 5987 encoded filename* preferred over filename", () => {
    expect(
      parseContentDisposition(
        "attachment; filename=fallback.pdf; filename*=UTF-8''%E2%9C%93%20report.pdf",
      ),
    ).toBe("✓ report.pdf");
  });
  it("null / missing → null", () => {
    expect(parseContentDisposition(null)).toBeNull();
    expect(parseContentDisposition(undefined)).toBeNull();
    expect(parseContentDisposition("")).toBeNull();
  });
  it("missing filename param → null", () => {
    expect(parseContentDisposition("attachment")).toBeNull();
  });
});
