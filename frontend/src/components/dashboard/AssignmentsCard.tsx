/**
 * AssignmentsCard — dashboard "Assigned to you" surface
 * (FE-3 §B.1, §E item 2).
 *
 * `GET /v1/me/assignments` is not in the schema; we render the
 * segmented control + a placeholder body so the layout is right and
 * the section explains itself. Filter state lives locally so the
 * segmented control is exercised by tests now and is ready to wire
 * when assignments land.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

type Tab = "all" | "mandatory" | "followups";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mandatory", label: "Mandatory" },
  { id: "followups", label: "Follow-ups" },
];

export function AssignmentsCard() {
  const [tab, setTab] = useState<Tab>("all");

  return (
    <Card data-testid="assignments-card" className="flex flex-col gap-5 p-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="eyebrow">Up next</div>
          <h2 className="mt-1 font-serif text-[22px] tracking-[-0.015em]">
            Assigned to you
          </h2>
        </div>
        <div
          role="group"
          aria-label="Filter assignments"
          className="inline-flex border border-line bg-bg-raised"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              data-active={tab === t.id}
              data-testid={`assignments-tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cn(
                "border-r border-line px-3 py-2 text-[12.5px] font-medium last:border-r-0",
                "transition-colors duration-150",
                tab === t.id
                  ? "bg-ink text-bg-raised"
                  : "text-ink-2 hover:bg-bg-deep hover:text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div
        data-testid="assignments-placeholder"
        className="border border-dashed border-line bg-bg-deep p-8 text-center"
      >
        <div className="font-serif text-[18px] text-ink mb-2">
          Assignments appear here when the backend endpoint lands.
        </div>
        <div className="text-[13px] text-ink-3">
          Pending <code className="font-mono">GET /v1/me/assignments</code> (v1.x).
          Self-directed practice is fully available via the catalogue.
        </div>
      </div>
    </Card>
  );
}
