"use client";

/**
 * GroupDetail — admin group membership view per FE-8 §B.3
 * (`fe-specs/FE-8-admin-identity.md:453–649`).
 *
 * Members list is DERIVED client-side from `group.member_ids[]` joined
 * against the cached users directory (`useAdminUsers()`) — there is no
 * `GET /v1/groups/{id}/members` endpoint on the wire (drift Finding #1).
 *
 * Add-member fans out N parallel `POST /v1/groups/{id}/members` calls
 * (single-user body each) via `Promise.allSettled` (drift Finding #2).
 *
 * Edit-group uses the `Sheet` primitive per §B.3 §7 + drift Finding #8.
 *
 * Remove-member uses the Modal-based confirm pattern (Slice 6 precedent)
 * rather than native `window.confirm()` — testable + consistent (drift
 * Finding #7).
 *
 * Stat-grid placeholders (Members count is derived; Assignments / Avg
 * engagement / Avg competence are em-dash per §E.2 + drift Finding #4).
 */

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { applyApiErrorToForm } from "@/lib/api/form-errors";
import { PageHeader } from "@/components/shell/PageHeader";
import { Modal, ModalActions, ModalHeader } from "@/components/admin/modal";
import { Field } from "@/components/admin/field";
import { Sheet, SheetBody, SheetFooter, SheetHeader } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  flattenGroupMembers,
  useAdminGroup,
  useAddGroupMember,
  useGroupMembers,
  useRemoveGroupMember,
  useUpdateGroup,
  type GroupResponse,
  type GroupUpdate,
} from "@/lib/queries/admin-groups";
import {
  flattenUsers,
  useAdminUsers,
  type UserResponse,
} from "@/lib/queries/admin-users";

const groupEditSchema = z.object({
  name: z.string().min(1, "Group name is required.").max(255),
  description: z.string().max(1024).optional().default(""),
});
type GroupEditInput = z.infer<typeof groupEditSchema>;

type ModalState = { kind: "closed" } | { kind: "remove"; user: UserResponse };

export function GroupDetail() {
  const router = useRouter();
  const params = useParams<{ groupId: string }>();
  const groupId = params?.groupId ?? null;

  const groupQuery = useAdminGroup(groupId);
  const membersQuery = useGroupMembers(groupId);
  const members = useMemo(
    () => flattenGroupMembers(membersQuery.data),
    [membersQuery.data],
  );

  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  const [memberQ, setMemberQ] = useState("");

  // Members come from the single batched `GET /v1/groups/{id}/members`
  // call (N2). Filter client-side, consistent with the rest of the
  // admin suite. Must run before any conditional return per
  // rules-of-hooks.
  const memberRows = useMemo<UserResponse[]>(() => {
    const needle = memberQ.trim().toLowerCase();
    if (!needle) return members;
    return members.filter(
      (u) =>
        u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle),
    );
  }, [members, memberQ]);

  if (groupQuery.isPending) {
    return (
      <div data-testid="group-detail-loading" className="space-y-4">
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-24 w-full" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  if (groupQuery.isError) {
    return (
      <div
        className="border border-line bg-bg-raised p-8 text-center"
        data-testid="group-detail-not-found"
      >
        <div className="font-serif text-[20px] text-ink mb-2">Group not found</div>
        <div className="text-[13px] text-ink-3 mb-4">
          This group may have been deleted, or the link is stale.
        </div>
        <Button onClick={() => router.push("/admin/groups")}>Back to groups</Button>
      </div>
    );
  }

  const group = groupQuery.data!;
  const isSystem = group.is_system;

  return (
    <>
      <PageHeader
        eyebrow={`Group · ${group.name}`}
        title={group.name}
        subtitle={group.description ?? "No description."}
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditSheetOpen(true)}
              disabled={isSystem}
              aria-disabled={isSystem}
              title={isSystem ? "System groups are immutable (AC-D15)" : undefined}
              data-testid="group-edit-button"
            >
              Edit group
            </Button>
            <Button
              onClick={() => setPickerOpen(true)}
              disabled={isSystem}
              aria-disabled={isSystem}
              title={isSystem ? "System groups are immutable (AC-D15)" : undefined}
              data-testid="group-add-member-button"
            >
              + Add member
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="group-stats">
        <StatCard label="Members" value={group.member_ids.length.toString()} />
        <StatCard label="Assignments" value="—" deferred />
        <StatCard label="Avg engagement" value="—" deferred />
        <StatCard label="Avg competence" value="—" deferred />
      </div>

      <div className="mt-6 border border-line bg-bg-raised p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <div className="eyebrow">Members</div>
            <div className="text-[11.5px] text-ink-3 mt-0.5">
              Search by name or email; members are derived from this group&rsquo;s
              membership.
            </div>
          </div>
          <input
            type="search"
            value={memberQ}
            onChange={(e) => setMemberQ(e.target.value)}
            placeholder="Filter members…"
            aria-label="Filter members"
            data-testid="member-filter-search"
            className={cn(
              "h-9 max-w-[260px] border border-line bg-bg-raised px-3 text-[12.5px]",
              "focus:outline-none focus:ring-2 focus:ring-accent",
            )}
          />
        </div>

        {membersQuery.isPending ? (
          <div data-testid="members-loading" className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : membersQuery.isError ? (
          <div
            className="border border-dashed border-line p-8 text-center"
            data-testid="members-error"
          >
            <div className="font-serif text-[17px] text-ink mb-1">
              Couldn&rsquo;t load members.
            </div>
            <div className="text-[12.5px] text-ink-3">Refresh the page to try again.</div>
          </div>
        ) : memberRows.length === 0 ? (
          <div
            className="border border-dashed border-line p-8 text-center"
            data-testid="members-empty"
          >
            <div className="font-serif text-[17px] text-ink mb-1">
              {memberQ.trim()
                ? "No members match your search."
                : "No members in this group yet."}
            </div>
            <div className="text-[12.5px] text-ink-3">
              {memberQ.trim()
                ? "Try a different term."
                : "Click “+ Add member” above to invite users into this group."}
            </div>
          </div>
        ) : (
          <table className="w-full text-[13px]" data-testid="members-table">
            <thead>
              <tr className="border-b border-line text-ink-3 text-left">
                <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2">
                  Name
                </th>
                <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[28%]">
                  Email
                </th>
                <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[14%]">
                  Last active
                </th>
                <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[14%] text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {memberRows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-line"
                  data-testid={`members-row-${row.id}`}
                >
                  <td className="py-2.5 px-2 font-medium text-ink">{row.name}</td>
                  <td className="py-2.5 px-2 font-mono text-ink-2 text-[12px]">
                    {row.email}
                  </td>
                  <td
                    className="py-2.5 px-2 text-ink-3"
                    data-testid="derived-count-pending"
                  >
                    —
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setModal({ kind: "remove", user: row })}
                      disabled={isSystem}
                      aria-disabled={isSystem}
                      data-testid={`members-remove-${row.id}`}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editSheetOpen ? (
        <EditGroupSheet group={group} onClose={() => setEditSheetOpen(false)} />
      ) : null}

      {pickerOpen ? (
        <MemberPickerModal group={group} onClose={() => setPickerOpen(false)} />
      ) : null}

      {modal.kind === "remove" ? (
        <RemoveMemberModal
          group={group}
          user={modal.user}
          onClose={() => setModal({ kind: "closed" })}
        />
      ) : null}
    </>
  );
}

function StatCard({
  label,
  value,
  deferred,
}: {
  label: string;
  value: string;
  deferred?: boolean;
}) {
  return (
    <div
      className="border border-line bg-bg-sunk px-4 py-3"
      data-testid={deferred ? "derived-count-pending" : undefined}
    >
      <div className="eyebrow mb-1">{label}</div>
      <div className="font-serif text-[24px] tabular-nums text-ink">{value}</div>
    </div>
  );
}

function EditGroupSheet({
  group,
  onClose,
}: {
  group: GroupResponse;
  onClose: () => void;
}) {
  const form = useForm<GroupEditInput>({
    resolver: zodResolver(groupEditSchema),
    mode: "onSubmit",
    defaultValues: { name: group.name, description: group.description ?? "" },
  });
  const mutation = useUpdateGroup();

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      // Value-diff PATCH per Slice 7 precedent + drift Finding #9.
      const body: GroupUpdate = {};
      if (values.name !== group.name) body.name = values.name;
      const nextDesc =
        values.description?.trim() === "" ? null : (values.description ?? null);
      if (nextDesc !== group.description) body.description = nextDesc;
      if (Object.keys(body).length > 0) {
        await mutation.mutateAsync({ groupId: group.id, body });
      }
      toast("Group updated");
      onClose();
    } catch (err) {
      applyApiErrorToForm(err, form);
    }
  });

  return (
    <Sheet
      open
      onOpenChange={(o) => (o ? null : onClose())}
      ariaTitle="Edit group"
      ariaDescription="Edit the group name and description."
      width={460}
    >
      <SheetHeader eyebrow="Edit group">{group.name}</SheetHeader>
      <SheetBody>
        <form
          id="group-edit-form"
          onSubmit={onSubmit}
          noValidate
          data-testid="group-edit-form"
        >
          <Field label="Name" error={form.formState.errors.name?.message ?? null}>
            <Input
              {...form.register("name")}
              autoFocus
              disabled={mutation.isPending}
              data-testid="group-edit-name"
            />
          </Field>
          <Field
            label="Description"
            hint="Optional. Up to 1024 characters."
            error={form.formState.errors.description?.message ?? null}
          >
            <Textarea
              {...form.register("description")}
              rows={4}
              disabled={mutation.isPending}
              data-testid="group-edit-description"
            />
          </Field>
        </form>
      </SheetBody>
      <SheetFooter>
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
          form="group-edit-form"
          disabled={mutation.isPending}
          data-testid="group-edit-submit"
        >
          {mutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}

function MemberPickerModal({
  group,
  onClose,
}: {
  group: GroupResponse;
  onClose: () => void;
}) {
  // The full user directory is fetched lazily here — only when the
  // picker opens — rather than eagerly on every group-detail load (N2).
  const usersQuery = useAdminUsers();
  const usersCache = useMemo(() => flattenUsers(usersQuery.data), [usersQuery.data]);
  const addMutation = useAddGroupMember();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pickerQ, setPickerQ] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const existingIds = useMemo(() => new Set(group.member_ids), [group.member_ids]);

  const candidates = useMemo(() => {
    const needle = pickerQ.trim().toLowerCase();
    return usersCache.filter((u) => {
      if (existingIds.has(u.id)) return false;
      if (needle) {
        const inName = u.name.toLowerCase().includes(needle);
        const inEmail = u.email.toLowerCase().includes(needle);
        if (!inName && !inEmail) return false;
      }
      return true;
    });
  }, [usersCache, existingIds, pickerQ]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onSubmit = async () => {
    setSubmitting(true);
    const ids = Array.from(selected);
    // Fan out N single-user POSTs per drift Finding #2.
    const results = await Promise.allSettled(
      ids.map((userId) => addMutation.mutateAsync({ groupId: group.id, userId })),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - ok;
    setSubmitting(false);
    if (failed === 0) {
      toast(`Added ${ok} member${ok === 1 ? "" : "s"}`);
      onClose();
      return;
    }
    // Partial / total failure: keep the modal open and reduce the
    // selection to only the rejected user_ids so the admin can retry
    // without re-searching + re-clicking.
    if (ok === 0) {
      toast.error(`Couldn't add ${failed} member${failed === 1 ? "" : "s"}`);
    } else {
      toast(`Added ${ok} of ${results.length} — ${failed} failed`);
    }
    setSelected(new Set(ids.filter((_, i) => results[i]?.status === "rejected")));
  };

  return (
    <Modal
      open
      onOpenChange={(o) => (o ? null : onClose())}
      ariaTitle="Add members"
      ariaDescription="Pick one or more users to add to this group."
      width={620}
    >
      <ModalHeader
        eyebrow="Add members"
        title={
          <>
            Add to <span className="serif-it">{group.name}</span>
          </>
        }
      />
      <input
        type="search"
        value={pickerQ}
        onChange={(e) => setPickerQ(e.target.value)}
        placeholder="Search users…"
        aria-label="Search users"
        data-testid="picker-search"
        className={cn(
          "h-10 w-full border border-line bg-bg-raised px-3 text-[13px] mb-3",
          "focus:outline-none focus:ring-2 focus:ring-accent",
        )}
      />
      <div
        className="max-h-[340px] overflow-y-auto border border-line"
        data-testid="picker-list"
      >
        {usersQuery.isPending ? (
          <div
            className="p-6 text-center text-[13px] text-ink-3"
            data-testid="picker-loading"
          >
            Loading users…
          </div>
        ) : candidates.length === 0 ? (
          <div className="p-6 text-center text-[13px] text-ink-3">
            No users match — try clearing the search.
          </div>
        ) : (
          <ul>
            {candidates.map((u) => {
              const checked = selected.has(u.id);
              return (
                <li
                  key={u.id}
                  className={cn(
                    "flex items-center gap-3 border-b border-line px-3 py-2 cursor-pointer",
                    checked && "bg-bg-sunk",
                  )}
                  onClick={() => toggle(u.id)}
                  data-testid={`picker-row-${u.id}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(u.id)}
                    aria-label={`Pick ${u.name || u.email}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-ink truncate">
                      {u.name || u.email}
                    </div>
                    <div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-3 mt-0.5">
                      {u.email} · {u.role}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <ModalActions>
        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={selected.size === 0 || submitting}
          data-testid="picker-add"
        >
          {submitting
            ? "Adding…"
            : `Add ${selected.size > 0 ? `${selected.size} ` : ""}member${selected.size === 1 ? "" : "s"}`}
        </Button>
      </ModalActions>
    </Modal>
  );
}

function RemoveMemberModal({
  group,
  user,
  onClose,
}: {
  group: GroupResponse;
  user: UserResponse;
  onClose: () => void;
}) {
  const mutation = useRemoveGroupMember();
  const onConfirm = async () => {
    try {
      await mutation.mutateAsync({ groupId: group.id, userId: user.id });
      toast(`${user.name || user.email} removed from ${group.name}`);
      onClose();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Couldn't remove — try again";
      toast.error(msg);
    }
  };
  return (
    <Modal
      open
      onOpenChange={(o) => (o ? null : onClose())}
      ariaTitle="Remove member"
      ariaDescription="Confirm or cancel removal of this member from the group."
    >
      <ModalHeader
        eyebrow="Remove member"
        title={
          <>
            Remove <span className="serif-it">{user.name || user.email}</span>?
          </>
        }
      />
      <p className="text-[13px] text-ink-2">
        They&rsquo;ll lose any group-bound assignments. Attempt history is preserved. You
        can re-add them later.
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
          data-testid="members-remove-confirm"
        >
          {mutation.isPending ? "Removing…" : "Remove member"}
        </Button>
      </ModalActions>
    </Modal>
  );
}
