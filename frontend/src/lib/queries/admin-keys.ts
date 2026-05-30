/**
 * `adminKeys` — canonical query-key library for the admin authoring
 * suite (FE-8 §C.1 declared in `fe-specs/FE-8-admin-catalogue.md`,
 * consumed unchanged by `FE-8-admin-identity.md` + `FE-8-admin-tests.md`).
 *
 * Mirrors FE-3's `meQueryKeys` shape (AC-CD21): per-domain
 * `all() / list(filters) / detail(id)` hierarchy rooted at `['admin']`.
 *
 * Reviewers reject inline key construction — page files MUST consume
 * keys from here. Cross-resource mutations invalidate both sides via
 * the `.all()` keys (e.g. approving a proposal invalidates
 * `proposals.all()` AND `pills.all()`).
 */
import type { components } from "@/lib/api/types";

type TestMode = components["schemas"]["TestMode"];

export const adminKeys = {
  all: ["admin"] as const,

  // Pills
  pills: {
    all: () => [...adminKeys.all, "pills"] as const,
    list: (filters: {
      q?: string;
      subject_id?: string;
      safety_relevant?: boolean;
      status?: "draft" | "published";
    }) => [...adminKeys.pills.all(), "list", filters] as const,
    // ?limit=1 total-count probe (FE-9 count meta) — reads PageMeta.count.
    count: () => [...adminKeys.pills.all(), "count"] as const,
    detail: (pillId: string) => [...adminKeys.pills.all(), "detail", pillId] as const,
  },

  // Subjects
  subjects: {
    all: () => [...adminKeys.all, "subjects"] as const,
    list: (filters: { q?: string }) =>
      [...adminKeys.subjects.all(), "list", filters] as const,
    detail: (subjectId: string) =>
      [...adminKeys.subjects.all(), "detail", subjectId] as const,
  },

  // Pill proposals
  proposals: {
    all: () => [...adminKeys.all, "proposals"] as const,
    list: (filters: { status?: "pending" | "approved" | "rejected" | "all" }) =>
      [...adminKeys.proposals.all(), "list", filters] as const,
    detail: (proposalId: string) =>
      [...adminKeys.proposals.all(), "detail", proposalId] as const,
  },

  // Learning paths
  paths: {
    all: () => [...adminKeys.all, "paths"] as const,
    list: () => [...adminKeys.paths.all(), "list"] as const,
    detail: (pathId: string) => [...adminKeys.paths.all(), "detail", pathId] as const,
  },

  // Users (consumed by FE-8-admin-identity.md §B.1).
  // Wire `UserStatus` enum is `active | deactivated` only — "invited" is
  // a derived display status (see `frontend/src/lib/identity/
  // derive-invited-status.ts`). Slice 8 drift Finding #1: align the key
  // filter type to the wire enum; "invited" filtering happens
  // client-side over the cached pages.
  users: {
    all: () => [...adminKeys.all, "users"] as const,
    list: (filters: { role?: "admin" | "testee"; status?: "active" | "deactivated" }) =>
      [...adminKeys.users.all(), "list", filters] as const,
    detail: (userId: string) => [...adminKeys.users.all(), "detail", userId] as const,
  },

  // Groups (consumed by FE-8-admin-identity.md §B.2)
  groups: {
    all: () => [...adminKeys.all, "groups"] as const,
    list: (filters: { q?: string }) =>
      [...adminKeys.groups.all(), "list", filters] as const,
    detail: (groupId: string) => [...adminKeys.groups.all(), "detail", groupId] as const,
    members: (groupId: string) =>
      [...adminKeys.groups.detail(groupId), "members"] as const,
  },

  // Assignments (consumed by FE-8-admin-identity.md §B.4)
  assignments: {
    all: () => [...adminKeys.all, "assignments"] as const,
    list: (filters: { assigner_id?: string }) =>
      [...adminKeys.assignments.all(), "list", filters] as const,
    detail: (assignmentId: string) =>
      [...adminKeys.assignments.all(), "detail", assignmentId] as const,
  },

  // Tests (consumed by FE-8-admin-tests.md §B.1)
  tests: {
    all: () => [...adminKeys.all, "tests"] as const,
    list: (filters: { mode?: TestMode; status?: "draft" | "published" }) =>
      [...adminKeys.tests.all(), "list", filters] as const,
    detail: (testId: string) => [...adminKeys.tests.all(), "detail", testId] as const,
  },

  // Questions per test (consumed by FE-8-admin-tests.md §B.2 + §B.3)
  questions: {
    all: (testId: string) => [...adminKeys.tests.detail(testId), "questions"] as const,
    list: (testId: string) => [...adminKeys.questions.all(testId), "list"] as const,
    detail: (testId: string, questionId: string) =>
      [...adminKeys.questions.all(testId), "detail", questionId] as const,
  },

  // ── FE-9 ops key roots (fe-specs/FE-9-admin-ops.md §C.1) ──
  // Appended unchanged from the FE-8 library above. The ops landing's
  // synthetic `overview` key composes the page's underlying queries;
  // cross-resource mutations (e.g. the engagement sweep) invalidate it
  // so the landing refreshes on next visit.

  // FE-9 ops landing (synthetic key — composes the landing's queries)
  ops: {
    all: () => [...adminKeys.all, "ops"] as const,
    overview: () => [...adminKeys.ops.all(), "overview"] as const,
  },

  // FE-9 grade-review queue (B.2)
  gradeReviews: {
    all: () => [...adminKeys.all, "gradeReviews"] as const,
    flagged: (filters?: { verdict?: "flagged" | "confirmed" | "all" }) =>
      [...adminKeys.gradeReviews.all(), "flagged", filters ?? {}] as const,
    detail: (gradeReviewId: string) =>
      [...adminKeys.gradeReviews.all(), "detail", gradeReviewId] as const,
  },

  // FE-9 loop queue (B.3)
  loops: {
    all: () => [...adminKeys.all, "loops"] as const,
    queue: (filters?: { status?: string }) =>
      [...adminKeys.loops.all(), "queue", filters ?? {}] as const,
  },

  // FE-9 engagement (B.4)
  engagement: {
    all: () => [...adminKeys.all, "engagement"] as const,
    pending: () => [...adminKeys.engagement.all(), "pending"] as const,
  },

  // ── FE-9 systems key roots (fe-specs/FE-9-admin-systems.md §C.1) ──

  // Cost dashboard (systems §B.1) — read-only, no mutations.
  cost: {
    all: () => [...adminKeys.all, "cost"] as const,
    summary: () => [...adminKeys.cost.all(), "summary"] as const,
  },

  // Anchor calibration (systems §B.2)
  calibration: {
    all: () => [...adminKeys.all, "calibration"] as const,
    flaggedAnchors: (filters?: { pill_id?: string }) =>
      [...adminKeys.calibration.all(), "flaggedAnchors", filters ?? {}] as const,
    lastRun: () => [...adminKeys.calibration.all(), "lastRun"] as const,
  },

  // System page (systems §B.3)
  system: {
    all: () => [...adminKeys.all, "system"] as const,
    driveIndex: () => [...adminKeys.system.all(), "driveIndex"] as const,
    realismStatus: () => [...adminKeys.system.all(), "realismStatus"] as const,
    safetyLinkStatus: () => [...adminKeys.system.all(), "safetyLinkStatus"] as const,
  },
};
