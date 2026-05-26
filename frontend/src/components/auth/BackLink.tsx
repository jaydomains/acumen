import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Auth-surface back link (FE-1 §C.1). Sits below the card on
 * /forgot, /reset/[token], /setup/[token]; design renders it as a
 * muted text link with a leading arrow glyph.
 */

export function BackLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center text-sm text-gray-600 hover:text-gray-900",
        className,
      )}
    >
      <span aria-hidden="true" className="mr-1">
        ←
      </span>
      {children}
    </Link>
  );
}
