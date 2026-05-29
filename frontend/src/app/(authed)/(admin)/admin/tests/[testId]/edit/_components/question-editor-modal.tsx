"use client";

/**
 * QuestionEditorModal — top-level wrapper per FE-8 admin-tests §B.3
 * §2 (`fe-specs/FE-8-admin-tests.md:531`). Slice 13.
 *
 * Owns:
 * - Modal shell + accessible title.
 * - Pool-context navigation (Save & next / Save & previous) by index
 *   into the parent-supplied `pool` array.
 * - Cancel-with-dirty confirm via the §C.5 Modal primitive (jsdom-
 *   testable; matches Slice 7 PathEditor precedent).
 *
 * The form itself lives in `QuestionEditorInner`. The modal calls
 * `submitRef.current()` to fire submit from its `ModalActions` buttons.
 *
 * Architectural lock A from binding pause #2: the modal closes via its
 * own confirm flow independent of the test editor's Save. Question
 * state never threads through `TestEditorFormInput`.
 */

import { useCallback, useRef, useState } from "react";
import { Modal, ModalActions, ModalHeader } from "@/components/admin/modal";
import { Button } from "@/components/ui/button";
import type { QuestionResponse } from "@/lib/queries/admin-questions";
import { QuestionEditorInner } from "./question-editor-inner";

export type QuestionEditorModalProps = {
  open: boolean;
  testId: string;
  /** Ordered pool list — needed for Save & next/previous navigation. */
  pool: QuestionResponse[];
  /** When null → create mode; when set → edit mode for this question. */
  question: QuestionResponse | null;
  /** Modal close. */
  onClose: () => void;
  /** Switch to a different question (used by Save & next/previous). */
  onNavigate: (next: QuestionResponse | null) => void;
};

export function QuestionEditorModal({
  open,
  testId,
  pool,
  question,
  onClose,
  onNavigate,
}: QuestionEditorModalProps) {
  const submitRef = useRef<(() => Promise<void>) | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const isEdit = question !== null;
  const currentIndex = isEdit ? pool.findIndex((q) => q.id === question.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < pool.length - 1;

  const handleClose = useCallback(() => {
    if (isDirty) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  }, [isDirty, onClose]);

  const confirmDiscard = () => {
    setDiscardOpen(false);
    setIsDirty(false);
    onClose();
  };

  // The modal tracks `pendingAfterSave` so the close/navigate action
  // only fires once `QuestionEditorInner.onSaved` has actually been
  // invoked — rhf's `handleSubmit` resolves the same Promise whether
  // validation passed or failed, so we can't infer success from the
  // submit await alone.
  const pendingAfterSaveRef = useRef<"close" | "prev" | "next" | null>(null);
  const triggerSubmit = (after: "close" | "prev" | "next") => {
    const fn = submitRef.current;
    if (!fn) return;
    pendingAfterSaveRef.current = after;
    void fn();
  };

  const handleSaved = () => {
    setIsDirty(false);
    const after = pendingAfterSaveRef.current;
    pendingAfterSaveRef.current = null;
    if (after === "close") {
      onClose();
    } else if (after === "prev") {
      const prev = pool[currentIndex - 1] ?? null;
      onNavigate(prev);
    } else if (after === "next") {
      const next = pool[currentIndex + 1] ?? null;
      onNavigate(next);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={(o) => (o ? null : handleClose())}
        ariaTitle={isEdit ? "Edit question" : "Add question"}
        ariaDescription="Author or edit a question in this test's pool."
        width={720}
      >
        <ModalHeader
          eyebrow={
            isEdit
              ? `EDIT QUESTION · ${currentIndex + 1} OF ${pool.length}`
              : "ADD QUESTION"
          }
          title={
            isEdit ? (
              <>
                Edit <span className="serif-it">question {currentIndex + 1}</span>
              </>
            ) : (
              <>
                Add a <span className="serif-it">question</span>
              </>
            )
          }
        />

        <QuestionEditorInner
          testId={testId}
          question={question}
          editMode={isEdit}
          onSaved={handleSaved}
          onDirtyChange={setIsDirty}
          submitRef={submitRef}
        />

        <ModalActions>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            data-testid="question-modal-cancel"
          >
            Cancel
          </Button>
          <div className="flex flex-wrap gap-2 ml-auto">
            {isEdit ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => triggerSubmit("prev")}
                disabled={!hasPrev}
                data-testid="question-modal-save-prev"
              >
                ← Save &amp; previous
              </Button>
            ) : null}
            {isEdit && hasNext ? (
              <Button
                type="button"
                onClick={() => triggerSubmit("next")}
                data-testid="question-modal-save-next"
              >
                Save &amp; next →
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => triggerSubmit("close")}
                data-testid="question-modal-save"
              >
                Save
              </Button>
            )}
          </div>
        </ModalActions>
      </Modal>

      {discardOpen ? (
        <Modal
          open
          onOpenChange={(o) => (o ? null : setDiscardOpen(false))}
          ariaTitle="Discard unsaved changes"
          ariaDescription="Confirm whether to discard your unsaved edits."
          width={420}
        >
          <ModalHeader eyebrow="Unsaved changes" title={<>Discard unsaved changes?</>} />
          <p className="text-[13px] text-ink-2">
            You have unsaved edits to this question. Closing will lose them.
          </p>
          <ModalActions>
            <Button type="button" variant="outline" onClick={() => setDiscardOpen(false)}>
              Keep editing
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDiscard}
              data-testid="question-modal-discard-confirm"
            >
              Discard
            </Button>
          </ModalActions>
        </Modal>
      ) : null}
    </>
  );
}
