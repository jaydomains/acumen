/**
 * Repo-level 404 (FE-2-shell.md §B.15). Full-page posture covers both
 * unauth and authed unmatched routes — `next-found.tsx` is the catchall.
 */

import Link from "next/link";
import { BoundaryFrame } from "@/components/shell/BoundaryFrame";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <BoundaryFrame
      glyph={<span className="font-serif text-[34px] text-ink-3">404</span>}
      eyebrow="NOT FOUND"
      title={
        <>
          That <span className="serif-it">page</span> doesn&apos;t exist
        </>
      }
      body="The link may be old or mistyped. Try the dashboard or head back."
      actions={
        <Link href="/" className={buttonVariants()}>
          Go to dashboard →
        </Link>
      }
    />
  );
}
