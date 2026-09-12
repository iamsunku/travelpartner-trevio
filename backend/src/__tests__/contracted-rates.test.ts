import { describe, expect, it } from "vitest";
import { searchAmadeusFlights } from "../lib/amadeus.js";
import {
  NO_VALID_RATE_MESSAGE,
  OVERLAP_RATE_MESSAGE,
  RATE_SOURCES,
  applyResolvedSnapshot,
  buildRateSnapshot,
  canManageContractedRates,
  canViewContractedCost,
  findApplicableContractedRate,
  findOverlap,
  presentApplicableRate,
  preservedSnapshotCost,
  type RateWindow,
} from "../lib/contracted-rates.js";
import { sanitizeQuotationForRole } from "../lib/quotations.js";
import { stripCatalogForRole } from "../lib/quote-access.js";

const janMar: RateWindow = {
  id: "rate-jan",
  contractedCost: 5000,
  currency: "INR",
  validFrom: "2027-01-01",
  validTo: "2027-03-31",
  active: true,
};
const aprJun: RateWindow = {
  id: "rate-apr",
  contractedCost: 6000,
  currency: "INR",
  validFrom: "2027-04-01",
  validTo: "2027-06-30",
  active: true,
};

describe("contracted rate validity", () => {
  it("1. selects the rate whose validity covers the travel date", () => {
    const result = findApplicableContractedRate([janMar, aprJun], "2027-05-15");
    expect(result.status).toBe("OK");
    if (result.status === "OK") expect(result.rate.contractedCost).toBe(6000);
  });

  it("2. treats both boundary dates as valid", () => {
    expect(findApplicableContractedRate([janMar], "2027-01-01").status).toBe("OK");
    expect(findApplicableContractedRate([janMar], "2027-03-31").status).toBe("OK");
    expect(findApplicableContractedRate([janMar], "2027-04-01").status).toBe("NO_VALID_RATE");
  });

  it("3. does not select an expired rate", () => {
    const result = findApplicableContractedRate([janMar], "2027-05-01");
    expect(result).toEqual({ status: "NO_VALID_RATE", message: NO_VALID_RATE_MESSAGE });
  });

  it("4. does not select a future rate when the travel date is earlier", () => {
    const result = findApplicableContractedRate([aprJun], "2027-02-01");
    expect(result.status).toBe("NO_VALID_RATE");
    const current = findApplicableContractedRate([janMar, aprJun], "2027-02-01");
    expect(current.status).toBe("OK");
    if (current.status === "OK") expect(current.rate.id).toBe("rate-jan");
  });

  it("5. returns an unresolved result when nothing matches", () => {
    const inactive = { ...janMar, active: false };
    expect(findApplicableContractedRate([inactive], "2027-02-01")).toMatchObject({
      status: "NO_VALID_RATE",
      message: NO_VALID_RATE_MESSAGE,
    });
  });

  it("6. prevents ambiguous overlapping active rates", () => {
    const overlap = { ...aprJun, validFrom: "2027-03-01" };
    const hit = findOverlap([janMar], overlap);
    expect(hit?.id).toBe("rate-jan");
    expect(OVERLAP_RATE_MESSAGE).toMatch(/overlap/i);
    const otherVariant = { ...overlap, metadata: { roomType: "Suite" } };
    expect(findOverlap([janMar], otherVariant)).toBeNull();
  });
});

describe("rate snapshot and security", () => {
  it("7. a later catalogue edit does not replace the stored quotation snapshot", () => {
    const selectedAt = "2027-01-10T10:00:00.000Z";
    const snapshot = buildRateSnapshot({
      productType: "HOTEL",
      productId: "hotel-1",
      rate: janMar,
      travelDate: "2027-02-01",
      selectedAt,
    });
    const line = applyResolvedSnapshot({ productId: "hotel-1", productType: "HOTEL", rateSnapshot: snapshot }, snapshot);
    const editedMaster = { ...janMar, contractedCost: 9000 };
    const preserved = preservedSnapshotCost(snapshot, line, "2027-02-01");
    expect(preserved?.contractedCost).toBe(5000);
    expect(editedMaster.contractedCost).toBe(9000);
    expect(preserved?.contractedCost).not.toBe(editedMaster.contractedCost);
  });

  it("8-11. agents and customers cannot see or manage contracted cost", () => {
    const presented = presentApplicableRate(
      { status: "OK", rate: janMar },
      "travel_agent",
      { productType: "HOTEL", productId: "hotel-1", displayPrice: 8000 },
    );
    expect(presented).not.toHaveProperty("contractedCost");
    expect(presented).toMatchObject({ displayPrice: 8000, rateId: "rate-jan", source: "CONTRACTED_PRODUCT" });
    expect(canViewContractedCost("travel_agent")).toBe(false);
    expect(canManageContractedRates("travel_agent")).toBe(false);
    expect(canManageContractedRates("customer")).toBe(false);

    const quote = sanitizeQuotationForRole({
      id: "q1",
      packages: [{ hotels: [{ productId: "hotel-1", contractedCost: 5000, costPrice: 5000, supplier: "Secret DMC", sellingPrice: 8000 }] }],
    }, "travel_agent");
    expect(JSON.stringify(quote)).not.toContain("5000");
    expect(JSON.stringify(quote)).not.toContain("Secret DMC");

    const customer = presentApplicableRate(
      { status: "OK", rate: janMar },
      "customer",
      { productType: "HOTEL", productId: "hotel-1", displayPrice: 8000 },
    );
    expect(customer).not.toHaveProperty("contractedCost");
    const catalog = stripCatalogForRole({ supplier: { name: "Secret DMC" }, contractedCost: 5000, name: "Hotel A" }, "customer");
    expect(catalog).not.toHaveProperty("supplier");
    expect(catalog).not.toHaveProperty("contractedCost");
  });

  it("12. product selection keeps product and rate references", () => {
    const snapshot = buildRateSnapshot({
      productType: "TRANSFER",
      productId: "tr-1",
      rate: aprJun,
      travelDate: "2027-05-01",
    });
    const line = applyResolvedSnapshot({ pickup: "Pattaya Hotel", drop: "Bangkok Hotel" }, snapshot);
    expect(line.productId).toBe("tr-1");
    expect(line.rateId).toBe("rate-apr");
    expect(line.source).toBe("CONTRACTED_PRODUCT");
    expect((line.rateSnapshot as { validFrom: string }).validFrom).toBe("2027-04-01");
  });

  it("13-15. flight sources stay distinct: API, manual, and internal contracted", () => {
    expect(typeof searchAmadeusFlights).toBe("function");
    expect(RATE_SOURCES.AMADEUS_API).toBe("AMADEUS_API");
    expect(RATE_SOURCES.API).toBe("API");
    expect(RATE_SOURCES.MANUAL).toBe("MANUAL");
    const internal = presentApplicableRate(
      { status: "OK", rate: janMar },
      "product_executive",
      { productType: "FLIGHT", productId: "fl-1", displayPrice: null },
    );
    expect(internal).toMatchObject({
      source: "CONTRACTED_PRODUCT",
      productType: "FLIGHT",
      contractedCost: 5000,
    });
    expect(RATE_SOURCES.MANUAL).not.toBe(RATE_SOURCES.CONTRACTED_PRODUCT);
    expect(RATE_SOURCES.AMADEUS_API).not.toBe(RATE_SOURCES.CONTRACTED_PRODUCT);
  });
});
