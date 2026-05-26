import { cn } from "@/lib/utils";

/**
 * Auth surface coloured-bar callout (FE-1 §C.1). Tone-driven banner.
 *
 * `warn` / `danger` use ARIA `role="alert"` (assertive live region) —
 * these announce immediately because the user needs to react. `info`
 * and `ok` use `role="status"` (polite) so non-urgent messages don't
 * interrupt screen reader output mid-sentence.
 */

export type AuthNoticeTone = "warn" | "danger" | "info" | "ok";

const TONE_CLASSES: Record<AuthNoticeTone, string> = {
  warn: "border-amber-400 bg-amber-50 text-amber-900",
  danger: "border-red-400 bg-red-50 text-red-900",
  info: "border-blue-400 bg-blue-50 text-blue-900",
  ok: "border-emerald-400 bg-emerald-50 text-emerald-900",
};

const URGENT_TONES = new Set<AuthNoticeTone>(["warn", "danger"]);

export type AuthNoticeProps = {
  tone: AuthNoticeTone;
  title?: string | undefined;
  body: string;
  className?: string;
};

export function AuthNotice({ tone, title, body, className }: AuthNoticeProps) {
  const role = URGENT_TONES.has(tone) ? "alert" : "status";
  return (
    <div
      role={role}
      className={cn(
        "rounded-md border-l-4 p-3 text-sm",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {title ? <p className="font-medium">{title}</p> : null}
      <p className={title ? "mt-1" : undefined}>{body}</p>
    </div>
  );
}
