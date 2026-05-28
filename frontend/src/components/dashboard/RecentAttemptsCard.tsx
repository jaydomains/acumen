/**
 * RecentAttemptsCard — testee dashboard widget showing the most recent
 * attempts (FE-3 §B.1 §2; prototype source at
 * `frontend/design-reference/prototype/testee.jsx:149-175`).
 *
 * Consumes `GET /v1/attempts` via `useMeAttemptsCapped(RECENT_LIMIT)` —
 * the cap namespace (`["me","attempts","capped",{limit:5}]`) is distinct
 * from the profile page's default (200), so the cache entries do not
 * collide.
 *
 * Δcomp renders `—` in ink-dim while `competence_delta` ships null on
 * the wire (FE-6 absorbed trap inherited via FE-7 history-row.tsx); the
 * positive/negative colour branches are exercised by unit tests until
 * the per-attempt snapshot column lands.
 */

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { formatRelative } from "@/lib/result/format-relative";
import { useMeAttemptsCapped, type AttemptListItem } from "@/lib/queries/me";
import { cn } from "@/lib/utils";

const RECENT_LIMIT = 5;

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

function Row({ row }: { row: AttemptListItem }) {
  const router = useRouter();
  const delta = formatDelta(row.competence_delta);
  const navigate = () =>
    router.push(`/attempts/${encodeURIComponent(row.attempt_id)}/result`);

  return (
    <div
      data-testid="recent-attempts-row"
      data-attempt-id={row.attempt_id}
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
        "flex items-center justify-between gap-3 border-b border-line pb-3",
        "last:border-b-0 last:pb-0",
        "cursor-pointer hover:bg-bg-sunk focus:bg-bg-sunk focus:outline-none",
      )}
    >
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-ink truncate">{row.pill_name}</div>
        <div className="mt-2 text-[11px] font-mono uppercase tracking-[0.04em] text-ink-3">
          {formatRelative(row.submitted_at)} · {row.origin}
        </div>
      </div>
      <div className="text-right whitespace-nowrap">
        <div className="font-mono text-[18px] font-semibold tabular-nums text-ink">
          {Math.round(row.score_percent)}%
        </div>
        <div
          data-testid="recent-attempts-row-delta"
          className="text-[11px] font-mono tabular-nums"
          style={{ color: delta.color }}
        >
          {delta.text}
        </div>
      </div>
    </div>
  );
}

export function RecentAttemptsCard() {
  const { data, isLoading, isError } = useMeAttemptsCapped(RECENT_LIMIT);
  const rows = data?.data ?? [];

  return (
    <Card data-testid="recent-attempts-card" className="flex flex-col gap-4 p-6">
      <div className="eyebrow">Recent</div>
      <h2 className="font-serif text-[22px] tracking-[-0.015em]">Your last attempts</h2>
      {isLoading && (
        <div data-testid="recent-attempts-loading" className="text-[13px] text-ink-3">
          Loading…
        </div>
      )}
      {isError && (
        <div data-testid="recent-attempts-error" className="text-[13px] text-danger">
          Couldn’t load recent attempts.
        </div>
      )}
      {!isLoading && !isError && rows.length === 0 && (
        <div data-testid="recent-attempts-empty" className="text-[13px] text-ink-3">
          No attempts yet — your last results will appear here.
        </div>
      )}
      {!isLoading && !isError && rows.length > 0 && (
        <div className="flex flex-col gap-3">
          {rows.map((r) => (
            <Row key={r.attempt_id} row={r} />
          ))}
        </div>
      )}
    </Card>
  );
}
