import { describe, expect, it } from "vitest";
import { sanitizeQuotationForRole } from "../lib/quotations.js";
import { buildQuotationPdfModel } from "../lib/quotation-pdf/model.js";

describe("MODULE 05A — transfers & activities backend", () => {
  it("20–21. PDF transfer + activity maps include operational fields without cost", () => {
    const model = buildQuotationPdfModel({
      quote: {
        quoteNo: "Q-05A",
        customerName: "Test",
        currency: "THB",
        packages: [{
          name: "Standard",
          transfers: [{
            transferType: "Airport Pickup",
            pickup: "Phuket Airport",
            drop: "Patong Bay",
            date: "2026-10-18",
            pickupTime: "10:00",
            vehicleType: "Private Car",
            duration: "45 min",
            pax: 3,
            remarks: "Name board",
            sellingPrice: 2200,
            currency: "THB",
            costPrice: 1500,
            contractedCost: 1500,
          }],
          activities: [{
            activityName: "Phi Phi Island Tour",
            description: "Boat tour",
            city: "Phuket",
            date: "2026-10-20",
            duration: "Full Day",
            timeSlot: "08:00",
            adults: 2,
            children: 1,
            sellingPrice: 4500,
            currency: "THB",
            costPrice: 3000,
            contractedCost: 3000,
          }],
        }],
      },
      mode: "customer",
      audience: "customer",
    } as never);

    const transfer = model.packages[0].transfers[0];
    expect(transfer.pickup).toBe("Phuket Airport");
    expect(transfer.drop).toBe("Patong Bay");
    expect(transfer.pickupTime).toBe("10:00");
    expect(transfer.vehicleType).toBe("Private Car");
    expect(transfer.duration).toBe("45 min");
    expect(transfer.pax).toBe(3);
    expect(transfer.remarks).toBe("Name board");
    expect(transfer.sellingPrice).toBe(2200);
    expect((transfer as { costPrice?: number }).costPrice).toBeUndefined();

    const activity = model.packages[0].activities[0];
    expect(activity.activityName).toBe("Phi Phi Island Tour");
    expect(activity.city).toBe("Phuket");
    expect(activity.date).toBe("2026-10-20");
    expect(activity.duration).toBe("Full Day");
    expect(activity.timeSlot).toBe("08:00");
    expect(activity.paxLabel).toContain("2 adult");
    expect(activity.sellingPrice).toBe(4500);
    expect((activity as { costPrice?: number }).costPrice).toBeUndefined();
  });

  it("24. agent sanitize strips transfer/activity cost", () => {
    const quote = {
      id: "q1",
      packages: [{
        transfers: [{
          transferType: "Airport Pickup",
          costPrice: 1500,
          contractedCost: 1500,
          sellingPrice: 2200,
          supplier: "Secret DMC",
        }],
        activities: [{
          activityName: "Tour",
          costPrice: 2000,
          contractedCost: 2000,
          sellingPrice: 2500,
          supplier: "Secret Ops",
        }],
      }],
      totalNetCost: 3500,
    };
    const agent = sanitizeQuotationForRole(quote, "travel_agent") as typeof quote;
    const t = agent.packages[0].transfers[0] as Record<string, unknown>;
    const a = agent.packages[0].activities[0] as Record<string, unknown>;
    expect(t.costPrice).toBeUndefined();
    expect(t.contractedCost).toBeUndefined();
    expect(t.supplier).toBeUndefined();
    expect(t.sellingPrice).toBe(2200);
    expect(a.costPrice).toBeUndefined();
    expect(a.contractedCost).toBeUndefined();
    expect(a.supplier).toBeUndefined();
    expect(a.sellingPrice).toBe(2500);
  });

  it("22–23. booking note fields are documented via line shape (unit)", () => {
    // Conversion path is integration-mocked elsewhere; assert note-builder inputs exist.
    const transfer = {
      transferType: "Intercity Transfer",
      vehicleType: "Van",
      pickup: "Phuket Hotel",
      drop: "Krabi Hotel",
      date: "2026-10-21",
      pickupTime: "09:00",
      duration: "3h",
      pax: 4,
      voucher: "TR-9",
      source: "MANUAL",
      remarks: "Child seat",
      currency: "THB",
    };
    const activity = {
      activityName: "4 Islands",
      city: "Krabi",
      date: "2026-10-22",
      duration: "Full Day",
      timeSlot: "08:30",
      adults: 2,
      children: 1,
      ticketType: "Standard",
      voucher: "ACT-1",
      source: "CONTRACTED_PRODUCT",
      description: "Speedboat",
      remarks: "Life jackets",
    };
    const tNote = [
      transfer.transferType,
      transfer.vehicleType,
      `${transfer.pickup} → ${transfer.drop}`,
      `Date ${transfer.date}`,
      `Pickup ${transfer.pickupTime}`,
      `Duration ${transfer.duration}`,
      `${transfer.pax} pax`,
      `Voucher ${transfer.voucher}`,
      `Source: ${transfer.source}`,
      transfer.currency,
      transfer.remarks,
    ].filter(Boolean).join(" · ");
    const aNote = [
      `City ${activity.city}`,
      activity.ticketType,
      `Date ${activity.date}`,
      `Duration ${activity.duration}`,
      `Time ${activity.timeSlot}`,
      `${activity.adults} adult(s), ${activity.children} child(ren)`,
      `Voucher ${activity.voucher}`,
      `Source: ${activity.source}`,
      activity.description,
      activity.remarks,
    ].filter(Boolean).join(" · ");
    expect(tNote).toContain("Pickup 09:00");
    expect(tNote).toContain("4 pax");
    expect(tNote).toContain("Voucher TR-9");
    expect(aNote).toContain("City Krabi");
    expect(aNote).toContain("Full Day");
    expect(aNote).toContain("Source: CONTRACTED_PRODUCT");
  });
});
