/**
 * parse-proposal-payload — LOCKED v1 contract for rendering
 * `PillProposalResponse.payload` in the proposal drawer
 * (FE-8 §B.4 §7 + §H(a) item 1 in `fe-specs/FE-8-admin-catalogue.md:551,669`).
 *
 * Backend persists proposal content under `payload.proposal.{...}`
 * (per `app/domain/catalogue.py:521–588`), but the spec's recognised-
 * field list also names hint shapes (`subject_hint`, `difficulty_hint`)
 * for the eventual real-AI-provider path. This helper accepts BOTH
 * shapes and falls back to formatted JSON for anything unrecognised —
 * matches Slice 4 drift Finding #9 resolution.
 */

export type ProposalDerivedStatus = "pending" | "approved" | "rejected" | "failed";

type Payload = Record<string, unknown> | null | undefined;

type ProposalLike = {
  status: string;
  payload?: Payload;
};

/**
 * Derive the frontend-visible status from the wire shape.
 *
 * Wire (`ProcessingTaskStatus`, `app/models.py:152`):
 *   pending | running | done | failed
 *
 * Wire (`payload.decision`, set when status flips to done — see
 * `app/domain/catalogue.py:594,620`):
 *   "approved" | "rejected" | undefined
 *
 * Derived (UI-visible):
 *   pending — proposal is queued or being processed
 *   approved / rejected — admin decision recorded on the proposal
 *   failed — backend pipeline errored before a decision could land
 */
export function deriveProposalStatus(p: ProposalLike): ProposalDerivedStatus {
  if (p.status === "failed") return "failed";
  if (p.status === "pending" || p.status === "running") return "pending";
  // status === "done" — decision MUST be on the payload
  const payload = p.payload as Record<string, unknown> | undefined;
  const decision = typeof payload?.decision === "string" ? payload.decision : null;
  if (decision === "approved") return "approved";
  if (decision === "rejected") return "rejected";
  // Defensive fallback: an old "done" row without a decision is
  // treated as approved (matches what the backend writes via
  // `loop.queue.approve` — the only path where decision can land
  // missing is a pre-§B.4 historical row). Surfaced as a v1
  // tolerance; future cleanup folds this into §E.
  return "approved";
}

export type ParsedRow = {
  key: string;
  label: string;
  value: string;
};

type RecognisedRow = {
  /** Field key in the persisted payload.proposal (or top-level payload). */
  source: string;
  /** Display label. */
  label: string;
  /** Coerces the raw value into a display string. */
  render: (v: unknown) => string;
};

const PASS_THROUGH = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
};

const PROPOSAL_FIELDS: RecognisedRow[] = [
  { source: "name", label: "Name", render: PASS_THROUGH },
  { source: "description", label: "Description", render: PASS_THROUGH },
  {
    source: "subject_hint",
    label: "Subject (suggested)",
    render: PASS_THROUGH,
  },
  {
    source: "subject_id",
    label: "Subject (resolved)",
    render: PASS_THROUGH,
  },
  {
    source: "difficulty_hint",
    label: "Difficulty (suggested)",
    render: PASS_THROUGH,
  },
  {
    source: "available_difficulty_min",
    label: "Difficulty min",
    render: PASS_THROUGH,
  },
  {
    source: "available_difficulty_max",
    label: "Difficulty max",
    render: PASS_THROUGH,
  },
  {
    source: "related_pill_ids",
    label: "Related pill ids",
    render: (v) =>
      Array.isArray(v) ? v.map((x) => String(x)).join(", ") : PASS_THROUGH(v),
  },
];

export type ParsedProposalPayload =
  | { kind: "structured"; rows: ParsedRow[] }
  | { kind: "raw"; json: string };

/**
 * Parse a proposal payload into structured rows for the drawer.
 *
 * Reads from `payload.proposal.{...}` first (backend's persisted
 * shape per `app/domain/catalogue.py:521`), then falls back to the
 * top-level `payload.{...}` (anticipated future-AI-provider shape).
 * If neither path yields any recognised fields, returns a raw JSON
 * blob for the drawer to render verbatim per §B.4 §7.
 */
export function parseProposalPayload(payload: Payload): ParsedProposalPayload {
  if (!payload || typeof payload !== "object") {
    return { kind: "raw", json: JSON.stringify(payload ?? null, null, 2) };
  }
  const nested =
    payload.proposal && typeof payload.proposal === "object"
      ? (payload.proposal as Record<string, unknown>)
      : null;
  const sources: Record<string, unknown>[] = [];
  if (nested) sources.push(nested);
  sources.push(payload as Record<string, unknown>);

  const rows: ParsedRow[] = [];
  const seen = new Set<string>();
  for (const field of PROPOSAL_FIELDS) {
    if (seen.has(field.source)) continue;
    for (const source of sources) {
      if (field.source in source) {
        rows.push({
          key: field.source,
          label: field.label,
          value: field.render(source[field.source]),
        });
        seen.add(field.source);
        break;
      }
    }
  }
  if (rows.length === 0) {
    return { kind: "raw", json: JSON.stringify(payload, null, 2) };
  }
  return { kind: "structured", rows };
}
