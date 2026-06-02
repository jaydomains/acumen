"use client";

/**
 * Latest Result redirect (`/results`) — FE-2-shell §B.2 v1 nav model (D3),
 * Slice 3. A thin client page that redirects to the most-recent submitted
 * attempt's result page. Client (not server) redirect: it needs the authed
 * testee's attempts via the bearer-token react-query client, which is the
 * app's pattern; a server `redirect()` would require server-side token fetch.
 *
 * Freshness (DEC-S3-A): the `me/attempts` list is never invalidated on submit,
 * so a warm cached page could point "Latest Result" at the *prior* attempt.
 * This uses `useMeAttemptsCapped(1)` — a distinct `{limit:1}` cache key the
 * hero / profile (200-cap) never warm — and forces a mount revalidation, then
 * gates the redirect on the post-mount settled fetch (`isFetchedAfterMount`),
 * so even a warm-but-stale entry re-reads the true latest before redirecting.
 *
 * Render states mirror the per-query honesty used across the testee surface
 * (error ≠ empty): loading / redirecting → a centered loading card; empty
 * (no submitted attempts) → an honest "No results yet" + Discover CTA; error
 * → a neutral error card (never a redirect, never the empty copy).
 */

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMeAttemptsCapped } from "@/lib/queries/me";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";

export default function LatestResultPage() {
  const router = useRouter();
  const { data, isError, isSuccess, isFetchedAfterMount, refetch } =
    useMeAttemptsCapped(1);
  const latestId = data?.data?.[0]?.attempt_id ?? null;

  // Force a fresh read on mount so a warm-but-stale {limit:1} entry can't
  // redirect us to a prior result (the list is never invalidated on submit).
  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Redirect only once the post-mount fetch has settled with a latest attempt.
  useEffect(() => {
    if (isSuccess && isFetchedAfterMount && latestId) {
      router.replace(`/attempts/${latestId}/result`);
    }
  }, [isSuccess, isFetchedAfterMount, latestId, router]);

  if (isError) {
    return (
      <div data-testid="results-error">
        <PageHeader eyebrow="Latest result · Unavailable" title="Latest Result" />
        <Card className="p-6 bg-bg-sunk text-center text-[13px] text-ink-3">
          We couldn&apos;t load your results right now — please try again shortly.
        </Card>
      </div>
    );
  }

  // Honest empty state once the fresh fetch settles with no submitted attempts.
  if (isSuccess && isFetchedAfterMount && latestId === null) {
    return (
      <div data-testid="results-empty">
        <PageHeader eyebrow="Latest result · 0 records" title="Latest Result" />
        <Card className="p-6 bg-bg-sunk text-center text-[13px] text-ink-3">
          <p>No results yet.</p>
          <p className="mt-2">
            Finish a test and your latest result lands here.{" "}
            <Link href="/catalogue" className="underline">
              Discover a pill
            </Link>
            .
          </p>
        </Card>
      </div>
    );
  }

  // Loading (cold) or redirecting (settled-with-latest, effect navigating) —
  // a single honest loading card, never a flash of empty or a fake result.
  return (
    <div data-testid="results-loading">
      <PageHeader eyebrow="Latest result" title="Latest Result" />
      <Card className="p-6 bg-bg-sunk text-center text-[13px] text-ink-3">
        Loading your latest result…
      </Card>
    </div>
  );
}
