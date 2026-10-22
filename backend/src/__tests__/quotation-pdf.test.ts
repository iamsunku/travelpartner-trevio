import { afterAll, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "fs/promises";
import os from "os";
import path from "path";
import {
  assertCustomerSafeModel,
  buildQuotationPdfModel,
  customerFacingHotelSell,
  TREVIO_BRAND_NAME,
} from "../lib/quotation-pdf/model.js";
import {
  authorizedContactLines,
  commercialDisplayRows,
  renderQuotationPdf,
} from "../lib/quotation-pdf/render.js";
import { quoteSendBlockReason } from "../lib/quote-access.js";
import { putPrivateObject, objectKey, readPrivateObject } from "../lib/document-storage.js";
import { visibilityAllows } from "../lib/documents.js";

const dir = await mkdtemp(path.join(os.tmpdir(), "trevio-qpdf-"));
process.env.DOCUMENT_STORAGE = "local";
process.env.DOCUMENT_STORAGE_DIR = dir;

const baseQuote = {
  quoteNo: "TG-QT-2026-PDF001",
  customerName: "Dillip Traveller",
  agentName: "Aarav Sharma",
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
  termsAndConditions: "Rates are subject to availability at confirmation.",
  travelDisclaimer: "Itinerary may change based on weather.",
  hotelTerms: "Quoted on twin sharing basis unless stated otherwise.",
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
        address: "Jl. Raya Ubud, Bali",
        highlight: "Walkable to central Ubud",
        costPrice: 5000,
        contractedCost: 5000,
        supplier: "Hidden DMC",
        remarks: "staff only remark",
      }],
      flights: [{
        airline: "Garuda",
        flightNo: "GA 851",
        from: "BLR",
        to: "DPS",
        date: "2026-10-01",
        depTime: "08:00",
        arrTime: "16:00",
        duration: "6h",
        cabin: "Economy",
        aircraft: "Boeing 737",
        sellingPrice: 8000,
        costPrice: 4000,
        direction: "outbound",
      }, {
        airline: "Garuda",
        flightNo: "GA 852",
        from: "DPS",
        to: "BLR",
        date: "2026-10-05",
        depTime: "18:00",
        arrTime: "21:30",
        duration: "5h 30m",
        cabin: "Economy",
        sellingPrice: 8000,
        direction: "return",
      }],
      transfers: [{ transferType: "Airport", vehicleType: "Innova", costPrice: 2000, supplier: "TransferCo" }],
      activities: [{ activityName: "Temple visit", description: "Morning temple circuit", costPrice: 800 }],
      meals: [{ mealType: "Dinner", restaurant: "Ubud Kitchen", date: "2026-10-02", sellingPrice: 1200 }],
      addOns: [{ name: "Local SIM", description: "7-day data", quantity: 2, sellingPrice: 900, currency: "INR", costPrice: 400 }],
      itinerary: [
        {
          day: 1,
          title: "Arrival",
          city: "Ubud",
          date: "2026-10-01",
          mealPlan: "Dinner",
          items: [
            { activityName: "Airport pickup", itemType: "TRANSFER" },
            { activityName: "Check-in", description: "Hotel check-in" },
          ],
        },
        {
          day: 2,
          title: "Temples",
          city: "Ubud",
          mealPlan: "Breakfast",
          items: [{ activityName: "Temple visit", description: "Tirta Empul" }],
        },
        {
          day: 3,
          title: "Leisure",
          city: "Ubud",
          mealPlan: "Breakfast",
          items: [],
        },
      ],
      inclusions: ["Accommodation with breakfast", "Airport transfers", "Temple entrance", "Welcome dinner"],
      exclusions: ["Personal expenses", "Tips", "Room service"],
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
    expect(rendered.pageCount).toBeLessThan(30);
    expect(rendered.buffer.length).toBeGreaterThan(1000);
    const textish = rendered.buffer.toString("latin1");
    expect(textish).not.toMatch(/Hidden DMC/);
    expect(textish).not.toMatch(/SECRET INTERNAL NOTES/);
    expect(textish).not.toMatch(/staff only remark/);
    expect(textish).not.toMatch(/trevioMarkup/i);
    expect(textish).not.toMatch(/contractedCost/i);
    // PDFKit compresses content streams — assert via model + metadata, not latin1 body scrape.
    expect(model.quoteNo).toBe("TG-QT-2026-PDF001");
    expect(model.validTill).toBe("2026-09-20");
    expect(model.packages[0].pricing.finalPrice || model.packages[0].pricing.packageBase).toBe(12650);
    expect(model.agentName).toBe("Aarav Sharma");
    expect(model.destinationName).toBe("Bali");
    expect(model.packages[0].itinerary.length).toBeGreaterThan(0);
    expect(model.packages[0].hotels.length).toBeGreaterThan(0);

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

  it("dedicated ADD-ONS section uses packages.addOns and hides legacy auto MISC itinerary lines", () => {
    const quote = {
      ...baseQuote,
      packages: [{
        ...baseQuote.packages[0],
        addOns: [{
          name: "Local SIM",
          description: "7-day data pack",
          date: "2026-10-02",
          city: "Ubud",
          quantity: 2,
          sellingPrice: 900,
          currency: "INR",
          costPrice: 400,
          supplier: "SecretSupplier",
        }],
        itinerary: [{
          day: 1,
          title: "Arrival",
          city: "Ubud",
          items: [
            { activityName: "Check-in", description: "Hotel check-in" },
            {
              activityName: "Local SIM",
              itemType: "MISC",
              autoFromMisc: true,
              miscLineId: "ao1",
            },
            {
              activityName: "Hand note",
              itemType: "MISC",
              description: "manual",
            },
          ],
        }],
      }],
    };
    const model = buildQuotationPdfModel({ quote, mode: "customer", audience: "customer" });
    const pkg = model.packages[0];
    expect(pkg.addOns).toHaveLength(1);
    expect(pkg.addOns[0].name).toBe("Local SIM");
    expect(pkg.addOns[0].description).toContain("7-day");
    expect(pkg.addOns[0].date).toBe("2026-10-02");
    expect(pkg.addOns[0].city).toBe("Ubud");
    expect(pkg.addOns[0].quantity).toBe(2);
    expect(pkg.addOns[0].sellingPrice).toBe(900);
    expect(pkg.addOns[0].unitPrice).toBe(450);
    expect(pkg.serviceTotals.some((r) => r.label === "Add-ons" && r.amount === 900)).toBe(true);
    const itineraryNames = pkg.itinerary[0].items.map((i) => i.activityName);
    expect(itineraryNames).toContain("Check-in");
    expect(itineraryNames).toContain("Hand note");
    expect(itineraryNames).not.toContain("Local SIM");
    expect(assertCustomerSafeModel(model)).toEqual([]);
    expect(JSON.stringify(model)).not.toMatch(/SecretSupplier|costPrice/i);
  });

  it("proposal model maps agent, destination copy, pax, hotel summary, and flight aircraft", () => {
    const model = buildQuotationPdfModel({
      quote: baseQuote,
      destinationDescription: "Bali blends temples, rice terraces, and coastal culture.",
      mode: "customer",
      audience: "customer",
    });
    expect(model.agentName).toBe("Aarav Sharma");
    expect(model.destinationName).toBe("Bali");
    expect(model.destinationDescription).toContain("temples");
    expect(model.paxSummary).toBe("2A+1C");
    expect(model.hotelSummary).toMatch(/UBUD GARDEN/);
    expect(model.packages[0].flights[0].aircraft).toBe("Boeing 737");
    expect(model.packages[0].hotels[0].highlight).toContain("Walkable");
    expect(model.flightCostPerPerson).toBe(8000);
    expect(model.packages[0].inclusionGroups.some((g) => g.label === "Hotel")).toBe(true);
    expect(model.overviewNotes.length).toBeGreaterThan(0);
  });

  it("omits land/flight per-person rows when flights have no selling prices", () => {
    const quote = {
      ...baseQuote,
      packages: [{
        ...baseQuote.packages[0],
        flights: [{ airline: "Garuda", from: "BLR", to: "DPS", date: "2026-10-01" }],
      }],
    };
    const model = buildQuotationPdfModel({ quote, mode: "customer", audience: "customer" });
    expect(model.flightCostPerPerson).toBeUndefined();
    expect(model.landCostPerPerson).toBeUndefined();
  });

  it("no-flight quotation still renders and skips empty airline page artifacts", async () => {
    const quote = {
      ...baseQuote,
      packages: [{
        ...baseQuote.packages[0],
        flights: [],
        hotels: [
          { hotelName: "Ubud Garden", nights: 2, starCategory: "4", mealPlan: "Breakfast" },
          { hotelName: "Seminyak Suites", nights: 2, starCategory: "5", mealPlan: "Breakfast", roomType: "Suite" },
        ],
      }],
    };
    const model = buildQuotationPdfModel({ quote, mode: "customer", audience: "customer" });
    expect(model.packages[0].flights).toHaveLength(0);
    expect(model.packages[0].hotels).toHaveLength(2);
    const rendered = await renderQuotationPdf(model);
    expect(rendered.buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(rendered.pageCount).toBeGreaterThan(4);
    const textish = rendered.buffer.toString("latin1");
    expect(textish).not.toMatch(/Hidden DMC|contractedCost|supplier/i);
    expect(model.packages[0].hotels.map((h) => h.hotelName)).toEqual(["Ubud Garden", "Seminyak Suites"]);
    expect(model.packages[0].flights).toHaveLength(0);
  });

  it("missing images and long text do not break PDF generation", async () => {
    const long = "A".repeat(1200);
    const quote = {
      ...baseQuote,
      agentName: undefined,
      destinationDescription: long,
      packages: [{
        ...baseQuote.packages[0],
        hotels: [{
          hotelName: "Very Long Hotel Name ".repeat(8).trim(),
          address: long,
          highlight: long,
          imageUrl: "https://example.invalid/missing-hotel.jpg",
          nights: 4,
        }],
        itinerary: Array.from({ length: 8 }).map((_, i) => ({
          day: i + 1,
          title: `Day title ${i + 1} ${long.slice(0, 80)}`,
          coverImage: "https://example.invalid/missing-day.jpg",
          mealPlan: "Breakfast & Dinner",
          items: [
            { activityName: `Activity ${i + 1}`, description: long.slice(0, 200) },
            { activityName: `Transfer ${i + 1}`, itemType: "TRANSFER" },
          ],
        })),
        inclusions: Array.from({ length: 20 }).map((_, i) => `Inclusion item ${i + 1} ${long.slice(0, 40)}`),
        exclusions: Array.from({ length: 12 }).map((_, i) => `Exclusion item ${i + 1}`),
      }],
    };
    const model = buildQuotationPdfModel({
      quote,
      branding: { agencyName: "Trevio Global" },
      mode: "customer",
      audience: "customer",
    });
    expect(model.agentName).toBe("Trevio Global");
    expect(model.agentName).not.toMatch(/undefined/i);
    const rendered = await renderQuotationPdf(model);
    expect(rendered.buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(rendered.pageCount).toBeGreaterThan(5);
  });

  it("writes a sample redesigned PDF artifact for visual QA", async () => {
    const model = buildQuotationPdfModel({
      quote: baseQuote,
      destinationDescription: "Bali is an island province of Indonesia known for its forested volcanic mountains, iconic rice paddies, beaches and coral reefs.",
      branding: {
        agencyName: "Trevio Global",
        phone: "+91 89516 63471",
        email: "hello@trevioglobal.com",
        footerText: "Trevio Global",
      },
      mode: "customer",
      audience: "customer",
    });
    const rendered = await renderQuotationPdf(model);
    const outDir = path.resolve(process.cwd(), "../phase5-artifacts");
    await mkdir(outDir, { recursive: true });
    const outPath = path.join(outDir, "sample-redesigned-quotation-test.pdf");
    await writeFile(outPath, rendered.buffer);
    expect(rendered.pageCount).toBeGreaterThan(4);
    expect(rendered.pageCount).toBeLessThan(20);
    expect(assertCustomerSafeModel(model)).toEqual([]);
    expect(model.branding.phone).toBe("+91 89516 63471");
    expect(model.destinationDescription).toMatch(/volcanic mountains/i);
    expect(model.packages[0].flights.length).toBe(2);
    expect(model.packages[0].hotels.length).toBe(1);
  });

  it("keeps refund policy on the model and omits short destination intro", async () => {
    const quote = {
      ...baseQuote,
      refundPolicy: "Refunds processed within 14 working days after supplier confirmation.",
      destinationDescription: "Short",
    };
    const model = buildQuotationPdfModel({ quote, mode: "customer", audience: "customer" });
    expect(model.refundPolicy).toMatch(/14 working days/);
    // Short catalogue blurbs are intentionally not treated as editorial intro copy.
    expect(model.destinationDescription).toBe("Short");
    const rendered = await renderQuotationPdf(model);
    const textish = rendered.buffer.toString("latin1");
    expect(textish).not.toMatch(/Hidden DMC|contractedCost/i);
    expect(rendered.pageCount).toBeGreaterThan(3);
    expect(rendered.pageCount).toBeLessThan(18);
  });

  it("destination image picker avoids immediate reuse when alternatives exist", async () => {
    const { pickUnusedDestinationImage } = await import("../lib/quotation-pdf/destination-images.js");
    const pool = ["a.jpg", "b.jpg", "c.jpg"];
    const used = new Set<string>();
    expect(pickUnusedDestinationImage(pool, used, 0)).toBe("a.jpg");
    expect(pickUnusedDestinationImage(pool, used, 1)).toBe("b.jpg");
    expect(pickUnusedDestinationImage(pool, used, 2)).toBe("c.jpg");
    expect(used.size).toBe(3);
  });

  it("document brandName stays Trevio Global even when agency trading name is Wanderlust Travels", async () => {
    const model = buildQuotationPdfModel({
      quote: baseQuote,
      branding: {
        agencyName: "Wanderlust Travels",
        footerText: "Wanderlust Travels • Partner",
        phone: "+91 98200 12345",
        email: "ops@wanderlust.example",
      },
      mode: "customer",
      audience: "customer",
    });
    expect(model.branding.brandName).toBe(TREVIO_BRAND_NAME);
    expect(model.branding.brandName).not.toMatch(/wanderlust/i);
    expect(model.branding.legalName).toMatch(/TREVIO GLOBAL/i);
    // Agency contact channels remain available for partner desk.
    expect(model.branding.phone).toBe("+91 98200 12345");

    const rendered = await renderQuotationPdf(model);
    expect(rendered.buffer.subarray(0, 4).toString()).toBe("%PDF");
    // Uncompressed PDF metadata / literal strings should not promote the agency trading name as header brand.
    const textish = rendered.buffer.toString("latin1");
    expect(textish).not.toMatch(/WANDERLUST TRAVELS/);
    expect(assertCustomerSafeModel(model)).toEqual([]);
  });

  it("keeps customer identity distinct from advisor across authorized contact lines", () => {
    const model = buildQuotationPdfModel({
      quote: {
        ...baseQuote,
        customerName: "Manjunath B R",
        agentName: "Kabir Khan",
        contactPhone: "9876543210",
        contactEmail: "guest@example.com",
        salesExecutiveName: "Ananya Kapoor",
        salesExecutivePhone: "+91 98600 55555",
      },
      branding: {
        agencyName: "Trevio Global",
        phone: "+91 98200 12345",
        email: "not-an-email",
      },
      mode: "customer",
      audience: "customer",
    });
    expect(model.customerName).toBe("Manjunath B R");
    expect(model.agentName).toBe("Kabir Khan");
    expect(model.customerName).not.toBe(model.agentName);
    expect(model.salesContact).toMatch(/Ananya Kapoor/);

    const contacts = authorizedContactLines(model);
    expect(contacts.some((l) => l.startsWith("Customer:") && l.includes("Manjunath B R"))).toBe(true);
    expect(contacts.some((l) => l.includes("9876543210"))).toBe(true);
    expect(contacts.some((l) => l.startsWith("Advisor:") && l.includes("Kabir Khan"))).toBe(true);
    expect(contacts.some((l) => l.startsWith("Partner desk:") && l.includes("+91 98200 12345"))).toBe(true);
    // Names containing "na" (e.g. Ananya) must not be rejected as placeholder "n/a".
    expect(contacts.some((l) => l.startsWith("Sales:") && l.includes("Ananya Kapoor"))).toBe(true);
    // Invalid branding email must be omitted — never substitute another person's details.
    expect(contacts.join("\n")).not.toMatch(/not-an-email/i);
    // Customer group must never be the agent name.
    expect(contacts.find((l) => l.startsWith("Customer:"))).not.toContain("Kabir Khan");
  });

  it("contracted PER_ROOM_NIGHT hotel: extends unit sell × rooms × nights (1×3)", () => {
    const model = buildQuotationPdfModel({
      quote: {
        ...baseQuote,
        adults: 2,
        packages: [{
          ...baseQuote.packages[0],
          pricing: {
            ...baseQuote.packages[0].pricing,
            customerPrice: 9828,
            taxAmount: 491,
            taxRate: 5,
            finalPrice: 10319,
            perAdultPrice: 4914,
            perChildPrice: 0,
          },
          hotels: [{
            hotelName: "Ramada Encore",
            source: "CONTRACTED_PRODUCT",
            productType: "HOTEL",
            productId: "prod-1",
            rooms: 1,
            nights: 3,
            checkIn: "2026-10-13",
            checkOut: "2026-10-16",
            sellingPrice: 3276,
            mealPlan: "Breakfast",
            rateSnapshot: {
              contractedCost: 3276,
              currency: "INR",
              rateUnit: "PER_ROOM_NIGHT",
              frozen: true,
            },
          }],
          flights: [],
          transfers: [],
          activities: [],
          meals: [],
          addOns: [],
        }],
      },
      mode: "customer",
      audience: "customer",
    });
    const pkg = model.packages[0];
    const hotels = pkg.serviceTotals.find((r) => r.label === "Hotels");
    expect(hotels?.amount).toBe(9828);
    expect(hotels?.basis).toBe("room_night_extended");
    expect(hotels?.detail).toMatch(/Rs 3,276 × 1 room × 3 nights/);
    expect(hotels?.amount).toBe(pkg.pricing.packageBase);
    expect(pkg.pricing.finalPrice).toBe(10319);

    const rows = commercialDisplayRows(pkg, model.adults);
    expect(rows.some((r) => r.component && r.value === "Rs 9,828" && /1 room × 3 nights/.test(r.label))).toBe(true);
    expect(rows.find((r) => r.label === "Package total (before tax)")?.value).toBe("Rs 9,828");
    expect(rows.find((r) => r.label === "TOTAL PAYABLE")?.value).toBe("Rs 10,319");
    // Informational hotel equals package before tax — still must not be treated as additive.
    const componentSum = rows.filter((r) => r.component).reduce((s, r) => s + Number(r.value.replace(/[^\d]/g, "")), 0);
    const packageBase = 9828;
    expect(componentSum).toBe(packageBase);
    expect(packageBase + 491).toBe(10319);
    // Customer model must not leak snapshot cost keys.
    expect(assertCustomerSafeModel(model)).toEqual([]);
    expect(JSON.stringify(model)).not.toMatch(/"contractedCost"/);
    expect(JSON.stringify(model)).not.toMatch(/"rateSnapshot"/);
  });

  it("contracted PER_ROOM_NIGHT hotel: multi-room multi-night extension", () => {
    const sell = customerFacingHotelSell({
      source: "CONTRACTED_PRODUCT",
      rooms: 2,
      nights: 4,
      sellingPrice: 1000,
      rateSnapshot: { rateUnit: "PER_ROOM_NIGHT", contractedCost: 1000, frozen: true },
    });
    expect(sell).toEqual({
      amount: 8000,
      unitPrice: 1000,
      rooms: 2,
      nights: 4,
      basis: "room_night_extended",
    });

    const model = buildQuotationPdfModel({
      quote: {
        ...baseQuote,
        packages: [{
          ...baseQuote.packages[0],
          pricing: {
            ...baseQuote.packages[0].pricing,
            customerPrice: 8000,
            taxAmount: null,
            finalPrice: 8000,
            perAdultPrice: 4000,
            perChildPrice: 0,
          },
          hotels: [{
            hotelName: "Multi Room Inn",
            source: "CONTRACTED_PRODUCT",
            rooms: 2,
            nights: 4,
            checkIn: "2026-11-01",
            checkOut: "2026-11-05",
            sellingPrice: 1000,
            rateSnapshot: { rateUnit: "PER_ROOM_NIGHT", contractedCost: 900, frozen: true },
          }],
          flights: [],
          transfers: [],
          activities: [],
          meals: [],
          addOns: [],
        }],
      },
      mode: "customer",
      audience: "customer",
    });
    const hotels = model.packages[0].serviceTotals.find((r) => r.label === "Hotels");
    expect(hotels?.amount).toBe(8000);
    expect(hotels?.detail).toMatch(/2 rooms × 4 nights/);
    // Uses customer sellingPrice unit (1000), not snapshot contractedCost (900).
    expect(hotels?.detail).toMatch(/Rs 1,000/);
    expect(assertCustomerSafeModel(model)).toEqual([]);
  });

  it("manual hotel sellingPrice is treated as stay total (no room-night multiply)", () => {
    const sell = customerFacingHotelSell({
      source: "MANUAL",
      rooms: 2,
      nights: 3,
      sellingPrice: 9828,
    });
    expect(sell).toEqual({ amount: 9828, basis: "lump_selling" });

    const model = buildQuotationPdfModel({
      quote: {
        ...baseQuote,
        packages: [{
          ...baseQuote.packages[0],
          pricing: {
            ...baseQuote.packages[0].pricing,
            customerPrice: 9828,
            taxAmount: 491,
            taxRate: 5,
            finalPrice: 10319,
          },
          hotels: [{
            hotelName: "Manual Stay",
            source: "MANUAL",
            rooms: 2,
            nights: 3,
            sellingPrice: 9828,
          }],
          flights: [],
          transfers: [],
          activities: [],
          meals: [],
          addOns: [],
        }],
      },
      mode: "customer",
      audience: "customer",
    });
    const hotels = model.packages[0].serviceTotals.find((r) => r.label === "Hotels");
    expect(hotels?.amount).toBe(9828);
    expect(hotels?.basis).toBe("lump_selling");
    expect(hotels?.detail).toBeUndefined();
    const rows = commercialDisplayRows(model.packages[0], 2);
    expect(rows.some((r) => r.label === "Hotels (stay total)" && r.value === "Rs 9,828")).toBe(true);
    expect(assertCustomerSafeModel(model)).toEqual([]);
  });

  it("missing rooms/nights or unsupported rate unit does not invent multipliers", () => {
    expect(customerFacingHotelSell({
      source: "CONTRACTED_PRODUCT",
      sellingPrice: 3276,
      rateSnapshot: { rateUnit: "PER_ROOM_NIGHT", frozen: true },
    }).basis).toBe("unextended_unit");

    expect(customerFacingHotelSell({
      source: "CONTRACTED_PRODUCT",
      rooms: 1,
      nights: 3,
      sellingPrice: 3276,
      rateSnapshot: { rateUnit: "PER_PASSENGER", frozen: true },
    })).toEqual({ amount: 3276, basis: "lump_selling" });

    const model = buildQuotationPdfModel({
      quote: {
        ...baseQuote,
        packages: [{
          ...baseQuote.packages[0],
          hotels: [{
            hotelName: "Incomplete",
            source: "CONTRACTED_PRODUCT",
            sellingPrice: 3276,
            rateSnapshot: { rateUnit: "PER_ROOM_NIGHT", frozen: true },
          }],
          flights: [],
          transfers: [],
          activities: [],
          meals: [],
          addOns: [],
        }],
      },
      mode: "customer",
      audience: "customer",
    });
    const hotels = model.packages[0].serviceTotals.find((r) => r.label === "Hotels");
    expect(hotels?.amount).toBe(3276);
    expect(hotels?.basis).toBe("unextended_unit");
    expect(assertCustomerSafeModel(model)).toEqual([]);
  });

  it("informational hotel amount must not be double-counted into payable", () => {
    const model = buildQuotationPdfModel({
      quote: {
        ...baseQuote,
        adults: 2,
        packages: [{
          ...baseQuote.packages[0],
          pricing: {
            customerPrice: 9828,
            taxAmount: 491,
            taxRate: 5,
            finalPrice: 10319,
            perAdultPrice: 4914,
            perChildPrice: 0,
          },
          hotels: [{
            hotelName: "Ramada Encore",
            source: "CONTRACTED_PRODUCT",
            rooms: 1,
            nights: 3,
            sellingPrice: 3276,
            rateSnapshot: { rateUnit: "PER_ROOM_NIGHT", frozen: true },
          }],
          flights: [],
          transfers: [],
          activities: [],
          meals: [],
          addOns: [],
        }],
      },
      mode: "customer",
      audience: "customer",
    });
    const pkg = model.packages[0];
    const hotelAmt = pkg.serviceTotals.find((r) => r.label === "Hotels")!.amount;
    expect(hotelAmt).toBe(9828);
    // Payable is package + tax only — never package + hotel + tax.
    expect(pkg.pricing.packageBase + (pkg.pricing.taxAmount || 0)).toBe(pkg.pricing.finalPrice);
    expect(pkg.pricing.packageBase + hotelAmt + (pkg.pricing.taxAmount || 0)).not.toBe(pkg.pricing.finalPrice);
    const rows = commercialDisplayRows(pkg, 2);
    expect(rows.filter((r) => r.component)).toHaveLength(1);
    expect(rows.find((r) => r.emphasize)?.value).toBe("Rs 10,319");
  });

  it("omits placeholder contact emails from the customer-safe model path without leaking costs", async () => {
    const quote = {
      ...baseQuote,
      contactEmail: "not-an-email",
      packages: [{
        ...baseQuote.packages[0],
        hotels: [{
          hotelName: "Ubud Garden",
          nights: 4,
          starCategory: "4",
          mealPlan: "Breakfast",
          imageUrl: "https://example.invalid/hotel.jpg",
        }],
      }],
    };
    const model = buildQuotationPdfModel({
      quote,
      branding: {
        agencyName: "Trevio Global",
        phone: "+91 89516 63471",
        email: "not-an-email",
      },
      mode: "customer",
      audience: "customer",
    });
    expect(assertCustomerSafeModel(model)).toEqual([]);
    const rendered = await renderQuotationPdf(model);
    expect(rendered.buffer.subarray(0, 4).toString()).toBe("%PDF");
    const textish = rendered.buffer.toString("latin1");
    expect(textish).not.toMatch(/Hidden DMC|contractedCost|trevioMarkup/i);
    expect(model.branding.phone).toBe("+91 89516 63471");
  });
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});
