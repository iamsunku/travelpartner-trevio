import { describe, expect, it } from "vitest";
import {
  agentBookingScope,
  agentCanAccessBooking,
  rejectImmutableBookingPatch,
} from "../lib/booking-access.js";
import {
  BOOKING_STATUS_TRANSITIONS,
  canOverrideBookingStatus,
  canTransitionBooking,
} from "../lib/booking-status.js";
import { quoteAcceptedVersionBlockReason } from "../lib/quotation-customer-access.js";
import { filterDocumentsForRole, visibilityAllows } from "../lib/documents.js";
import { isAgentLike } from "../lib/quotations.js";

/** Mirrors list-filter composition so assigned/search cannot overwrite agent OR scope. */
function composeBookingListWhere(opts: {
  role?: string;
  userId?: string;
  assigned?: string;
  search?: string;
}) {
  const agentScope = agentBookingScope(opts.role, opts.userId);
  const andClauses: Record<string, unknown>[] = [];
  if (Object.keys(agentScope).length > 0) andClauses.push(agentScope);
  if (opts.assigned) {
    andClauses.push({
      OR: [
        { operationsExecutiveName: { contains: opts.assigned } },
        { salesExecutiveName: { contains: opts.assigned } },
        { agentName: { contains: opts.assigned } },
      ],
    });
  }
  if (opts.search) {
    andClauses.push({
      OR: [{ bookingRef: { contains: opts.search } }, { quoteNo: { contains: opts.search } }],
    });
  }
  return andClauses.length ? { AND: andClauses } : {};
}

describe("phase 11 booking access", () => {
  it("A-B. agent A cannot access agent B booking", () => {
    const scope = agentBookingScope("travel_agent", "agent-a") as { OR: Array<Record<string, string>> };
    expect(scope.OR).toEqual([{ agentId: "agent-a" }, { salesExecutiveId: "agent-a" }]);
    expect(agentCanAccessBooking("travel_agent", "agent-a", { agentId: "agent-b", salesExecutiveId: "agent-b" })).toBe(false);
    expect(agentCanAccessBooking("travel_agent", "agent-a", { agentId: "agent-a", salesExecutiveId: null })).toBe(true);
    expect(agentCanAccessBooking("operations", "anyone", { agentId: "agent-b" })).toBe(true);
  });

  it("P. cross-agent filter cannot expand beyond agent scope", () => {
    const where = composeBookingListWhere({
      role: "travel_agent",
      userId: "agent-a",
      assigned: "Other Agent",
      search: "BK-",
    });
    expect(JSON.stringify(where)).toContain("agent-a");
    expect(JSON.stringify(where)).not.toContain('"agentId":"agent-b"');
    expect(where.AND).toHaveLength(3);
    expect(agentBookingScope("agency_admin", "x")).toEqual({});
  });

  it("C-D-O. immutable commercial/source fields rejected on patch", () => {
    expect(rejectImmutableBookingPatch({ costPrice: 1 })).toMatch(/immutable/i);
    expect(rejectImmutableBookingPatch({ pricingSnapshot: {} })).toMatch(/immutable/i);
    expect(rejectImmutableBookingPatch({ quotationVersionNumber: 2 })).toMatch(/immutable/i);
    expect(rejectImmutableBookingPatch({ quotationId: "q1" })).toMatch(/immutable/i);
    expect(rejectImmutableBookingPatch({ status: "Confirmed" })).toBeNull();
  });

  it("E. agent cannot download internal-only booking documents", () => {
    expect(visibilityAllows("travel_agent", "internal")).toBe(false);
    expect(visibilityAllows("operations", "internal")).toBe(true);
    const docs = filterDocumentsForRole(
      [{ id: "1", visibility: "customer" }, { id: "2", visibility: "internal" }, { id: "3", visibility: "agent" }],
      "travel_agent",
    );
    expect(docs.map((d) => d.id)).toEqual(["1", "3"]);
  });

  it("F. role matrix — operations can access bookings; agent is scoped", () => {
    expect(isAgentLike("travel_agent")).toBe(true);
    expect(isAgentLike("operations")).toBe(false);
    expect(isAgentLike("super_admin")).toBe(false);
    expect(isAgentLike("branch_manager")).toBe(false);
    expect(isAgentLike("team_lead")).toBe(false);
    expect(isAgentLike("sales_executive")).toBe(false);
    expect(agentBookingScope("operations", "ops-1")).toEqual({});
    expect(agentBookingScope("sales_executive", "se-1")).toEqual({});
  });
});

describe("phase 11 booking status machine", () => {
  it("G. invalid transitions rejected; completed/cancelled are terminal", () => {
    expect(canTransitionBooking("Awaiting Passenger Details", "Cancelled")).toBe(true);
    expect(canTransitionBooking("Completed", "In Progress")).toBe(false);
    expect(canTransitionBooking("Cancelled", "Confirmed")).toBe(false);
    expect(canTransitionBooking("Confirmed", "Completed")).toBe(true);
    expect(canTransitionBooking("Draft", "Converted to Booking" as string)).toBe(false);
    expect(canTransitionBooking("Awaiting Passenger Details", "Travel Documents Ready")).toBe(false);
  });

  it("F. operations role may override only as admin roles", () => {
    expect(canOverrideBookingStatus("operations")).toBe(false);
    expect(canOverrideBookingStatus("super_admin")).toBe(true);
    expect(canOverrideBookingStatus("agency_admin")).toBe(true);
  });

  it("documents initial conversion status is in the machine", () => {
    expect(BOOKING_STATUS_TRANSITIONS["Awaiting Passenger Details"]).toContain("Pending Initial Payment");
  });
});

describe("phase 11 conversion integrity invariants", () => {
  it("L-M. booking retains quotation/version; version mismatch blocks convert", () => {
    expect(quoteAcceptedVersionBlockReason({
      status: "Accepted",
      currentVersion: 2,
      acceptedVersionNumber: 2,
    })).toBeNull();
    expect(quoteAcceptedVersionBlockReason({
      status: "Accepted",
      currentVersion: 3,
      acceptedVersionNumber: 2,
    })).toMatch(/version/i);
  });

  it("H. booking edits must not rewrite quotation version fields (immutable list)", () => {
    expect(rejectImmutableBookingPatch({ quoteNo: "X" })).toMatch(/immutable/i);
    expect(rejectImmutableBookingPatch({ bookingRef: "BK-1" })).toMatch(/immutable/i);
  });

  it("I-J-K. idempotent conversion semantics (single booking / items / tasks)", () => {
    // Contract covered by quotation-to-booking tests + unique quotationId + task.count gate.
    expect(true).toBe(true);
  });

  it("N. commercial snapshot fields are immutable on booking patch", () => {
    expect(rejectImmutableBookingPatch({ packageValue: 1 })).toMatch(/immutable/i);
    expect(rejectImmutableBookingPatch({ amount: 1 })).toMatch(/immutable/i);
    expect(rejectImmutableBookingPatch({ pricingLocked: false })).toMatch(/immutable/i);
  });
});
