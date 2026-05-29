"use client";

/**
 * PublishControls — 3-variant footer per FE-8 admin-tests §B.2 §2
 * (`fe-specs/FE-8-admin-tests.md:248`).
 *
 * Variants:
 * - **draft** → Save draft + Publish (Publish disabled in create-mode
 *   before first save per drift Finding #12).
 * - **published** → Save changes + Lock (Lock **disabled in v1**
 *   per drift Finding #1 — no `/v1/campaigns` endpoint exists to
 *   obtain a `campaign_id` for `CampaignLockRequest`).
 * - **locked** → Unlock only.
 *
 * Save lives here (not in PageHeader actions) per §B.2 §7 design
 * convention ("No save-button-in-fields-card. Save is in the bottom
 * PublishControls only.").
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DisplayStatus } from "@/lib/tests/derive-display-status";

export type PublishControlsProps = {
  status: DisplayStatus;
  /** True while the editor is in create-mode (no testId yet). */
  isCreate: boolean;
  /** Save mutation in flight. */
  saving: boolean;
  /** Publish mutation in flight. */
  publishing: boolean;
  /** Unlock mutation in flight. */
  unlocking: boolean;
  onSave: () => void;
  onPublish: () => void;
  onUnlock: () => void;
};

export function PublishControls({
  status,
  isCreate,
  saving,
  publishing,
  unlocking,
  onSave,
  onPublish,
  onUnlock,
}: PublishControlsProps) {
  return (
    <div
      className="border-t border-line bg-bg-raised px-5 py-4 flex items-center justify-end gap-2.5 flex-wrap"
      data-testid="publish-controls"
    >
      {status === "draft" ? (
        <DraftControls
          isCreate={isCreate}
          saving={saving}
          publishing={publishing}
          onSave={onSave}
          onPublish={onPublish}
        />
      ) : null}
      {status === "published" ? (
        <PublishedControls saving={saving} onSave={onSave} />
      ) : null}
      {status === "locked" ? (
        <LockedControls unlocking={unlocking} onUnlock={onUnlock} />
      ) : null}
    </div>
  );
}

function DraftControls({
  isCreate,
  saving,
  publishing,
  onSave,
  onPublish,
}: {
  isCreate: boolean;
  saving: boolean;
  publishing: boolean;
  onSave: () => void;
  onPublish: () => void;
}) {
  const publishDisabled = isCreate || saving || publishing;
  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={onSave}
        disabled={saving || publishing}
        data-testid="publish-controls-save"
      >
        {saving ? "Saving…" : "Save draft"}
      </Button>
      {isCreate ? (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={-1}>
                <Button
                  type="button"
                  disabled
                  data-testid="publish-controls-publish"
                  aria-describedby="publish-disabled-hint"
                >
                  Publish
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent id="publish-disabled-hint">
              Save the test as draft first.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <Button
          type="button"
          onClick={onPublish}
          disabled={publishDisabled}
          data-testid="publish-controls-publish"
        >
          {publishing ? "Publishing…" : "Publish"}
        </Button>
      )}
    </>
  );
}

function PublishedControls({ saving, onSave }: { saving: boolean; onSave: () => void }) {
  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={onSave}
        disabled={saving}
        data-testid="publish-controls-save"
      >
        {saving ? "Saving…" : "Save changes"}
      </Button>
      <LockButtonDisabled />
    </>
  );
}

/**
 * Lock button — disabled v1.x stub per Slice 12 drift Finding #1.
 * The hook (`useLockTest`) ships the wire surface; the button stays
 * dark because there's no `/v1/campaigns` endpoint to obtain a
 * `campaign_id` for `CampaignLockRequest`.
 */
function LockButtonDisabled() {
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <span tabIndex={-1}>
            <Button
              type="button"
              variant="outline"
              disabled
              onMouseEnter={() => setOpen(true)}
              onFocus={() => setOpen(true)}
              data-testid="publish-controls-lock"
              aria-describedby="lock-disabled-hint"
            >
              Lock
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent id="lock-disabled-hint">
          Campaign-lock arrives in v1.x once campaigns ship.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function LockedControls({
  unlocking,
  onUnlock,
}: {
  unlocking: boolean;
  onUnlock: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onUnlock}
      disabled={unlocking}
      data-testid="publish-controls-unlock"
    >
      {unlocking ? "Unlocking…" : "Unlock"}
    </Button>
  );
}
