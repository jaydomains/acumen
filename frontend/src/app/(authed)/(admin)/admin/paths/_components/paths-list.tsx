"use client";

/**
 * PathsList — admin learning-paths list per FE-8 §B.6
 * (`fe-specs/FE-8-admin-catalogue.md:809–894`).
 *
 * Columns: Name, Pills count (derived from `pill_ids.length` per drift
 * Finding #2), Assigned to (em-dash per §E.8 + drift Finding #7 —
 * field not on the wire), Last edited (relative `updated_at`),
 * Edit/Delete row actions.
 *
 * No filter / search in v1 per §E item 5.
 *
 * Add path → `router.push("/admin/paths/new/edit")` (Slice 7 editor).
 * Edit row → `router.push("/admin/paths/{id}/edit")` (Slice 7 editor).
 * Delete → confirm modal → `useDeletePath` → invalidate `paths.all()`.
 *
 * Sentinel-driven pagination follows FE-3 §C.5 with destructured props
 * per the IntersectionObserver dep-array discipline.
 *
 * `is_private` + `owner_user_id` ignored per drift Finding #3 — v1 admin
 * always shows all paths; backend defaults `is_private=false` on create.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { PageHeader } from "@/components/shell/PageHeader";
import { Modal, ModalActions, ModalHeader } from "@/components/admin/modal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  flattenPaths,
  useAdminPaths,
  useDeletePath,
  type LearningPathResponse,
} from "@/lib/queries/admin-paths";

type ModalState = { kind: "closed" } | { kind: "delete"; path: LearningPathResponse };

export function PathsList() {
  const router = useRouter();
  const list = useAdminPaths();
  const allPaths = useMemo(() => flattenPaths(list.data), [list.data]);

  const [modal, setModal] = useState<ModalState>({ kind: "closed" });

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Learning paths"
        subtitle="Bundle pills into curricula and hand them to testees via assignments."
        actions={
          <Button
            onClick={() => router.push("/admin/paths/new/edit")}
            data-testid="paths-add-button"
          >
            + Add path
          </Button>
        }
      />

      <PathsBody
        list={list}
        paths={allPaths}
        onEdit={(path) => router.push(`/admin/paths/${path.id}/edit`)}
        onDelete={(path) => setModal({ kind: "delete", path })}
      />

      {modal.kind === "delete" ? (
        <DeletePathConfirmModal
          path={modal.path}
          onClose={() => setModal({ kind: "closed" })}
        />
      ) : null}
    </>
  );
}

type PathsBodyProps = {
  list: ReturnType<typeof useAdminPaths>;
  paths: LearningPathResponse[];
  onEdit: (path: LearningPathResponse) => void;
  onDelete: (path: LearningPathResponse) => void;
};

function PathsBody({ list, paths, onEdit, onDelete }: PathsBodyProps) {
  const sentinelRef = useRef<HTMLTableRowElement | null>(null);
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
      <div className="mt-5" data-testid="paths-loading">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-full mb-2" />
        ))}
      </div>
    );
  }

  if (paths.length === 0) {
    return (
      <div
        className="mt-5 border border-line bg-bg-raised p-10 text-center"
        data-testid="paths-empty"
      >
        <div className="font-serif text-[20px] text-ink mb-2">No learning paths yet.</div>
        <div className="text-[13px] text-ink-3">
          Add your first path to bundle pills into a curriculum.
        </div>
      </div>
    );
  }

  return (
    <table className="mt-5 w-full text-[13px]" data-testid="paths-table">
      <thead>
        <tr className="border-b border-line text-ink-3 text-left">
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2">
            Name
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[10%]">
            Pills
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[16%]">
            Assigned to
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[16%]">
            Last edited
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[16%] text-right">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {paths.map((path) => (
          <tr
            key={path.id}
            className="border-b border-line"
            data-testid={`paths-row-${path.id}`}
          >
            <td className="py-2.5 px-2">
              <div className="font-medium text-ink">{path.name}</div>
              {path.description ? (
                <div className="text-[11.5px] text-ink-3 mt-0.5 truncate max-w-[60ch]">
                  {path.description}
                </div>
              ) : null}
            </td>
            <td className="py-2.5 px-2 font-mono text-ink-2 text-[12px]">
              {path.pill_ids.length}
            </td>
            <td className="py-2.5 px-2 text-ink-3" data-testid="derived-count-pending">
              —
            </td>
            <td className="py-2.5 px-2 font-mono text-ink-3 text-[11.5px]">
              {formatRelative(path.updated_at)}
            </td>
            <td className="py-2.5 px-2 text-right">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(path)}
                data-testid={`paths-edit-${path.id}`}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(path)}
                data-testid={`paths-delete-${path.id}`}
              >
                Delete
              </Button>
            </td>
          </tr>
        ))}
        {list.hasNextPage ? (
          <tr ref={sentinelRef} data-testid="paths-sentinel" aria-hidden="true">
            <td colSpan={5} className="py-3 text-center text-ink-3 text-[12px]">
              {list.isFetchingNextPage ? "Loading more…" : ""}
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

function DeletePathConfirmModal({
  path,
  onClose,
}: {
  path: LearningPathResponse;
  onClose: () => void;
}) {
  const mutation = useDeletePath();
  const onConfirm = async () => {
    try {
      await mutation.mutateAsync(path.id);
      toast("Path deleted");
      onClose();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Couldn't delete path — try again";
      toast.error(msg);
    }
  };
  return (
    <Modal
      open
      onOpenChange={(o) => (o ? null : onClose())}
      ariaTitle="Delete learning path"
      ariaDescription="Confirm or cancel deletion of this learning path."
    >
      <ModalHeader
        eyebrow="Delete path"
        title={
          <>
            Delete <span className="serif-it">{path.name}</span>?
          </>
        }
      />
      <p className={cn("text-[13px] text-ink-2")}>
        Bound assignments will lose their reference (testees keep their attempt history).
        This action can&rsquo;t be undone.
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
          data-testid="paths-delete-confirm"
        >
          {mutation.isPending ? "Deleting…" : "Delete path"}
        </Button>
      </ModalActions>
    </Modal>
  );
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const delta = Date.now() - t;
  if (delta < 0) return new Date(iso).toLocaleDateString();
  const sec = Math.round(delta / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}
