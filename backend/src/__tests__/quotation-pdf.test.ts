import { afterAll, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import { assertCustomerSafeModel, buildQuotationPdfModel } from "../lib/quotation-pdf/model.js";
import { renderQuotationPdf } from "../lib/quotation-pdf/render.js";
import { quoteSendBlockReason } from "../lib/quote-access.js";
import { putPrivateObject, objectKey, readPrivateObject } from "../lib/document-storage.js";
import { visibilityAllows } from "../lib/documents.js";

const dir = await mkdtemp(path.join(os.tmpdir(), "trevio-qpdf-"));
process.env.DOCUMENT_STORAGE = "local";
process.env.DOCUMENT_STORAGE_DIR = dir;

const baseQuote = {
  quoteNo: "TG-QT-2026-PDF001",
  customerName: "Dillip Traveller",
  destination: "Bali",
  country: "Indonesia",
  travelStartDate: "2026-10-01",
  travelEndDate: "2026-10-05",
  nights: 4,
  days: 5,
  adults: 2,
  children: 1,
  infants: 0,
  currency: "INR",
  total: 12650,
  amount: 12650,
  gst: 0,
  taxRate: 0,
  validTill: "2026-09-20",
  paymentTerms: "50% advance to confirm.",
  cancellationPolicy: "As per supplier policy.",
  internalNotes: "SECRET INTERNAL NOTES",
  totalNetCost: 10000,
  trevioMarkupValue: 15,
  agentMarkup: 1150,
  packages: [
    {
      name: "Deluxe",
      sortOrder: 0,
      isSelected: true,
      pricing: {
        contractedCost: 10000,
        trevioMarkupAmount: 1500,
        trevioSellingPrice: 11500,
        agentMarkupAmount: 1150,
        customerPrice: 12650,
        taxAmount: null,
        taxRate: null,
        finalPrice: null,
        perAdultPrice: 5000,
        perChildPrice: 2650,
      },
      hotels: [{
        hotelName: "Ubud Garden",
        city: "Ubud",
        starCategory: "4",
        roomType: "Deluxe",
        mealPlan: "Breakfast",
        nights: 4,
        costPrice: 5000,
        contractedCost: 5000,
        supplier: "Hidden DMC",
        remarks: "staff only remark",
      }],
      flights: [{ airline: "Garuda", from: "BLR", to: "DPS", date: "2026-10-01", depTime: "08:00", arrTime: "16:00", costPrice: 4000 }],
      transfers: [{ transferType: "Airport", vehicleType: "Innova", costPrice: 2000, supplier: "TransferCo" }],
      activities: [{ activityName: "Temple visit", description: "Morning temple circuit", costPrice: 800 }],
      meals: [],
      itinerary: [{ day: 1, title: "Arrival", city: "Ubud", items: [{ activityName: "Check-in", description: "Hotel check-in" }] }],
      inclusions: ["Accommodation", "Breakfast"],
      exclusions: ["Flights optional"],
    },
    {
      name: "Premium",
      sortOrder: 1,
      pricing: {
        customerPrice: 18000,
        taxAmount: null,
        finalPrice: null,
        perAdultPrice: 7000,
        perChildPrice: 4000,
      },
      hotels: [{ hotelName: "Seminyak Suites", city: "Seminyak", roomType: "Suite", mealPlan: "Breakfast", nights: 4 }],
      flights: [],
      transfers: [],
      activities: [],
      meals: [],
      itinerary: [{ day: 1, title: "Arrival Premium", items: [{ description: "Private transfer" }] }],
      inclusions: ["Accommodation"],
      exclusions: ["Personal expenses"],
    },
  ],
};

describe("phase 5 quotation pdf", () => {
  it("1-4. agent-facing model excludes contracted cost, trevio markup, and supplier", () => {
    const model = buildQuotationPdfModel({ quote: baseQuote, mode: "customer", audience: "agent" });
    const json = JSON.stringify(model);
    expect(json).not.toContain("10000");
    expect(json).not.toContain("1500");
    expect(json).not.toContain("Hidden DMC");
    expect(json).not.toContain("TransferCo");
    expect(json).not.toContain("contractedCost");
    expect(json).not.toContain("trevioMarkup");
    expect(assertCustomerSafeModel(model)).toEqual([]);
  });

  it("5-9. customer model excludes contracted cost, trevio markup, agent markup, notes, remarks", () => {
    const model = buildQuotationPdfModel({ quote: baseQuote, mode: "customer", audience: "customer" });
    const json = JSON.stringify(model);
    expect(json).not.toContain("1150");
    expect(json).not.toContain("agentMarkup");
    expect(json).not.toContain("SECRET INTERNAL NOTES");
    expect(json).not.toContain("staff only remark");
    expect(json).not.toContain("totalNetCost");
    expect(model.packages[0].pricing.packageBase).toBe(12650);
    expect(model.packages[0].pricing.perAdultPrice).toBe(5000);
    expect(assertCustomerSafeModel(model)).toEqual([]);
  });

  it("10. draft cannot produce a customer-shareable PDF that bypasses approval", () => {
    expect(quoteSendBlockReason({ status: "Draft", approvalStatus: "Draft", approvals: [] })).toMatch(/approval/i);
    expect(quoteSendBlockReason({
      status: "Pending Approval",
      approvalStatus: "Pending",
      approvals: [{ stage: "Team Lead", status: "Pending" }],
    })).toMatch(/approval/i);
  });

  it("11-12. rendered PDF is a private stored PDF and unauthorized visibility is blocked", async () => {
    const model = buildQuotationPdfModel({ quote: baseQuote, mode: "customer", audience: "customer" });
    expect(model.packages.map((p) => p.name)).toEqual(["Deluxe", "Premium"]);
    expect(assertCustomerSafeModel(model)).toEqual([]);
    const rendered = await renderQuotationPdf(model);
    expect(rendered.buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(rendered.pageCount).toBeGreaterThan(2);
    expect(rendered.pageCount).toBeLessThan(20);
    expect(rendered.buffer.length).toBeGreaterThan(1000);
    const textish = rendered.buffer.toString("latin1");
    expect(textish).not.toMatch(/Hidden DMC/);
    expect(textish).not.toMatch(/SECRET INTERNAL NOTES/);
    expect(textish).not.toMatch(/staff only remark/);
    expect(textish).not.toMatch(/trevioMarkup/i);

    const stored = await putPrivateObject(objectKey("quote-pdf-test", "quote.pdf"), rendered.buffer, "application/pdf");
    const again = await readPrivateObject(stored.storageKey);
    expect(again?.equals(rendered.buffer)).toBe(true);
    expect(visibilityAllows("travel_agent", "INTERNAL")).toBe(false);
    expect(visibilityAllows("customer", "CUSTOMER")).toBe(true);
  });

  it("visa/insurance customer notes do not trip the sensitive-field guard", () => {
    const quote = {
      ...baseQuote,
      packages: [{
        ...baseQuote.packages[0],
        visa: { enabled: true, visaType: "Tourist", remarks: "Carry originals" },
        insurance: { enabled: true, planName: "Travel Guard", remarks: "Covers medical" },
      }],
    };
    const model = buildQuotationPdfModel({ quote, mode: "customer", audience: "customer" });
    expect(model.packages[0].visa?.notes).toContain("Carry originals");
    expect(assertCustomerSafeModel(model)).toEqual([]);
  });

  it("multi-package pricing stays independent in the model", () => {
    const model = buildQuotationPdfModel({ quote: baseQuote, mode: "customer", audience: "customer" });
    expect(model.packages).toHaveLength(2);
    expect(model.packages[0].pricing.packageBase).toBe(12650);
    expect(model.packages[1].pricing.packageBase).toBe(18000);
    expect(model.packages[0].hotels[0].hotelName).toBe("Ubud Garden");
    expect(model.packages[1].hotels[0].hotelName).toBe("Seminyak Suites");
  });
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});
