import { describe, expect, it } from "vitest";
import { formatRelative } from "@/lib/result/format-relative";

const NOW = new Date("2026-05-27T12:00:00Z");

describe("formatRelative", () => {
  it("under a minute → just now", () => {
    expect(formatRelative("2026-05-27T11:59:30Z", NOW)).toBe("just now");
  });
  it("a minute → 'a minute ago'", () => {
    expect(formatRelative("2026-05-27T11:58:50Z", NOW)).toBe("a minute ago");
  });
  it("5 minutes → '5 minutes ago'", () => {
    expect(formatRelative("2026-05-27T11:55:00Z", NOW)).toBe("5 minutes ago");
  });
  it("an hour → 'an hour ago'", () => {
    expect(formatRelative("2026-05-27T10:55:00Z", NOW)).toBe("an hour ago");
  });
  it("3 hours → '3 hours ago'", () => {
    expect(formatRelative("2026-05-27T09:00:00Z", NOW)).toBe("3 hours ago");
  });
  it("yesterday → 'yesterday'", () => {
    expect(formatRelative("2026-05-26T11:00:00Z", NOW)).toBe("yesterday");
  });
  it("days ago", () => {
    expect(formatRelative("2026-05-24T11:00:00Z", NOW)).toBe("3 days ago");
  });
  it("null / invalid → —", () => {
    expect(formatRelative(null, NOW)).toBe("—");
    expect(formatRelative(undefined, NOW)).toBe("—");
    expect(formatRelative("not-a-date", NOW)).toBe("—");
  });
  it("future timestamp → just now", () => {
    expect(formatRelative("2026-05-27T13:00:00Z", NOW)).toBe("just now");
  });
});
