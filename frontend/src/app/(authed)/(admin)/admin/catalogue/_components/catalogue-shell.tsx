"use client";

/**
 * CatalogueShell — the 4-tab admin catalogue chrome per FE-8 §B.1
 * (`fe-specs/FE-8-admin-catalogue.md:89–194`).
 *
 * URL state: `?tab={pills|subjects|proposals|safety}` (default `pills`).
 * Switching tabs calls `router.replace()` (not `push`) so the back
 * button doesn't accumulate tab noise (§B.1 §7).
 *
 * Invalid `?tab=foo` silently falls back to `pills` and rewrites the URL.
 * Only the active tab mounts — other tabs unmount and their TanStack
 * caches stay warm per §B.1 §7.
 */

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shell/PageHeader";
import { cn } from "@/lib/utils";
import { PillsTab } from "./pills-tab";
import { SubjectsTab } from "./subjects-tab";
import { ProposalsTab } from "./proposals-tab";
import { SafetyTab } from "./safety-tab";

const TABS = ["pills", "subjects", "proposals", "safety"] as const;
type TabId = (typeof TABS)[number];
const DEFAULT_TAB: TabId = "pills";

const TAB_LABELS: Record<TabId, string> = {
  pills: "Pills",
  subjects: "Subjects",
  proposals: "Proposals",
  safety: "Safety pills",
};

const isTabId = (v: string | null): v is TabId =>
  v !== null && (TABS as readonly string[]).includes(v);

export function CatalogueShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams?.get("tab") ?? null;
  const active: TabId = isTabId(raw) ? raw : DEFAULT_TAB;

  // Silent recovery for invalid `?tab=foo` — rewrite URL to default.
  useEffect(() => {
    if (raw !== null && !isTabId(raw)) {
      router.replace(`/admin/catalogue?tab=${DEFAULT_TAB}`);
    }
  }, [raw, router]);

  const setTab = (next: TabId) => {
    if (next === active) return;
    // Preserve sibling query params (notably `?q=` from the subjects
    // tab) across tab switches — round-tripping subjects → pills →
    // subjects keeps the filter alive, matching the URL contract in
    // `subjects-tab.tsx`'s header comment.
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("tab", next);
    router.replace(`/admin/catalogue?${params.toString()}`);
  };

  const headerTitle = useMemo(() => TAB_LABELS[active], [active]);

  return (
    <>
      <PageHeader
        eyebrow="Pill catalogue"
        title={headerTitle}
        subtitle="Author pills, group them under subjects, review AI proposals, and curate the safety-tagged set."
      />
      <CatalogueTabs active={active} onSelect={setTab} />
      <div className="mt-6" data-testid={`tab-pane-${active}`}>
        {active === "pills" ? <PillsTab /> : null}
        {active === "subjects" ? <SubjectsTab /> : null}
        {active === "proposals" ? <ProposalsTab /> : null}
        {active === "safety" ? <SafetyTab /> : null}
      </div>
    </>
  );
}

type CatalogueTabsProps = {
  active: TabId;
  onSelect: (next: TabId) => void;
};

function CatalogueTabs({ active, onSelect }: CatalogueTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Catalogue sections"
      className="flex border-b border-line"
      data-testid="catalogue-tabs"
    >
      {TABS.map((id) => {
        const selected = id === active;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            data-active={selected ? "true" : undefined}
            data-testid={`catalogue-tab-${id}`}
            onClick={() => onSelect(id)}
            className={cn(
              "px-4 py-2.5 -mb-px text-[13px] font-medium border-b-2",
              selected
                ? "border-ink text-ink"
                : "border-transparent text-ink-3 hover:text-ink-2",
            )}
          >
            {TAB_LABELS[id]}
          </button>
        );
      })}
    </div>
  );
}
