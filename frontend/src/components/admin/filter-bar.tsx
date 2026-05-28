/**
 * FilterBar — text search + N segmented filter groups (FE-8 §C.4 in
 * `fe-specs/FE-8-admin-catalogue.md:1179–1199`). Extracted from FE-3
 * catalogue filter pattern + extended for FE-8.
 *
 * Search input debounces internally to 300ms before calling
 * `onSearchChange`. URL-state sync is the consumer's responsibility
 * (this is a controlled primitive). Per spec: typing 5 chars within
 * 300ms fires 1 search; typing 5 chars over 500ms fires 5 searches
 * but only the last lands due to TanStack Query's last-write-wins.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 300;

export type FilterSegment = {
  label: string;
  /** Currently selected value (controlled). */
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (next: string) => void;
};

export type FilterBarProps = {
  searchValue?: string;
  onSearchChange?: (next: string) => void;
  searchPlaceholder?: string;
  segments?: FilterSegment[];
  className?: string;
};

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search…",
  segments,
  className,
}: FilterBarProps) {
  const [draft, setDraft] = useState(searchValue ?? "");

  // Stabilise the callback reference so the debounce effect below
  // doesn't tear down + re-install its timer on every parent re-render.
  // Without this, a parent that passes an inline arrow (the common case)
  // would reset the 300ms timer every render and the debounced search
  // might never land. Same pattern as StreamingRunner.tsx:121–130.
  const onSearchChangeRef = useRef(onSearchChange);
  onSearchChangeRef.current = onSearchChange;

  // Keep local draft in sync with externally-driven value changes
  // (e.g. URL hydration / reset). Doesn't fire onSearchChange.
  useEffect(() => {
    setDraft(searchValue ?? "");
  }, [searchValue]);

  // Debounced fire to onSearchChange. The cleanup runs on every keystroke,
  // so the timer resets each time — only the last value lands after the
  // user pauses 300ms. Reads the callback via ref so parent re-renders
  // don't reset the timer.
  useEffect(() => {
    if (!onSearchChangeRef.current) return;
    if (draft === (searchValue ?? "")) return;
    const id = window.setTimeout(() => onSearchChangeRef.current?.(draft), DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [draft, searchValue]);

  return (
    <div
      className={cn("flex items-center gap-3 flex-wrap py-3 px-1", className)}
      data-testid="filter-bar"
    >
      {onSearchChange ? (
        <Input
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label="Search"
          className="max-w-[280px]"
          data-testid="filter-bar-search"
        />
      ) : null}
      {segments?.map((seg) => <SegmentGroup key={seg.label} segment={seg} />)}
    </div>
  );
}

function SegmentGroup({ segment }: { segment: FilterSegment }) {
  return (
    <div
      className="flex items-center gap-2"
      data-testid={`filter-bar-segment-${segment.label}`}
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
        {segment.label}
      </span>
      <div className="flex" role="group" aria-label={segment.label}>
        {segment.options.map((opt, idx) => {
          const active = opt.value === segment.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => segment.onChange(opt.value)}
              aria-pressed={active}
              className={cn(
                "px-2.5 py-1 text-[12px] font-medium border border-line",
                idx > 0 && "-ml-px",
                active
                  ? "bg-ink text-bg-raised border-ink"
                  : "bg-bg-raised text-ink-2 hover:bg-bg-deep",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
