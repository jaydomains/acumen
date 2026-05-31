"use client";

/**
 * UsersList — admin users list per FE-8 admin-identity §B.1
 * (`fe-specs/FE-8-admin-identity.md:66–311`).
 *
 * URL state: `?q={search}&role={admin|testee|all}&status={active|invited|deactivated|all}`.
 * Wire takes `role + status` (with status mapped to `active|deactivated`
 * — "invited" is derived client-side via `deriveUserStatus`). `q` is
 * client-side per §E.11 + drift Finding #3.
 *
 * Modal state: ephemeral (NOT in URL) per §B.1 §1.
 *
 * Columns: Name (or "(invited)" muted) / Email / Role / Last active
 * (em-dash per §E.1 + drift Finding #4) / Status (Active/Invited/
 * Inactive derived per Finding #5) / row actions.
 *
 * Self-deactivation guard: Deactivate row action hidden when
 * `user.id === auth.user.id` per spec §B.1 §7 + drift Finding #11.
 *
 * Resend setup row action ships as a disabled affordance per §E.10 +
 * drift Finding #6 — endpoint TBD.
 *
 * Single-string `name` field (not first+last split per spec §F.3) for
 * Slice 8 simplicity; backend stores single string.
 *
 * `Pill tone="soft"` doesn't exist in `PillTone` (drift Finding #8) —
 * inline spans with text-ink-3 used instead, matching Slice 5/6 styling.
 *
 * Deactivate reason textarea dropped per drift Finding #7 — backend
 * accepts no body; captured text would go nowhere.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { applyApiErrorToForm } from "@/lib/api/form-errors";
import { useAuth } from "@/lib/auth/context";
import { fromWireRole, toWireRole } from "@/lib/auth/role";
import { PageHeader } from "@/components/shell/PageHeader";
import { FilterBar } from "@/components/admin/filter-bar";
import { Modal, ModalActions, ModalHeader } from "@/components/admin/modal";
import { Field, FieldError } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  flattenUsers,
  useAdminUsers,
  useCreateUser,
  useDeactivateUser,
  useReactivateUser,
  useUpdateUser,
  type UserResponse,
} from "@/lib/queries/admin-users";
import { deriveUserStatus } from "@/lib/identity/derive-invited-status";

type RoleFilter = "admin" | "testee" | "all";
type UrlStatusFilter = "active" | "invited" | "deactivated" | "all";

type ModalState =
  | { kind: "closed" }
  | { kind: "add" }
  | { kind: "edit"; user: UserResponse }
  | { kind: "deactivate"; user: UserResponse };

const userAddSchema = z.object({
  email: z
    .string()
    .email("We need a working email — that's how the setup link gets there."),
  name: z.string().min(1, "Name is required.").max(255),
  role: z.enum(["admin", "testee"]),
});
type UserAddInput = z.infer<typeof userAddSchema>;

const userEditSchema = z.object({
  name: z.string().min(1, "Name is required.").max(255),
  role: z.enum(["admin", "testee"]),
});
type UserEditInput = z.infer<typeof userEditSchema>;

function isRoleFilter(v: string | null): v is RoleFilter {
  return v === "admin" || v === "testee" || v === "all";
}

function isUrlStatusFilter(v: string | null): v is UrlStatusFilter {
  return v === "active" || v === "invited" || v === "deactivated" || v === "all";
}

export function UsersList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams?.get("q") ?? "";
  const role: RoleFilter = isRoleFilter(searchParams?.get("role") ?? null)
    ? (searchParams!.get("role") as RoleFilter)
    : "all";
  const status: UrlStatusFilter = isUrlStatusFilter(searchParams?.get("status") ?? null)
    ? (searchParams!.get("status") as UrlStatusFilter)
    : "all";

  const [modal, setModal] = useState<ModalState>({ kind: "closed" });

  // Translate the URL status filter to the wire's `active|deactivated|null`.
  // "invited" + "all" → no wire filter; client-side narrowing handles them.
  const list = useAdminUsers({
    ...(role !== "all" ? { role: role as "admin" | "testee" } : {}),
    ...(status === "active" || status === "deactivated" ? { status } : {}),
  });
  const allUsers = useMemo(() => flattenUsers(list.data), [list.data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allUsers.filter((u) => {
      if (status === "invited" && deriveUserStatus(u) !== "invited") return false;
      if (needle) {
        const inName = u.name.toLowerCase().includes(needle);
        const inEmail = u.email.toLowerCase().includes(needle);
        if (!inName && !inEmail) return false;
      }
      return true;
    });
  }, [allUsers, q, status]);

  const writeParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (value === null || value === "" || value === "all") params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.replace(qs ? `/admin/users?${qs}` : "/admin/users");
  };

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Users"
        subtitle="Invite admins or testees; deactivate when access ends. Setup emails fire automatically."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled
              aria-disabled
              title="Coming in v1.x"
              data-testid="users-bulk-invite"
            >
              Bulk invite
            </Button>
            <Button
              onClick={() => setModal({ kind: "add" })}
              data-testid="users-add-button"
            >
              + Add user
            </Button>
          </div>
        }
      />

      <FilterBar
        searchValue={q}
        onSearchChange={(v) => writeParam("q", v)}
        searchPlaceholder="Search by name or email…"
        segments={[
          {
            label: "Role",
            value: role,
            options: [
              { label: "All", value: "all" },
              { label: "Admin", value: "admin" },
              { label: "Testee", value: "testee" },
            ],
            onChange: (next) => writeParam("role", next),
          },
          {
            label: "Status",
            value: status,
            options: [
              { label: "All", value: "all" },
              { label: "Active", value: "active" },
              { label: "Invited", value: "invited" },
              { label: "Inactive", value: "deactivated" },
            ],
            onChange: (next) => writeParam("status", next),
          },
        ]}
      />

      <UsersBody
        list={list}
        users={filtered}
        hasFilter={q.length > 0 || role !== "all" || status !== "all"}
        onEdit={(user) => setModal({ kind: "edit", user })}
        onDeactivate={(user) => setModal({ kind: "deactivate", user })}
      />

      {modal.kind === "add" ? (
        <UserAddModal onClose={() => setModal({ kind: "closed" })} />
      ) : null}

      {modal.kind === "edit" ? (
        <UserEditModal user={modal.user} onClose={() => setModal({ kind: "closed" })} />
      ) : null}

      {modal.kind === "deactivate" ? (
        <DeactivateModal user={modal.user} onClose={() => setModal({ kind: "closed" })} />
      ) : null}
    </>
  );
}

type UsersBodyProps = {
  list: ReturnType<typeof useAdminUsers>;
  users: UserResponse[];
  hasFilter: boolean;
  onEdit: (user: UserResponse) => void;
  onDeactivate: (user: UserResponse) => void;
};

function UsersBody({ list, users, hasFilter, onEdit, onDeactivate }: UsersBodyProps) {
  const sentinelRef = useRef<HTMLTableRowElement | null>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  const { user: authUser } = useAuth();
  const reactivate = useReactivateUser();

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    if (typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (list.isPending) {
    return (
      <div className="mt-5" data-testid="users-loading">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-full mb-2" />
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div
        className="mt-5 border border-line bg-bg-raised p-10 text-center"
        data-testid="users-empty"
      >
        <div className="font-serif text-[20px] text-ink mb-2">
          {hasFilter ? "No users match your filters." : "No users yet."}
        </div>
        <div className="text-[13px] text-ink-3">
          {hasFilter
            ? "Try clearing a filter or searching for a different term."
            : "Add your first user to get started."}
        </div>
      </div>
    );
  }

  return (
    <table className="mt-5 w-full text-[13px]" data-testid="users-table">
      <thead>
        <tr className="border-b border-line text-ink-3 text-left">
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2">
            Name
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[24%]">
            Email
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[10%]">
            Role
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[12%]">
            Last active
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[14%]">
            Status
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[18%] text-right">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => {
          const derived = deriveUserStatus(u);
          const isSelf = authUser?.id === u.id;
          const handleReactivate = async () => {
            try {
              await reactivate.mutateAsync(u.id);
              toast(`Reactivated ${u.name || u.email}`);
            } catch (err) {
              const msg =
                err instanceof ApiError ? err.message : "Couldn't reactivate — try again";
              toast.error(msg);
            }
          };
          return (
            <tr
              key={u.id}
              className={cn(
                "border-b border-line",
                derived === "deactivated" && "opacity-70",
              )}
              data-testid={`users-row-${u.id}`}
            >
              <td className="py-2.5 px-2">
                {derived === "invited" ? (
                  <span className="text-ink-3 italic">(invited)</span>
                ) : (
                  <span className="font-medium text-ink">{u.name || "—"}</span>
                )}
              </td>
              <td className="py-2.5 px-2 font-mono text-ink-2 text-[12px]">{u.email}</td>
              <td className="py-2.5 px-2">
                <span
                  className={cn(
                    "font-mono text-[10.5px] uppercase tracking-[0.08em]",
                    fromWireRole(u.role) === "admin" ? "text-accent" : "text-ink-3",
                  )}
                >
                  {fromWireRole(u.role) ?? u.role}
                </span>
              </td>
              <td className="py-2.5 px-2 text-ink-3" data-testid="derived-count-pending">
                —
              </td>
              <td className="py-2.5 px-2">
                <StatusBadge status={derived} />
              </td>
              <td className="py-2.5 px-2 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(u)}
                  data-testid={`users-edit-${u.id}`}
                >
                  Edit
                </Button>
                {derived === "invited" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled
                    aria-disabled
                    title="Resend endpoint pending"
                    data-testid={`users-resend-${u.id}`}
                  >
                    Resend
                  </Button>
                ) : null}
                {derived === "deactivated" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReactivate}
                    disabled={reactivate.isPending}
                    data-testid={`users-reactivate-${u.id}`}
                  >
                    Reactivate
                  </Button>
                ) : null}
                {derived !== "deactivated" && !isSelf ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeactivate(u)}
                    data-testid={`users-deactivate-${u.id}`}
                  >
                    Deactivate
                  </Button>
                ) : null}
              </td>
            </tr>
          );
        })}
        {list.hasNextPage ? (
          <tr ref={sentinelRef} data-testid="users-sentinel" aria-hidden="true">
            <td colSpan={6} className="py-3 text-center text-ink-3 text-[12px]">
              {list.isFetchingNextPage ? "Loading more…" : ""}
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

function StatusBadge({ status }: { status: "active" | "invited" | "deactivated" }) {
  const map: Record<typeof status, { label: string; cls: string; testid: string }> = {
    active: { label: "Active", cls: "text-success", testid: "user-status-active" },
    invited: {
      label: "Invited · not set up",
      cls: "text-warn",
      testid: "user-status-invited",
    },
    deactivated: {
      label: "Inactive",
      cls: "text-ink-3",
      testid: "user-status-deactivated",
    },
  };
  const m = map[status];
  return (
    <span
      className={cn("font-mono text-[10.5px] uppercase tracking-[0.08em]", m.cls)}
      data-testid={m.testid}
    >
      {m.label}
    </span>
  );
}

function UserAddModal({ onClose }: { onClose: () => void }) {
  const form = useForm<UserAddInput>({
    resolver: zodResolver(userAddSchema),
    mode: "onSubmit",
    defaultValues: { email: "", name: "", role: "testee" },
  });
  const mutation = useCreateUser();

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({
        email: values.email,
        name: values.name,
        role: toWireRole(values.role),
      });
      toast(`Setup email sent to ${values.email}`);
      onClose();
    } catch (err) {
      applyApiErrorToForm(err, form, { fieldMap: { EMAIL_TAKEN: "email" } });
    }
  });

  return (
    <Modal
      open
      onOpenChange={(o) => (o ? null : onClose())}
      ariaTitle="Add user"
      ariaDescription="Create a new admin or testee and send them a setup email."
    >
      <ModalHeader
        eyebrow="New user"
        title={
          <>
            Add a <span className="serif-it">user</span>
          </>
        }
      />
      <form onSubmit={onSubmit} noValidate data-testid="user-add-form">
        <div className="mb-3 border border-line bg-bg-sunk px-3 py-2 text-[12px] text-ink-3">
          We&rsquo;ll send a setup link to this email. It works for 7 days.
        </div>
        <Field label="Email" error={form.formState.errors.email?.message ?? null}>
          <Input
            {...form.register("email")}
            type="email"
            autoFocus
            disabled={mutation.isPending}
            data-testid="user-add-email"
          />
        </Field>
        <Field label="Name" error={form.formState.errors.name?.message ?? null}>
          <Input
            {...form.register("name")}
            disabled={mutation.isPending}
            data-testid="user-add-name"
          />
        </Field>
        <Field label="Role" error={form.formState.errors.role?.message ?? null}>
          <RoleChoice
            value={form.watch("role")}
            onChange={(r) =>
              form.setValue("role", r, { shouldValidate: true, shouldDirty: true })
            }
            disabled={mutation.isPending}
          />
        </Field>
        {form.formState.errors.root?.message ? (
          <FieldError msg={form.formState.errors.root.message} />
        ) : null}
        <ModalActions>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={mutation.isPending}
            data-testid="user-add-submit"
          >
            {mutation.isPending ? "Sending setup email…" : "Send setup email"}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}

function UserEditModal({ user, onClose }: { user: UserResponse; onClose: () => void }) {
  const form = useForm<UserEditInput>({
    resolver: zodResolver(userEditSchema),
    mode: "onSubmit",
    defaultValues: {
      name: user.name,
      // Seed from the wire literal via the shared seam: a real admin's
      // wire role is `"administrator"`, which the old `=== "admin"` check
      // missed → the form seeded to `"testee"` (wrong role shown).
      role: fromWireRole(user.role) ?? "testee",
    },
  });
  const mutation = useUpdateUser();

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      // Value-diff against the persisted user (Slice 7 precedent —
      // more reliable than rhf's `dirtyFields`).
      const body: { name?: string; role?: string } = {};
      if (values.name !== user.name) body.name = values.name;
      // Compare on the wire literal: `values.role` is the UI `"admin"`,
      // `user.role` is the wire `"administrator"`. Comparing them raw
      // never matched → every save resent the role as `"admin"` → 422.
      const wireRole = toWireRole(values.role);
      if (wireRole !== user.role) body.role = wireRole;
      if (Object.keys(body).length > 0) {
        await mutation.mutateAsync({ userId: user.id, body });
      }
      toast("User updated");
      onClose();
    } catch (err) {
      applyApiErrorToForm(err, form);
    }
  });

  return (
    <Modal
      open
      onOpenChange={(o) => (o ? null : onClose())}
      ariaTitle="Edit user"
      ariaDescription="Edit the name and role of this user."
    >
      <ModalHeader
        eyebrow="Edit user"
        title={
          <>
            Edit <span className="serif-it">{user.name || user.email}</span>
          </>
        }
      />
      <form onSubmit={onSubmit} noValidate data-testid="user-edit-form">
        <Field label="Email">
          <Input
            value={user.email}
            readOnly
            disabled
            data-testid="user-edit-email-readonly"
          />
        </Field>
        <Field label="Name" error={form.formState.errors.name?.message ?? null}>
          <Input
            {...form.register("name")}
            autoFocus
            disabled={mutation.isPending}
            data-testid="user-edit-name"
          />
        </Field>
        <Field label="Role" error={form.formState.errors.role?.message ?? null}>
          <RoleChoice
            value={form.watch("role")}
            onChange={(r) =>
              form.setValue("role", r, { shouldValidate: true, shouldDirty: true })
            }
            disabled={mutation.isPending}
          />
        </Field>
        {form.formState.errors.root?.message ? (
          <FieldError msg={form.formState.errors.root.message} />
        ) : null}
        <ModalActions>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={mutation.isPending}
            data-testid="user-edit-submit"
          >
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}

function DeactivateModal({ user, onClose }: { user: UserResponse; onClose: () => void }) {
  const mutation = useDeactivateUser();
  const onConfirm = async () => {
    try {
      await mutation.mutateAsync(user.id);
      toast("User deactivated");
      onClose();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Couldn't deactivate — try again";
      toast.error(msg);
    }
  };
  return (
    <Modal
      open
      onOpenChange={(o) => (o ? null : onClose())}
      ariaTitle="Deactivate user"
      ariaDescription="Confirm deactivation of this user."
    >
      <ModalHeader
        eyebrow="Deactivate user"
        title={
          <>
            Deactivate <span className="serif-it">{user.name || user.email}</span>?
          </>
        }
      />
      <div className="border border-danger bg-bg-sunk px-3 py-2 text-[12.5px] text-danger mb-3">
        Immediate access loss. Any attempt in flight is paused; attempt and result history
        is preserved (AC-D14).
      </div>
      <p className="text-[13px] text-ink-2">
        The user can be reactivated later from this same list.
      </p>
      <ModalActions>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={mutation.isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={onConfirm}
          disabled={mutation.isPending}
          data-testid="user-deactivate-confirm"
        >
          {mutation.isPending ? "Deactivating…" : "Deactivate"}
        </Button>
      </ModalActions>
    </Modal>
  );
}

function RoleChoice({
  value,
  onChange,
  disabled,
}: {
  value: "admin" | "testee";
  onChange: (next: "admin" | "testee") => void;
  disabled?: boolean;
}) {
  const options: Array<{ value: "admin" | "testee"; label: string; hint: string }> = [
    {
      value: "testee",
      label: "Testee",
      hint: "Takes tests; sees their own results.",
    },
    {
      value: "admin",
      label: "Admin",
      hint: "Authors content; manages users + assignments.",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Role">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            data-testid={`role-choice-${opt.value}`}
            className={cn(
              "text-left border px-3 py-2.5",
              active
                ? "border-ink bg-ink text-bg-raised"
                : "border-line bg-bg-raised text-ink-2 hover:bg-bg-sunk",
              disabled && "opacity-60 cursor-not-allowed",
            )}
          >
            <div className="font-medium text-[13px]">{opt.label}</div>
            <div
              className={cn(
                "text-[11.5px] mt-0.5",
                active ? "text-bg-raised/70" : "text-ink-3",
              )}
            >
              {opt.hint}
            </div>
          </button>
        );
      })}
    </div>
  );
}
