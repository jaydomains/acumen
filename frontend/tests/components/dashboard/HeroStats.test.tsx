/**
 * HeroStats container tests (FE-3 §B.1, §C.1, §5).
 *
 * HeroStats is a container: it owns `useMeCompetence()` + `useMeAttemptsCapped()`
 * and derives its three Stats internally, so it mounts through a
 * QueryClientProvider and resolves against MSW. These tests assert the live
 * derivation (overall competence to 1dp, pills-at-working+, day streak) and the
 * honest loading / empty / error states — in particular that an empty or errored
 * fetch never regresses to "v1.x-pending" copy and that error is rendered
 * distinctly from a true empty/zero state.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { http } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/mocks/node";
import {
  resetMockMeAttempts,
  resetMockMeCompetence,
  setMockMeAttempts,
  setMockMeAttemptsStatus,
  setMockMeCompetence,
  setMockMeCompetenceStatus,
} from "@/mocks/handlers";
import type { AttemptListItem, MeCompetencePill } from "@/lib/queries/me";
import type { Band } from "@/components/primitives/bands";
import { HeroStats } from "@/components/dashboard/HeroStats";

const API = "http://localhost:8000";

const makePill = (
  input: Partial<MeCompetencePill> & { pill_id: string },
): MeCompetencePill => ({
  pill_name: "Antifouling",
  subject_id: "11111111-1111-1111-1111-000000000111",
  competence_estimate: 6.4,
  band: "working",
  n: 22,
  confidence: "confident",
  last_activity_at: "2026-05-26T09:00:00Z",
  related_pill_ids: [],
  safety_relevant: false,
  ...input,
});

const makeAttempt = (
  input: Partial<AttemptListItem> & { attempt_id: string; submitted_at: string },
): AttemptListItem => ({
  pill_id: "11111111-1111-1111-1111-000000000aaa",
  pill_name: "Antifouling",
  score_percent: 70,
  band: "working",
  origin: "self_initiated",
  competence_delta: null,
  ...input,
});

/** Noon-UTC ISO `offset` days before today, so a streak is unambiguous. */
const dayMsAgoIso = (offset: number): string => {
  const DAY = 86_400_000;
  const todayFloor = Math.floor(Date.now() / DAY) * DAY;
  return new Date(todayFloor - offset * DAY + 12 * 3_600_000).toISOString();
};

function mountTree(node: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>;
}

afterEach(() => {
  cleanup();
  resetMockMeCompetence();
  resetMockMeAttempts();
});

describe("HeroStats", () => {
  it("renders the greeting + dateLabel", async () => {
    render(mountTree(<HeroStats displayName="Jay" dateLabel="Tuesday, 26 May" />));
    expect(
      await screen.findByRole("heading", { name: /welcome back, jay\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Tuesday, 26 May")).toBeInTheDocument();
  });

  it("renders real overall competence to 1 dp", async () => {
    setMockMeCompetence([
      makePill({ pill_id: "p1", competence_estimate: 4.0, band: "junior" }),
      makePill({ pill_id: "p2", competence_estimate: 6.0, band: "working" }),
    ]);
    render(mountTree(<HeroStats displayName="Jay" dateLabel="—" />));
    expect(await screen.findByText("5.0")).toBeInTheDocument();
    expect(screen.getByText("across 2 pills")).toBeInTheDocument();
  });

  it("counts pills at working+", async () => {
    const bands: Band[] = ["junior", "working", "advanced", "expert"];
    setMockMeCompetence(
      bands.map((band, i) =>
        makePill({ pill_id: `p${i}`, band, competence_estimate: 5 + i }),
      ),
    );
    render(mountTree(<HeroStats displayName="Jay" dateLabel="—" />));
    // 3 of 4 bands are working+ (working/advanced/expert).
    expect(await screen.findByText("3/4")).toBeInTheDocument();
  });

  it("derives the day streak from attempts", async () => {
    setMockMeAttempts([
      makeAttempt({ attempt_id: "a0", submitted_at: dayMsAgoIso(0) }),
      makeAttempt({ attempt_id: "a1", submitted_at: dayMsAgoIso(1) }),
      makeAttempt({ attempt_id: "a2", submitted_at: dayMsAgoIso(2) }),
    ]);
    render(mountTree(<HeroStats displayName="Jay" dateLabel="—" />));
    // DAY STREAK is the accent-toned stat.
    expect(await screen.findByText("3")).toBeInTheDocument();
  });

  it("empty competence renders an honest empty state (not v1.x-pending)", async () => {
    setMockMeCompetence([]);
    render(mountTree(<HeroStats displayName="Jay" dateLabel="—" />));
    expect(await screen.findByText("No attempts yet")).toBeInTheDocument();
    expect(screen.getByText("0/0")).toBeInTheDocument();
    expect(screen.queryByText(/v1\.x|pending/i)).toBeNull();
  });

  it("error competence renders a neutral error state (not empty copy)", async () => {
    setMockMeCompetenceStatus(500);
    render(mountTree(<HeroStats displayName="Jay" dateLabel="—" />));
    expect(await screen.findByText("Unavailable")).toBeInTheDocument();
    // Error must NOT reuse the empty copy/zero.
    expect(screen.queryByText("No attempts yet")).toBeNull();
    expect(screen.queryByText("0/0")).toBeNull();
    // OVERALL + WORKING+ both render "—" (two of the three stat values).
    const dashes = screen
      .getAllByTestId("stat-value")
      .filter((v) => v.textContent === "—");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it("error attempts renders a neutral streak (not '0')", async () => {
    setMockMeAttemptsStatus(500);
    render(mountTree(<HeroStats displayName="Jay" dateLabel="—" />));
    // Competence resolves from defaults; streak takes its own error branch.
    await screen.findByText(/across \d+ pills/i);
    const values = screen.getAllByTestId("stat-value").map((v) => v.textContent);
    expect(values).toContain("—"); // streak error
    expect(values).not.toContain("0"); // never a false zero
  });

  it("loading renders a skeleton, not pending copy", () => {
    // Hang both endpoints so the queries stay pending for the assertion.
    server.use(
      http.get(`${API}/v1/me/competence`, () => new Promise<never>(() => {})),
      http.get(`${API}/v1/attempts`, () => new Promise<never>(() => {})),
    );
    render(mountTree(<HeroStats displayName="Jay" dateLabel="—" />));
    const values = screen.getAllByTestId("stat-value");
    expect(values).toHaveLength(3);
    values.forEach((v) => expect(v).toHaveTextContent("…"));
    expect(screen.queryByText(/v1\.x|pending/i)).toBeNull();
  });

  it("fires the competence request (real values prove the fetch)", async () => {
    setMockMeCompetence([
      makePill({ pill_id: "p1", competence_estimate: 8.0, band: "expert" }),
    ]);
    render(mountTree(<HeroStats displayName="Jay" dateLabel="—" />));
    // "8.0" can only render if the competence request fired and resolved.
    expect(await screen.findByText("8.0")).toBeInTheDocument();
    expect(screen.getByText("across 1 pill")).toBeInTheDocument();
  });
});
