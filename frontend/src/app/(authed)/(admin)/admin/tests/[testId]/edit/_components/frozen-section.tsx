"use client";

/**
 * FrozenSection — question pool table + Add CTA + question editor
 * modal mount per FE-8 admin-tests §B.2 §2 (`fe-specs/FE-8-admin-
 * tests.md:242`). Slice 13.
 *
 * Architectural lock C from binding pause #2: two lock props.
 * - `sectionLocked` — locks Add/Edit/Delete (entire pool surface).
 * - `poolLocked` — locks pool mutation but section can still render
 *   in read mode. Today `sectionLocked` implies `poolLocked`; the
 *   prop split future-proofs the partial-locked published state.
 *
 * Pool ordering (drift sweep Finding #10): the wire returns rows in
 * server order (presumably `created_at ASC`); FE trusts that order
 * and uses array index for Save & next/previous navigation.
 *
 * Pool-size hint (Finding #11): pure FE display logic — backend
 * doesn't gate publish on pool size.
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Modal, ModalActions, ModalHeader } from "@/components/admin/modal";
import { cn } from "@/lib/utils";
import {
  flattenQuestions,
  useAdminQuestions,
  useDeleteQuestion,
  type QuestionResponse,
} from "@/lib/queries/admin-questions";
import { flattenPills, useAdminPills } from "@/lib/queries/admin-pills";
import {
  pillIdFromQuestion,
  previewQuestionBody,
} from "@/lib/tests/unpack-question-config";
import { QuestionEditorModal } from "./question-editor-modal";

export const RECOMMENDED_POOL_SIZE = 8;

export type FrozenSectionProps = {
  testId: string | null;
  /** Whole section locked (locked-status tests). */
  sectionLocked?: boolean;
  /** Pool mutation locked (published-status tests). */
  poolLocked?: boolean;
};

type ModalState =
  | { kind: "closed" }
  | { kind: "edit"; question: QuestionResponse | null };

export function FrozenSection({
  testId,
  sectionLocked = false,
  poolLocked = false,
}: FrozenSectionProps) {
  const list = useAdminQuestions(testId);
  const pool = useMemo(() => flattenQuestions(list.data), [list.data]);
  const pillsQuery = useAdminPills();
  const pillById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of flattenPills(pillsQuery.data)) m.set(p.id, p.name);
    return m;
  }, [pillsQuery.data]);
  const deleteMutation = useDeleteQuestion(testId);

  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  const [confirmDelete, setConfirmDelete] = useState<QuestionResponse | null>(null);

  if (testId === null) {
    // Test must be saved as a draft first before the pool can exist
    // (POST /v1/tests/{id}/questions needs a real test_id).
    return (
      <div
        className="border border-dashed border-line bg-bg-sunk p-6 text-center"
        data-testid="frozen-section-save-first"
      >
        <div className="eyebrow mb-2">Frozen pool</div>
        <div className="font-serif text-[20px] text-ink mb-2">
          Save the test as a draft first.
        </div>
        <div className="text-[13px] text-ink-3 max-w-md mx-auto">
          The question pool attaches to a saved test. Once saved, the pool table lands
          here.
        </div>
      </div>
    );
  }

  const mutable = !sectionLocked && !poolLocked;
  const recommendedDelta = Math.max(0, RECOMMENDED_POOL_SIZE - pool.length);

  return (
    <div className="border border-line bg-bg-raised p-5" data-testid="frozen-section">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div>
          <div className="eyebrow">Question pool</div>
          <div className="text-[11.5px] text-ink-3 mt-0.5">
            {pool.length} question{pool.length === 1 ? "" : "s"} · recommended{" "}
            {RECOMMENDED_POOL_SIZE}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setModal({ kind: "edit", question: null })}
          disabled={!mutable}
          data-testid="frozen-section-add"
        >
          + Add question
        </Button>
      </div>

      {list.isPending ? (
        <div data-testid="frozen-section-loading">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full mb-2" />
          ))}
        </div>
      ) : pool.length === 0 ? (
        <div
          className="border border-dashed border-line p-6 text-center text-[13px] text-ink-3"
          data-testid="frozen-section-empty"
        >
          No questions yet. Click &ldquo;Add question&rdquo; to start the pool.
        </div>
      ) : (
        <PoolTable
          pool={pool}
          pillNameById={pillById}
          mutable={mutable}
          onEdit={(q) => setModal({ kind: "edit", question: q })}
          onDelete={(q) => setConfirmDelete(q)}
        />
      )}

      {recommendedDelta > 0 && pool.length > 0 ? (
        <div
          className="mt-3 text-[12.5px] text-warn"
          data-testid="frozen-section-recommend-hint"
        >
          Add at least {recommendedDelta} more question
          {recommendedDelta === 1 ? "" : "s"} to reach the recommended pool size of{" "}
          {RECOMMENDED_POOL_SIZE}.
        </div>
      ) : null}

      {modal.kind === "edit" ? (
        <QuestionEditorModal
          open
          testId={testId}
          pool={pool}
          question={modal.question}
          onClose={() => setModal({ kind: "closed" })}
          onNavigate={(next) => setModal({ kind: "edit", question: next })}
        />
      ) : null}

      {confirmDelete ? (
        <Modal
          open
          onOpenChange={(o) => (o ? null : setConfirmDelete(null))}
          ariaTitle="Delete question"
          ariaDescription="Confirm deletion of this question."
          width={460}
        >
          <ModalHeader eyebrow="Delete question" title={<>Delete this question?</>} />
          <p className="text-[13px] text-ink-2">
            This removes the question from the pool. Attempt history is preserved for any
            testees who already saw it.
          </p>
          <ModalActions>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDelete(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              data-testid="frozen-section-delete-confirm"
              disabled={deleteMutation.isPending}
              onClick={async () => {
                try {
                  await deleteMutation.mutateAsync(confirmDelete.id);
                  toast("Question deleted");
                  setConfirmDelete(null);
                } catch (err) {
                  const msg =
                    err instanceof ApiError
                      ? err.message
                      : "Couldn't delete question — try again.";
                  toast.error(msg);
                }
              }}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete question"}
            </Button>
          </ModalActions>
        </Modal>
      ) : null}
    </div>
  );
}

type PoolTableProps = {
  pool: QuestionResponse[];
  pillNameById: Map<string, string>;
  mutable: boolean;
  onEdit: (q: QuestionResponse) => void;
  onDelete: (q: QuestionResponse) => void;
};

function PoolTable({ pool, pillNameById, mutable, onEdit, onDelete }: PoolTableProps) {
  return (
    <table className="w-full text-[13px]" data-testid="frozen-section-table">
      <thead>
        <tr className="border-b border-line text-ink-3 text-left">
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[5%]">
            #
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[14%]">
            Type
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2">
            Body
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[18%]">
            Pill
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[8%]">
            D
          </th>
          <th className="font-mono text-[10.5px] tracking-[0.12em] uppercase py-2 px-2 w-[16%] text-right">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {pool.map((q, i) => {
          const pid = pillIdFromQuestion(q);
          const pillName = pid ? (pillNameById.get(pid) ?? "Unknown pill") : "—";
          const body = previewQuestionBody(q);
          return (
            <tr
              key={q.id}
              className="border-b border-line"
              data-testid={`frozen-section-row-${q.id}`}
            >
              <td className="py-2 px-2 font-mono text-ink-3 tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </td>
              <td className="py-2 px-2">
                <span
                  className={cn(
                    "font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-2",
                  )}
                  data-testid={`frozen-section-row-${q.id}-type`}
                >
                  {q.type}
                </span>
              </td>
              <td className="py-2 px-2 text-ink truncate max-w-[280px]">
                {body || <span className="text-ink-3 italic">(empty body)</span>}
              </td>
              <td className="py-2 px-2 text-ink-2">{pillName}</td>
              <td className="py-2 px-2 font-mono text-ink-3">D{q.assigned_difficulty}</td>
              <td className="py-2 px-2 text-right whitespace-nowrap">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(q)}
                  disabled={!mutable}
                  data-testid={`frozen-section-edit-${q.id}`}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(q)}
                  disabled={!mutable}
                  data-testid={`frozen-section-delete-${q.id}`}
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
