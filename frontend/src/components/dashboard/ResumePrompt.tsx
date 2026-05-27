"use client";

/**
 * ResumePrompt (FE-4 §B.3).
 *
 * Dashboard banner that surfaces when an in-flight attempt is
 * recoverable via the localStorage bridge. Two buttons:
 *   - Resume → router.push(/attempts/<id>)
 *   - Discard → clear the inflight key (does NOT abandon the attempt
 *     server-side; documented as known limitation in spec §E #7).
 *
 * Renders above the dashboard hero. Hidden when there's no inflight
 * attempt or while the detection query is loading (avoids flash).
 */

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/primitives/Icon";
import { useResumeDetection } from "@/lib/attempts/resume-detection";

function relativeMinutesAgo(iso: string | null): string {
  if (!iso) return "moments ago";
  const startedMs = Date.parse(iso);
  if (Number.isNaN(startedMs)) return "moments ago";
  const minutes = Math.floor((Date.now() - startedMs) / 60_000);
  if (minutes < 1) return "moments ago";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "1 hour ago";
  return `${hours} hours ago`;
}

export function ResumePrompt() {
  const router = useRouter();
  const detection = useResumeDetection();

  if (detection.status !== "resumable") return null;
  const attempt = detection.attempt;
  const startedAtCopy = relativeMinutesAgo(attempt.started_at);

  return (
    <Card
      data-testid="resume-prompt"
      className="flex flex-col gap-3 border-warn bg-warn-soft p-5"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-1 text-warn">
          <Icon name="flag" size={20} />
        </span>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-warn">
            In-flight attempt
          </span>
          <h2 className="font-serif text-[20px] tracking-[-0.01em] text-ink">
            You have an attempt in progress.
          </h2>
          <p className="text-[13px] leading-5 text-ink-2">
            Started {startedAtCopy}. Resume where you left off, or discard if you
            don&apos;t plan to finish it (this just clears the reminder — the attempt
            stays open on the server).
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          data-testid="resume-prompt-discard"
          onClick={() => detection.discard()}
        >
          Discard
        </Button>
        <Button
          data-testid="resume-prompt-resume"
          onClick={() => router.push(`/attempts/${attempt.id}`)}
        >
          Resume →
        </Button>
      </div>
    </Card>
  );
}
