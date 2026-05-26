"use client";

/**
 * TanStack Query provider boundary. Creates one QueryClient per
 * browser session (lazy singleton in `getQueryClient`) and provides
 * it to the tree. AC-CD19.
 */

import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";

export function QueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
