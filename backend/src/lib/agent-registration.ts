/** Agent self-registration approval (Phase 15). */

export const REGISTRATION_STATUS = {
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
} as const;

export type RegistrationStatus = (typeof REGISTRATION_STATUS)[keyof typeof REGISTRATION_STATUS];

/** User.status values that may receive a session. Existing agents use Active. */
export const AUTHENTICATABLE_USER_STATUSES = new Set(["Active", "Approved"]);

export function isAuthenticatableUserStatus(status: string | null | undefined): boolean {
  return AUTHENTICATABLE_USER_STATUSES.has(String(status || ""));
}

export function loginBlockReasonForUserStatus(status: string | null | undefined): string | null {
  const s = String(status || "");
  if (isAuthenticatableUserStatus(s)) return null;
  if (s === "Submitted" || s === REGISTRATION_STATUS.SUBMITTED) {
    return "Your registration is pending admin approval. You cannot sign in until an administrator approves your account.";
  }
  if (s === "Rejected" || s === REGISTRATION_STATUS.REJECTED) {
    return "Your registration was rejected. Contact Trevio support if you need help.";
  }
  if (s === "Suspended" || s === "Inactive") {
    return "This account is not active. Contact your administrator.";
  }
  return "This account is not eligible to sign in.";
}

export function canReviewAgentRegistrations(role: string | undefined): boolean {
  return role === "super_admin";
}
