/**
 * Figure / InlineFigure / ChoiceFigure — typed image-shells per AC-CD24.
 *
 * v1 contract: every prop shape that the eventual image-rendering PR
 * needs is accepted through the type layer, but every render returns
 * `null`. v1 backend always emits `null` URLs; v1.x lights up the body
 * without touching question-component contracts.
 *
 * The `?: string | null` prop typing accepts optional + nullable from
 * the generated `QuestionResponse` / `ChoiceResponse` schemas without
 * widening or `as` casts at the call site.
 */

export type FigureProps = {
  url?: string | null;
  caption?: string | null;
  alt?: string | null;
};

export type InlineFigureProps = FigureProps;

export type ChoiceFigureProps = {
  url?: string | null;
  alt?: string | null;
};

export function Figure(_props: FigureProps): null {
  return null;
}

export function InlineFigure(_props: InlineFigureProps): null {
  return null;
}

export function ChoiceFigure(_props: ChoiceFigureProps): null {
  return null;
}
