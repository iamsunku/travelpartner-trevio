/**
 * Phase 11 — Booking status machine (existing BMS terminology).
 * Initial state from quotation conversion: Awaiting Passenger Details
 */

export const BOOKING_STATUSES = [
  "Draft",
  "Awaiting Passenger Details",
  "Pending Initial Payment",
  "Partially Paid",
  "Payment Received",
  "In Progress",
  "Partially Confirmed",
  "Confirmed",
  "Travel Documents Ready",
  "Completed",
  "Cancelled",
  // legacy aliases
  "Pending",
  "Ticketed",
  "Refunded",
  "Failed",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Allowed transitions. Same-status is always allowed (idempotent). */
export const BOOKING_STATUS_TRANSITIONS: Record<string, string[]> = {
  Draft: ["Awaiting Passenger Details", "Pending Initial Payment", "Cancelled"],
  "Awaiting Passenger Details": ["Pending Initial Payment", "Partially Paid", "Payment Received", "In Progress", "Cancelled"],
  "Pending Initial Payment": ["Partially Paid", "Payment Received", "Awaiting Passenger Details", "Cancelled"],
  "Partially Paid": ["Payment Received", "In Progress", "Cancelled"],
  "Payment Received": ["In Progress", "Partially Confirmed", "Confirmed", "Cancelled"],
  "In Progress": ["Partially Confirmed", "Confirmed", "Travel Documents Ready", "Completed", "Cancelled"],
  "Partially Confirmed": ["Confirmed", "In Progress", "Travel Documents Ready", "Cancelled"],
  Confirmed: ["Travel Documents Ready", "In Progress", "Completed", "Cancelled"],
  "Travel Documents Ready": ["Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
  // legacy
  Pending: ["Confirmed", "Cancelled", "Awaiting Passenger Details", "Pending Initial Payment"],
  Ticketed: ["Completed", "Cancelled"],
  Refunded: [],
  Failed: ["Cancelled", "Draft"],
};

export function canTransitionBooking(from: string, to: string, override = false): boolean {
  if (override) return true;
  if (from === to) return true;
  const allowed = BOOKING_STATUS_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/** Roles that may force an override (admin recovery only). */
export function canOverrideBookingStatus(role?: string): boolean {
  return role === "super_admin" || role === "agency_admin";
}
