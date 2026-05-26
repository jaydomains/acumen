/**
 * MaterialReady — right-column AI-generated explainer
 * (FE-3 §B.3 §2). Mirrors `pill-detail.jsx:183–292`.
 *
 * v1 default is paragraph-split plain-text rendering. If the backend
 * starts emitting Markdown (§H(b) item 9), swap in `react-markdown`
 * here — the prop contract stays the same.
 *
 * Regenerate is a `useMutation` (not a query); the button shows a
 * pending state and the small "regenerating" badge appears top-right
 * so the user knows fresh content is on its way.
 */

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/primitives/Icon";

export type MaterialReadyProps = {
  content: string;
  cached: boolean;
  served_at: string | null;
  onRegenerate: () => void;
  regenerating: boolean;
};

export function MaterialReady({
  content,
  cached,
  served_at,
  onRegenerate,
  regenerating,
}: MaterialReadyProps) {
  return (
    <Card data-testid="material-ready" className="flex flex-col gap-4 p-6">
      <div className="flex items-baseline justify-between gap-3">
        <div className="eyebrow">Explainer · claude-sonnet-4-5</div>
        {regenerating ? (
          <div
            data-testid="material-regenerating-badge"
            className="flex items-center gap-1.5 text-accent-ink"
          >
            <span
              className="inline-block h-1.5 w-1.5 animate-pulse bg-accent"
              aria-hidden
            />
            <span className="font-mono text-[10.5px] uppercase tracking-[0.08em]">
              Regenerating
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 text-[14.5px] leading-[1.65] text-ink">
        {splitParagraphs(content).map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-4">
          {cached ? "cached" : "fresh"}
          {served_at ? ` · served ${formatServedAt(served_at)}` : null}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRegenerate}
          disabled={regenerating}
          data-testid="material-regenerate"
        >
          <Icon name="sparkles" size={14} />
          Regenerate
        </Button>
      </div>
    </Card>
  );
}

/**
 * Plain-text content splits on blank lines into paragraphs. Single
 * newlines stay inside a paragraph so the body reads naturally
 * regardless of the backend's wrapping choices.
 */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function formatServedAt(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC";
  } catch {
    return iso;
  }
}
