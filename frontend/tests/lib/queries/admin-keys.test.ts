import { describe, expect, it } from "vitest";
import { adminKeys } from "@/lib/queries/admin-keys";

/**
 * Snapshot the canonical `adminKeys` key shapes locked at FE-8
 * catalogue spec §C.1 (`:1077–1148`). Reviewers reject inline key
 * construction in page files — keys must come from this library and
 * stay shape-stable across slices. A diff here surfaces silent shape
 * drift before it leaks into a slice that depends on prefix-match
 * invalidation.
 */

describe("adminKeys — shape stability", () => {
  it("roots all keys under ['admin']", () => {
    expect(adminKeys.all).toEqual(["admin"]);
  });

  it("locks pills domain shape", () => {
    expect(adminKeys.pills.all()).toEqual(["admin", "pills"]);
    expect(adminKeys.pills.list({})).toEqual(["admin", "pills", "list", {}]);
    expect(adminKeys.pills.list({ q: "anti" })).toEqual([
      "admin",
      "pills",
      "list",
      { q: "anti" },
    ]);
    expect(adminKeys.pills.detail("pill-1")).toEqual([
      "admin",
      "pills",
      "detail",
      "pill-1",
    ]);
  });

  it("locks subjects domain shape", () => {
    expect(adminKeys.subjects.all()).toEqual(["admin", "subjects"]);
    expect(adminKeys.subjects.list({})).toEqual(["admin", "subjects", "list", {}]);
    expect(adminKeys.subjects.detail("s-1")).toEqual([
      "admin",
      "subjects",
      "detail",
      "s-1",
    ]);
  });

  it("locks proposals domain shape", () => {
    expect(adminKeys.proposals.all()).toEqual(["admin", "proposals"]);
    expect(adminKeys.proposals.list({ status: "pending" })).toEqual([
      "admin",
      "proposals",
      "list",
      { status: "pending" },
    ]);
    expect(adminKeys.proposals.detail("p-1")).toEqual([
      "admin",
      "proposals",
      "detail",
      "p-1",
    ]);
  });

  it("locks paths domain shape", () => {
    expect(adminKeys.paths.all()).toEqual(["admin", "paths"]);
    expect(adminKeys.paths.list()).toEqual(["admin", "paths", "list"]);
    expect(adminKeys.paths.detail("path-1")).toEqual([
      "admin",
      "paths",
      "detail",
      "path-1",
    ]);
  });

  it("locks users domain shape", () => {
    expect(adminKeys.users.all()).toEqual(["admin", "users"]);
    expect(adminKeys.users.list({})).toEqual(["admin", "users", "list", {}]);
    expect(adminKeys.users.detail("u-1")).toEqual(["admin", "users", "detail", "u-1"]);
  });

  it("locks groups domain shape (with members nested under detail)", () => {
    expect(adminKeys.groups.all()).toEqual(["admin", "groups"]);
    expect(adminKeys.groups.list({})).toEqual(["admin", "groups", "list", {}]);
    expect(adminKeys.groups.detail("g-1")).toEqual(["admin", "groups", "detail", "g-1"]);
    expect(adminKeys.groups.members("g-1")).toEqual([
      "admin",
      "groups",
      "detail",
      "g-1",
      "members",
    ]);
  });

  it("locks assignments domain shape", () => {
    expect(adminKeys.assignments.all()).toEqual(["admin", "assignments"]);
    expect(adminKeys.assignments.list({})).toEqual(["admin", "assignments", "list", {}]);
    expect(adminKeys.assignments.detail("a-1")).toEqual([
      "admin",
      "assignments",
      "detail",
      "a-1",
    ]);
  });

  it("locks tests domain shape", () => {
    expect(adminKeys.tests.all()).toEqual(["admin", "tests"]);
    expect(adminKeys.tests.list({ mode: "frozen" })).toEqual([
      "admin",
      "tests",
      "list",
      { mode: "frozen" },
    ]);
    expect(adminKeys.tests.detail("t-1")).toEqual(["admin", "tests", "detail", "t-1"]);
  });

  it("locks questions domain nested under tests.detail (per spec :1142–1146)", () => {
    expect(adminKeys.questions.all("t-1")).toEqual([
      "admin",
      "tests",
      "detail",
      "t-1",
      "questions",
    ]);
    expect(adminKeys.questions.list("t-1")).toEqual([
      "admin",
      "tests",
      "detail",
      "t-1",
      "questions",
      "list",
    ]);
    expect(adminKeys.questions.detail("t-1", "q-1")).toEqual([
      "admin",
      "tests",
      "detail",
      "t-1",
      "questions",
      "detail",
      "q-1",
    ]);
  });
});

describe("adminKeys — prefix-match invariant", () => {
  /**
   * TanStack Query invalidates by prefix: `invalidateQueries({ queryKey:
   * pills.all() })` matches every `pills.list(...)` / `pills.detail(...)`
   * key. Verify the prefix property holds across every domain so a
   * single `.all()` invalidation cascades correctly.
   */
  const isPrefix = <T extends readonly unknown[]>(prefix: T, full: readonly unknown[]) =>
    prefix.every(
      (seg, i) =>
        Object.is(seg, full[i]) || JSON.stringify(seg) === JSON.stringify(full[i]),
    );

  it("pills.all() is a prefix of pills.list(...) and pills.detail(...)", () => {
    const prefix = adminKeys.pills.all();
    expect(isPrefix(prefix, adminKeys.pills.list({ q: "x" }))).toBe(true);
    expect(isPrefix(prefix, adminKeys.pills.detail("p-1"))).toBe(true);
  });

  it("groups.detail(id) is a prefix of groups.members(id)", () => {
    const prefix = adminKeys.groups.detail("g-1");
    expect(isPrefix(prefix, adminKeys.groups.members("g-1"))).toBe(true);
  });

  it("tests.detail(id) is a prefix of questions.* under that test", () => {
    const prefix = adminKeys.tests.detail("t-1");
    expect(isPrefix(prefix, adminKeys.questions.all("t-1"))).toBe(true);
    expect(isPrefix(prefix, adminKeys.questions.list("t-1"))).toBe(true);
    expect(isPrefix(prefix, adminKeys.questions.detail("t-1", "q-1"))).toBe(true);
  });

  it("admin root is a prefix of every domain", () => {
    const root = adminKeys.all;
    expect(isPrefix(root, adminKeys.pills.all())).toBe(true);
    expect(isPrefix(root, adminKeys.subjects.all())).toBe(true);
    expect(isPrefix(root, adminKeys.proposals.all())).toBe(true);
    expect(isPrefix(root, adminKeys.paths.all())).toBe(true);
    expect(isPrefix(root, adminKeys.users.all())).toBe(true);
    expect(isPrefix(root, adminKeys.groups.all())).toBe(true);
    expect(isPrefix(root, adminKeys.assignments.all())).toBe(true);
    expect(isPrefix(root, adminKeys.tests.all())).toBe(true);
  });
});
