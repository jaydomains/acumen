/**
 * AcumenMark — brand logo SVG. Ported from `prototype/shell.jsx::AcumenMark`.
 *
 * Two ascending diagonals (the legs of an A, stopping short of the apex),
 * the apex dot ("moment of acumen"), and the faint crossbar dot. The
 * `accent` variant tints the apex dot ochre.
 *
 * Stroke colour inherits via `currentColor` so consumers colour through
 * Tailwind text utilities. FE-1 ships its own AuthLogo on the auth pages;
 * this is the shell-side logo (kept independent to avoid touching FE-1
 * auth code per FE-2 scope discipline).
 */

import type { SVGProps } from "react";

export type AcumenMarkProps = {
  size?: number;
  accent?: boolean;
} & Omit<SVGProps<SVGSVGElement>, "width" | "height">;

export function AcumenMark({ size = 28, accent = false, ...rest }: AcumenMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      aria-label="Acumen"
      {...rest}
    >
      <path
        d="M 5 28 L 14 9"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M 18 9 L 27 28"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle
        cx="16"
        cy="6.4"
        r="2.4"
        className={accent ? "fill-accent" : "fill-current"}
      />
      <circle cx="16" cy="21" r="1.4" fill="currentColor" opacity="0.45" />
    </svg>
  );
}
