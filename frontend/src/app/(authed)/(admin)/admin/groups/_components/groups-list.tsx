"use client";

/**
 * GroupsList — admin groups list per FE-8 admin-identity §B.2
 * (`fe-specs/FE-8-admin-identity.md:313–452`).
 *
 * URL state: `?q={search}`. `q` is client-side per §E.11 + drift
 * Finding #3 (server doesn't accept it).
 *
 * Columns: Group name (lock icon + "System" badge for system groups) /
 * Members (count from `member_ids.length` per drift Finding #4) /
 * Description / Edit + Members row actions.
 *
 * System groups (`is_system === true`) render with disabled row
 * actions per AC-D15. Custom groups navigate to
 * `/admin/groups/{groupId}` (Slice 9 §B.3 detail page).
 *
 * No Delete affordance per §E.6 — deferred to v1.x.
 */

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { applyApiErrorToForm } from "@/lib/api/form-errors";
import { PageHeader } from "@/components/shell/PageHeader";
import { FilterBar } from "@/components/admin/filter-bar";
import { Modal, ModalActions, ModalHeader } from "@/components/admin/modal";
import { Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/primitives/Icon";
import { cn } from "@/lib/utils";
import {
  flattenGroups,
  useAdminGroups,
  useCreateGroup,
  type GroupResponse,
} from "@/lib/queries/admin-groups";

const groupAddSchema = z.object({
  name: z.string().min(1, "Group name is required.").max(255),
  description: z.string().max(1024).optional().default(""),
});
type GroupAddInput = z.infer<typeof groupAddSchema>;

export function GroupsList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams?.get("q") ?? "";

  const [modalOpen, setModalOpen] = useState(false);

  const list = useAdminGroups();
  const allGroups = useMemo(() => flattenGroups(list.data), [list.data]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return allGroups;
    return allGroups.filter(
      (g) =>
        g.name.toLowerCase().includes(needle) ||
        (g.description ?? "").toLowerCase().includes(needle),
    );
  }, [allGroups, q]);

  const writeParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (value === null || value === "") params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.replace(qs ? `/admin/groups?${qs}` : "/admin/groups");
  };

  const showSystemBanner = filtered.some((g) => g.is_system);

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Groups"
        subtitle="Bundle users into cohorts. System groups are maintained by Acumen; custom groups bind assignments to specific teams."
        actions={
          <Button onClick={() => setModalOpen(true)} data-testid="groups-add-button">
            + Add group
          </Button>
        }
      />

      <FilterBar
        searchValue={q}
        onSearchChange={(v) => writeParam("q", v)}
        searchPlaceholder="Search groups…"
      />

      <GroupsBody
        list={list}
        groups={filtered}
        hasFilter={q.length > 0}
        onNavigate={(g) => router.push(`/admin/groups/${g.id}`)}
      />

      {showSystemBanner ? (
        <div
          className="mt-4 border border-line bg-bg-sunk px-4 py-3 text-[12px] text-ink-3"
          data-testid="groups-system-banner"
        >
          System groups (All Users, All Testees, All Administrators) are maintained by
          Acumen — name, description, and membership can&rsquo;t be edited (AC-D15). Use a
          custom group to bind assignments to a specific cohort.
        </div>
      ) : null}

      {modalOpen ? <GroupAddModal onClose={() => setModalOpen(false)} /> : null}
    </>
  );
}

function GroupsBody({
  list,
  groups,
  hasFilter,
  onNavigate,
}: {
  list: ReturnType<typeof useAdminGroups>;
  groups: GroupResponse[];
  hasFilter: boolean;
  onNavigate: (g: GroupResponse) => void;
}) {
  if (list.isPending) {
    return (
      <div className="mt-5" data-testid="groups-loading">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-full mb-2" />
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div
        className="mt-5 border border-line bg-bg-raised p-10 text-center"
        data-testid="groups-empty"
      >
        <div className="font-serif text-[20px] text-ink mb-2">
          {hasFilter ? "No groups match your search." : "No groups yet."}
        </div>
        <div className="text-[13px] text-ink-3">
          {hasFilter
            ? "Try clearing the search or a different term."
            : "Add your first custom group above. System groups appear automatically."}
        </div>
      </div>
    );
  }

  return (
    <table className="mt-5 w-full text-[13px]" data-testid="groups-table">
      <thead>
        <tr className="border-b border-line text-ink-3 text-left">
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2">
            Group name
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[10%]">
            Members
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2">
            Description
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[20%] text-right">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <tr
            key={g.id}
            className={cn("border-b border-line", g.is_system && "bg-bg-sunk")}
            data-testid={`groups-row-${g.id}`}
          >
            <td className="py-2.5 px-2">
              <div className="flex items-center gap-2">
                {g.is_system ? (
                  <Icon name="lock" size={11} className="text-ink-3" />
                ) : null}
                <span className="font-medium text-ink">{g.name}</span>
                {g.is_system ? (
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.08em] text-warn"
                    data-testid={`groups-system-badge-${g.id}`}
                  >
                    System
                  </span>
                ) : null}
              </div>
            </td>
            <td
              className="py-2.5 px-2 font-mono text-ink-2 text-[12px]"
              data-testid={`groups-member-count-${g.id}`}
            >
              {g.member_ids.length}
            </td>
            <td className="py-2.5 px-2 text-ink-3 truncate max-w-0">
              {g.description ?? ""}
            </td>
            <td className="py-2.5 px-2 text-right">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate(g)}
                disabled={g.is_system}
                aria-disabled={g.is_system}
                title={g.is_system ? "System groups are immutable (AC-D15)" : undefined}
                data-testid={`groups-edit-${g.id}`}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate(g)}
                disabled={g.is_system}
                aria-disabled={g.is_system}
                title={g.is_system ? "System groups are immutable (AC-D15)" : undefined}
                data-testid={`groups-members-${g.id}`}
              >
                Members
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GroupAddModal({ onClose }: { onClose: () => void }) {
  const form = useForm<GroupAddInput>({
    resolver: zodResolver(groupAddSchema),
    mode: "onSubmit",
    defaultValues: { name: "", description: "" },
  });
  const mutation = useCreateGroup();

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      // GroupCreate.description is anyOf[string, null] — send null for
      // empty (drift Finding #11).
      await mutation.mutateAsync({
        name: values.name,
        description: values.description?.trim() === "" ? null : values.description,
      });
      toast("Group created");
      onClose();
    } catch (err) {
      applyApiErrorToForm(err, form);
    }
  });

  return (
    <Modal
      open
      onOpenChange={(o) => (o ? null : onClose())}
      ariaTitle="Add group"
      ariaDescription="Create a new custom group for binding assignments."
    >
      <ModalHeader
        eyebrow="New group"
        title={
          <>
            Add a <span className="serif-it">group</span>
          </>
        }
      />
      <form onSubmit={onSubmit} noValidate data-testid="group-add-form">
        <Field label="Name" error={form.formState.errors.name?.message ?? null}>
          <Input
            {...form.register("name")}
            autoFocus
            disabled={mutation.isPending}
            data-testid="group-add-name"
          />
        </Field>
        <Field
          label="Description"
          hint="Optional. Up to 1024 characters."
          error={form.formState.errors.description?.message ?? null}
        >
          <Textarea
            {...form.register("description")}
            rows={3}
            disabled={mutation.isPending}
            data-testid="group-add-description"
          />
        </Field>
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
            data-testid="group-add-submit"
          >
            {mutation.isPending ? "Creating…" : "Create group"}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
