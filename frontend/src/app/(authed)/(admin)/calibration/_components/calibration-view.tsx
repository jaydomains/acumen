"use client";

/**
 * Anchor-calibration client surface (FE-9 admin-systems §B.2) at
 * /calibration. Run trigger (reused SweepButton) + session-local summary
 * strip + per-pill drift table + flagged-anchors table + resolve modal
 * (reused VerdictTile, 3 action tiles with a conditional JSON editor).
 *
 * v1 simplifications (§B.2 §7 / §E.2): the "drift chart" ships as a
 * per-pill count table; the summary strip is session-local (resets on
 * reload until calibration is re-run — no current-summary GET endpoint).
 *
 * Surface is `anchors/flagged` (the AC-D23 bootstrap-quality flag queue);
 * the AC-D27 drift queue is deferred to v1.x (§E.4).
 */

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { PageHeader } from "@/components/shell/PageHeader";
import { BoundaryFrame } from "@/components/shell/BoundaryFrame";
import { Stat } from "@/components/primitives/Stat";
import { Pill } from "@/components/primitives/Pill";
import { Icon } from "@/components/primitives/Icon";
import { BandTag } from "@/components/primitives/BandTag";
import { bandFromLevel } from "@/components/primitives/bands";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Modal, ModalActions, ModalHeader } from "@/components/admin/modal";
import { Field, FieldError } from "@/components/admin/field";
import { SweepButton } from "@/components/admin/sweep-button";
import { VerdictTile } from "@/components/admin/verdict-tile";
import {
  useFlaggedAnchors,
  useResolveAnchor,
  useRunCalibration,
  type AnchorResolveRequest,
  type CalibrationSweepResult,
  type FlaggedAnchorItem,
} from "@/lib/queries/admin-calibration";

type LastRun = { result: CalibrationSweepResult; at: number };

function sinceLabel(at: number): string {
  const mins = Math.floor((Date.now() - at) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

export function CalibrationView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pillFilter = searchParams?.get("pill") ?? null;

  const query = useFlaggedAnchors();
  const runMutation = useRunCalibration();
  const [lastRun, setLastRun] = useState<LastRun | null>(null);
  const [resolveTarget, setResolveTarget] = useState<FlaggedAnchorItem | null>(null);

  const rows = useMemo(() => query.data?.data ?? [], [query.data]);
  const filteredRows = pillFilter ? rows.filter((r) => r.pill_id === pillFilter) : rows;

  const driftByPill = useMemo(() => {
    const map = new Map<string, { pillId: string; pillName: string; count: number }>();
    for (const r of rows) {
      const entry = map.get(r.pill_id) ?? {
        pillId: r.pill_id,
        pillName: r.pill_name,
        count: 0,
      };
      entry.count += 1;
      map.set(r.pill_id, entry);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [rows]);

  const writePill = (pillId: string | null) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (pillId === null) params.delete("pill");
    else params.set("pill", pillId);
    const qs = params.toString();
    router.replace(qs ? `/calibration?${qs}` : "/calibration");
  };

  const onRun = async () => {
    try {
      const result = await runMutation.mutateAsync();
      setLastRun({ result, at: Date.now() });
      toast.info(
        `Calibration ran · ${result.anchors_processed} anchors processed · ${result.anchors_updated} updated`,
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't run calibration");
      throw err;
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="AC-D27 · /admin/calibration · psychometric integrity"
        title="Anchor calibration."
        subtitle="Bootstrap-quality flagged anchors awaiting your resolution. Run a calibration sweep to refresh effective-difficulty estimates."
        actions={
          <div className="flex flex-col items-end gap-1">
            <SweepButton
              label="Run calibration"
              runningLabel="Running calibration…"
              onRun={onRun}
            />
            {!lastRun ? (
              <span className="text-[11.5px] text-ink-3" data-testid="calibration-no-run">
                Run calibration to populate stats.
              </span>
            ) : null}
          </div>
        }
      />

      <SummaryStrip lastRun={lastRun} flaggedCount={rows.length} />

      {query.isError ? (
        <BoundaryFrame
          glyph={<Icon name="wave" size={24} />}
          eyebrow="CALIBRATION"
          title="We couldn't load flagged anchors."
          body="The flagged-anchors request failed. Try again, and if it keeps failing, let your administrator know."
          actions={
            <Button onClick={() => query.refetch()} variant="outline" size="sm">
              Try again
            </Button>
          }
        />
      ) : query.isPending ? (
        <div className="mt-5" data-testid="calibration-loading">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="mb-2 h-9 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div
          className="mt-5 border border-line bg-bg-raised p-10 text-center"
          data-testid="calibration-empty"
        >
          <div className="mb-2 flex justify-center text-ok">
            <Icon name="check" size={24} />
          </div>
          <div className="font-serif text-[18px] text-ink mb-1">
            No flagged anchors — calibration is clean.
          </div>
          <div className="text-[13px] text-ink-3">
            Every anchor passed its generate-and-review cycle.
          </div>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <DriftTable
              drift={driftByPill}
              activePill={pillFilter}
              onPick={(id) => writePill(id)}
              onClear={() => writePill(null)}
            />
          </div>
          <div className="lg:col-span-8">
            <FlaggedAnchorsTable rows={filteredRows} onResolve={setResolveTarget} />
          </div>
        </div>
      )}

      {resolveTarget ? (
        <ResolveAnchorModal
          anchor={resolveTarget}
          onClose={() => setResolveTarget(null)}
        />
      ) : null}
    </>
  );
}

function SummaryStrip({
  lastRun,
  flaggedCount,
}: {
  lastRun: LastRun | null;
  flaggedCount: number;
}) {
  if (!lastRun) {
    return (
      <div
        className="grid grid-cols-2 gap-4 md:grid-cols-4"
        data-testid="calibration-summary"
      >
        {["Anchors analysed", "Flagged", "% in-band", "Since last run"].map((label) => (
          <Stat key={label} value="—" label={label} />
        ))}
      </div>
    );
  }
  const { anchors_processed, anchors_updated } = lastRun.result;
  const inBandPct =
    anchors_processed > 0
      ? Math.round(((anchors_processed - anchors_updated) / anchors_processed) * 100)
      : 0;
  return (
    <div
      className="grid grid-cols-2 gap-4 md:grid-cols-4"
      data-testid="calibration-summary"
    >
      <Stat value={String(anchors_processed)} label="Anchors analysed" />
      <Stat value={String(flaggedCount)} label="Flagged" />
      <Stat value={`${inBandPct}%`} label="% in-band" />
      <Stat value={sinceLabel(lastRun.at)} label="Since last run" />
    </div>
  );
}

function DriftTable({
  drift,
  activePill,
  onPick,
  onClear,
}: {
  drift: Array<{ pillId: string; pillName: string; count: number }>;
  activePill: string | null;
  onPick: (pillId: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="border border-line bg-bg-raised p-4" data-testid="calibration-drift">
      <div className="mb-3 flex items-center justify-between">
        <div className="eyebrow">Flagged by pill</div>
        {activePill ? (
          <button
            type="button"
            onClick={onClear}
            className="text-[11.5px] text-ink-3 underline"
            data-testid="calibration-show-all"
          >
            Show all pills
          </button>
        ) : null}
      </div>
      <ul className="flex flex-col gap-1">
        {drift.map((d) => (
          <li key={d.pillId}>
            <button
              type="button"
              onClick={() => onPick(d.pillId)}
              aria-current={d.pillId === activePill}
              data-testid={`calibration-pill-${d.pillId}`}
              className={
                d.pillId === activePill
                  ? "flex w-full items-center justify-between border border-ink bg-bg-deep px-2.5 py-1.5 text-[13px]"
                  : "flex w-full items-center justify-between border border-line px-2.5 py-1.5 text-[13px] hover:bg-bg-deep"
              }
            >
              <span className="truncate text-ink-2">{d.pillName}</span>
              <span className="font-mono text-ink-3">{d.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FlaggedAnchorsTable({
  rows,
  onResolve,
}: {
  rows: FlaggedAnchorItem[];
  onResolve: (row: FlaggedAnchorItem) => void;
}) {
  return (
    <table className="w-full text-[13px]" data-testid="calibration-table">
      <thead>
        <tr className="border-b border-line text-left text-ink-3">
          {["Pill", "Band", "Anchor", "Type", "Reason", ""].map((h, i) => (
            <th
              key={h || `actions-${i}`}
              className="px-2 py-2 font-mono text-[10.5px] uppercase tracking-[0.12em]"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const band = bandFromLevel(row.band);
          return (
            <tr
              key={row.anchor_question_id}
              className="border-b border-line"
              data-testid={`calibration-row-${row.anchor_question_id}`}
            >
              <td className="px-2 py-2.5 text-ink-2">{row.pill_name}</td>
              <td className="px-2 py-2.5">
                {band ? <BandTag band={band} /> : <Pill mono>band {row.band}</Pill>}
              </td>
              <td className="px-2 py-2.5 font-mono text-[11px] text-ink-3">
                {row.anchor_question_id.slice(0, 8)}
              </td>
              <td className="px-2 py-2.5 text-ink-3">{row.type}</td>
              <td className="px-2 py-2.5 text-ink-3">{row.excluded_reason ?? "—"}</td>
              <td className="px-2 py-2.5 text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onResolve(row)}
                  data-testid={`calibration-resolve-${row.anchor_question_id}`}
                >
                  Resolve
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

type ResolveAction = "keep" | "reject" | "substitute_wording";

function isJsonObject(s: string): boolean {
  try {
    const parsed = JSON.parse(s);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

function ResolveAnchorModal({
  anchor,
  onClose,
}: {
  anchor: FlaggedAnchorItem;
  onClose: () => void;
}) {
  const mutation = useResolveAnchor();
  const [action, setAction] = useState<ResolveAction | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [rootError, setRootError] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const tiles: Array<{ value: ResolveAction; label: string; subtitle: string }> = [
    { value: "keep", label: "Accept", subtitle: "keep" },
    { value: "reject", label: "Reject", subtitle: "remove from pool" },
    { value: "substitute_wording", label: "Override", subtitle: "substitute wording" },
  ];

  const onApply = async () => {
    setRootError(null);
    setJsonError(null);
    if (!action) {
      setRootError("Pick a resolution.");
      return;
    }
    let body: AnchorResolveRequest;
    if (action === "substitute_wording") {
      if (!isJsonObject(jsonText)) {
        setJsonError("Must be a valid JSON object.");
        return;
      }
      body = { action, new_config: JSON.parse(jsonText) };
    } else {
      body = { action };
    }
    try {
      await mutation.mutateAsync({ anchorId: anchor.anchor_question_id, body });
      toast.info("Anchor resolution applied");
      onClose();
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.status === 409 || err.code === "ANCHOR_ALREADY_RESOLVED")
      ) {
        toast.error(err.message || "Anchor was already resolved — refreshing list");
        onClose();
        return;
      }
      toast.error(err instanceof ApiError ? err.message : "Couldn't apply resolution");
    }
  };

  const busy = mutation.isPending;

  return (
    <Modal
      open
      onOpenChange={(o) => (o ? null : onClose())}
      ariaTitle="Resolve flagged anchor"
      ariaDescription={`Resolve the flagged anchor for ${anchor.pill_name}.`}
    >
      <ModalHeader
        eyebrow="Resolve flagged anchor"
        title={
          <>
            Resolve a flagged anchor in{" "}
            <span className="serif-it">{anchor.pill_name}</span>
          </>
        }
      />
      <p className="mb-3 text-[12.5px] text-ink-3">
        {anchor.excluded_reason ??
          "Flagged during the bootstrap generate-and-review cycle."}
      </p>
      <div
        className="grid grid-cols-3 gap-2"
        role="radiogroup"
        aria-label="Resolution"
        data-testid="anchor-resolve-tiles"
      >
        {tiles.map((t) => (
          <VerdictTile
            key={t.value}
            label={t.label}
            subtitle={t.subtitle}
            selected={action === t.value}
            disabled={busy}
            onSelect={() => {
              setAction(t.value);
              setRootError(null);
            }}
          />
        ))}
      </div>
      {rootError ? <FieldError msg={rootError} /> : null}

      {action === "substitute_wording" ? (
        <div className="mt-3">
          <Field label="Replacement config — JSON object" error={jsonError}>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={5}
              disabled={busy}
              data-testid="anchor-json-editor"
              className="w-full border border-line bg-bg-sunk px-3 py-2 font-mono text-[12px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </Field>
        </div>
      ) : null}

      <ModalActions>
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onApply}
          disabled={busy}
          data-testid="anchor-resolve-apply"
        >
          {busy ? "Applying…" : "Apply resolution"}
        </Button>
      </ModalActions>
    </Modal>
  );
}
