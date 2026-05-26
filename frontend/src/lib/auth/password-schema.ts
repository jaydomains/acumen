import { z } from "zod";

/**
 * Password-rules schema (FE-1 §B.3.4). The four design rules are
 * surfaced individually so `PasswordRulesChecklist` can drive its
 * live pass/fail UI off the same predicates.
 *
 * Backend enforces 8..1024; the client gates the stricter design
 * floor at 12 (§B.3.7 — intentional, no drift).
 */

export const passwordRulePredicates = {
  length: (v: string) => v.length >= 12,
  lower: (v: string) => /[a-z]/.test(v),
  upper: (v: string) => /[A-Z]/.test(v),
  number: (v: string) => /\d/.test(v),
  symbol: (v: string) => /[^A-Za-z0-9]/.test(v),
} as const;

export type PasswordRuleKey = keyof typeof passwordRulePredicates;

export const PASSWORD_RULE_LABELS: Record<PasswordRuleKey, string> = {
  length: "At least 12 characters.",
  lower: "Needs a lowercase letter.",
  upper: "Needs an uppercase letter.",
  number: "Needs a number.",
  symbol: "Needs a symbol.",
};

export const passwordRule = z
  .string()
  .min(12, PASSWORD_RULE_LABELS.length)
  .regex(/[a-z]/, PASSWORD_RULE_LABELS.lower)
  .regex(/[A-Z]/, PASSWORD_RULE_LABELS.upper)
  .regex(/\d/, PASSWORD_RULE_LABELS.number)
  .regex(/[^A-Za-z0-9]/, PASSWORD_RULE_LABELS.symbol);

export const passwordSchema = z
  .object({
    new_password: passwordRule,
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    path: ["confirm_password"],
    message: "Passwords don't match — re-type the new one.",
  });

export type PasswordInput = z.infer<typeof passwordSchema>;
