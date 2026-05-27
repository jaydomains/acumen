"use client";

/**
 * Testee competency profile page (FE-7 §B.1).
 *
 * Slice 1 shipped the route shell + top-level state branches.
 * Slice 2 wires the constellation SVG, view-toggle, and band-count
 * legend; the SelectedPillDetailCard, MatrixTable, and HowToReadCard
 * still arrive in Slice 3.
 *
 * Per LOCK-2, the wire excludes rows with `competence_estimate IS NULL`,
 * so render paths read `pill.competence_estimate` directly without
 * null-guards. Per LOCK-3, `pill.n` is the testee's submitted-attempt
 * count (not the dead `retake_count` column), so the confidence ring +
 * BandTag preliminary/confident suffix are honest at v1 ship.
 *
 * Subject grouping: derived from the competence response's distinct
 * `subject_id` UUIDs; the `subjectById` helper resolves to the unknown-
 * fallback neutral grey for every subject in v1 until
 * `GET /v1/catalogue/subjects` lands (FE-3 §H(b) item 5). Layout still
 * works (UUIDs are stable keys); halo colour is uniformly neutral.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError } from "@/lib/api/errors";
import type { Band } from "@/components/primitives/bands";
import { subjectById } from "@/lib/catalogue/subjects";
import { useMeCompetence, type MeCompetencePill } from "@/lib/queries/me";
import type { ConstellationSubject } from "@/lib/profile/layout-constellation";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConstellationSVG } from "@/components/profile/constellation-svg";
import { Legend } from "@/components/profile/legend";
import { ViewToggle } from "@/components/profile/view-toggle";

type ViewMode = "constellation" | "matrix";

function deriveSubjects(pills: ReadonlyArray<MeCompetencePill>): ConstellationSubject[] {
  const seen: ConstellationSubject[] = [];
  const known = new Set<string>();
  for (const p of pills) {
    if (known.has(p.subject_id)) continue;
    known.add(p.subject_id);
    const meta = subjectById(p.subject_id);
    seen.push({ id: p.subject_id, name: meta.name, color: meta.colour });
  }
  return seen;
}

function deriveBandCounts(pills: ReadonlyArray<MeCompetencePill>): Record<Band, number> {
  const counts: Record<Band, number> = {
    novice: 0,
    junior: 0,
    working: 0,
    advanced: 0,
    expert: 0,
  };
  for (const p of pills) {
    counts[p.band] = (counts[p.band] ?? 0) + 1;
  }
  return counts;
}

export default function TesteeProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const competence = useMeCompetence();
  const [view, setView] = useState<ViewMode>("constellation");

  const pills = useMemo(() => competence.data?.pills ?? [], [competence.data]);
  const pillsCount = pills.length;
  const subjects = useMemo(() => deriveSubjects(pills), [pills]);
  const bandCounts = useMemo(() => deriveBandCounts(pills), [pills]);

  const defaultSelectedId = useMemo<string | null>(() => {
    if (pills.length === 0) return null;
    const withAttempts = pills.find((p) => p.n > 0);
    return withAttempts?.pill_id ?? pills[0]?.pill_id ?? null;
  }, [pills]);

  const paramId = searchParams?.get("pill") ?? null;
  const knownIds = useMemo(() => new Set(pills.map((p) => p.pill_id)), [pills]);
  const resolvedSelectedId =
    paramId && knownIds.has(paramId) ? paramId : defaultSelectedId;

  useEffect(() => {
    if (!resolvedSelectedId) return;
    if (paramId === resolvedSelectedId) return;
    router.replace(`?pill=${encodeURIComponent(resolvedSelectedId)}`, {
      scroll: false,
    });
  }, [resolvedSelectedId, paramId, router]);

  // Endpoint-absent placeholder branch — drift-mode for 404/405 only;
  // any other failure escalates to the Pattern C boundary.
  const apiError = competence.error instanceof ApiError ? competence.error : null;
  const endpointAbsent =
    apiError !== null && (apiError.status === 404 || apiError.status === 405);
  if (competence.error && !endpointAbsent) {
    throw competence.error;
  }

  if (competence.isPending) {
    return <ProfileSkeleton />;
  }

  if (endpointAbsent) {
    return (
      <div data-testid="profile-endpoint-absent">
        <ProfileHero eyebrow="Your competency · Coming in v1.x" />
        <Card className="p-6 bg-bg-sunk text-center text-[13px] text-ink-3">
          Your competence profile arrives once we light up the{" "}
          <code className="font-mono">/v1/me/competence</code> endpoint. No data yet.
        </Card>
      </div>
    );
  }

  if (pillsCount === 0) {
    return (
      <div data-testid="profile-empty">
        <ProfileHero eyebrow="Your competency · 0 pills · no attempts yet" />
        <Card className="p-6 bg-bg-sunk text-center text-[13px] text-ink-3">
          Your constellation will appear after a few attempts.
        </Card>
      </div>
    );
  }

  return (
    <div data-testid="profile-happy">
      <ProfileHero
        eyebrow={`Your competency · ${pillsCount} pill${pillsCount === 1 ? "" : "s"} · calibrated`}
        toggle={<ViewToggle value={view} onChange={setView} />}
      />
      <Legend counts={bandCounts} className="mb-6" />

      {view === "constellation" ? (
        <div className="grid gap-4 lg:grid-cols-12">
          <Card
            data-testid="profile-constellation-slot"
            className="bg-bg-sunk overflow-hidden p-0 lg:col-span-8"
          >
            <ConstellationSVG
              pills={pills}
              subjects={subjects}
              selectedId={resolvedSelectedId}
              onSelect={(id) =>
                router.replace(`?pill=${encodeURIComponent(id)}`, { scroll: false })
              }
            />
          </Card>
          <div className="flex flex-col gap-4 lg:col-span-4">
            <Card
              data-testid="profile-detail-card-slot"
              className="p-6 text-[12px] text-ink-3"
            >
              SelectedPillDetailCard arrives in Slice 3.
              {resolvedSelectedId ? (
                <>
                  {" "}
                  Selected:{" "}
                  <code className="font-mono" data-testid="profile-selected-pill-echo">
                    {resolvedSelectedId}
                  </code>
                </>
              ) : null}
            </Card>
            <Card
              data-testid="profile-how-to-read-slot"
              className="p-6 text-[12px] text-ink-3"
            >
              HowToReadCard arrives in Slice 3.
            </Card>
          </div>
        </div>
      ) : (
        <Card data-testid="profile-matrix-slot" className="p-6 text-[12px] text-ink-3">
          MatrixTable arrives in Slice 3.
        </Card>
      )}
    </div>
  );
}

function ProfileHero({ eyebrow, toggle }: { eyebrow: string; toggle?: React.ReactNode }) {
  return (
    <div
      data-testid="profile-hero"
      className="mb-6 flex flex-wrap items-baseline justify-between gap-6"
    >
      <div>
        <div className="eyebrow mb-2">{eyebrow}</div>
        <h1 className="font-serif text-[44px] leading-[1.05] tracking-[-0.025em] text-ink">
          <span className="italic font-light">A map of</span> what you know.
        </h1>
        <p className="mt-3 max-w-[52ch] text-[14px] text-ink-3">
          Each star is a pill. Brightness is your competence. The ring around it is
          calibration confidence — faded rings mean we haven&apos;t seen enough attempts
          to be sure yet. Lines connect related pills.
        </p>
      </div>
      {toggle ?? null}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div data-testid="profile-skeleton" className="flex flex-col gap-4">
      <div>
        <Skeleton className="h-3 w-40 mb-3" />
        <Skeleton className="h-12 w-80" />
        <Skeleton className="mt-3 h-3 w-96" />
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <Skeleton className="h-[620px] lg:col-span-8" />
        <div className="flex flex-col gap-4 lg:col-span-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-40" />
        </div>
      </div>
    </div>
  );
}
