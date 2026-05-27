"use client";

/**
 * Testee competency profile page (FE-7 §B.1).
 *
 * Slice 1 ships the route shell with the top-level state branches —
 * loading skeleton, endpoint_absent placeholder, empty fallback, and a
 * happy-state stub that hosts the constellation + detail-card slots
 * that arrive in Slices 2 / 3. The role guard is handled upstream by
 * the `(testee)/layout.tsx` `Gate posture="authed" role="testee"`; this
 * file does not re-check the role.
 *
 * Per LOCK-2, the wire excludes rows with `competence_estimate IS NULL`,
 * so render paths read `pill.competence_estimate` directly without
 * null-guards. Per LOCK-3, `pill.n` is the testee's submitted-attempt
 * count (not the dead `retake_count` column), so the confidence ring +
 * BandTag preliminary/confident suffix are honest at v1 ship.
 *
 * `?pill={pillId}` query state and the constellation/matrix view toggle
 * are wired here, but the visual slots (`ConstellationSVG`, `MatrixTable`,
 * `SelectedPillDetailCard`, `Sparkline`, `Legend`, `HowToReadCard`) land
 * in Slices 2 / 3 — placeholders below until then.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError } from "@/lib/api/errors";
import { useMeCompetence } from "@/lib/queries/me";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type ViewMode = "constellation" | "matrix";

export default function TesteeProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const competence = useMeCompetence();
  const [view, setView] = useState<ViewMode>("constellation");

  // Wrap in useMemo so the array reference stays stable across renders
  // when the query data is unchanged — keeps the downstream useMemo +
  // useEffect dependency lists honest.
  const pills = useMemo(() => competence.data?.pills ?? [], [competence.data]);
  const pillsCount = pills.length;

  // First pill with n > 0 makes a good default selection — the
  // constellation's selected ring belongs on a star that actually has
  // calibration evidence. Falls back to the first pill if every pill
  // is fresh.
  const defaultSelectedId = useMemo<string | null>(() => {
    if (pills.length === 0) return null;
    const withAttempts = pills.find((p) => p.n > 0);
    return withAttempts?.pill_id ?? pills[0]?.pill_id ?? null;
  }, [pills]);

  const paramId = searchParams?.get("pill") ?? null;
  const knownIds = useMemo(() => new Set(pills.map((p) => p.pill_id)), [pills]);
  const resolvedSelectedId =
    paramId && knownIds.has(paramId) ? paramId : defaultSelectedId;

  // Sync `?pill=` to the resolved selection when they diverge (stale
  // link, no param, deleted pill). Always run the hook to keep React's
  // hook-order invariant; the branches below short-circuit rendering.
  useEffect(() => {
    if (!resolvedSelectedId) return;
    if (paramId === resolvedSelectedId) return;
    router.replace(`?pill=${encodeURIComponent(resolvedSelectedId)}`, {
      scroll: false,
    });
  }, [resolvedSelectedId, paramId, router]);

  // Endpoint-absent placeholder branch — drift-mode for 404/405 only;
  // any other failure escalates to the Pattern C boundary.
  const apiError =
    competence.error instanceof ApiError ? competence.error : null;
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
          <code className="font-mono">/v1/me/competence</code> endpoint. No data
          yet.
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
      />
      <div
        className="mb-6 flex items-center gap-2"
        data-testid="profile-view-toggle"
      >
        <button
          type="button"
          data-active={view === "constellation"}
          onClick={() => setView("constellation")}
          className="px-3 py-1.5 text-[12px] font-mono uppercase tracking-[0.08em] border border-line data-[active=true]:bg-ink data-[active=true]:text-bg-raised"
        >
          Constellation
        </button>
        <button
          type="button"
          data-active={view === "matrix"}
          onClick={() => setView("matrix")}
          className="px-3 py-1.5 text-[12px] font-mono uppercase tracking-[0.08em] border border-line data-[active=true]:bg-ink data-[active=true]:text-bg-raised"
        >
          Matrix
        </button>
      </div>

      {view === "constellation" ? (
        <div className="grid gap-4 lg:grid-cols-12">
          <Card
            data-testid="profile-constellation-slot"
            className="bg-bg-sunk min-h-[620px] p-6 text-[12px] text-ink-3 lg:col-span-8"
          >
            Constellation SVG arrives in Slice 2. Selected pill:{" "}
            <code className="font-mono">{resolvedSelectedId ?? "—"}</code>.
          </Card>
          <div className="flex flex-col gap-4 lg:col-span-4">
            <Card
              data-testid="profile-detail-card-slot"
              className="p-6 text-[12px] text-ink-3"
            >
              SelectedPillDetailCard arrives in Slice 3.
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
        <Card
          data-testid="profile-matrix-slot"
          className="p-6 text-[12px] text-ink-3"
        >
          MatrixTable arrives in Slice 3.
        </Card>
      )}
    </div>
  );
}

function ProfileHero({ eyebrow }: { eyebrow: string }) {
  return (
    <div data-testid="profile-hero" className="mb-6">
      <div className="eyebrow mb-2">{eyebrow}</div>
      <h1 className="font-serif text-[44px] leading-[1.05] tracking-[-0.025em] text-ink">
        <span className="italic font-light">A map of</span> what you know.
      </h1>
      <p className="mt-3 max-w-[52ch] text-[14px] text-ink-3">
        Each star is a pill. Brightness is your competence. The ring around it is
        calibration confidence — faded rings mean we haven&apos;t seen enough
        attempts to be sure yet. Lines connect related pills.
      </p>
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
