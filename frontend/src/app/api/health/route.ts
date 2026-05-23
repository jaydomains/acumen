/**
 * Frontend healthcheck endpoint (AC-CD19).
 *
 * Used by the `acumen-frontend` docker service healthcheck. Returns
 * 200 unconditionally — Next.js itself being up is the actual signal.
 */

export const GET = () => Response.json({ status: "ok" });
