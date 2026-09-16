import type { Quotation } from "@/types";

/** Customer/list-facing status label — maps approved-but-unsent quotes to Ready to Send. */
export function quoteDisplayStatus(
  quote: Pick<Quotation, "status" | "approvalStatus"> & {
    approvals?: Array<{ stage?: string | null; status?: string | null }> | null;
  },
): string {
  const status = quote.status || "";
  if (status === "Sent") return "Sent to Agent";
  if (
    (status === "Pending Approval" || status === "In Progress")
    && quote.approvalStatus === "Approved"
  ) {
    return "Ready to Send";
  }
  return status || "Draft";
}

export function isQuoteReadyToSend(
  quote: Pick<Quotation, "status" | "approvalStatus">,
): boolean {
  return quote.approvalStatus === "Approved"
    && ["Pending Approval", "In Progress", "Draft"].includes(quote.status || "");
}
