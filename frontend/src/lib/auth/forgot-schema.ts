import { z } from "zod";

/**
 * Forgot-password schema (FE-1 §B.2.4). Only the email field; no
 * client-side rate-limit logic — the backend is privacy-preserving.
 */

export const forgotSchema = z.object({
  email: z.string().email("Enter a valid email address."),
});

export type ForgotInput = z.infer<typeof forgotSchema>;
