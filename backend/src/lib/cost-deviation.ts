import { db } from "./db.js";
import { notify } from "./bms.js";
import { travelDetailsComplete } from "./travel-details.js";

export type ServiceUpdatePayload = {
  status?: string;
  confirmationNo?: string;
  supplierName?: string;
  supplierRef?: string;
  voucherUrl?: string;
  ticketUrl?: string;
  notes?: string;
  costPrice: number;
};

export function canApproveCostDeviation(role?: string | null): boolean {
  return role === "super_admin" || role === "agency_admin";
}

export function baselineServiceCost(svc: { quotedCostPrice: number; costPrice: number }): number {
  return svc.quotedCostPrice > 0 ? svc.quotedCostPrice : svc.costPrice;
}

export function isCostOverBaseline(proposedCost: number, baseline: number): boolean {
  return proposedCost > baseline;
}

export function extractServiceUpdatePayload(body: Record<string, unknown>, fallbackCost: number): ServiceUpdatePayload {
  const payload: ServiceUpdatePayload = {
    costPrice: body.costPrice !== undefined ? Number(body.costPrice) : fallbackCost,
  };
  for (const k of ["status", "confirmationNo", "supplierName", "supplierRef", "voucherUrl", "ticketUrl", "notes"] as const) {
    if (body[k] !== undefined) payload[k] = String(body[k]);
  }
  return payload;
}

export async function findPendingServiceDeviation(bookingId: string, bookingServiceId: string) {
  return db.costDeviationApproval.findFirst({
    where: {
      bookingId,
      bookingServiceId,
      deviationType: "service_cost",
      status: "Pending",
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createServiceCostDeviation(opts: {
  bookingId: string;
  agencyId?: string | null;
  bookingServiceId: string;
  serviceType: string;
  bookingRef: string;
  baseline: number;
  proposedCost: number;
  payload: ServiceUpdatePayload;
  requestedById?: string;
  requestedByName?: string;
}) {
  const delta = opts.proposedCost - opts.baseline;
  const approval = await db.costDeviationApproval.create({
    data: {
      bookingId: opts.bookingId,
      agencyId: opts.agencyId ?? undefined,
      bookingServiceId: opts.bookingServiceId,
      deviationType: "service_cost",
      quotedCost: opts.baseline,
      proposedCost: opts.proposedCost,
      deltaAmount: delta,
      currentPackageValue: 0,
      payload: opts.payload as object,
      requestedById: opts.requestedById,
      requestedByName: opts.requestedByName,
      reason: `Supplier cost for ${opts.serviceType} exceeds quoted cost by ₹${delta}`,
    },
  });
  await notify({
    agencyId: opts.agencyId,
    type: "approval",
    title: "Cost deviation approval required",
    message: `${opts.bookingRef}: ${opts.serviceType} cost ₹${opts.proposedCost} exceeds quoted ₹${opts.baseline}`,
    priority: "high",
  });
  return approval;
}

export async function createSellingPriceIncreaseRequest(opts: {
  bookingId: string;
  agencyId?: string | null;
  bookingRef: string;
  currentPackageValue: number;
  proposedPackageValue: number;
  reason?: string;
  requestedById?: string;
  requestedByName?: string;
}) {
  const delta = opts.proposedPackageValue - opts.currentPackageValue;
  const approval = await db.costDeviationApproval.create({
    data: {
      bookingId: opts.bookingId,
      agencyId: opts.agencyId ?? undefined,
      deviationType: "selling_price_increase",
      quotedCost: opts.currentPackageValue,
      proposedCost: opts.proposedPackageValue,
      deltaAmount: delta,
      currentPackageValue: opts.currentPackageValue,
      proposedPackageValue: opts.proposedPackageValue,
      reason: opts.reason || `Selling price increase of ₹${delta}`,
      requestedById: opts.requestedById,
      requestedByName: opts.requestedByName,
    },
  });
  await notify({
    agencyId: opts.agencyId,
    type: "approval",
    title: "Selling price increase approval required",
    message: `${opts.bookingRef}: proposed selling price ₹${opts.proposedPackageValue} (was ₹${opts.currentPackageValue})`,
    priority: "high",
  });
  return approval;
}

export async function syncBookingAfterServiceUpdate(bookingId: string) {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return null;

  const all = await db.bookingService.findMany({ where: { bookingId } });
  const confirmed = all.filter((s) => s.status === "Confirmed" || s.status === "Issued").length;
  let bookingStatus = booking.status;
  if (confirmed > 0 && confirmed < all.length) bookingStatus = "Partially Confirmed";
  else if (confirmed === all.length && all.length > 0) {
    const travel = travelDetailsComplete(booking.travelDetails, all);
    bookingStatus = travel.ok ? "Confirmed" : "Partially Confirmed";
  }

  const costPrice = all.reduce((s, x) => s + x.costPrice, 0);
  const selling = booking.packageValue ?? booking.amount;

  return db.booking.update({
    where: { id: bookingId },
    data: {
      status: ["Completed", "Cancelled", "Travel Documents Ready"].includes(booking.status)
        ? booking.status
        : bookingStatus,
      costPrice,
      grossProfit: selling - costPrice,
      netProfit: Math.round((selling - costPrice) * 0.9),
    },
  });
}

export async function applyServiceUpdate(
  bookingServiceId: string,
  bookingId: string,
  payload: ServiceUpdatePayload,
) {
  const data: Record<string, unknown> = { costPrice: payload.costPrice };
  for (const k of ["status", "confirmationNo", "supplierName", "supplierRef", "voucherUrl", "ticketUrl", "notes"] as const) {
    if (payload[k] !== undefined) data[k] = payload[k];
  }
  if (data.status === "Confirmed" || data.status === "Issued") data.confirmedAt = new Date();

  const updated = await db.bookingService.update({
    where: { id: bookingServiceId },
    data,
  });
  await syncBookingAfterServiceUpdate(bookingId);
  return updated;
}

export async function approveCostDeviation(
  approvalId: string,
  decidedBy: string,
  decisionNotes?: string,
) {
  const approval = await db.costDeviationApproval.findUnique({ where: { id: approvalId } });
  if (!approval) return { error: "Not found" as const };
  if (approval.status !== "Pending") return { error: "Already decided" as const };

  if (approval.deviationType === "service_cost" && approval.bookingServiceId) {
    const payload = (approval.payload || {}) as ServiceUpdatePayload;
    payload.costPrice = approval.proposedCost;
    await applyServiceUpdate(approval.bookingServiceId, approval.bookingId, payload);
  } else if (approval.deviationType === "selling_price_increase" && approval.proposedPackageValue != null) {
    await db.booking.update({
      where: { id: approval.bookingId },
      data: { packageValue: approval.proposedPackageValue },
    });
  }

  const updated = await db.costDeviationApproval.update({
    where: { id: approvalId },
    data: {
      status: "Approved",
      decidedBy,
      decidedAt: new Date(),
      decisionNotes,
    },
  });
  return { approval: updated };
}

export async function rejectCostDeviation(
  approvalId: string,
  decidedBy: string,
  decisionNotes?: string,
) {
  const approval = await db.costDeviationApproval.findUnique({ where: { id: approvalId } });
  if (!approval) return { error: "Not found" as const };
  if (approval.status !== "Pending") return { error: "Already decided" as const };

  const updated = await db.costDeviationApproval.update({
    where: { id: approvalId },
    data: {
      status: "Rejected",
      decidedBy,
      decidedAt: new Date(),
      decisionNotes,
    },
  });
  return { approval: updated };
}
