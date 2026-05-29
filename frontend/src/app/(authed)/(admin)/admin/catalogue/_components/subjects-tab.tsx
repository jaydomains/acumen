"use client";

/**
 * SubjectsTab — list + create/edit/delete per FE-8 §B.3
 * (`fe-specs/FE-8-admin-catalogue.md:425–533`).
 *
 * URL state: `?q={search}` for text filter. The `GET /v1/subjects`
 * endpoint has no `q` query param (`frontend/openapi/schema.json:917`),
 * absorbed under §E.7 — we filter the cached page array client-side.
 * The URL still carries `?q=` so deep-links + back-button work.
 *
 * Modal state is ephemeral (NOT in URL) per §B.3 §1 + §B.1 §7.
 *
 * Sentinel-driven pagination follows FE-3 §C.5 (`CatalogueGrid.tsx:28–44`).
 *
 * `pill_count` per row is rendered as "—" per §B.3 §7 + §H(b) item 3 —
 * `SubjectResponse` doesn't carry the field in v1.
 *
 * Toasts: sonner is imported directly (no `@/lib/ui/toast.ts` shim —
 * FE-5 precedent in `BenchmarkRunner.tsx:25`, absorbed Slice 2 Finding #3).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError } from "@/lib/api/errors";
import { applyApiErrorToForm } from "@/lib/api/form-errors";
import { FilterBar } from "@/components/admin/filter-bar";
import { Modal, ModalActions, ModalHeader } from "@/components/admin/modal";
import { Field, FieldError } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  flattenSubjects,
  useAdminSubjects,
  useCreateSubject,
  useDeleteSubject,
  useUpdateSubject,
  type SubjectResponse,
} from "@/lib/queries/admin-subjects";

const subjectFormSchema = z.object({
  name: z.string().min(1, "Subject name is required.").max(255),
  description: z.string().max(1024).optional().default(""),
});
type SubjectFormInput = z.infer<typeof subjectFormSchema>;

type ModalState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; subject: SubjectResponse }
  | { kind: "delete"; subject: SubjectResponse };

export function SubjectsTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams?.get("q") ?? "";

  const [modal, setModal] = useState<ModalState>({ kind: "closed" });

  const list = useAdminSubjects();
  const allSubjects = useMemo(() => flattenSubjects(list.data), [list.data]);
  const filtered = useMemo(() => filterSubjects(allSubjects, q), [allSubjects, q]);

  const writeSearchToUrl = (next: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (!params.get("tab")) params.set("tab", "subjects");
    if (next.trim() === "") params.delete("q");
    else params.set("q", next.trim());
    router.replace(`/admin/catalogue?${params.toString()}`);
  };

  return (
    <div data-testid="subjects-tab">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <FilterBar
          searchValue={q}
          onSearchChange={writeSearchToUrl}
          searchPlaceholder="Search subjects…"
        />
        <Button
          onClick={() => setModal({ kind: "create" })}
          data-testid="subjects-add-button"
        >
          + Add subject
        </Button>
      </div>

      <SubjectsBody
        list={list}
        subjects={filtered}
        hasFilter={q.length > 0}
        onEdit={(subject) => setModal({ kind: "edit", subject })}
        onDelete={(subject) => setModal({ kind: "delete", subject })}
      />

      {modal.kind === "create" || modal.kind === "edit" ? (
        <SubjectModal
          mode={modal.kind}
          subject={modal.kind === "edit" ? modal.subject : null}
          onClose={() => setModal({ kind: "closed" })}
        />
      ) : null}

      {modal.kind === "delete" ? (
        <DeleteSubjectModal
          subject={modal.subject}
          onClose={() => setModal({ kind: "closed" })}
        />
      ) : null}
    </div>
  );
}

function filterSubjects(subjects: SubjectResponse[], q: string): SubjectResponse[] {
  if (!q.trim()) return subjects;
  const needle = q.trim().toLowerCase();
  return subjects.filter(
    (s) =>
      s.name.toLowerCase().includes(needle) ||
      (s.description ?? "").toLowerCase().includes(needle),
  );
}

type SubjectsBodyProps = {
  list: ReturnType<typeof useAdminSubjects>;
  subjects: SubjectResponse[];
  hasFilter: boolean;
  onEdit: (s: SubjectResponse) => void;
  onDelete: (s: SubjectResponse) => void;
};

function SubjectsBody({
  list,
  subjects,
  hasFilter,
  onEdit,
  onDelete,
}: SubjectsBodyProps) {
  const sentinelRef = useRef<HTMLTableRowElement | null>(null);
  // Pin individual props rather than the full `list` object — every
  // `useInfiniteQuery` render returns a fresh object reference, so
  // `[list]` would tear down + recreate the observer on every render.
  // Matches the precedent at `CatalogueGrid.tsx:30–44`.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;

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
      <div className="mt-5" data-testid="subjects-loading">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-full mb-2" />
        ))}
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div
        className="mt-5 border border-line bg-bg-raised p-10 text-center"
        data-testid="subjects-empty"
      >
        <div className="font-serif text-[20px] text-ink mb-2">
          {hasFilter ? "No subjects match your search." : "No subjects yet."}
        </div>
        <div className="text-[13px] text-ink-3">
          {hasFilter
            ? "Try a different term or clear the search."
            : 'Add your first subject with "+ Add subject" above.'}
        </div>
      </div>
    );
  }

  return (
    <table className="mt-5 w-full text-[13px]" data-testid="subjects-table">
      <thead>
        <tr className="border-b border-line text-ink-3 text-left">
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[28%]">
            Subject
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[10%]">
            Pills
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2">
            Description
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[14%] text-right">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {subjects.map((subject) => (
          <tr
            key={subject.id}
            className="border-b border-line"
            data-testid={`subjects-row-${subject.id}`}
          >
            <td className="py-2.5 px-2 font-medium text-ink">{subject.name}</td>
            <td className="py-2.5 px-2 text-ink-3">—</td>
            <td className="py-2.5 px-2 text-ink-2 truncate max-w-0">
              {subject.description ?? ""}
            </td>
            <td className="py-2.5 px-2 text-right">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(subject)}
                data-testid={`subjects-edit-${subject.id}`}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(subject)}
                data-testid={`subjects-delete-${subject.id}`}
              >
                Delete
              </Button>
            </td>
          </tr>
        ))}
        {list.hasNextPage ? (
          <tr ref={sentinelRef} data-testid="subjects-sentinel" aria-hidden="true">
            <td colSpan={4} className="py-3 text-center text-ink-3 text-[12px]">
              {list.isFetchingNextPage ? "Loading more…" : ""}
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

type SubjectModalProps = {
  mode: "create" | "edit";
  subject: SubjectResponse | null;
  onClose: () => void;
};

function SubjectModal({ mode, subject, onClose }: SubjectModalProps) {
  const isEdit = mode === "edit";
  const form = useForm<SubjectFormInput>({
    resolver: zodResolver(subjectFormSchema),
    defaultValues: {
      name: subject?.name ?? "",
      // Per Slice 2 Finding #2: `SubjectResponse.description` is
      // `string | null` so pre-fill defaults to "" for null values.
      description: subject?.description ?? "",
    },
  });

  const createMutation = useCreateSubject();
  const updateMutation = useUpdateSubject();
  const submitting = createMutation.isPending || updateMutation.isPending;

  const onSubmit = form.handleSubmit(async (values) => {
    const body = {
      name: values.name,
      description: values.description?.trim() === "" ? null : values.description,
    };
    try {
      if (isEdit && subject) {
        await updateMutation.mutateAsync({ subjectId: subject.id, body });
        toast("Subject saved");
      } else {
        await createMutation.mutateAsync(body);
        toast("Subject created");
      }
      onClose();
    } catch (err) {
      applyApiErrorToForm(err, form);
    }
  });

  const rootError = form.formState.errors.root?.message;

  return (
    <Modal
      open
      onOpenChange={(o) => (o ? null : onClose())}
      ariaTitle={isEdit ? "Edit subject" : "Create subject"}
      ariaDescription={
        isEdit
          ? "Edit the name and description of this subject."
          : "Create a new subject by entering a name and optional description."
      }
    >
      <ModalHeader
        eyebrow={isEdit ? "Edit subject" : "New subject"}
        title={
          isEdit ? (
            <>
              Edit <span className="serif-it">{subject?.name}</span>
            </>
          ) : (
            <>
              Add a <span className="serif-it">subject</span>
            </>
          )
        }
      />
      <form onSubmit={onSubmit} noValidate data-testid="subject-modal-form">
        <Field label="Name" error={form.formState.errors.name?.message ?? null}>
          <Input
            {...form.register("name")}
            autoFocus
            disabled={submitting}
            data-testid="subject-modal-name"
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
            disabled={submitting}
            data-testid="subject-modal-description"
          />
        </Field>
        {rootError ? <FieldError msg={rootError} /> : null}
        <ModalActions>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} data-testid="subject-modal-submit">
            {submitting
              ? isEdit
                ? "Saving…"
                : "Creating…"
              : isEdit
                ? "Save changes"
                : "Create subject"}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}

type DeleteSubjectModalProps = {
  subject: SubjectResponse;
  onClose: () => void;
};

function DeleteSubjectModal({ subject, onClose }: DeleteSubjectModalProps) {
  const deleteMutation = useDeleteSubject();
  // Per §B.3 §7 + §H(b) item 3: pill_count isn't on SubjectResponse in
  // v1, so the "blocked" variant fires only when the backend rejects
  // the DELETE (the spec's pre-emptive client gate degenerates to a
  // post-response surface until the field lands). v1: enable delete
  // by default; project the rejection error onto the body copy.
  const [serverError, setServerError] = useState<string | null>(null);

  const onConfirm = async () => {
    try {
      await deleteMutation.mutateAsync(subject.id);
      toast("Subject deleted");
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError("Could not delete this subject. Try again.");
      }
    }
  };

  return (
    <Modal
      open
      onOpenChange={(o) => (o ? null : onClose())}
      ariaTitle="Delete subject"
      ariaDescription="Confirm or cancel deletion of this subject."
    >
      <ModalHeader
        eyebrow="Delete subject"
        title={
          <>
            Delete <span className="serif-it">{subject.name}</span>?
          </>
        }
      />
      <p className={cn("text-[13px] text-ink-2", serverError && "mb-1.5")}>
        {serverError
          ? `Can't delete — ${serverError}`
          : "This removes the subject from the catalogue. Re-assign or delete its pills first if the server rejects."}
      </p>
      <ModalActions>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={deleteMutation.isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={onConfirm}
          disabled={deleteMutation.isPending || serverError !== null}
          data-testid="subjects-delete-confirm"
        >
          {deleteMutation.isPending ? "Deleting…" : "Delete subject"}
        </Button>
      </ModalActions>
    </Modal>
  );
}
