"use client";

/**
 * Pill detail page (`/pills/[pillId]`) — FE-3 §B.3 + §B.4.
 *
 * Two branches off `pill.safety_relevant`:
 *  - false: PillMetaCard + (MaterialLoading → MaterialReady) + Regenerate
 *  - true : PillMetaCard + SafetyPosterCard + (SafetyLinks | SafetyEmpty)
 *
 * Both branches share the StickyDifficultyBar at the bottom. The
 * "Practice at D{n}" CTA stops at the entry-point + sonner toast no-op
 * per FE-3 §H(b) item 3 — FE-4 owns the runner.
 *
 * `safety_relevant` source of truth is the pill query. If the
 * learning-material query later says otherwise (shape vs layout
 * drift), log a console warning and trust each path for its own
 * concern (FE-3 §B.4.7).
 */

import { use } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { BoundaryFrame } from "@/components/shell/BoundaryFrame";
import { Icon } from "@/components/primitives/Icon";
import { PillMetaCard } from "@/components/pill-detail/PillMetaCard";
import { SafetyPosterCard } from "@/components/pill-detail/SafetyPosterCard";
import { MaterialLoading } from "@/components/pill-detail/MaterialLoading";
import { MaterialReady } from "@/components/pill-detail/MaterialReady";
import { SafetyLinks } from "@/components/pill-detail/SafetyLinks";
import { SafetyEmpty } from "@/components/pill-detail/SafetyEmpty";
import { StickyDifficultyBar } from "@/components/pill-detail/StickyDifficultyBar";
import {
  narrowMaterial,
  usePillDetail,
  useLearningMaterial,
  useRegenerateLearningMaterial,
} from "@/lib/queries/pills";
import { subjectById } from "@/lib/catalogue/subjects";

// Avoid `use(useParams())` confusion — useParams returns an object
// in client components, NOT a promise. We use it directly.
export default function PillDetailPage() {
  void use; // silence unused import; kept for future server-component split
  const params = useParams<{ pillId: string }>();
  const pillId = params?.pillId ?? "";

  const pillQuery = usePillDetail(pillId);
  const materialQuery = useLearningMaterial(pillId);
  const regenerate = useRegenerateLearningMaterial(pillId);

  if (pillQuery.isError) {
    // The route-level error.tsx boundary takes over on thrown errors,
    // but `unwrap` returns errors to React Query rather than throwing
    // out of the queryFn. Surface an inline boundary card here so the
    // user has a Retry without a full route remount.
    return (
      <BoundaryFrame
        glyph={<Icon name="flag" size={24} />}
        eyebrow="PILL"
        title="We couldn't load this pill."
        body="The pill request failed. Try again, and if it keeps failing, head back to the catalogue."
        actions={
          <Button onClick={() => pillQuery.refetch()} variant="outline" size="sm">
            Try again
          </Button>
        }
      />
    );
  }

  if (pillQuery.isPending) {
    return (
      <PageHeader
        eyebrow="PILL"
        title="Loading pill…"
        subtitle="Hydrating subject + description."
      />
    );
  }

  const pill = pillQuery.data;
  const subject = subjectById(pill.subject_id);

  const handleStart = (difficulty: number) => {
    toast(`Start attempt at D${difficulty}`, {
      description: "Attempt runner lands in FE-4 — this is the entry-point CTA.",
    });
  };

  return (
    <>
      <PageHeader
        eyebrow={subject.name.toUpperCase()}
        title={pill.name}
        subtitle={
          pill.safety_relevant
            ? "Safety-tagged pill — curated external sources only (AC-D21)."
            : "AI explainer below. Pick a difficulty and start practising."
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <PillMetaCard pill={pill} />
          {pill.safety_relevant ? <SafetyPosterCard /> : null}
        </div>

        <div className="min-w-0">
          <RightColumn
            pill={pill}
            materialQuery={materialQuery}
            regenerate={regenerate}
          />
        </div>
      </div>

      <StickyDifficultyBar pill={pill} onStart={handleStart} />
    </>
  );
}

type MaterialQuery = ReturnType<typeof useLearningMaterial>;
type RegenerateMutation = ReturnType<typeof useRegenerateLearningMaterial>;

function RightColumn({
  pill,
  materialQuery,
  regenerate,
}: {
  pill: ReturnType<typeof usePillDetail>["data"] & object;
  materialQuery: MaterialQuery;
  regenerate: RegenerateMutation;
}) {
  if (materialQuery.isPending) {
    return <MaterialLoading />;
  }

  if (materialQuery.isError) {
    return (
      <BoundaryFrame
        glyph={<Icon name="flag" size={24} />}
        eyebrow="LEARNING MATERIAL"
        title="We couldn't load the learning material."
        body="The request failed twice in a row. Try again — your progress isn't affected."
        actions={
          <Button onClick={() => materialQuery.refetch()} variant="outline" size="sm">
            Try again
          </Button>
        }
      />
    );
  }

  let narrowed: ReturnType<typeof narrowMaterial>;
  try {
    narrowed = narrowMaterial(materialQuery.data);
  } catch (err) {
    // Contract violation (e.g. backend ships a new `source` enum we
    // don't know yet). Render inline boundary instead of letting the
    // throw escape into the route-level error.tsx — keeps the meta
    // card visible so the user can retry without losing context.
    console.warn("narrowMaterial failed:", err);
    return (
      <BoundaryFrame
        glyph={<Icon name="flag" size={24} />}
        eyebrow="LEARNING MATERIAL"
        title="Unexpected material format."
        body="The server returned a format we don't recognise. Try refreshing the material — your progress isn't affected."
        actions={
          <Button onClick={() => materialQuery.refetch()} variant="outline" size="sm">
            Try again
          </Button>
        }
      />
    );
  }

  if (pill.safety_relevant && narrowed.kind !== "safety") {
    // Drift: pill says safety, material payload says ai. Trust pill
    // for layout (we're already in the safety branch); show empty
    // state with a console warning so QA can spot it.
    console.warn(
      `safety_relevant mismatch: pill=${pill.id} pill.safety_relevant=true material.kind=${narrowed.kind}`,
    );
    return <SafetyEmpty />;
  }
  if (!pill.safety_relevant && narrowed.kind !== "ai") {
    console.warn(
      `safety_relevant mismatch: pill=${pill.id} pill.safety_relevant=false material.kind=${narrowed.kind}`,
    );
  }

  if (narrowed.kind === "safety") {
    return narrowed.links.length === 0 ? (
      <SafetyEmpty />
    ) : (
      <SafetyLinks links={narrowed.links} />
    );
  }

  return (
    <MaterialReady
      content={narrowed.content}
      cached={narrowed.cached}
      served_at={narrowed.served_at}
      regenerating={regenerate.isPending}
      onRegenerate={() => {
        regenerate.mutate(undefined, {
          onError: () => {
            toast.error("Couldn't regenerate. Try again in a moment.");
          },
        });
      }}
    />
  );
}
