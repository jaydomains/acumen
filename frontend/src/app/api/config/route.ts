/**
 * Runtime config probe (AC-CD19).
 *
 * Returns the values the browser needs to talk to the backend. Reads
 * the frontend container's server-side env at request time so the same
 * Docker image deploys against any backend by changing the env — no
 * rebuild required (multi-tenant).
 *
 * `force-dynamic` and `cache: "no-store"` (on the client side) ensure
 * a container restart with a different env is picked up immediately.
 * The response is tiny; the per-page-load fetch is cheap.
 */

export const dynamic = "force-dynamic";

export const GET = (): Response => {
  const apiBaseUrl =
    process.env.API_BASE_URL_PUBLIC ?? process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBaseUrl) {
    return Response.json(
      {
        error: {
          code: "config_missing",
          message: "API_BASE_URL_PUBLIC is not set on the frontend container",
          detail: null,
        },
      },
      { status: 500 },
    );
  }
  return Response.json({ apiBaseUrl });
};
