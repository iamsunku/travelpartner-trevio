import { quotePastValidityBlockReason } from "./quotation-expiry.js";

function isAgentLike(role?: string): boolean {
  return role === "travel_agent" || role === "customer";
}

function normalizeStatus(status: string): string {
  return status === "Sent" ? "Sent to Agent" : status;
}

export type ApprovalRow = {
  stage?: string | null;
  status?: string | null;
  comments?: string | null;
  approverName?: string | null;
  approverRole?: string | null;
};

export type QuoteAccessShape = {
  status?: string | null;
  approvalStatus?: string | null;
  validTill?: string | null;
  createdById?: string | null;
  agentId?: string | null;
  approvals?: ApprovalRow[] | null;
};

const TEAM_LEAD_APPROVERS = new Set(["team_lead", "branch_manager", "agency_admin", "super_admin"]);
const FINANCE_APPROVERS = new Set(["accountant", "management", "agency_admin", "super_admin"]);

const ALREADY_RELEASED = new Set([
  "Sent to Agent",
  "Customer Reviewing",
  "Accepted",
  "Revision Requested",
]);

/** Agents and customers only see quotes they created or that are assigned to them. */
export function agentQuoteScope(role: string | undefined, userId: string | undefined): Record<string, unknown> {
  if (!isAgentLike(role) || !userId) return {};
  return { OR: [{ createdById: userId }, { agentId: userId }] };
}

export function agentCanAccessQuote(
  role: string | undefined,
  userId: string | undefined,
  quote: Pick<QuoteAccessShape, "createdById" | "agentId">,
): boolean {
  if (!isAgentLike(role)) return true;
  if (!userId) return false;
  return quote.createdById === userId || quote.agentId === userId;
}

export function canApproveStage(role: string | undefined, stage: string): boolean {
  if (stage === "Finance") return FINANCE_APPROVERS.has(role || "");
  if (stage === "Team Lead") return TEAM_LEAD_APPROVERS.has(role || "");
  return false;
}

function latestApproval(approvals: ApprovalRow[] | null | undefined, stage: string): ApprovalRow | undefined {
  if (!Array.isArray(approvals)) return undefined;
  for (let i = approvals.length - 1; i >= 0; i -= 1) {
    if (approvals[i]?.stage === stage) return approvals[i];
  }
  return undefined;
}

function approvalIncompleteReason(quote: QuoteAccessShape): string | null {
  if (quote.approvalStatus === "Rejected") {
    return "Approval was rejected. This quotation cannot be sent.";
  }
  if (quote.approvalStatus !== "Approved") {
    return "Quotation cannot be sent until required approval is complete.";
  }
  const team = latestApproval(quote.approvals, "Team Lead");
  if (team && team.status !== "Approved") {
    return "Team Lead approval is required before this quotation can be sent.";
  }
  const finance = latestApproval(quote.approvals, "Finance");
  if (finance && finance.status !== "Approved") {
    return "Finance approval is required before this quotation can be sent.";
  }
  return null;
}

/** Hard gate for share, email, WhatsApp, public link, and marking a quote sent. */
export function quoteSendBlockReason(quote: QuoteAccessShape, now: Date = new Date()): string | null {
  const status = normalizeStatus(quote.status || "");
  if (quote.approvalStatus === "Rejected" || status === "Rejected") {
    return "A rejected quotation cannot be sent.";
  }
  if (status === "Expired" || status === "Archived" || status === "Converted to Booking") {
    return `A ${status.toLowerCase()} quotation cannot be sent.`;
  }
  const pastValidity = quotePastValidityBlockReason(quote, now);
  if (pastValidity) {
    return "This quotation’s validity date has passed. Renew before sending.";
  }
  if (ALREADY_RELEASED.has(status) && quote.approvalStatus === "Approved") {
    return approvalIncompleteReason(quote);
  }
  const incomplete = approvalIncompleteReason(quote);
  if (incomplete) return incomplete;
  if (status === "Pending Approval" || ALREADY_RELEASED.has(status)) return null;
  return "Quotation cannot be sent until required approval is complete.";
}

export function quoteConversionBlockReason(quote: QuoteAccessShape, now: Date = new Date()): string | null {
  if (quote.status === "Expired" || quotePastValidityBlockReason(quote, now)) {
    return "Renew expired quotation before conversion.";
  }
  if (quote.status !== "Accepted") {
    return "Quotation must be Accepted before proceeding to booking.";
  }
  return approvalIncompleteReason(quote);
}

const AGENT_STRIP = [
  "costPrice",
  "quotedCostPrice",
  "contractedCost",
  "supplierCost",
  "trevioMarkup",
  "trevioMarkupType",
  "trevioMarkupValue",
  "trevioMarkupAmount",
  "supplier",
  "supplierId",
  "supplierRef",
  "supplierName",
  "totalNetCost",
  "grossProfit",
  "profitMargin",
  "internalNotes",
  "internalRemarks",
  "remarks",
  "discountType",
  "discountValue",
  "discountAmount",
] as const;

const CUSTOMER_EXTRA = ["agentMarkup", "baseSellingTotal", "markup"] as const;

function stripKeys(value: unknown, extra: readonly string[]): unknown {
  if (Array.isArray(value)) return value.map((item) => stripKeys(item, extra));
  if (!value || typeof value !== "object") return value;
  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if ((AGENT_STRIP as readonly string[]).includes(key) || extra.includes(key)) continue;
    if (key === "approvals" || key === "versions") continue;
    next[key] = stripKeys(child, extra);
  }
  return next;
}

export function isCustomerRole(role?: string): boolean {
  return role === "customer";
}

/** Catalog responses must not reveal supplier identity to agents or customers. */
export function stripCatalogForRole<T>(item: T, role?: string): T {
  if (!isAgentLike(role)) return item;
  return stripKeys(item, ["supplier"]) as T;
}
