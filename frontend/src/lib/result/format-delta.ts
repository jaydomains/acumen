/**
 * format-delta — signed-float → display string + tone for the hero
 * competence-delta stat (FE-6 §B.2). Null delta → "—" with ink-dim
 * tone per AC-D9 ("null means no data yet, not a failing score").
 */

export type DeltaTone = "ok" | "danger" | "ink-dim" | "ink";

export type FormattedDelta = {
  display: string;
  tone: DeltaTone;
};

export function formatDelta(delta: number | null | undefined): FormattedDelta {
  if (delta === null || delta === undefined || Number.isNaN(delta)) {
    return { display: "—", tone: "ink-dim" };
  }
  if (delta > 0) {
    return { display: `+${delta.toFixed(1)}`, tone: "ok" };
  }
  if (delta < 0) {
    return { display: delta.toFixed(1), tone: "danger" };
  }
  return { display: "0.0", tone: "ink" };
}
