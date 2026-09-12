import { describe, expect, it } from "vitest";
import { sanitizeQuotationForRole } from "../lib/quotations.js";
import {
  agentCanAccessQuote,
  agentQuoteScope,
  canApproveStage,
  quoteConversionBlockReason,
  quoteSendBlockReason,
  stripCatalogForRole,
} from "../lib/quote-access.js";

const agentA = "agent-a";
const agentB = "agent-b";

describe("agent isolation", () => {
  it("A. list scope for agent A does not include agent B", () => {
    const scope = agentQuoteScope("travel_agent", agentA) as { OR: Array<Record<string, string>> };
    expect(scope.OR).toEqual([{ createdById: agentA }, { agentId: agentA }]);
    expect(JSON.stringify(scope)).not.toContain(agentB);
    expect(agentQuoteScope("agency_admin", agentA)).toEqual({});
  });

  it("B. agent A cannot open agent B quote by id", () => {
    const quote = { createdById: agentB, agentId: agentB };
    expect(agentCanAccessQuote("travel_agent", agentA, quote)).toBe(false);
    expect(agentCanAccessQuote("travel_agent", agentB, quote)).toBe(true);
    expect(agentCanAccessQuote("customer", agentA, quote)).toBe(false);
  });
});

describe("sensitive fields", () => {
  const quote = {
    quoteNo: "TG-QT-2026-000001",
    total: 10000,
    totalNetCost: 7000,
    grossProfit: 3000,
    profitMargin: 30,
    internalNotes: "secret",
    agentMarkup: 500,
    baseSellingTotal: 9500,
    approvals: [{ stage: "Team Lead", status: "Pending", comments: "internal", approverName: "lead@trevio.test" }],
    packages: [
      {
        name: "Standard",
        totalNetCost: 7000,
        grossProfit: 3000,
        hotels: [{ hotelName: "Taj", costPrice: 5000, sellingPrice: 7000, supplier: "ABC", remarks: "staff only" }],
      },
    ],
  };

  it("C-E. agent cannot retrieve contracted cost, supplier, or internal notes", () => {
    const out = sanitizeQuotationForRole(quote, "travel_agent");
    const hotel = (out.packages as Array<{ hotels: Array<Record<string, unknown>> }>)[0].hotels[0];
    expect(hotel.sellingPrice).toBe(7000);
    expect(hotel.costPrice).toBeUndefined();
    expect(hotel.supplier).toBeUndefined();
    expect(hotel.remarks).toBeUndefined();
    expect(out.internalNotes).toBeUndefined();
    expect(out.totalNetCost).toBeUndefined();
    expect(out.grossProfit).toBeUndefined();
    expect(out.approvals).toBeUndefined();
    expect(out.agentMarkup).toBe(500);
  });

  it("F-G. customer cannot retrieve contracted cost or Trevio/agent markup", () => {
    const out = sanitizeQuotationForRole(quote, "customer");
    const hotel = (out.packages as Array<{ hotels: Array<Record<string, unknown>> }>)[0].hotels[0];
    expect(hotel.sellingPrice).toBe(7000);
    expect(hotel.costPrice).toBeUndefined();
    expect(out.total).toBe(10000);
    expect(out.agentMarkup).toBeUndefined();
    expect(out.baseSellingTotal).toBeUndefined();
    expect(out.grossProfit).toBeUndefined();
    expect(out.internalNotes).toBeUndefined();
    expect(out.approvals).toBeUndefined();
  });

  it("strips supplier identity from catalog payloads for agents", () => {
    const item = stripCatalogForRole({ id: "h1", name: "Hotel", supplier: { id: "s1", name: "DMC" }, supplierId: "s1" }, "travel_agent");
    expect(item.supplier).toBeUndefined();
    expect(item.supplierId).toBeUndefined();
    expect(item.name).toBe("Hotel");
  });
});

describe("approval gate", () => {
  it("H. draft quote cannot be sent", () => {
    expect(quoteSendBlockReason({ status: "Draft", approvalStatus: "Draft", approvals: [] })).toMatch(/approval/i);
  });

  it("I. pending approval quote cannot be sent", () => {
    expect(quoteSendBlockReason({
      status: "Pending Approval",
      approvalStatus: "Pending",
      approvals: [{ stage: "Team Lead", status: "Pending" }],
    })).toMatch(/approval/i);
  });

  it("J. Team Lead approval moves the quote to the next sendable state when finance is not required", () => {
    expect(canApproveStage("team_lead", "Team Lead")).toBe(true);
    expect(canApproveStage("sales_executive", "Team Lead")).toBe(false);
    const ready = quoteSendBlockReason({
      status: "Pending Approval",
      approvalStatus: "Approved",
      approvals: [{ stage: "Team Lead", status: "Approved" }],
    });
    expect(ready).toBeNull();
  });

  it("J. finance pending still blocks send after Team Lead approval", () => {
    expect(quoteSendBlockReason({
      status: "Pending Approval",
      approvalStatus: "Pending",
      approvals: [
        { stage: "Team Lead", status: "Approved" },
        { stage: "Finance", status: "Pending" },
      ],
    })).toMatch(/approval/i);
    expect(quoteSendBlockReason({
      status: "Pending Approval",
      approvalStatus: "Approved",
      approvals: [
        { stage: "Team Lead", status: "Approved" },
        { stage: "Finance", status: "Approved" },
      ],
    })).toBeNull();
  });

  it("K. rejected approval cannot be sent", () => {
    expect(quoteSendBlockReason({
      status: "In Progress",
      approvalStatus: "Rejected",
      approvals: [{ stage: "Team Lead", status: "Rejected" }],
    })).toMatch(/rejected/i);
  });

  it("N. unauthorized roles cannot approve", () => {
    expect(canApproveStage("sales_executive", "Team Lead")).toBe(false);
    expect(canApproveStage("employee", "Finance")).toBe(false);
    expect(canApproveStage("travel_agent", "Team Lead")).toBe(false);
    expect(canApproveStage("accountant", "Team Lead")).toBe(false);
    expect(canApproveStage("accountant", "Finance")).toBe(true);
    expect(canApproveStage("team_lead", "Finance")).toBe(false);
  });
});

describe("conversion gate", () => {
  it("L. quote cannot be converted without acceptance and completed approval", () => {
    expect(quoteConversionBlockReason({ status: "Draft", approvalStatus: "Draft" })).toMatch(/Accepted/);
    expect(quoteConversionBlockReason({
      status: "Accepted",
      approvalStatus: "Pending",
      approvals: [{ stage: "Team Lead", status: "Pending" }],
    })).toMatch(/approval/i);
    expect(quoteConversionBlockReason({
      status: "Accepted",
      approvalStatus: "Approved",
      approvals: [{ stage: "Team Lead", status: "Approved" }],
    })).toBeNull();
  });

  it("M. a second conversion is blocked once a booking is already linked", () => {
    expect(quoteConversionBlockReason({
      status: "Converted to Booking",
      approvalStatus: "Approved",
    })).toMatch(/Accepted/);
  });
});
