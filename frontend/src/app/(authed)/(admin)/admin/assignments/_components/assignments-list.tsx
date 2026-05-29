"use client";

/**
 * AssignmentsList — admin assignments list per FE-8 admin-identity §B.4
 * (`fe-specs/FE-8-admin-identity.md:651–822`).
 *
 * v1 LOCKED — create + delete only per §E item 9. No PATCH; existing
 * assignments are deleted + recreated.
 *
 * URL state: `?assigner={me|all}` (default `me`). Server takes
 * `assigner_id` when filter=`me`; `all` omits the param.
 *
 * Bound-to column / Test-or-Path resolved-name column: client-side
 * joins against the cached `useAdminUsers` + `useAdminGroups` +
 * `useAdminTests` + `useAdminPaths` directories (drift Finding #3).
 * Progress column renders em-dash per §E.7 (engagement_status field
 * absent from `AssignmentResponse`).
 *
 * Test picker filters to tests where `pill_id !== null` per drift
 * Finding #6 — frozen/hand_authored/benchmark tests don't have a
 * single bindable pill.
 *
 * Difficulty is auto-derived (drift Finding #9) — for test-bound
 * assignments, use `TestResponse.target_difficulty ?? 5`; for
 * path-bound, default 5. No UI difficulty input in v1.
 *
 * Multi-target dedup runs client-side per §E.11 / drift Finding #7 —
 * group member_ids unioned with testee_ids, deduped.
 */

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { applyApiErrorToForm } from "@/lib/api/form-errors";
import { useAuth } from "@/lib/auth/context";
import { PageHeader } from "@/components/shell/PageHeader";
import { FilterBar } from "@/components/admin/filter-bar";
import { Modal, ModalActions, ModalHeader } from "@/components/admin/modal";
import { Field, FieldError } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  flattenAssignments,
  useAdminAssignments,
  useCreateAssignment,
  useDeleteAssignment,
  type AssignmentCreate,
  type AssignmentResponse,
} from "@/lib/queries/admin-assignments";
import { flattenUsers, useAdminUsers } from "@/lib/queries/admin-users";
import { flattenGroups, useAdminGroups } from "@/lib/queries/admin-groups";
import {
  flattenTests,
  useAdminTests,
  type TestResponse,
} from "@/lib/queries/admin-tests";
import { flattenPaths, useAdminPaths } from "@/lib/queries/admin-paths";
import { formatLoopMode, type LoopMode } from "@/lib/identity/format-loop-mode";

type AssignerFilter = "me" | "all";

type ModalState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "delete"; assignment: AssignmentResponse };

const assignmentFormSchema = z
  .object({
    target: z.string().min(1, "Pick a test or learning path."),
    testee_ids: z.array(z.string().uuid()).default([]),
    group_ids: z.array(z.string().uuid()).default([]),
    deadline_date: z.string().optional().default(""),
    deadline_time: z.string().optional().default(""),
    loop_mode: z.enum(["autonomous", "admin_reviewed"]).default("autonomous"),
    is_mandatory: z.boolean().default(false),
  })
  .refine((d) => d.testee_ids.length > 0 || d.group_ids.length > 0, {
    path: ["testee_ids"],
    message: "Bind to at least one testee or group.",
  })
  .refine((d) => !d.deadline_date || (d.deadline_date && d.deadline_time), {
    path: ["deadline_time"],
    message: "Pick a deadline time too.",
  });
type AssignmentFormInput = z.infer<typeof assignmentFormSchema>;

export function AssignmentsList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: authUser } = useAuth();
  const raw = searchParams?.get("assigner") ?? null;
  const assigner: AssignerFilter = raw === "all" ? "all" : "me";

  const [modal, setModal] = useState<ModalState>({ kind: "closed" });

  const list = useAdminAssignments(
    assigner === "me" && authUser ? { assigner_id: authUser.id } : {},
  );
  const allAssignments = useMemo(() => flattenAssignments(list.data), [list.data]);

  // Cross-resource caches for column joins.
  const usersList = useAdminUsers();
  const groupsList = useAdminGroups();
  const testsList = useAdminTests();
  const pathsList = useAdminPaths();
  const users = useMemo(() => flattenUsers(usersList.data), [usersList.data]);
  const groups = useMemo(() => flattenGroups(groupsList.data), [groupsList.data]);
  const tests = useMemo(() => flattenTests(testsList.data), [testsList.data]);
  const paths = useMemo(() => flattenPaths(pathsList.data), [pathsList.data]);

  const writeParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (value === null || value === "" || value === "me") params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.replace(qs ? `/admin/assignments?${qs}` : "/admin/assignments");
  };

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Assignments"
        subtitle="Bind tests or learning paths to testees and groups. Existing assignments can be deleted; in-place editing lands in v1.x."
        actions={
          <Button
            onClick={() => setModal({ kind: "create" })}
            data-testid="assignments-add-button"
          >
            + New assignment
          </Button>
        }
      />

      <FilterBar
        segments={[
          {
            label: "Assigner",
            value: assigner,
            options: [
              { label: "Me", value: "me" },
              { label: "All", value: "all" },
            ],
            onChange: (next) => writeParam("assigner", next),
          },
        ]}
      />

      <AssignmentsBody
        list={list}
        assignments={allAssignments}
        users={users}
        groups={groups}
        tests={tests}
        paths={paths}
        onDelete={(a) => setModal({ kind: "delete", assignment: a })}
      />

      {modal.kind === "create" ? (
        <AssignmentEditor
          users={users}
          groups={groups}
          tests={tests}
          paths={paths}
          onClose={() => setModal({ kind: "closed" })}
        />
      ) : null}

      {modal.kind === "delete" ? (
        <DeleteAssignmentModal
          assignment={modal.assignment}
          onClose={() => setModal({ kind: "closed" })}
        />
      ) : null}
    </>
  );
}

type AssignmentsBodyProps = {
  list: ReturnType<typeof useAdminAssignments>;
  assignments: AssignmentResponse[];
  users: ReturnType<typeof flattenUsers>;
  groups: ReturnType<typeof flattenGroups>;
  tests: TestResponse[];
  paths: ReturnType<typeof flattenPaths>;
  onDelete: (a: AssignmentResponse) => void;
};

function AssignmentsBody({
  list,
  assignments,
  users,
  groups,
  tests,
  paths,
  onDelete,
}: AssignmentsBodyProps) {
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  // groups param retained — current row format only surfaces testee
  // count; group attribution to add when wire exposes group_ids on
  // AssignmentResponse.
  void groups;
  // Test resolution is reverse-keyed by pill_id (assignment carries
  // pill_id, not test_id — drift Finding #6).
  const testByPillId = useMemo(() => {
    const m = new Map<string, TestResponse>();
    for (const t of tests) if (t.pill_id) m.set(t.pill_id, t);
    return m;
  }, [tests]);
  const pathById = useMemo(() => new Map(paths.map((p) => [p.id, p])), [paths]);

  if (list.isPending) {
    return (
      <div className="mt-5" data-testid="assignments-loading">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-full mb-2" />
        ))}
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div
        className="mt-5 border border-line bg-bg-raised p-10 text-center"
        data-testid="assignments-empty"
      >
        <div className="font-serif text-[20px] text-ink mb-2">No assignments yet.</div>
        <div className="text-[13px] text-ink-3">
          Bind a test or path to testees or groups to get started.
        </div>
      </div>
    );
  }

  return (
    <table className="mt-5 w-full text-[13px]" data-testid="assignments-table">
      <thead>
        <tr className="border-b border-line text-ink-3 text-left">
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[26%]">
            Bound to
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2">
            Test / Path
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[14%]">
            Loop
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[12%]">
            Progress
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[10%] text-right">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {assignments.map((a) => {
          const boundTo = formatBoundTo(a, userById);
          const target = formatTarget(a, testByPillId, pathById);
          return (
            <tr
              key={a.id}
              className="border-b border-line"
              data-testid={`assignments-row-${a.id}`}
            >
              <td className="py-2.5 px-2 text-ink-2">{boundTo}</td>
              <td className="py-2.5 px-2 text-ink">{target}</td>
              <td className="py-2.5 px-2">
                <span
                  className={cn(
                    "font-mono text-[10.5px] uppercase tracking-[0.08em]",
                    a.loop_mode === "admin_reviewed" ? "text-accent" : "text-ink-3",
                  )}
                >
                  {formatLoopMode(a.loop_mode as LoopMode)}
                </span>
              </td>
              <td className="py-2.5 px-2 text-ink-3" data-testid="derived-count-pending">
                —
              </td>
              <td className="py-2.5 px-2 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(a)}
                  data-testid={`assignments-delete-${a.id}`}
                >
                  Delete
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function formatBoundTo(
  a: AssignmentResponse,
  userById: Map<string, ReturnType<typeof flattenUsers>[number]>,
): string {
  const testeeCount = a.assignee_ids?.length ?? 0;
  // AssignmentResponse exposes resolved testee ids; group attribution
  // is lost on the wire so we surface aggregate count.
  if (testeeCount === 1) {
    const u = userById.get(a.assignee_ids![0]!);
    return u?.name || u?.email || "(testee)";
  }
  if (testeeCount > 1) return `${testeeCount} testees`;
  return "(no targets)";
}

function formatTarget(
  a: AssignmentResponse,
  testByPillId: Map<string, TestResponse>,
  pathById: Map<string, ReturnType<typeof flattenPaths>[number]>,
): string {
  if (a.pill_id) {
    const t = testByPillId.get(a.pill_id);
    if (t) return `${t.name} (test, ${t.mode})`;
    return "(test outside loaded set)";
  }
  if (a.learning_path_id) {
    const p = pathById.get(a.learning_path_id);
    if (p) return `${p.name} (path)`;
    return "(path outside loaded set)";
  }
  return "—";
}

function AssignmentEditor({
  users,
  groups,
  tests,
  paths,
  onClose,
}: {
  users: ReturnType<typeof flattenUsers>;
  groups: ReturnType<typeof flattenGroups>;
  tests: TestResponse[];
  paths: ReturnType<typeof flattenPaths>;
  onClose: () => void;
}) {
  const form = useForm<AssignmentFormInput>({
    resolver: zodResolver(assignmentFormSchema),
    mode: "onSubmit",
    defaultValues: {
      target: "",
      testee_ids: [],
      group_ids: [],
      deadline_date: "",
      deadline_time: "",
      loop_mode: "autonomous",
      is_mandatory: false,
    },
  });
  const mutation = useCreateAssignment();

  // Bindable tests = tests with a single pill_id (drift Finding #6).
  const bindableTests = useMemo(() => tests.filter((t) => t.pill_id !== null), [tests]);

  const testeeIds = form.watch("testee_ids");
  const groupIds = form.watch("group_ids");

  // Client-side dedup count (drift Finding #7 / §E.11).
  const uniqueTesteeCount = useMemo(() => {
    const s = new Set<string>(testeeIds);
    for (const gid of groupIds) {
      const g = groups.find((x) => x.id === gid);
      if (!g) continue;
      for (const m of g.member_ids) s.add(m);
    }
    return s.size;
  }, [testeeIds, groupIds, groups]);

  const onSubmit = form.handleSubmit(async (values) => {
    const { target } = values;
    let pill_id: string | null = null;
    let learning_path_id: string | null = null;
    let difficulty = 5;
    if (target.startsWith("test:")) {
      const testId = target.slice(5);
      const t = tests.find((x) => x.id === testId);
      if (!t || !t.pill_id) {
        form.setError("target", { message: "This test isn't bindable in v1." });
        return;
      }
      pill_id = t.pill_id;
      difficulty = t.target_difficulty ?? 5;
    } else if (target.startsWith("path:")) {
      learning_path_id = target.slice(5);
    } else {
      form.setError("target", { message: "Pick a test or learning path." });
      return;
    }
    let deadline: string | null = null;
    if (values.deadline_date) {
      // Compose ISO from local-tz date+time inputs.
      const time = values.deadline_time || "17:00";
      const composed = new Date(`${values.deadline_date}T${time}:00`);
      deadline = composed.toISOString();
    }
    const body: AssignmentCreate = {
      pill_id,
      learning_path_id,
      difficulty,
      deadline,
      testee_ids: values.testee_ids,
      group_ids: values.group_ids,
      loop_mode: values.loop_mode,
      is_mandatory: values.is_mandatory,
    };
    try {
      await mutation.mutateAsync(body);
      toast(
        `Assignment created — ${uniqueTesteeCount} testee${
          uniqueTesteeCount === 1 ? "" : "s"
        } will be notified`,
      );
      onClose();
    } catch (err) {
      applyApiErrorToForm(err, form);
    }
  });

  return (
    <Modal
      open
      onOpenChange={(o) => (o ? null : onClose())}
      ariaTitle="New assignment"
      ariaDescription="Bind a test or learning path to testees and groups."
      width={640}
    >
      <ModalHeader
        eyebrow="New assignment"
        title={
          <>
            Create an <span className="serif-it">assignment</span>
          </>
        }
      />
      <form onSubmit={onSubmit} noValidate data-testid="assignment-editor-form">
        <Field
          label="Test or learning path"
          error={form.formState.errors.target?.message ?? null}
        >
          <select
            {...form.register("target")}
            data-testid="assignment-target"
            className={cn(
              "h-10 w-full border border-line bg-bg-raised px-3 text-[13px]",
              "focus:outline-none focus:ring-2 focus:ring-accent",
            )}
          >
            <option value="">Pick a test or learning path…</option>
            <optgroup label="Tests">
              {bindableTests.map((t) => (
                <option key={t.id} value={`test:${t.id}`}>
                  {t.name} ({t.mode})
                </option>
              ))}
            </optgroup>
            <optgroup label="Learning paths">
              {paths.map((p) => (
                <option key={p.id} value={`path:${p.id}`}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          </select>
        </Field>

        <Field
          label="Bind to"
          hint={`${uniqueTesteeCount} unique testee${uniqueTesteeCount === 1 ? "" : "s"} selected`}
          error={form.formState.errors.testee_ids?.message ?? null}
        >
          <MultiTargetPicker
            users={users}
            groups={groups}
            testeeIds={testeeIds}
            groupIds={groupIds}
            onToggleTestee={(id) =>
              form.setValue(
                "testee_ids",
                testeeIds.includes(id)
                  ? testeeIds.filter((x) => x !== id)
                  : [...testeeIds, id],
                { shouldDirty: true },
              )
            }
            onToggleGroup={(id) =>
              form.setValue(
                "group_ids",
                groupIds.includes(id)
                  ? groupIds.filter((x) => x !== id)
                  : [...groupIds, id],
                { shouldDirty: true },
              )
            }
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Deadline date">
            <input
              type="date"
              {...form.register("deadline_date")}
              disabled={mutation.isPending}
              data-testid="assignment-deadline-date"
              className={cn(
                "h-10 w-full border border-line bg-bg-raised px-3 text-[13px]",
                "focus:outline-none focus:ring-2 focus:ring-accent",
              )}
            />
          </Field>
          <Field
            label="Deadline time"
            error={form.formState.errors.deadline_time?.message ?? null}
          >
            <input
              type="time"
              {...form.register("deadline_time")}
              disabled={mutation.isPending}
              data-testid="assignment-deadline-time"
              className={cn(
                "h-10 w-full border border-line bg-bg-raised px-3 text-[13px]",
                "focus:outline-none focus:ring-2 focus:ring-accent",
              )}
            />
          </Field>
        </div>

        <Field label="Loop mode">
          <div
            className="grid grid-cols-2 gap-2"
            role="radiogroup"
            aria-label="Loop mode"
          >
            {(["autonomous", "admin_reviewed"] as const).map((mode) => {
              const active = form.watch("loop_mode") === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() =>
                    form.setValue("loop_mode", mode, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  disabled={mutation.isPending}
                  data-testid={`assignment-loop-${mode}`}
                  className={cn(
                    "text-left border px-3 py-2.5",
                    active
                      ? "border-ink bg-ink text-bg-raised"
                      : "border-line bg-bg-raised text-ink-2 hover:bg-bg-sunk",
                  )}
                >
                  <div className="font-medium text-[13px]">{formatLoopMode(mode)}</div>
                  <div
                    className={cn(
                      "text-[11.5px] mt-0.5",
                      active ? "text-bg-raised/70" : "text-ink-3",
                    )}
                  >
                    {mode === "autonomous"
                      ? "Testee drives their own follow-up after each attempt."
                      : "Admin reviews each attempt before any follow-up fires."}
                  </div>
                </button>
              );
            })}
          </div>
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
            data-testid="assignment-submit"
          >
            {mutation.isPending ? "Creating…" : "Create assignment"}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}

function MultiTargetPicker({
  users,
  groups,
  testeeIds,
  groupIds,
  onToggleTestee,
  onToggleGroup,
}: {
  users: ReturnType<typeof flattenUsers>;
  groups: ReturnType<typeof flattenGroups>;
  testeeIds: string[];
  groupIds: string[];
  onToggleTestee: (id: string) => void;
  onToggleGroup: (id: string) => void;
}) {
  return (
    <div className="border border-line">
      <div className="max-h-[200px] overflow-y-auto">
        <div className="px-3 py-2 bg-bg-sunk eyebrow text-[10px] sticky top-0">
          Groups
        </div>
        {groups.length === 0 ? (
          <div className="px-3 py-2 text-[12px] text-ink-3">No groups.</div>
        ) : (
          <ul>
            {groups.map((g) => {
              const checked = groupIds.includes(g.id);
              return (
                <li
                  key={g.id}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 border-b border-line cursor-pointer",
                    checked && "bg-bg-sunk",
                  )}
                  onClick={() => onToggleGroup(g.id)}
                  data-testid={`picker-group-${g.id}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    readOnly
                    aria-label={`Pick group ${g.name}`}
                  />
                  <div className="flex-1 min-w-0 text-[12.5px] text-ink">{g.name}</div>
                  <div className="font-mono text-[10.5px] text-ink-3">
                    {g.member_ids.length}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="px-3 py-2 bg-bg-sunk eyebrow text-[10px] sticky top-0">
          Testees
        </div>
        {users.length === 0 ? (
          <div className="px-3 py-2 text-[12px] text-ink-3">No users loaded.</div>
        ) : (
          <ul>
            {users
              .filter((u) => u.role === "testee" && u.status === "active")
              .map((u) => {
                const checked = testeeIds.includes(u.id);
                return (
                  <li
                    key={u.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 border-b border-line cursor-pointer",
                      checked && "bg-bg-sunk",
                    )}
                    onClick={() => onToggleTestee(u.id)}
                    data-testid={`picker-testee-${u.id}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      readOnly
                      aria-label={`Pick ${u.name || u.email}`}
                    />
                    <div className="flex-1 min-w-0 text-[12.5px] text-ink">
                      {u.name || u.email}
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </div>
    </div>
  );
}

function DeleteAssignmentModal({
  assignment,
  onClose,
}: {
  assignment: AssignmentResponse;
  onClose: () => void;
}) {
  const mutation = useDeleteAssignment();
  const onConfirm = async () => {
    try {
      await mutation.mutateAsync(assignment.id);
      toast("Assignment deleted");
      onClose();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Couldn't delete — try again";
      toast.error(msg);
    }
  };
  return (
    <Modal
      open
      onOpenChange={(o) => (o ? null : onClose())}
      ariaTitle="Delete assignment"
      ariaDescription="Confirm or cancel deletion of this assignment."
    >
      <ModalHeader eyebrow="Delete assignment" title={<>Delete this assignment?</>} />
      <div className="border border-danger bg-bg-sunk px-3 py-2 text-[12.5px] text-danger mb-3">
        Testees lose access immediately. Completed attempts are preserved in their
        history; in-progress attempts are paused and can&rsquo;t be resumed.
      </div>
      <p className="text-[13px] text-ink-2">
        Per §E item 9, in-place edit isn&rsquo;t available in v1 — to change a setting,
        delete and recreate.
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
          data-testid="assignment-delete-confirm"
        >
          {mutation.isPending ? "Deleting…" : "Delete assignment"}
        </Button>
      </ModalActions>
    </Modal>
  );
}
