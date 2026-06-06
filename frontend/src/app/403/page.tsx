"use client";

/**
 * /403 landing — fired by the role-mismatch redirect inside
 * (testee)/(admin) layouts when a user's role doesn't match the
 * required role. Per FE-2-shell.md §B.17.
 *
 * Full-page posture — the 403 is a navigation destination, not a
 * route-error boundary.
 *
 * Both the denied route and the required role ride along on the URL:
 *   ?from=<encoded path>   — surfaced as diagnostic in the footer
 *                            (usePathname() alone returns "/403"
 *                            after the redirect, which is useless).
 *   ?required=<role>       — drives the dynamic "for administrators"
 *                            / "for testees" copy + the footer's
 *                            "required role" line. Without it, the
 *                            copy hardcoded "administrators" was
 *                            wrong when an admin hit a testee-only
 *                            route.
 *
 * Wrapped in Suspense so Next 15 accepts useSearchParams in a page.
 */

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/primitives/Icon";
import { BoundaryFrame } from "@/components/shell/BoundaryFrame";
import { DashboardLink } from "@/components/shell/DashboardLink";

const REQUIRED_LABEL: Record<string, string> = {
  admin: "administrators",
  testee: "testees",
};

function ForbiddenContent() {
  const searchParams = useSearchParams();
  const deniedRoute = searchParams.get("from") ?? "/";
  const requiredRole = searchParams.get("required") ?? "admin";
  const requiredPlural = REQUIRED_LABEL[requiredRole] ?? `${requiredRole}s`;

  return (
    <BoundaryFrame
      glyph={<Icon name="lock" size={24} />}
      eyebrow="NO ACCESS"
      title={
        <>
          This area is <span className="serif-it">for {requiredPlural}</span>
        </>
      }
      body="Your account doesn't have access. Ask an admin if you need elevated permissions."
      actions={<DashboardLink />}
      footer={
        <div className="space-y-1">
          <div>
            <span className="text-ink-3">route</span> <code>{deniedRoute}</code>
          </div>
          <div>
            <span className="text-ink-3">required role</span> <code>{requiredRole}</code>
          </div>
        </div>
      }
    />
  );
}

export default function ForbiddenPage() {
  return (
    <Suspense fallback={null}>
      <ForbiddenContent />
    </Suspense>
  );
}
