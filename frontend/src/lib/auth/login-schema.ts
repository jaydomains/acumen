import { z } from "zod";

/**
 * Login form schema (FE-1 §B.1.4). `mode: "onSubmit"` per spec — the
 * design shows no on-blur validation; errors only surface after the
 * user clicks Sign in.
 */

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export type LoginInput = z.infer<typeof loginSchema>;
