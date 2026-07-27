export type ProductKind = "hotel" | "activity" | "transfer";

const RATE_FIELDS: Record<ProductKind, string[]> = {
  hotel: ["roomCategories", "childPolicy", "inventory", "currency", "blackoutDates", "contractStart", "contractEnd"],
  activity: ["adultPrice", "childPrice", "infantPrice", "rateValidFrom", "rateValidTo", "transferOptions", "blackoutDates", "currency"],
  transfer: ["privatePrice", "sharedPrice", "sharedAdultPrice", "sharedChildPrice", "vehiclePricing", "waitingCharges", "rateValidFrom", "rateValidTo", "blackoutDates", "currency"],
};

const BLOCKED_FIELDS = new Set([
  "id", "agencyId", "createdAt", "updatedAt", "createdById", "updatedById",
  "approvedBy", "approvedAt", "approvalStatus", "pendingRateChanges", "rejectionReason", "status",
]);

function stableEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function splitRateFields(kind: ProductKind, body: Record<string, unknown>) {
  const rateKeys = new Set(RATE_FIELDS[kind]);
  const rateFields: Record<string, unknown> = {};
  const otherFields: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body)) {
    if (BLOCKED_FIELDS.has(key)) continue;
    if (rateKeys.has(key)) rateFields[key] = value;
    else otherFields[key] = value;
  }

  return { rateFields, otherFields };
}

export function hasRateChanges(existing: Record<string, unknown>, rateFields: Record<string, unknown>): boolean {
  return Object.entries(rateFields).some(([key, value]) => !stableEqual(existing[key], value));
}

export function sanitizeCreateBody(body: Record<string, unknown>): Record<string, unknown> {
  const { approvalStatus: _a, status: _s, pendingRateChanges: _p, approvedBy: _ab, approvedAt: _aa, rejectionReason: _rr, ...rest } = body;
  return {
    ...rest,
    status: "Draft",
    approvalStatus: "Draft",
    rejectionReason: null,
    approvedBy: null,
    approvedAt: null,
  };
}

export function buildRateAwareUpdate(
  existing: Record<string, unknown>,
  body: Record<string, unknown>,
  kind: ProductKind,
): { data: Record<string, unknown>; rateChangePending: boolean } {
  const { rateFields, otherFields } = splitRateFields(kind, body);
  const rateChanged = hasRateChanges(existing, rateFields);
  const data: Record<string, unknown> = { ...otherFields };

  if (!rateChanged) {
    return { data, rateChangePending: false };
  }

  const wasLive = existing.approvalStatus === "Approved";

  if (wasLive) {
    const currentPending =
      existing.pendingRateChanges && typeof existing.pendingRateChanges === "object"
        ? (existing.pendingRateChanges as Record<string, unknown>)
        : {};
    data.pendingRateChanges = { ...currentPending, ...rateFields };
    data.approvalStatus = "Pending";
    data.rejectionReason = null;
  } else {
    Object.assign(data, rateFields);
    data.approvalStatus = "Pending";
    data.status = "Draft";
    data.pendingRateChanges = null;
  }

  return { data, rateChangePending: true };
}

export function buildApproveData(existing: Record<string, unknown>): Record<string, unknown> {
  const pending =
    existing.pendingRateChanges && typeof existing.pendingRateChanges === "object"
      ? (existing.pendingRateChanges as Record<string, unknown>)
      : null;
  const hasPending = pending && Object.keys(pending).length > 0;

  return {
    ...(hasPending ? pending : {}),
    approvalStatus: "Approved",
    status: "Active",
    pendingRateChanges: null,
    rejectionReason: null,
  };
}

export function buildRejectData(existing: Record<string, unknown>, reason: string): Record<string, unknown> {
  const pending =
    existing.pendingRateChanges && typeof existing.pendingRateChanges === "object"
      ? (existing.pendingRateChanges as Record<string, unknown>)
      : null;
  const hasPending = pending && Object.keys(pending).length > 0;
  const wasLiveBefore = existing.approvedAt != null;

  if (hasPending && wasLiveBefore) {
    return {
      approvalStatus: "Approved",
      status: "Active",
      pendingRateChanges: null,
      rejectionReason: reason,
    };
  }

  return {
    approvalStatus: "Rejected",
    status: "Draft",
    pendingRateChanges: null,
    rejectionReason: reason,
  };
}

export function mergePendingForDisplay<T extends Record<string, unknown>>(item: T): T {
  const pending = item.pendingRateChanges;
  if (!pending || typeof pending !== "object" || Object.keys(pending as object).length === 0) {
    return item;
  }
  return { ...item, ...(pending as Record<string, unknown>) };
}

export function primaryRateLabel(kind: ProductKind, item: Record<string, unknown>, usePending = false): string {
  const source = usePending && item.pendingRateChanges && typeof item.pendingRateChanges === "object"
    ? { ...item, ...(item.pendingRateChanges as Record<string, unknown>) }
    : item;

  if (kind === "activity") {
    return `Adult: ${Number(source.adultPrice ?? 0).toLocaleString("en-IN")}`;
  }
  if (kind === "transfer") {
    return `Private: ${Number(source.privatePrice ?? source.sharedAdultPrice ?? source.sharedPrice ?? 0).toLocaleString("en-IN")}`;
  }
  const rooms = Array.isArray(source.roomCategories) ? source.roomCategories : [];
  const first = rooms[0] as Record<string, unknown> | undefined;
  const pricing = first?.pricing as Record<string, unknown> | undefined;
  const double = Number(pricing?.double ?? pricing?.single ?? 0);
  return double ? `From: ${double.toLocaleString("en-IN")}` : "Room rates";
}
