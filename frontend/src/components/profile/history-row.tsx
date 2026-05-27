/**
 * HistoryRow — one attempt as a table row in the history page
 * (FE-7 §B.2 §2; prototype source at
 * `frontend/design-reference/prototype/testee.jsx:513-524`).
 *
 * Columns: When | Pill | Origin | Score | Band | Δcomp.
 *
 * Spec-locked rendering rules:
 * - Timestamp via `formatRelative` from FE-6 (`lib/result/format-relative.ts`).
 * - Origin chip with LOCK-4 long-form enum values
 *   (`self_initiated | assignment_driven | loop_driven`) — the value
 *   is rendered as-is in mono per the prototype + FE-7 §C.5 BandTag
 *   history-row note.
 * - Score column shows `Math.round(score_percent)%`.
 * - Band column uses `<BandTag band={row.band}>` without `estimate`
 *   or `confidence` — history rows are scannable per-row snapshots
 *   per §C.5; the float + qualifier surface only on the profile
 *   detail card.
 * - Δcomp: `+0.4` in `var(--ok)`, `-0.5` in `var(--danger)`, `—` in
 *   `var(--ink-dim)` for null. v1 ships with `competence_delta`
 *   always null on the wire (per-attempt snapshot column deferred
 *   per FE-6 trap) — the colour branches are reached only by unit
 *   tests until that column lands.
 * - Row click routes to `/attempts/{attempt_id}/result` (FE-6
 *   destination).
 */

import { useRouter } from "next/navigation";
import { BandTag } from "@/components/primitives/BandTag";
import { Pill } from "@/components/primitives/Pill";
import { formatRelative } from "@/lib/result/format-relative";
import type { AttemptListItem } from "@/lib/queries/me";
import { cn } from "@/lib/utils";

export type HistoryRowProps = {
  row: AttemptListItem;
};

function formatDelta(value: number | null | undefined): {
  text: string;
  color: string;
} {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { text: "—", color: "var(--ink-3)" };
  }
  const formatted = value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
  const color = value > 0 ? "var(--ok)" : value < 0 ? "var(--danger)" : "var(--ink-3)";
  return { text: formatted, color };
}

export function HistoryRow({ row }: HistoryRowProps) {
  const router = useRouter();
  const delta = formatDelta(row.competence_delta);
  const navigate = () =>
    router.push(`/attempts/${encodeURIComponent(row.attempt_id)}/result`);

  return (
    <tr
      data-testid="history-row"
      data-attempt-id={row.attempt_id}
      data-origin={row.origin}
      onClick={navigate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate();
        }
      }}
      tabIndex={0}
      role="link"
      aria-label={`Open attempt result for ${row.pill_name}`}
      className={cn(
        "cursor-pointer border-t border-line",
        "hover:bg-bg-sunk",
        "focus:bg-bg-sunk focus:outline-none",
      )}
    >
      <td className="px-3 py-3 text-[11px] font-mono uppercase tracking-[0.04em] text-ink-3 whitespace-nowrap">
        {formatRelative(row.submitted_at)}
      </td>
      <td className="px-3 py-3 text-[13px] text-ink-2 max-w-[280px]">
        <span data-testid="history-row-pill-name" className="block truncate">
          {row.pill_name}
        </span>
      </td>
      <td className="px-3 py-3">
        <Pill tone="default" mono>
          {row.origin}
        </Pill>
      </td>
      <td className="px-3 py-3 text-right font-mono text-[12px] tabular-nums text-ink">
        {Math.round(row.score_percent)}%
      </td>
      <td className="px-3 py-3">
        <BandTag band={row.band} />
      </td>
      <td
        data-testid="history-row-delta"
        className="px-3 py-3 text-right font-mono text-[12px] tabular-nums"
        style={{ color: delta.color }}
      >
        {delta.text}
      </td>
    </tr>
  );
}
