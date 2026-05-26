import { cn } from "@/lib/utils";
import {
  PASSWORD_RULE_LABELS,
  passwordRulePredicates,
  type PasswordRuleKey,
} from "@/lib/auth/password-schema";

/**
 * Live 4-rule password checklist (FE-1 §C.1, §B.3.4).
 *
 * Renders the five rule labels and re-evaluates each predicate
 * against the current password value on every keystroke (no
 * debounce, per spec §B.3.7). Passing rules show a green check;
 * failing rules show a grey hyphen. Pure presentation — the form
 * still validates via zod.
 */

const ORDER: PasswordRuleKey[] = ["length", "lower", "upper", "number", "symbol"];

export function PasswordRulesChecklist({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <ul className={cn("space-y-1 text-sm", className)} aria-label="Password rules">
      {ORDER.map((key) => {
        const passes = passwordRulePredicates[key](value);
        return (
          <li
            key={key}
            className={cn(
              "flex items-center gap-2",
              passes ? "text-emerald-700" : "text-gray-500",
            )}
            data-rule={key}
            data-passes={passes ? "true" : "false"}
          >
            <span
              aria-hidden="true"
              className={cn(
                "inline-flex h-4 w-4 items-center justify-center rounded-full border text-xs",
                passes
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-gray-300 bg-white text-gray-400",
              )}
            >
              {passes ? "✓" : "–"}
            </span>
            <span>{PASSWORD_RULE_LABELS[key]}</span>
          </li>
        );
      })}
    </ul>
  );
}
