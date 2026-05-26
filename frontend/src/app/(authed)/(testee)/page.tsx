"use client";

/**
 * Testee dashboard at `/`. Per FE-2-shell.md §B.13 the FE-2 body is an
 * empty placeholder — PageHeader only, no Stat block (per Slice 4
 * user amendment). FE-3 builds the real dashboard content on top of
 * this scaffold.
 *
 * URL stays `/` because both route groups `(authed)` and `(testee)`
 * are parenthesised — Next.js strips them from the URL.
 */

import { useAuth } from "@/lib/auth/context";
import { PageHeader } from "@/components/shell/PageHeader";

export default function TesteeDashboardPage() {
  const { user } = useAuth();
  const displayName = user?.name?.trim() || user?.email || "there";

  // TODO(FE-3): real dashboard content (greeting + stats + assignments
  // + recommendations + recent attempts + Today's Reading widget).
  return (
    <PageHeader
      eyebrow="DASHBOARD"
      title={`Welcome, ${displayName}`}
      subtitle="You have no assignments yet"
    />
  );
}
