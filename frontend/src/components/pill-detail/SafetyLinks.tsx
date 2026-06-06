/**
 * SafetyLinks — right-column curated external references for safety
 * pills (FE-3 §B.4). Mirrors `pill-detail.jsx:332–388`.
 *
 * All anchors render with `target="_blank" rel="noopener noreferrer"`
 * (FE-3 §B.4.7). The serif index (00, 01, …) gives the list a
 * curated, dossier-like feel matching the design source.
 *
 * The backend `SafetyLinkResponse` schema is leaner than the
 * prototype: only url / title / source / last_verified_at. The
 * prototype's `kind` (REGULATOR / STANDARD / CASE STUDIES) and
 * `estimated_minutes` are not in the v1 contract; we render only
 * what the schema gives us.
 */

import type { SafetyLinkResponse } from "@/lib/queries/pills";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/primitives/Icon";

export type SafetyLinksProps = {
  links: SafetyLinkResponse[];
};

export function SafetyLinks({ links }: SafetyLinksProps) {
  return (
    <Card data-testid="safety-links" className="flex flex-col gap-5 p-6">
      <div className="flex items-baseline justify-between gap-3">
        <div className="eyebrow">Curated industry sources</div>
        <span
          className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-4"
          aria-hidden
        >
          {links.length} source{links.length === 1 ? "" : "s"}
        </span>
      </div>

      <p className="text-[13.5px] leading-[1.6] text-ink-2">
        These are the authoritative references for this pill. Read them in order; the test
        exercises understanding of the underlying material.
      </p>

      <ol className="flex flex-col gap-5">
        {links.map((link, i) => (
          <SafetyLink key={link.url} index={i} link={link} />
        ))}
      </ol>
    </Card>
  );
}

function SafetyLink({ index, link }: { index: number; link: SafetyLinkResponse }) {
  const indexLabel = String(index).padStart(2, "0");
  return (
    <li className="flex gap-4" data-testid={`safety-link-${index}`}>
      <span className="shrink-0 font-serif text-[26px] leading-none text-ink-3">
        {indexLabel}
      </span>
      <div className="flex flex-col gap-1.5 min-w-0">
        {link.source ? (
          <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-4">
            {link.source}
          </span>
        ) : null}
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-baseline gap-1.5 text-[14.5px] font-medium text-ink underline-offset-4 hover:underline truncate"
          title={link.title ?? link.url}
        >
          <span className="truncate">{link.title ?? link.url}</span>
          <Icon name="external" size={12} className="shrink-0 translate-y-[1px]" />
        </a>
        {link.last_verified_at ? (
          <span className="font-mono text-[10.5px] tracking-[0.04em] text-ink-4">
            verified {link.last_verified_at.slice(0, 10)}
          </span>
        ) : null}
      </div>
    </li>
  );
}
