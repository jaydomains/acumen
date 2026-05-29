"use client";

/**
 * TestEditor — admin test editor per FE-8 admin-tests §B.2
 * (`fe-specs/FE-8-admin-tests.md:223–516`). Slice 12.
 *
 * `testId === "new"` triggers create mode; any UUID triggers edit mode.
 * Save lives in `PublishControls` (footer) per §B.2 §7 design rule.
 *
 * Mode wiring:
 * - `per_testee` is fully wired (the only shipping mode in v1 for
 *   Slice 12; frozen + hand_authored land Slice 13 alongside the
 *   question editor modal; benchmark deferred per §E.8).
 * - `frozen`, `hand_authored`, `benchmark` mount stub sections — admins
 *   selecting these get an honest "coming next slice" notice.
 *
 * Drift Finding #10: value-diff PATCH body (rhf `dirtyFields` is
 * unreliable in jsdom — Slice 5/7 absorbed precedent).
 *
 * Drift Finding #6: post-create mode is immutable. ModePicker disabled
 * in edit mode regardless of status.
 *
 * Drift Finding #1: Lock button ships disabled (no `/v1/campaigns`
 * endpoint to feed `CampaignLockRequest.campaign_id`).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { applyApiErrorToForm } from "@/lib/api/form-errors";
import { PageHeader } from "@/components/shell/PageHeader";
import { Modal, ModalActions, ModalHeader } from "@/components/admin/modal";
import { Field, FieldRow, FieldError } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAdminTest,
  useCreateTest,
  useUpdateTest,
  usePublishTest,
  useUnlockTest,
  type TestCreate,
  type TestMode,
  type TestUpdate,
} from "@/lib/queries/admin-tests";
import { flattenPills, useAdminPills } from "@/lib/queries/admin-pills";
import { deriveDisplayStatus } from "@/lib/tests/derive-display-status";
import { testEditorSchema, type TestEditorFormInput } from "@/lib/tests/test-editor-form";
import { ModePicker } from "./mode-picker";
import { StatusBar, WarnBanner } from "./status-bar";
import { PerTesteeSection } from "./per-testee-section";
import { FrozenSection } from "./frozen-section";
import { HandAuthoredSection } from "./hand-authored-section";
import { BenchmarkSection } from "./benchmark-section";
import { PublishControls } from "./publish-controls";

export function TestEditor() {
  const router = useRouter();
  const params = useParams<{ testId: string }>();
  const rawTestId = params?.testId ?? "new";
  const isCreate = rawTestId === "new";
  const testId = isCreate ? null : rawTestId;

  const testQuery = useAdminTest(testId);
  const pillsQuery = useAdminPills();
  const pills = useMemo(() => flattenPills(pillsQuery.data), [pillsQuery.data]);

  const form = useForm<TestEditorFormInput>({
    resolver: zodResolver(testEditorSchema),
    mode: "onSubmit",
    defaultValues: {
      name: "",
      mode: "per_testee",
      timed: true,
      duration_minutes: null,
      pass_threshold: 0.7,
      target_difficulty: null,
      pill_id: null,
      randomise_question_order: false,
      randomise_option_order: false,
    },
  });

  // Hydrate on edit-mode load. Slice 13 cleanup: gate on a `hydrated`
  // ref so subsequent `testQuery.data` invalidations (e.g. after a
  // PATCH succeeds and TanStack invalidates) don't stomp in-flight
  // edits the user has typed since the last save. The first server
  // payload wins; later refetches no-op.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (isCreate) return;
    if (hydratedRef.current) return;
    const data = testQuery.data;
    if (!data) return;
    form.reset({
      name: data.name,
      mode: data.mode,
      timed: data.timed,
      duration_minutes: data.duration_minutes,
      pass_threshold: data.pass_threshold,
      target_difficulty: data.target_difficulty,
      pill_id: data.pill_id ?? null,
      randomise_question_order: data.randomise_question_order,
      randomise_option_order: data.randomise_option_order,
    });
    hydratedRef.current = true;
  }, [isCreate, testQuery.data, form]);

  const createMutation = useCreateTest();
  const updateMutation = useUpdateTest();
  const publishMutation = usePublishTest();
  const unlockMutation = useUnlockTest();
  // Destructure here so rhf's formState Proxy subscribes — reading
  // formState.isDirty inside a handler won't trigger reliably.
  const { isDirty } = form.formState;

  const test = testQuery.data ?? null;
  const displayStatus = test ? deriveDisplayStatus(test) : "draft";
  const formMode = form.watch("mode");
  // In edit mode, the canonical mode comes from server state and is
  // immutable — the form value mirrors it but the UI source of truth
  // is the response. Falling back to the form value covers create mode.
  const activeMode: TestMode = test ? test.mode : formMode;

  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  // Field locks per state matrix (§B.2 §5).
  // - draft → everything editable
  // - published → only name (+ timing) editable; mode/pill/difficulty locked
  // - locked → everything read-only
  const fullyLocked = displayStatus === "locked";
  const partiallyLocked = displayStatus === "published";
  const perTesteeLocked = fullyLocked || partiallyLocked;
  const submitting =
    createMutation.isPending || updateMutation.isPending || publishMutation.isPending;

  const composeCreateBody = (values: TestEditorFormInput): TestCreate => {
    const body: TestCreate = {
      name: values.name,
      mode: values.mode,
      visibility: "library",
      timed: values.timed,
      duration_minutes: values.duration_minutes ?? null,
      pause_allowance: null,
      timeout_behaviour: "auto_submit",
      max_pause_duration_minutes: 30,
      pass_threshold: values.pass_threshold ?? null,
      target_difficulty: values.target_difficulty ?? null,
      randomise_question_order: values.randomise_question_order,
      randomise_option_order: values.randomise_option_order,
    };
    if (values.mode === "per_testee") {
      body.pill_id = values.pill_id ?? null;
    }
    return body;
  };

  const composeUpdateBody = (
    values: TestEditorFormInput,
    existing: NonNullable<typeof test>,
  ): TestUpdate => {
    // Value-diff PATCH per Slice 5/7 standing absorption — only send
    // fields that actually changed. `mode` is NOT on TestUpdate.
    const body: TestUpdate = {};
    if (values.name !== existing.name) body.name = values.name;
    if (values.timed !== existing.timed) body.timed = values.timed;
    if (values.duration_minutes !== existing.duration_minutes) {
      body.duration_minutes = values.duration_minutes ?? null;
    }
    if (values.pass_threshold !== existing.pass_threshold) {
      body.pass_threshold = values.pass_threshold ?? null;
    }
    if (values.target_difficulty !== existing.target_difficulty) {
      body.target_difficulty = values.target_difficulty ?? null;
    }
    if (values.randomise_question_order !== existing.randomise_question_order) {
      body.randomise_question_order = values.randomise_question_order;
    }
    if (values.randomise_option_order !== existing.randomise_option_order) {
      body.randomise_option_order = values.randomise_option_order;
    }
    const nextPillId = values.mode === "per_testee" ? (values.pill_id ?? null) : null;
    if (nextPillId !== (existing.pill_id ?? null)) {
      body.pill_id = nextPillId;
    }
    return body;
  };

  const handleSave = form.handleSubmit(async (values) => {
    try {
      if (isCreate) {
        const created = await createMutation.mutateAsync(composeCreateBody(values));
        toast("Test saved");
        router.replace(`/admin/tests/${created.id}/edit`);
        return;
      }
      if (!testId || !test) return;
      const body = composeUpdateBody(values, test);
      if (Object.keys(body).length > 0) {
        await updateMutation.mutateAsync({ testId, body });
      }
      toast("Test saved");
    } catch (err) {
      applyApiErrorToForm(err, form);
      if (err instanceof ApiError && err.code !== "validation_error") {
        toast.error(err.message);
      }
    }
  });

  const handlePublish = async () => {
    if (!testId) return;
    try {
      await publishMutation.mutateAsync(testId);
      toast("Test published — bindable to assignments");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Couldn't publish test.";
      toast.error(msg);
    }
  };

  const handleUnlock = async () => {
    if (!testId) return;
    try {
      await unlockMutation.mutateAsync(testId);
      toast("Test unlocked — back to published");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Couldn't unlock test.";
      toast.error(msg);
    }
  };

  const onCancel = () => {
    if (isDirty) setCancelConfirmOpen(true);
    else router.push("/admin/tests");
  };
  const onConfirmCancel = () => {
    setCancelConfirmOpen(false);
    router.push("/admin/tests");
  };

  if (!isCreate && testQuery.isPending) {
    return (
      <div className="space-y-4" data-testid="test-editor-loading">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!isCreate && testQuery.isError) {
    const err = testQuery.error;
    const is404 = err instanceof ApiError && err.status === 404;
    if (is404) {
      return (
        <div
          className="border border-line bg-bg-raised p-8 text-center"
          data-testid="test-editor-not-found"
        >
          <div className="font-serif text-[20px] text-ink mb-2">Test not found</div>
          <div className="text-[13px] text-ink-3 mb-4">
            The test may have been deleted, or the link is stale.
          </div>
          <Button onClick={() => router.push("/admin/tests")}>Back to tests</Button>
        </div>
      );
    }
    throw err;
  }

  const errors = form.formState.errors;

  return (
    <>
      <PageHeader
        eyebrow={isCreate ? "New test" : "Edit test"}
        title={isCreate ? "Author a test" : (test?.name ?? "Edit test")}
        subtitle="Pick a mode, configure the run, and publish. Modes lock after first save."
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
            data-testid="test-editor-cancel"
          >
            Back to tests
          </Button>
        }
      />

      <div className="mb-4">
        <StatusBar test={test} />
      </div>

      {displayStatus !== "draft" ? (
        <div className="mb-4">
          <WarnBanner status={displayStatus} />
        </div>
      ) : null}

      <form
        id="test-editor-form"
        onSubmit={handleSave}
        noValidate
        data-testid="test-editor-form"
        className="space-y-5"
      >
        <div className="border border-line bg-bg-raised p-5">
          <div className="eyebrow mb-3">Identity</div>
          <Field label="Title" error={errors.name?.message ?? null} locked={fullyLocked}>
            <Input
              {...form.register("name")}
              autoFocus={isCreate}
              disabled={fullyLocked || submitting}
              data-testid="test-editor-name"
            />
          </Field>
        </div>

        <div className="border border-line bg-bg-raised p-5">
          <div className="eyebrow mb-3">Mode</div>
          <ModePicker
            value={activeMode}
            onChange={(m) => form.setValue("mode", m, { shouldDirty: true })}
            locked={!isCreate || fullyLocked}
          />
        </div>

        {activeMode === "per_testee" ? (
          <PerTesteeSection
            control={form.control}
            register={form.register}
            pills={pills}
            disabled={perTesteeLocked || submitting}
            errors={{
              pill_id: errors.pill_id?.message ?? null,
              target_difficulty: errors.target_difficulty?.message ?? null,
              duration_minutes: errors.duration_minutes?.message ?? null,
            }}
          />
        ) : null}
        {activeMode === "frozen" ? (
          <FrozenSection
            testId={testId}
            sectionLocked={fullyLocked}
            poolLocked={partiallyLocked}
          />
        ) : null}
        {activeMode === "hand_authored" ? (
          <HandAuthoredSection
            testId={testId}
            sectionLocked={fullyLocked}
            poolLocked={partiallyLocked}
          />
        ) : null}
        {activeMode === "benchmark" ? <BenchmarkSection /> : null}

        <div className="border border-line bg-bg-raised p-5">
          <div className="eyebrow mb-3">Run options</div>
          <FieldRow cols="1fr 1fr">
            <Field label="Pass threshold (0–1)" locked={fullyLocked}>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.05}
                {...form.register("pass_threshold", {
                  setValueAs: (v: unknown) => {
                    if (v === "" || v === null || v === undefined) return null;
                    const n = Number(v);
                    return Number.isFinite(n) ? n : null;
                  },
                })}
                disabled={fullyLocked || submitting}
                data-testid="test-editor-pass-threshold"
              />
            </Field>
            <Field
              label="Randomise"
              hint="Shuffle question and option order at attempt-start."
            >
              <div className="flex flex-col gap-2 mt-1">
                <label className="flex items-center gap-2 text-[13px] text-ink-2">
                  <input
                    type="checkbox"
                    {...form.register("randomise_question_order")}
                    disabled={fullyLocked || submitting}
                    data-testid="test-editor-randomise-questions"
                  />
                  Randomise question order
                </label>
                <label className="flex items-center gap-2 text-[13px] text-ink-2">
                  <input
                    type="checkbox"
                    {...form.register("randomise_option_order")}
                    disabled={fullyLocked || submitting}
                    data-testid="test-editor-randomise-options"
                  />
                  Randomise option order
                </label>
              </div>
            </Field>
          </FieldRow>
        </div>

        {errors.root?.message ? <FieldError msg={errors.root.message} /> : null}

        <PublishControls
          status={displayStatus}
          isCreate={isCreate}
          saving={createMutation.isPending || updateMutation.isPending}
          publishing={publishMutation.isPending}
          unlocking={unlockMutation.isPending}
          onSave={() => {
            void handleSave();
          }}
          onPublish={() => {
            void handlePublish();
          }}
          onUnlock={() => {
            void handleUnlock();
          }}
        />
      </form>

      {cancelConfirmOpen ? (
        <Modal
          open
          onOpenChange={(o) => (o ? null : setCancelConfirmOpen(false))}
          ariaTitle="Discard unsaved changes"
          ariaDescription="Confirm whether to discard your unsaved edits."
        >
          <ModalHeader eyebrow="Unsaved changes" title={<>Discard unsaved changes?</>} />
          <p className="text-[13px] text-ink-2">
            You have unsaved edits to this test. Leaving without saving will lose them.
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
              data-testid="test-editor-discard-confirm"
            >
              Discard
            </Button>
          </ModalActions>
        </Modal>
      ) : null}
    </>
  );
}
