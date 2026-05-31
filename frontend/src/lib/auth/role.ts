/**
 * Bidirectional role-literal seam between the FE UI vocabulary
 * (`"admin" | "testee"`) and the backend wire vocabulary
 * (`"administrator" | "testee"`).
 *
 * The backend canon is `ROLE_ADMINISTRATOR = "administrator"` /
 * `ROLE_TESTEE = "testee"` (`app/permissions.py:65-67`), and every role
 * field on the wire — `UserResponse.role`, `AdminCreateUserRequest.role`,
 * `UserUpdate.role`, and the `GET /v1/users?role=` filter — is a bare
 * `string` in the OpenAPI surface (no enum), so tsc cannot catch a literal
 * mismatch. Without this seam a real admin (`role: "administrator"` from
 * `/v1/auth/me`) narrows to `null` and the admin route guard bounces them
 * to `/403`, and every write path posts the UI literal `"admin"` which the
 * backend rejects with `422 invalid_role`. This module is the single place
 * the two vocabularies meet.
 *
 * Pre-deploy patch (audit A3-L1 / X3-H1). WS1 (post-deploy) replaces the
 * bare-string wire role with a real `enum.Enum` and subsumes this seam —
 * keep both directions funnelling through here so that conversion is a
 * one-file change.
 */

export type UiRole = "admin" | "testee";
export type WireRole = "administrator" | "testee";

/**
 * Wire → UI. Maps the canonical `"administrator"` to the UI's `"admin"`
 * and passes `"testee"` through. The transitional UI literal `"admin"` is
 * also accepted so a mixed payload still narrows. Anything else — an
 * unknown role, `null`, or `undefined` — returns `null`, which callers
 * treat as "no recognised role".
 */
export function fromWireRole(role: string | null | undefined): UiRole | null {
  if (role === "administrator" || role === "admin") return "admin";
  if (role === "testee") return "testee";
  return null;
}

/** UI → wire. `"admin"` → canonical `"administrator"`; `"testee"` through. */
export function toWireRole(role: UiRole): WireRole {
  return role === "admin" ? "administrator" : "testee";
}
