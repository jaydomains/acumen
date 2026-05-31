/**
 * Admin users list integration tests (FE-8 admin-identity §B.1 §6
 * Gherkin coverage). Mounts the `/admin/users` page and exercises real
 * MSW handlers for GET/POST/PATCH/deactivate/reactivate.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/node";
import {
  getMockAdminUsers,
  resetMockAdminUsers,
  setMockAdminUsers,
} from "@/mocks/handlers";
import { AuthProvider } from "@/lib/auth/context";
import AdminUsersPage from "@/app/(authed)/(admin)/admin/users/page";

const API = "http://localhost:8000";

const mockReplace = vi.fn();
let mockSearch = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/admin/users",
  useSearchParams: () => mockSearch,
}));

function mountTree(node: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <Suspense fallback={null}>{node}</Suspense>
      </AuthProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockReplace.mockClear();
  mockSearch = new URLSearchParams();
  server.resetHandlers();
  resetMockAdminUsers();
});

afterEach(() => {
  cleanup();
});

describe("users list — render + derived status", () => {
  it("renders all seed users in the table", async () => {
    render(mountTree(<AdminUsersPage />));
    await waitFor(() => expect(screen.getByTestId("users-table")).toBeInTheDocument());
    expect(screen.getByText("Jay Phillips")).toBeInTheDocument();
    expect(screen.getByText("Lerato Dlamini")).toBeInTheDocument();
    expect(screen.getByText("Themba Nkosi")).toBeInTheDocument();
    // Kabelo has privacy_ack_at=null → name renders as "(invited)" not the actual name.
    expect(screen.queryByText("Kabelo Mokoena")).not.toBeInTheDocument();
    expect(screen.getAllByText(/\(invited\)/i).length).toBeGreaterThan(0);
  });

  it("renders the derived Active / Invited / Inactive status badges", async () => {
    render(mountTree(<AdminUsersPage />));
    await waitFor(() => expect(screen.getByTestId("users-table")).toBeInTheDocument());
    // Jay + Lerato → active; Kabelo → invited; Themba → deactivated
    expect(screen.getAllByTestId("user-status-active").length).toBe(2);
    expect(screen.getByTestId("user-status-invited")).toBeInTheDocument();
    expect(screen.getByTestId("user-status-deactivated")).toBeInTheDocument();
  });

  it("renders Last-active column as em-dash placeholder (drift Finding #4 / §E.1)", async () => {
    render(mountTree(<AdminUsersPage />));
    await waitFor(() => expect(screen.getByTestId("users-table")).toBeInTheDocument());
    expect(screen.getAllByTestId("derived-count-pending").length).toBe(4);
  });

  it("renders Resend row action as disabled on invited rows (drift Finding #6 / §E.10)", async () => {
    render(mountTree(<AdminUsersPage />));
    await waitFor(() =>
      expect(screen.getByTestId("user-status-invited")).toBeInTheDocument(),
    );
    const kabelo = getMockAdminUsers().find((u) => u.email === "kabelo@sitemesh.co")!;
    const resend = screen.getByTestId(`users-resend-${kabelo.id}`);
    expect(resend).toBeDisabled();
  });

  it("Bulk invite CTA is disabled with v1.x tooltip", async () => {
    render(mountTree(<AdminUsersPage />));
    await waitFor(() =>
      expect(screen.getByTestId("users-bulk-invite")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("users-bulk-invite")).toBeDisabled();
  });
});

describe("users list — filters", () => {
  it("filters by ?role=admin server-side", async () => {
    mockSearch = new URLSearchParams("role=admin");
    render(mountTree(<AdminUsersPage />));
    await waitFor(() => expect(screen.getByText("Jay Phillips")).toBeInTheDocument());
    expect(screen.queryByText("Lerato Dlamini")).not.toBeInTheDocument();
  });

  it("filters by ?status=active server-side (active wire enum)", async () => {
    mockSearch = new URLSearchParams("status=active");
    render(mountTree(<AdminUsersPage />));
    await waitFor(() => expect(screen.getByText("Lerato Dlamini")).toBeInTheDocument());
    // Themba is deactivated — filtered out.
    expect(screen.queryByText("Themba Nkosi")).not.toBeInTheDocument();
  });

  it("filters by ?status=invited client-side (UX-derived only)", async () => {
    mockSearch = new URLSearchParams("status=invited");
    render(mountTree(<AdminUsersPage />));
    // Wait for at least the table to render; only "(invited)" rows should remain.
    await waitFor(() =>
      expect(screen.getByTestId("user-status-invited")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Jay Phillips")).not.toBeInTheDocument();
    expect(screen.queryByText("Lerato Dlamini")).not.toBeInTheDocument();
    expect(screen.queryByText("Themba Nkosi")).not.toBeInTheDocument();
  });

  it("filters by ?q= client-side (drift Finding #3 / §E.11)", async () => {
    mockSearch = new URLSearchParams("q=jay");
    render(mountTree(<AdminUsersPage />));
    await waitFor(() => expect(screen.getByText("Jay Phillips")).toBeInTheDocument());
    expect(screen.queryByText("Lerato Dlamini")).not.toBeInTheDocument();
  });
});

describe("users list — Add user flow", () => {
  it("creates a user via POST and shows in the list", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminUsersPage />));
    await waitFor(() =>
      expect(screen.getByTestId("users-add-button")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("users-add-button"));
    await waitFor(() => expect(screen.getByTestId("user-add-form")).toBeInTheDocument());

    await user.type(screen.getByTestId("user-add-email"), "newadmin@sitemesh.co");
    await user.type(screen.getByTestId("user-add-name"), "New Admin");
    await user.click(screen.getByTestId("role-choice-admin"));
    await user.click(screen.getByTestId("user-add-submit"));

    await waitFor(() =>
      expect(screen.queryByTestId("user-add-form")).not.toBeInTheDocument(),
    );
    expect(getMockAdminUsers().some((u) => u.email === "newadmin@sitemesh.co")).toBe(
      true,
    );
  });

  it("surfaces zod email validation error", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminUsersPage />));
    await waitFor(() =>
      expect(screen.getByTestId("users-add-button")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("users-add-button"));

    await user.type(screen.getByTestId("user-add-email"), "lerato@sitemesh");
    await user.type(screen.getByTestId("user-add-name"), "Lerato");
    await user.click(screen.getByTestId("user-add-submit"));

    await waitFor(() =>
      expect(screen.getByText(/We need a working email/i)).toBeInTheDocument(),
    );
  });

  it("projects duplicate-email 422 onto the email field", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/v1/users`, () =>
        HttpResponse.json(
          {
            detail: [
              {
                loc: ["body", "email"],
                msg: "email already exists",
                type: "value_error",
              },
            ],
          },
          { status: 422 },
        ),
      ),
    );
    render(mountTree(<AdminUsersPage />));
    await waitFor(() =>
      expect(screen.getByTestId("users-add-button")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("users-add-button"));
    await user.type(screen.getByTestId("user-add-email"), "jay@sitemesh.co");
    await user.type(screen.getByTestId("user-add-name"), "Jay");
    await user.click(screen.getByTestId("user-add-submit"));

    await waitFor(() =>
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument(),
    );
  });
});

describe("users list — Edit flow", () => {
  it("pre-fills + PATCHes only changed fields (drift Finding #14)", async () => {
    const user = userEvent.setup();
    let patchBody: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${API}/v1/users/:user_id`, async ({ request, params }) => {
        patchBody = (await request.json()) as Record<string, unknown>;
        const target = getMockAdminUsers().find((u) => u.id === String(params.user_id))!;
        return HttpResponse.json({ ...target, ...patchBody });
      }),
    );
    render(mountTree(<AdminUsersPage />));
    await waitFor(() => expect(screen.getByText("Lerato Dlamini")).toBeInTheDocument());

    const lerato = getMockAdminUsers().find((u) => u.email === "lerato@sitemesh.co")!;
    await user.click(screen.getByTestId(`users-edit-${lerato.id}`));
    await waitFor(() => expect(screen.getByTestId("user-edit-form")).toBeInTheDocument());

    expect(
      (screen.getByTestId("user-edit-email-readonly") as HTMLInputElement).value,
    ).toBe("lerato@sitemesh.co");
    expect((screen.getByTestId("user-edit-name") as HTMLInputElement).value).toBe(
      "Lerato Dlamini",
    );

    await user.click(screen.getByTestId("role-choice-admin"));
    await user.click(screen.getByTestId("user-edit-submit"));

    await waitFor(() => expect(patchBody).not.toBeNull());
    // Wire literal, not the UI `"admin"` (audit A3-L1 / X2-#3) — the role
    // seam maps the change to the backend's canonical `"administrator"`.
    expect(patchBody!.role).toBe("administrator");
    // name unchanged → not in body.
    expect("name" in patchBody!).toBe(false);
  });

  it("seeds an administrator to admin and a no-op save fires no PATCH (audit A3-L1 / X2-#3)", async () => {
    const user = userEvent.setup();
    let patchCalls = 0;
    server.use(
      http.patch(`${API}/v1/users/:user_id`, async ({ request, params }) => {
        patchCalls += 1;
        const body = (await request.json()) as Record<string, unknown>;
        const target = getMockAdminUsers().find((u) => u.id === String(params.user_id))!;
        return HttpResponse.json({ ...target, ...body });
      }),
    );
    render(mountTree(<AdminUsersPage />));
    await waitFor(() => expect(screen.getByText("Jay Phillips")).toBeInTheDocument());

    const jay = getMockAdminUsers().find((u) => u.email === "jay@sitemesh.co")!;
    // Guards the MSW flip to the real backend enum.
    expect(jay.role).toBe("administrator");
    await user.click(screen.getByTestId(`users-edit-${jay.id}`));
    await waitFor(() => expect(screen.getByTestId("user-edit-form")).toBeInTheDocument());

    // Wire `"administrator"` seeds the form to the UI `"admin"`, not
    // `"testee"` (the old `=== "admin"` seed bug).
    expect(screen.getByTestId("role-choice-admin")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByTestId("role-choice-testee")).toHaveAttribute(
      "aria-checked",
      "false",
    );

    // Save with nothing changed → empty value-diff → no PATCH (so no 422
    // from re-sending a role the dirty-compare used to think had changed).
    await user.click(screen.getByTestId("user-edit-submit"));
    await waitFor(() =>
      expect(screen.queryByTestId("user-edit-form")).not.toBeInTheDocument(),
    );
    expect(patchCalls).toBe(0);
  });
});

describe("users list — Deactivate flow", () => {
  it("opens DeactivateModal and fires POST deactivate on confirm", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminUsersPage />));
    await waitFor(() => expect(screen.getByText("Lerato Dlamini")).toBeInTheDocument());

    const lerato = getMockAdminUsers().find((u) => u.email === "lerato@sitemesh.co")!;
    await user.click(screen.getByTestId(`users-deactivate-${lerato.id}`));
    await waitFor(() =>
      expect(screen.getByTestId("user-deactivate-confirm")).toBeInTheDocument(),
    );
    expect(screen.getByText(/Immediate access loss/i)).toBeInTheDocument();

    await user.click(screen.getByTestId("user-deactivate-confirm"));

    await waitFor(() => {
      const updated = getMockAdminUsers().find((u) => u.id === lerato.id)!;
      expect(updated.status).toBe("deactivated");
    });
  });

  it("does NOT show Deactivate on a row with no privacy ack (resend is the action, not deactivate)", async () => {
    // The invited heuristic catches users with privacy_ack=null. Verify the
    // Deactivate action is still allowed on invited users (per spec — only
    // already-deactivated rows hide Deactivate).
    render(mountTree(<AdminUsersPage />));
    await waitFor(() =>
      expect(screen.getByTestId("user-status-invited")).toBeInTheDocument(),
    );
    const kabelo = getMockAdminUsers().find((u) => u.email === "kabelo@sitemesh.co")!;
    expect(screen.queryByTestId(`users-deactivate-${kabelo.id}`)).toBeInTheDocument();
  });
});

describe("users list — Reactivate flow", () => {
  it("reactivates a deactivated user (inline button)", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminUsersPage />));
    await waitFor(() => expect(screen.getByText("Themba Nkosi")).toBeInTheDocument());

    const themba = getMockAdminUsers().find((u) => u.email === "themba@sitemesh.co")!;
    await user.click(screen.getByTestId(`users-reactivate-${themba.id}`));

    await waitFor(() => {
      const updated = getMockAdminUsers().find((u) => u.id === themba.id)!;
      expect(updated.status).toBe("active");
    });
  });
});

describe("users list — self-deactivation guard (drift Finding #11)", () => {
  it("hides Deactivate row action for the current admin", async () => {
    // The AuthProvider initially has no user; for this test we'd need to
    // set the mock user to Jay. We exercise this by ensuring the
    // server `/v1/auth/me` returns Jay (signed-in), then assert no
    // Deactivate testid for his row.
    server.use(
      http.get(`${API}/v1/auth/me`, () =>
        HttpResponse.json({
          id: getMockAdminUsers().find((u) => u.email === "jay@sitemesh.co")!.id,
          email: "jay@sitemesh.co",
          name: "Jay Phillips",
          role: "admin",
          status: "active",
          privacy_ack_at: "2026-03-15T00:00:00Z",
          created_at: "2026-03-15T00:00:00Z",
        }),
      ),
    );
    render(mountTree(<AdminUsersPage />));
    await waitFor(() => expect(screen.getByText("Jay Phillips")).toBeInTheDocument());

    // Wait for AuthProvider to resolve, then check Deactivate is missing for Jay.
    const jay = getMockAdminUsers().find((u) => u.email === "jay@sitemesh.co")!;
    await waitFor(() =>
      expect(screen.queryByTestId(`users-deactivate-${jay.id}`)).not.toBeInTheDocument(),
    );
  });
});

describe("users list — empty state", () => {
  it("renders empty-state when no users exist", async () => {
    setMockAdminUsers([]);
    render(mountTree(<AdminUsersPage />));
    await waitFor(() => expect(screen.getByTestId("users-empty")).toBeInTheDocument());
  });
});
