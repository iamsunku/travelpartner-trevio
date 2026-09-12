import { Prisma } from "@prisma/client";
import { db } from "./db.js";
import { QUOTE_INCLUDE, sanitizeQuotationForRole, isAgentLike } from "./quotations.js";

/** Fields that define a meaningful customer/commercial revision. */
const QUOTE_MATERIAL_KEYS = [
  "customerName", "destination", "country", "departureCity",
  "travelDates", "travelStartDate", "travelEndDate", "returnDate",
  "nights", "days", "adults", "children", "infants",
  "currency", "specialRequests",
  "packageIncludes", "packageExcludes",
  "termsAndConditions", "paymentTerms", "cancellationPolicy", "refundPolicy",
  "hotelTerms", "flightTerms", "visaTerms", "insuranceTerms", "forceMajeure", "travelDisclaimer",
  "trevioMarkupType", "trevioMarkupValue", "agentMarkup", "agentMarkupType",
  "discountType", "discountValue", "discountAmount",
  "taxRate", "taxRuleId", "amount", "gst", "total", "totalNetCost", "totalSelling",
  "hotelStarPreference", "roomTypePreference", "mealPlanPreference",
  "coverImage", "lineItems",
] as const;

const PACKAGE_MATERIAL_KEYS = [
  "name", "description", "sortOrder", "isSelected",
  "hotels", "flights", "transfers", "activities", "meals", "itinerary",
  "inclusions", "exclusions", "visa", "insurance",
  "pricing", "totalNetCost", "totalSelling", "grossProfit", "gst", "total", "perPersonCost",
  "rateSnapshot", "pricingStatus",
] as const;

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

function pick(obj: Record<string, unknown> | null | undefined, keys: readonly string[]) {
  const out: Record<string, unknown> = {};
  if (!obj) return out;
  for (const key of keys) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

/** Fingerprint of commercially meaningful quotation content (ignores notes, wizard step, status). */
export function materialFingerprint(quote: Record<string, unknown>): string {
  const packages = Array.isArray(quote.packages)
    ? (quote.packages as Record<string, unknown>[]).map((pkg) => pick(pkg, PACKAGE_MATERIAL_KEYS as unknown as string[]))
    : [];
  return stableStringify({
    quote: pick(quote, QUOTE_MATERIAL_KEYS as unknown as string[]),
    packages,
  });
}

export function hasMeaningfulQuotationChange(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): boolean {
  return materialFingerprint(before) !== materialFingerprint(after);
}

/** Strip volatile relation noise from a stored snapshot while keeping packages/pricing. */
export function buildVersionSnapshot(full: Record<string, unknown>): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(full)) as Record<string, unknown>;
  delete clone.versions;
  delete clone.shares;
  delete clone.documents;
  delete clone.revisions;
  // Keep approvals metadata light — full comments stay on live approval rows, not required for pricing replay.
  if (Array.isArray(clone.approvals)) {
    clone.approvals = (clone.approvals as Array<Record<string, unknown>>).map((a) => ({
      stage: a.stage,
      status: a.status,
      decidedAt: a.decidedAt,
      createdAt: a.createdAt,
    }));
  }
  return clone;
}

export function sanitizeVersionSnapshot(snapshot: unknown, role?: string): Record<string, unknown> {
  const base = (snapshot && typeof snapshot === "object" ? snapshot : {}) as Record<string, unknown>;
  const sanitized = sanitizeQuotationForRole({ ...base }, role) as Record<string, unknown>;
  delete sanitized.approvals;
  delete sanitized.internalNotes;
  return sanitized;
}

export function summarizeVersionForList(row: {
  id: string;
  versionNumber: number;
  changeSummary: string | null;
  reason: string | null;
  createdByName: string | null;
  createdById: string | null;
  createdAt: Date;
  snapshot: unknown;
}, role?: string) {
  const snap = (row.snapshot && typeof row.snapshot === "object" ? row.snapshot : {}) as Record<string, unknown>;
  const safe = isAgentLike(role) ? sanitizeVersionSnapshot(snap, role) : snap;
  return {
    id: row.id,
    versionNumber: row.versionNumber,
    changeSummary: row.changeSummary,
    reason: row.reason,
    createdByName: row.createdByName,
    createdById: row.createdById,
    createdAt: row.createdAt,
    status: typeof safe.status === "string" ? safe.status : null,
    destination: typeof safe.destination === "string" ? safe.destination : null,
    total: typeof safe.total === "number" ? safe.total : null,
    packageCount: Array.isArray(safe.packages) ? safe.packages.length : 0,
    // Full snapshot only for staff; agents get sanitized body on detail endpoint.
    snapshot: isAgentLike(role) ? undefined : undefined,
  };
}

async function nextVersionNumber(quotationId: string): Promise<number> {
  const last = await db.quotationVersion.findFirst({
    where: { quotationId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });
  return (last?.versionNumber || 0) + 1;
}

export async function createQuotationVersion(opts: {
  quotationId: string;
  createdByName: string;
  createdById?: string;
  changeSummary?: string;
  reason?: string;
  /** If provided, use this payload instead of reloading. */
  full?: Record<string, unknown>;
}) {
  const full = opts.full || (await db.quotation.findUnique({
    where: { id: opts.quotationId },
    include: QUOTE_INCLUDE,
  })) as Record<string, unknown> | null;
  if (!full) return null;

  const versionNumber = await nextVersionNumber(opts.quotationId);
  const snapshot = buildVersionSnapshot(full);
  const version = await db.quotationVersion.create({
    data: {
      quotationId: opts.quotationId,
      versionNumber,
      snapshot: snapshot as Prisma.InputJsonValue,
      changeSummary: opts.changeSummary || `Version ${versionNumber}`,
      reason: opts.reason,
      createdByName: opts.createdByName,
      createdById: opts.createdById,
    },
  });
  await db.quotation.update({
    where: { id: opts.quotationId },
    data: { currentVersion: versionNumber },
  });
  return version;
}

/** Ensure a legacy/new quotation has at least Version 1. Does not invent earlier revisions. */
export async function ensureInitialQuotationVersion(opts: {
  quotationId: string;
  createdByName: string;
  createdById?: string;
  changeSummary?: string;
}) {
  const count = await db.quotationVersion.count({ where: { quotationId: opts.quotationId } });
  if (count > 0) return null;
  return createQuotationVersion({
    quotationId: opts.quotationId,
    createdByName: opts.createdByName,
    createdById: opts.createdById,
    changeSummary: opts.changeSummary || "Version 1",
    reason: "initial",
  });
}

/**
 * After a live save: if content changed meaningfully vs previous version snapshot
 * (or vs pre-save state when no versions), create a new immutable version of the NEW state.
 * Also invalidates approval when a released/approved quote was materially changed.
 */
export async function recordQuotationRevisionIfNeeded(opts: {
  quotationId: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  createdByName: string;
  createdById?: string;
  changeSummary?: string;
  reason?: string;
}): Promise<{ version: Awaited<ReturnType<typeof createQuotationVersion>>; approvalInvalidated: boolean } | null> {
  if (!hasMeaningfulQuotationChange(opts.before, opts.after)) {
    // Still ensure Version 1 exists for brand-new quotes with no prior history.
    const ensured = await ensureInitialQuotationVersion({
      quotationId: opts.quotationId,
      createdByName: opts.createdByName,
      createdById: opts.createdById,
    });
    return ensured ? { version: ensured, approvalInvalidated: false } : null;
  }

  const existingCount = await db.quotationVersion.count({ where: { quotationId: opts.quotationId } });
  if (existingCount === 0) {
    // Capture the pre-change state as Version 1 when history starts mid-life, then Version 2 as new state.
    await createQuotationVersion({
      quotationId: opts.quotationId,
      createdByName: opts.createdByName,
      createdById: opts.createdById,
      changeSummary: "Version 1 (state before first recorded revision)",
      reason: "bootstrap",
      full: opts.before,
    });
  }

  const approvalInvalidated = await invalidateApprovalAfterMaterialChange(opts.quotationId, opts.before);
  const afterForSnap = approvalInvalidated
    ? { ...opts.after, status: "In Progress", approvalStatus: "Draft", approvals: [] }
    : opts.after;

  if (approvalInvalidated) {
    await db.quotation.update({
      where: { id: opts.quotationId },
      data: { status: "In Progress", approvalStatus: "Draft" },
    });
    const { clearAcceptanceAfterMaterialChange } = await import("./quotation-customer-access.js");
    await clearAcceptanceAfterMaterialChange(opts.quotationId);
    const refreshed = await db.quotation.findUnique({
      where: { id: opts.quotationId },
      include: QUOTE_INCLUDE,
    });
    const version = await createQuotationVersion({
      quotationId: opts.quotationId,
      createdByName: opts.createdByName,
      createdById: opts.createdById,
      changeSummary: opts.changeSummary || "Content revised — re-approval required",
      reason: opts.reason || "material_change",
      full: (refreshed || afterForSnap) as Record<string, unknown>,
    });
    return { version, approvalInvalidated: true };
  }

  const version = await createQuotationVersion({
    quotationId: opts.quotationId,
    createdByName: opts.createdByName,
    createdById: opts.createdById,
    changeSummary: opts.changeSummary || "Quotation revised",
    reason: opts.reason || "material_change",
    full: opts.after,
  });
  return { version, approvalInvalidated: false };
}

const APPROVAL_PROTECTED = new Set([
  "Pending Approval",
  "Sent to Agent",
  "Customer Reviewing",
  "Accepted",
  "Revision Requested",
]);

export async function invalidateApprovalAfterMaterialChange(
  quotationId: string,
  before: Record<string, unknown>,
): Promise<boolean> {
  const status = String(before.status || "");
  const approvalStatus = String(before.approvalStatus || "");
  const needs = APPROVAL_PROTECTED.has(status) || approvalStatus === "Approved" || approvalStatus === "Pending";
  if (!needs) return false;
  await db.quotationApproval.deleteMany({ where: { quotationId } });
  return true;
}

/** Compatibility wrapper used by existing call sites. */
export async function snapshotVersion(
  quotationId: string,
  createdByName: string,
  createdById?: string,
  changeSummary?: string,
  reason?: string,
) {
  await ensureInitialQuotationVersion({ quotationId, createdByName, createdById });
  return createQuotationVersion({
    quotationId,
    createdByName,
    createdById,
    changeSummary,
    reason,
  });
}
