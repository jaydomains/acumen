/**
 * derive-invited-status — best-effort heuristic for the "Invited" UX
 * status (FE-8 admin-identity §B.1 §7 in
 * `fe-specs/FE-8-admin-identity.md:293,1031`).
 *
 * Backend `UserStatus` enum is `active | deactivated` only — there is
 * no `invited`/`setup_consumed_at`/`invited_at` field on
 * `UserResponse`. Slice 8 drift Finding #5 absorbed: derive client-side
 * from the signals we DO have.
 *
 * v1 heuristic:
 *   status === "active" AND privacy_ack_at === null  →  "invited"
 *
 * `privacy_ack_at` flips to non-null when the user accepts the privacy
 * notice — that happens only after they consume the setup link AND
 * sign in. So a user who's been created by an admin but never logged
 * in reads as "Invited"; a user who has logged in (acked privacy) but
 * never been active in practice reads as "Active". Acceptable per
 * §B.1 §7 + §H(b) item 2.
 */

export type UserLike = {
  status: string;
  privacy_ack_at: string | null;
};

export type DerivedUserStatus = "active" | "invited" | "deactivated";

export function deriveUserStatus(user: UserLike): DerivedUserStatus {
  if (user.status === "deactivated") return "deactivated";
  if (user.status === "active" && user.privacy_ack_at === null) return "invited";
  return "active";
}
