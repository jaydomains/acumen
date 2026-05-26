"use client";

/**
 * Catalogue page (`/catalogue`) — FE-3 §B.2.
 *
 * URL state ↔ filter state via `useSearchParams()` + `router.replace()`.
 * URL writes and query fires are coupled to the SAME 300ms debounce so
 * the browser back button stays useful (FE-3 §B.2.7).
 *
 * The subject filter row is derived from the loaded pages — there's
 * no `GET /v1/catalogue/subjects` endpoint in v1 (FE-3 §B.2.3).
 *
 * `GET /v1/me/competence` is not constructed (per-Testee overlay
 * absent in v1; FE-3 §E item 7); PillCards render without the overlay.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { BoundaryFrame } from "@/components/shell/BoundaryFrame";
import { Icon } from "@/components/primitives/Icon";
import { FilterBar } from "@/components/catalogue/FilterBar";
import { CatalogueGrid, PillCardSkeleton } from "@/components/catalogue/CatalogueGrid";
import {
  useCataloguePills,
  flattenPills,
  type PillResponse,
} from "@/lib/queries/catalogue";
import {
  parseFilterState,
  serializeFilterState,
  isFilterStateEmpty,
  type CatalogueFilterState,
} from "@/lib/catalogue/url-state";
import { subjectById, type SubjectMeta } from "@/lib/catalogue/subjects";

const SEARCH_DEBOUNCE_MS = 300;

export default function CataloguePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Synchronous URL → state hydration on first render. Re-derive on
  // back/forward (searchParams reference changes) without an effect:
  // this is a controlled hook return, not state we own.
  const urlState = useMemo<CatalogueFilterState>(
    () => parseFilterState(searchParams ?? new URLSearchParams()),
    [searchParams],
  );

  // Local search echo so typing feels immediate while we debounce
  // both the URL write and the query fire.
  const [searchEcho, setSearchEcho] = useState(urlState.search ?? "");
  // The debounced filter state that actually drives the query.
  const [filterState, setFilterState] = useState<CatalogueFilterState>(urlState);

  // Rehydrate echo + filterState when URL changes externally
  // (deep-link or back/forward).
  const lastUrlSerialized = useRef(serializeFilterState(urlState));
  useEffect(() => {
    const next = serializeFilterState(urlState);
    if (next !== lastUrlSerialized.current) {
      lastUrlSerialized.current = next;
      setFilterState(urlState);
      setSearchEcho(urlState.search ?? "");
    }
  }, [urlState]);

  const commitFilter = useCallback(
    (next: CatalogueFilterState) => {
      setFilterState(next);
      const qs = serializeFilterState(next);
      lastUrlSerialized.current = qs;
      router.replace(`/catalogue${qs}`);
    },
    [router],
  );

  // Debounce: a single timer governs both URL write + query fire.
  // Subject clicks fire immediately (no debounce); search input
  // waits SEARCH_DEBOUNCE_MS idle.
  useEffect(() => {
    const trimmed = searchEcho.trim();
    if ((filterState.search ?? "") === trimmed) return;
    const timer = setTimeout(() => {
      const { search: _drop, ...rest } = filterState;
      void _drop;
      commitFilter(trimmed === "" ? rest : { ...rest, search: trimmed });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchEcho, filterState, commitFilter]);

  const query = useCataloguePills(filterState, queryClient);

  const pills = useMemo(() => flattenPills(query.data), [query.data]);
  const subjects = useMemo(() => deriveSubjects(pills), [pills]);
  const filterIsActive = !isFilterStateEmpty(filterState);
  const totalLabel = query.data
    ? `Catalogue · ${pills.length}${query.hasNextPage ? "+" : ""} pill${
        pills.length === 1 ? "" : "s"
      } · ${subjects.length} subject${subjects.length === 1 ? "" : "s"}`
    : "Catalogue";

  return (
    <>
      <PageHeader
        eyebrow={totalLabel}
        title="Find what you need to learn."
        subtitle="Self-directed practice. Pick a subject, pick a pill, pick a difficulty. Anything safety-tagged links out to curated industry sources — Acumen doesn't generate safety teaching content."
      />
      <FilterBar
        subjects={subjects}
        value={filterState}
        onChange={commitFilter}
        searchInput={searchEcho}
        onSearchInputChange={setSearchEcho}
      />
      <CatalogueBody
        pills={pills}
        isPending={query.isPending}
        isError={query.isError}
        isFetchingNextPage={query.isFetchingNextPage}
        hasNextPage={Boolean(query.hasNextPage)}
        filterIsActive={filterIsActive}
        onLoadMore={() => query.fetchNextPage()}
        onClearFilters={() => {
          setSearchEcho("");
          commitFilter({});
        }}
        onRetry={() => query.refetch()}
      />
    </>
  );
}

type CatalogueBodyProps = {
  pills: PillResponse[];
  isPending: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  filterIsActive: boolean;
  onLoadMore: () => void;
  onClearFilters: () => void;
  onRetry: () => void;
};

function CatalogueBody({
  pills,
  isPending,
  isError,
  isFetchingNextPage,
  hasNextPage,
  filterIsActive,
  onLoadMore,
  onClearFilters,
  onRetry,
}: CatalogueBodyProps) {
  if (isError) {
    return (
      <BoundaryFrame
        glyph={<Icon name="flag" size={24} />}
        eyebrow="CATALOGUE"
        title="We couldn't load the catalogue."
        body="The catalogue request failed. Try again, and if it keeps failing, let your administrator know."
        actions={
          <Button onClick={onRetry} variant="outline" size="sm">
            Try again
          </Button>
        }
      />
    );
  }

  if (isPending) {
    return (
      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="catalogue-loading"
      >
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <PillCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (pills.length === 0) {
    return (
      <div
        className="border border-line bg-bg-raised p-10 text-center"
        data-testid="catalogue-empty"
      >
        <div className="font-serif text-[22px] text-ink mb-2">
          {filterIsActive
            ? "No pills match your filters."
            : "No pills in the catalogue yet."}
        </div>
        <div className="text-[13px] text-ink-3 mb-4">
          {filterIsActive
            ? "Try clearing a filter or searching for a different term."
            : "Pills will appear here as your administrator adds them."}
        </div>
        {filterIsActive ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            data-testid="catalogue-clear-filters"
          >
            Clear filters
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <CatalogueGrid
      pills={pills}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onLoadMore={onLoadMore}
    />
  );
}

// Subject list is derived from loaded pages (no /v1/catalogue/subjects
// in v1). De-dup by subject_id; preserve first-seen order.
function deriveSubjects(pills: PillResponse[]): SubjectMeta[] {
  const seen = new Set<string>();
  const out: SubjectMeta[] = [];
  for (const pill of pills) {
    if (seen.has(pill.subject_id)) continue;
    seen.add(pill.subject_id);
    out.push(subjectById(pill.subject_id));
  }
  return out;
}
