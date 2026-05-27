/**
 * Runtime narrowing for AttemptView.questions[] (FE-4 §B.1 §2).
 *
 * The backend types `questions: list[dict] | None` (verified
 * `app/schemas.py:570`) — the actual per-question shape is built by
 * `app/domain/attempts.py:_present_one`. This module is the FE-side
 * boundary: validate-and-narrow each raw entry into the
 * `AnyPresentedQuestion` discriminated union; entries that don't
 * pass validation are dropped (logged to console for debugging).
 *
 * MCQ option shape is normalised at the backend (`_wrap_option` always
 * emits `{text, image_url}`), so the FE always sees the dict form.
 *
 * Drift-policy: a malformed entry is a backend bug worth surfacing;
 * we drop the bad rows but keep the rest so a stray test doesn't
 * brick the whole runner.
 */

import type {
  AnyPresentedQuestion,
  ChoiceOption,
} from "@/components/attempt/questions/types";

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function narrowOption(raw: unknown): ChoiceOption | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { text?: unknown; image_url?: unknown };
  const text = asString(r.text);
  if (text == null) return null;
  const image = asString(r.image_url);
  return { text, image_url: image };
}

function narrowStringArray(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const item of raw) {
    const s = asString(item);
    if (s == null) return null;
    out.push(s);
  }
  return out;
}

export function narrowPresented(raw: unknown): AnyPresentedQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = asString(r.id);
  const type = asString(r.type);
  const config = r.config as Record<string, unknown> | null | undefined;
  if (!id || !type || !config || typeof config !== "object") return null;

  const prompt = asString(config.prompt);
  if (prompt == null) return null;

  const base = {
    id,
    question_group_id: asString(r.question_group_id),
    attempt_position: asNumber(r.attempt_position),
    reference_image_url: asString(r.reference_image_url),
    reference_image_caption: asString(r.reference_image_caption),
  };

  switch (type) {
    case "multiple_choice": {
      const rawOptions = config.options;
      if (!Array.isArray(rawOptions)) return null;
      const options: ChoiceOption[] = [];
      for (const o of rawOptions) {
        const narrow = narrowOption(o);
        if (!narrow) return null;
        options.push(narrow);
      }
      return { ...base, type: "multiple_choice", config: { prompt, options } };
    }
    case "true_false":
      return { ...base, type: "true_false", config: { prompt } };
    case "matching": {
      const left = narrowStringArray(config.left);
      const right = narrowStringArray(config.right);
      if (!left || !right) return null;
      return { ...base, type: "matching", config: { prompt, left, right } };
    }
    case "short_answer":
      return {
        ...base,
        type: "short_answer",
        config: { prompt, expected_seconds: asNumber(config.expected_seconds) },
      };
    case "scenario":
      return {
        ...base,
        type: "scenario",
        config: { prompt, expected_seconds: asNumber(config.expected_seconds) },
      };
    default:
      return null;
  }
}

export function narrowPresentedList(raw: unknown[]): AnyPresentedQuestion[] {
  const out: AnyPresentedQuestion[] = [];
  for (const item of raw) {
    const narrow = narrowPresented(item);
    if (narrow) out.push(narrow);
    else if (typeof console !== "undefined") {
      // eslint-disable-next-line no-console
      console.warn("[attempt] dropping malformed question entry:", item);
    }
  }
  return out;
}
