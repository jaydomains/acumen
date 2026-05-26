/**
 * FilterBar — debounced text search + subject button group
 * (FE-3 §B.2 §2). Mirrors `testee.jsx:260–268`.
 *
 * Controlled component: receives the current `value` (filter state)
 * and emits `onChange` with the next state. Debouncing lives in the
 * page (so the URL write and the query fire are coupled to the SAME
 * 300ms idle window; see FE-3 §B.2.7).
 *
 * Subject list is supplied by the page from the loaded pages (no
 * `GET /v1/catalogue/subjects` endpoint in v1 — FE-3 §B.2.3).
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { SubjectMeta } from "@/lib/catalogue/subjects";
import type { CatalogueFilterState } from "@/lib/catalogue/url-state";
import { Input } from "@/components/ui/input";

export type FilterBarProps = {
  subjects: SubjectMeta[];
  value: CatalogueFilterState;
  /** Fires immediately on subject click; debounced by the parent for search. */
  onChange: (next: CatalogueFilterState) => void;
  /** Local search text (uncontrolled echo); the page debounces this. */
  searchInput: string;
  onSearchInputChange: (next: string) => void;
};

export function FilterBar({
  subjects,
  value,
  onChange,
  searchInput,
  onSearchInputChange,
}: FilterBarProps) {
  // Keep the input element in sync if `value.search` is mutated externally
  // (e.g. deep-link hydration on first render).
  const [echo, setEcho] = useState(searchInput);
  useEffect(() => {
    setEcho(searchInput);
  }, [searchInput]);

  const activeSubject = value.subject_id ?? null;

  return (
    <div className="mb-6 flex flex-wrap gap-3" data-testid="catalogue-filter-bar">
      <Input
        type="search"
        placeholder="Search pills…"
        aria-label="Search pills"
        value={echo}
        onChange={(e) => {
          setEcho(e.target.value);
          onSearchInputChange(e.target.value);
        }}
        className="max-w-[280px]"
        data-testid="catalogue-search-input"
      />
      <div
        role="group"
        aria-label="Filter by subject"
        className="inline-flex flex-wrap items-center border border-line bg-bg-raised"
      >
        <FilterButton
          active={activeSubject === null}
          onClick={() => {
            const { subject_id: _drop, ...rest } = value;
            void _drop;
            onChange(rest);
          }}
          label="All"
          testId="catalogue-subject-all"
        />
        {subjects.map((s) => (
          <FilterButton
            key={s.id}
            active={activeSubject === s.id}
            onClick={() => onChange({ ...value, subject_id: s.id })}
            label={s.name}
            testId={`catalogue-subject-${s.id}`}
          />
        ))}
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  label,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active}
      data-testid={testId}
      className={cn(
        "px-3 py-2 text-[12.5px] font-medium border-r border-line last:border-r-0",
        "transition-colors duration-150",
        active ? "bg-ink text-bg-raised" : "text-ink-2 hover:bg-bg-deep hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}
