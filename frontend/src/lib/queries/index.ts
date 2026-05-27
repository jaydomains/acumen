/**
 * Query-key barrel (FE-3 §B.5, §C.2; AC-CD21).
 *
 * Re-exports key OBJECTS only — never hooks. Page files import hooks
 * directly from `@/lib/queries/<domain>` so Next.js can tree-shake
 * unused domains out of each page bundle. A hook barrel would pull
 * every domain into every consumer.
 *
 * Reviewers reject PRs that import hooks from `@/lib/queries`.
 */

export { catalogueQueryKeys } from "./catalogue";
export type { PillsQueryParams } from "./catalogue";
export { pillQueryKeys, narrowMaterial } from "./pills";
export type {
  NarrowedMaterial,
  LearningMaterialResponse,
  SafetyLinkResponse,
} from "./pills";
export { meQueryKeys } from "./me";
export { attemptQueryKeys, invalidateAttempt } from "./attempts";
export type {
  AttemptView,
  AttemptResultResponse,
  TestResponse,
  AttemptViewBundle,
  AutosaveBody,
} from "./attempts";
