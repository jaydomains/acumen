/**
 * TanStack Query client (AC-CD19).
 *
 * Lazily created so server components don't accidentally share a
 * client across requests. Defaults are conservative: queries don't
 * refetch on window focus by default — opt in per-query when the
 * staleness model warrants it.
 */

import { QueryClient } from "@tanstack/react-query";

let client: QueryClient | undefined;

export const getQueryClient = (): QueryClient => {
  if (!client) {
    client = new QueryClient({
      defaultOptions: {
        queries: {
          refetchOnWindowFocus: false,
          retry: false,
          staleTime: 30_000,
        },
      },
    });
  }
  return client;
};
