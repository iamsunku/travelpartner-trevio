import { describe, expect, it } from "vitest";
import {
  canTransition,
  normalizeStatus,
  quoteStaffAcceptTransitionBlockReason,
  STATUS_TRANSITIONS,
} from "../lib/quotations.js";
import { quoteCustomerResponseBlockReason } from "../lib/quotation-customer-access.js";
import { quotePastValidityBlockReason } from "../lib/quotation-expiry.js";

/**
 * Phase 19 — staff POST /api/quotations/:id/accept must use the status machine.
 * Previously the route wrote status=Accepted without canTransition.
 */

describe("phase 19 staff accept transition guard", () => {
  it("1. valid statuses may transition to Accepted (staff accept still allowed)", () => {
    for (const status of ["Sent to Agent", "Sent", "Customer Reviewing", "Accepted"] as const) {
      expect(canTransition(normalizeStatus(status), "Accepted")).toBe(true);
      expect(quoteStaffAcceptTransitionBlockReason(status)).toBeNull();
    }
  });

  it("2+6. invalid / ineligible statuses cannot be accepted (Draft, In Progress, etc.)", () => {
    const blocked = [
      "Draft",
      "In Progress",
      "Pending Approval",
      "Revision Requested",
      "Rejected",
      "Expired",
      "Converted to Booking",
      "Archived",
    ];
    for (const status of blocked) {
      expect(canTransition(status, "Accepted")).toBe(false);
      expect(quoteStaffAcceptTransitionBlockReason(status)).toMatch(/Invalid transition/i);
      expect(quoteStaffAcceptTransitionBlockReason(status)).toContain(status);
    }
  });

  it("5. Rejected remains blocked from Accepted by the status machine", () => {
    expect(STATUS_TRANSITIONS.Rejected).not.toContain("Accepted");
    expect(quoteStaffAcceptTransitionBlockReason("Rejected")).toMatch(/Rejected → Accepted/);
  });

  it("4. Expired remains blocked by transition guard (route also keeps expiry checks)", () => {
    expect(quoteStaffAcceptTransitionBlockReason("Expired")).toMatch(/Expired → Accepted/);
    expect(quotePastValidityBlockReason({
      status: "Expired",
      validTill: "2020-01-01",
    })).toMatch(/expired/i);
    // Past validTill on still-sent quote: transition may be allowed by machine, expiry gate still applies
    expect(canTransition("Sent to Agent", "Accepted")).toBe(true);
    expect(quotePastValidityBlockReason({
      status: "Sent to Agent",
      validTill: "2020-01-01",
    }, new Date("2026-09-12T12:00:00.000Z"))).toMatch(/validity/i);
  });

  it("does not invent admin override on staff accept helper", () => {
    // Status endpoint allows override for admins; accept helper must never skip the machine
    expect(canTransition("Draft", "Accepted", true)).toBe(true);
    expect(quoteStaffAcceptTransitionBlockReason("Draft")).not.toBeNull();
  });

  it("7. customer acceptance eligibility rules remain independent and unchanged", () => {
    // Customer path still blocks Draft; staff machine also blocks Draft — both deny incorrectly accepting Draft
    expect(quoteCustomerResponseBlockReason({
      status: "Draft",
      approvalStatus: "Draft",
      validTill: "2099-12-31",
      approvals: [],
    })).toMatch(/not yet available/i);
    expect(quoteStaffAcceptTransitionBlockReason("Draft")).toMatch(/Invalid transition/);

    // Customer path still allows Sent to Agent when approved
    expect(quoteCustomerResponseBlockReason({
      status: "Sent to Agent",
      approvalStatus: "Approved",
      validTill: "2099-12-31",
      approvals: [{ stage: "Team Lead", status: "Approved" }],
    })).toBeNull();
    expect(quoteStaffAcceptTransitionBlockReason("Sent to Agent")).toBeNull();
  });

  it("legacy Sent alias is treated like Sent to Agent for accept", () => {
    expect(quoteStaffAcceptTransitionBlockReason("Sent")).toBeNull();
    expect(canTransition("Sent", "Accepted")).toBe(true);
  });
});
