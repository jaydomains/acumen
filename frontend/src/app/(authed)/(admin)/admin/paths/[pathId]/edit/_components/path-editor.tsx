"use client";

/**
 * PathEditor — admin learning-path editor per FE-8 §B.7
 * (`fe-specs/FE-8-admin-catalogue.md:898–1067`).
 *
 * `pathId === "new"` → create mode; any UUID → edit mode (per §B.7 §1).
 *
 * Form shape projects `pill_ids: string[]` into `pills: {pill_id}[]`
 * for `useFieldArray` compatibility (drift Finding #7) — flattened back
 * on submit. Zod gates `pills.min(1)` per spec §B.7 §4 (drift Finding
 * #4 absorbed: keep as FE product constraint even though wire allows
 * empty).
 *
 * Drag-reorder uses `@dnd-kit/core` + `@dnd-kit/sortable` per §B.7 §2
 * + §F.3 carve-out. KeyboardSensor wired explicitly per drift Finding
 * #8 — `@dnd-kit` requires both Pointer + Keyboard sensors.
 *
 * Retired pills (per §B.7 §7 + drift Finding #9): pills referenced in
 * `pill_ids` but found in `useAdminPills()` cache with `retired_at !==
 * null` render with a "Retired" badge. Pills not found in the loaded
 * pages of the cache render as "Pill not loaded" — v1 acceptable
 * for ≤200 pill scale.
 *
 * "Assigned to" panel (drift Finding #5) renders a deferral placeholder
 * — no derived count on the wire; spec defers per §E pattern. The
 * §B.7 §2 "Path mechanics" panel renders static explainer copy.
 *
 * Cancel-confirm uses the §C.5 Modal primitive (drift Finding #11)
 * rather than native `confirm()` — consistent with delete-path UX +
 * testable in jsdom.
 *
 * Save success → `router.push("/admin/paths")` + toast.
 */

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { applyApiErrorToForm } from "@/lib/api/form-errors";
import { PageHeader } from "@/components/shell/PageHeader";
import { Modal, ModalActions, ModalHeader } from "@/components/admin/modal";
import { Field, FieldError } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useAdminPath,
  useCreatePath,
  useUpdatePath,
  type LearningPathCreate,
  type LearningPathUpdate,
} from "@/lib/queries/admin-paths";
import {
  flattenPills,
  useAdminPills,
  type PillResponse,
} from "@/lib/queries/admin-pills";
import { flattenSubjects, useAdminSubjects } from "@/lib/queries/admin-subjects";

const pathFormSchema = z.object({
  name: z.string().min(1, "Path name is required.").max(255),
  description: z.string().max(2048).optional().default(""),
  pills: z
    .array(z.object({ pill_id: z.string().uuid() }))
    .min(1, "Add at least one pill to the path."),
});
type PathFormInput = z.infer<typeof pathFormSchema>;

export function PathEditor() {
  const router = useRouter();
  const params = useParams<{ pathId: string }>();
  const rawPathId = params?.pathId ?? "new";
  const isCreate = rawPathId === "new";
  const pathId = isCreate ? null : rawPathId;

  const pathQuery = useAdminPath(pathId);
  const pillsQuery = useAdminPills();
  const subjectsQuery = useAdminSubjects();
  const pillsCache = useMemo(() => flattenPills(pillsQuery.data), [pillsQuery.data]);
  const subjectsCache = useMemo(
    () => flattenSubjects(subjectsQuery.data),
    [subjectsQuery.data],
  );
  const pillById = useMemo(() => {
    const m = new Map<string, PillResponse>();
    for (const p of pillsCache) m.set(p.id, p);
    return m;
  }, [pillsCache]);
  const subjectNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of subjectsCache) m.set(s.id, s.name);
    return m;
  }, [subjectsCache]);

  const form = useForm<PathFormInput>({
    resolver: zodResolver(pathFormSchema),
    mode: "onSubmit",
    defaultValues: { name: "", description: "", pills: [] },
  });
  // `keyName` defaults to `id`; we use `_internalId` per spec §B.7 §7
  // since our element shape has its own `pill_id` (avoiding rhf's
  // implicit `id` key clobbering future expansion).
  const { fields, move, append, remove } = useFieldArray({
    control: form.control,
    name: "pills",
    keyName: "_internalId",
  });

  // Hydrate the form on edit-mode load.
  useEffect(() => {
    if (isCreate) return;
    const data = pathQuery.data;
    if (!data) return;
    form.reset({
      name: data.name,
      description: data.description ?? "",
      pills: data.pill_ids.map((pill_id) => ({ pill_id })),
    });
  }, [isCreate, pathQuery.data, form]);

  const createMutation = useCreatePath();
  const updateMutation = useUpdatePath();
  const submitting = createMutation.isPending || updateMutation.isPending;
  // Destructure here so rhf's formState Proxy registers a subscription
  // — reading `form.formState.isDirty` only inside an event handler
  // won't trigger re-renders or even update the value reliably.
  const { isDirty } = form.formState;

  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onSubmit = form.handleSubmit(async (values) => {
    const pillIds = values.pills.map((p) => p.pill_id);
    try {
      if (isCreate) {
        const body: LearningPathCreate = {
          name: values.name,
          description:
            values.description?.trim() === "" ? null : (values.description ?? null),
          pill_ids: pillIds,
        };
        await createMutation.mutateAsync(body);
        toast("Path created");
      } else if (pathId && pathQuery.data) {
        // Slice 3 precedent: compare values directly rather than relying
        // on rhf `dirtyFields` for the pill-array diff (PillUpdate F10).
        const body: LearningPathUpdate = {};
        if (values.name !== pathQuery.data.name) body.name = values.name;
        const nextDesc =
          values.description?.trim() === "" ? null : (values.description ?? null);
        if (nextDesc !== pathQuery.data.description) body.description = nextDesc;
        if (!arraysEqual(pillIds, pathQuery.data.pill_ids)) body.pill_ids = pillIds;
        if (Object.keys(body).length > 0) {
          await updateMutation.mutateAsync({ pathId, body });
        }
        toast("Path saved");
      }
      router.push("/admin/paths");
    } catch (err) {
      applyApiErrorToForm(err, form);
    }
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = fields.findIndex((f) => f._internalId === active.id);
    const to = fields.findIndex((f) => f._internalId === over.id);
    if (from < 0 || to < 0) return;
    move(from, to);
  };

  const onCancel = () => {
    if (isDirty) {
      setCancelConfirmOpen(true);
    } else {
      router.push("/admin/paths");
    }
  };

  const onConfirmCancel = () => {
    setCancelConfirmOpen(false);
    router.push("/admin/paths");
  };

  const retiredCount = useMemo(
    () =>
      fields.filter((f) => {
        const pill = pillById.get(f.pill_id);
        return pill && pill.retired_at !== null;
      }).length,
    [fields, pillById],
  );

  if (!isCreate && pathQuery.isPending) {
    return (
      <div className="grid grid-cols-12 gap-6" data-testid="path-editor-loading">
        <div className="col-span-12 lg:col-span-7 space-y-4">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-32 w-full" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
        <div className="col-span-12 lg:col-span-5 space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!isCreate && pathQuery.isError) {
    // Pattern C boundary handles 5xx via error.tsx; surface a 404 inline.
    return (
      <div className="border border-line bg-bg-raised p-8 text-center">
        <div className="font-serif text-[20px] text-ink mb-2">Path not found</div>
        <div className="text-[13px] text-ink-3 mb-4">
          The path may have been deleted, or the link is stale.
        </div>
        <Button onClick={() => router.push("/admin/paths")}>Back to paths</Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={isCreate ? "New learning path" : "Edit learning path"}
        title={isCreate ? "Create a path" : (pathQuery.data?.name ?? "Edit path")}
        subtitle="Bundle pills into a curriculum. Reorder by dragging; remove pills inline."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
              data-testid="path-editor-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="path-editor-form"
              disabled={submitting}
              data-testid="path-editor-save"
            >
              {submitting ? "Saving…" : isCreate ? "Create path" : "Save changes"}
            </Button>
          </>
        }
      />

      <form
        id="path-editor-form"
        onSubmit={onSubmit}
        noValidate
        data-testid="path-editor-form"
        className="grid grid-cols-12 gap-6"
      >
        <div className="col-span-12 lg:col-span-7 space-y-5">
          <div className="border border-line bg-bg-raised p-5">
            <Field label="Name" error={form.formState.errors.name?.message ?? null}>
              <Input
                {...form.register("name")}
                autoFocus={isCreate}
                disabled={submitting}
                data-testid="path-editor-name"
              />
            </Field>
            <Field
              label="Description"
              hint="Optional. Up to 2048 characters."
              error={form.formState.errors.description?.message ?? null}
            >
              <Textarea
                {...form.register("description")}
                rows={3}
                disabled={submitting}
                data-testid="path-editor-description"
              />
            </Field>
          </div>

          <div className="border border-line bg-bg-raised p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="eyebrow">Pills in this path</div>
                <div className="text-[11.5px] text-ink-3 mt-0.5">
                  Drag a row to reorder; remove inline.
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPickerOpen(true)}
                disabled={submitting}
                data-testid="path-editor-add-pill"
              >
                + Add pill to this path
              </Button>
            </div>

            {retiredCount > 0 ? (
              <div
                className="mb-3 border border-warn bg-bg-sunk px-3 py-2 text-[12px] text-warn"
                data-testid="path-editor-retired-warning"
              >
                {retiredCount} pill{retiredCount === 1 ? "" : "s"} in this path{" "}
                {retiredCount === 1 ? "is" : "are"} retired.
              </div>
            ) : null}

            {fields.length === 0 ? (
              <div
                className="border border-dashed border-line p-6 text-center text-[13px] text-ink-3"
                data-testid="path-editor-empty"
              >
                No pills yet. Click &ldquo;Add pill&rdquo; to start.
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={fields.map((f) => f._internalId)}
                  strategy={verticalListSortingStrategy}
                >
                  <ol className="space-y-2" data-testid="path-editor-pills-list">
                    {fields.map((field, index) => (
                      <SortablePillRow
                        key={field._internalId}
                        id={field._internalId}
                        ordinal={index + 1}
                        pill={pillById.get(field.pill_id) ?? null}
                        subjectNameById={subjectNameById}
                        onRemove={() => remove(index)}
                        disabled={submitting}
                      />
                    ))}
                  </ol>
                </SortableContext>
              </DndContext>
            )}

            {form.formState.errors.pills?.message ? (
              <div className="mt-3">
                <FieldError msg={form.formState.errors.pills.message} />
              </div>
            ) : null}

            {form.formState.errors.root?.message ? (
              <div className="mt-3">
                <FieldError msg={form.formState.errors.root.message} />
              </div>
            ) : null}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 space-y-5">
          <div className="border border-line bg-bg-sunk p-5">
            <div className="eyebrow mb-2">Assigned to</div>
            <div className="text-[13px] text-ink-3" data-testid="derived-count-pending">
              Assignment summary coming in v1.x.
            </div>
          </div>

          <div className="border border-line bg-bg-sunk p-5">
            <div className="eyebrow mb-2">Path mechanics</div>
            <ul className="text-[12.5px] text-ink-2 space-y-1.5 list-disc pl-4">
              <li>Pills are presented to the testee in the order shown.</li>
              <li>
                Re-ordering or adding a pill applies to <em>new</em> attempts only —
                existing attempt history stays untouched.
              </li>
              <li>
                Deleting the path unbinds its assignments; testees keep their attempt
                history.
              </li>
            </ul>
          </div>
        </div>
      </form>

      {pickerOpen ? (
        <AddPillToPathModal
          pillsCache={pillsCache}
          subjectNameById={subjectNameById}
          alreadyChosenIds={new Set(fields.map((f) => f.pill_id))}
          onClose={() => setPickerOpen(false)}
          onAdd={(ids) => {
            for (const id of ids) append({ pill_id: id });
            setPickerOpen(false);
          }}
        />
      ) : null}

      {cancelConfirmOpen ? (
        <Modal
          open
          onOpenChange={(o) => (o ? null : setCancelConfirmOpen(false))}
          ariaTitle="Discard unsaved changes"
          ariaDescription="Confirm whether to discard your unsaved edits."
        >
          <ModalHeader eyebrow="Unsaved changes" title={<>Discard unsaved changes?</>} />
          <p className="text-[13px] text-ink-2">
            You have unsaved edits to this path. Closing without saving will lose them.
          </p>
          <ModalActions>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelConfirmOpen(false)}
            >
              Keep editing
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirmCancel}
              data-testid="path-editor-discard-confirm"
            >
              Discard
            </Button>
          </ModalActions>
        </Modal>
      ) : null}
    </>
  );
}

type SortablePillRowProps = {
  id: string;
  ordinal: number;
  pill: PillResponse | null;
  subjectNameById: Map<string, string>;
  onRemove: () => void;
  disabled: boolean;
};

function SortablePillRow({
  id,
  ordinal,
  pill,
  subjectNameById,
  onRemove,
  disabled,
}: SortablePillRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const subjectName = pill ? subjectNameById.get(pill.subject_id) : null;
  const retired = pill?.retired_at !== null && pill?.retired_at !== undefined;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 border border-line bg-bg-raised px-3 py-2.5",
        isDragging && "shadow-[var(--shadow-2)] rotate-[-0.5deg]",
        retired && "opacity-70",
      )}
      data-testid={`path-editor-pill-row-${ordinal}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag pill ${ordinal}`}
        disabled={disabled}
        className="cursor-grab font-mono text-[10px] tracking-[0.18em] text-ink-3 px-1"
        data-testid={`path-editor-drag-handle-${ordinal}`}
      >
        ⋮⋮
      </button>
      <div className="font-serif text-[22px] tabular-nums text-ink-3 w-9">
        {String(ordinal).padStart(2, "0")}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-ink truncate">
          {pill ? pill.name : "Pill not loaded"}
        </div>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-3 mt-0.5">
          {pill ? (
            <>
              {subjectName ?? "—"} · D{pill.available_difficulty_min}–D
              {pill.available_difficulty_max}
              {retired ? " · Retired" : ""}
            </>
          ) : (
            <>Outside the loaded page set</>
          )}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRemove}
        disabled={disabled}
        data-testid={`path-editor-remove-pill-${ordinal}`}
      >
        Remove
      </Button>
    </li>
  );
}

type AddPillToPathModalProps = {
  pillsCache: PillResponse[];
  subjectNameById: Map<string, string>;
  alreadyChosenIds: Set<string>;
  onClose: () => void;
  onAdd: (ids: string[]) => void;
};

function AddPillToPathModal({
  pillsCache,
  subjectNameById,
  alreadyChosenIds,
  onClose,
  onAdd,
}: AddPillToPathModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");

  const candidates = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return pillsCache.filter((p) => {
      if (alreadyChosenIds.has(p.id)) return false;
      if (p.retired_at !== null) return false;
      if (needle) return p.name.toLowerCase().includes(needle);
      return true;
    });
  }, [pillsCache, alreadyChosenIds, q]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Modal
      open
      onOpenChange={(o) => (o ? null : onClose())}
      ariaTitle="Add pills to path"
      ariaDescription="Pick one or more pills to append to this learning path."
      width={680}
    >
      <ModalHeader
        eyebrow="Pill picker"
        title={
          <>
            Add <span className="serif-it">pills</span> to this path
          </>
        }
      />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search pills…"
        aria-label="Search pills"
        data-testid="picker-search"
        className={cn(
          "h-10 w-full border border-line bg-bg-raised px-3 text-[13px] mb-3",
          "focus:outline-none focus:ring-2 focus:ring-accent",
        )}
      />
      <div
        className="max-h-[360px] overflow-y-auto border border-line"
        data-testid="picker-list"
      >
        {candidates.length === 0 ? (
          <div className="p-6 text-center text-[13px] text-ink-3">
            No pills match. Try clearing the search or adding more pills via the Pills
            tab.
          </div>
        ) : (
          <ul>
            {candidates.map((p) => {
              const subjectName = subjectNameById.get(p.subject_id) ?? "—";
              const checked = selected.has(p.id);
              return (
                <li
                  key={p.id}
                  className={cn(
                    "flex items-center gap-3 border-b border-line px-3 py-2 cursor-pointer",
                    checked && "bg-bg-sunk",
                  )}
                  onClick={() => toggle(p.id)}
                  data-testid={`picker-row-${p.id}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(p.id)}
                    aria-label={`Pick ${p.name}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-ink truncate">{p.name}</div>
                    <div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-3 mt-0.5">
                      {subjectName} · D{p.available_difficulty_min}–D
                      {p.available_difficulty_max}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <ModalActions>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => onAdd(Array.from(selected))}
          disabled={selected.size === 0}
          data-testid="picker-add"
        >
          Add {selected.size > 0 ? `${selected.size} ` : ""}pill
          {selected.size === 1 ? "" : "s"}
        </Button>
      </ModalActions>
    </Modal>
  );
}

function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
