import { isAgentLike } from "./quotations.js";

/**
 * Agents only see bookings they are linked to (converter agentId or sales executive).
 * Internal staff use agency/branch scope instead.
 */
export function agentBookingScope(
  role: string | undefined,
  userId: string | undefined,
): Record<string, unknown> {
  if (!isAgentLike(role)) return {};
  if (!userId) return { id: "__none__" };
  return {
    OR: [
      { agentId: userId },
      { salesExecutiveId: userId },
    ],
  };
}

export function agentCanAccessBooking(
  role: string | undefined,
  userId: string | undefined,
  booking: { agentId?: string | null; salesExecutiveId?: string | null },
): boolean {
  if (!isAgentLike(role)) return true;
  if (!userId) return false;
  return booking.agentId === userId || booking.salesExecutiveId === userId;
}

/** Fields that must never be rewritten via generic booking PATCH (quotation history / conversion lock). */
export const BOOKING_IMMUTABLE_FIELDS = [
  "quotationId",
  "quoteNo",
  "quotationVersionNumber",
  "pricingSnapshot",
  "pricingLocked",
  "costPrice",
  "grossProfit",
  "netProfit",
  "packageValue",
  "amount",
  "bookingRef",
] as const;

export function rejectImmutableBookingPatch(body: Record<string, unknown>): string | null {
  for (const key of BOOKING_IMMUTABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined) {
      return `Field "${key}" is immutable on a booking. Create a new quotation revision for commercial changes.`;
    }
  }
  return null;
}
