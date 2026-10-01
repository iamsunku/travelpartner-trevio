import { Prisma, type Quotation, type QuotationPackage } from "@prisma/client";
import type { AuthRequest } from "../middleware/auth.js";
import {
  QUOTE_INCLUDE,
  runWithUniqueQuoteNo,
  writeQuoteAudit,
  type QuotationDbClient,
} from "./quotations.js";
import { ensureInitialQuotationVersion } from "./quotation-versions.js";
import { todayYmd } from "./travel-dates.js";

export type QuotationCloneSource = Quotation & { packages: QuotationPackage[] };

export type CloneQuotationActor = {
  userId?: string | null;
  email?: string | null;
};

export type CloneQuotationInput = {
  source: QuotationCloneSource;
  actor: CloneQuotationActor;
  /** Prefer actor branch when provided (Duplicate behavior). */
  branchId?: string | null;
  /**
   * Optional wizard / PUT-wizard-shaped overrides so Save as New can include
   * unsaved client edits instead of only the last DB snapshot.
   */
  overrides?: Record<string, unknown> | null;
  auditAction: string;
  auditDetails?: string;
  req?: AuthRequest;
  wizardStep?: number;
};

function asJson(value: unknown, fallback: unknown = []): Prisma.InputJsonValue {
  if (value === undefined || value === null) return fallback as Prisma.InputJsonValue;
  return value as Prisma.InputJsonValue;
}

function optionalJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return value as Prisma.InputJsonValue;
}

function overrideOr<T>(overrides: Record<string, unknown> | null | undefined, key: string, fallback: T): T {
  if (!overrides || overrides[key] === undefined) return fallback;
  return overrides[key] as T;
}

function emptyToNull(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s ? s : null;
}

function toInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toFloat(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

type PackageSource = {
  oldId?: string | null;
  name: string;
  sortOrder: number;
  isSelected: boolean;
  description?: string | null;
  hotels: unknown;
  flights: unknown;
  transfers: unknown;
  activities: unknown;
  meals: unknown;
  itinerary: unknown;
  visa?: unknown;
  insurance?: unknown;
  addOns: unknown;
  inclusions: unknown;
  exclusions: unknown;
  totalNetCost: number;
  totalSelling: number;
  grossProfit: number;
  gst: number;
  total: number;
  perPersonCost: number;
  pricing?: unknown;
};

function packagesFromSource(source: QuotationCloneSource): PackageSource[] {
  return (source.packages || []).map((pkg) => ({
    oldId: pkg.id,
    name: pkg.name,
    sortOrder: pkg.sortOrder,
    isSelected: pkg.isSelected,
    description: pkg.description,
    hotels: pkg.hotels ?? [],
    flights: pkg.flights ?? [],
    transfers: pkg.transfers ?? [],
    activities: pkg.activities ?? [],
    meals: pkg.meals ?? [],
    itinerary: pkg.itinerary ?? [],
    visa: pkg.visa ?? undefined,
    insurance: pkg.insurance ?? undefined,
    addOns: pkg.addOns ?? [],
    inclusions: pkg.inclusions ?? [],
    exclusions: pkg.exclusions ?? [],
    totalNetCost: pkg.totalNetCost,
    totalSelling: pkg.totalSelling,
    grossProfit: pkg.grossProfit,
    gst: pkg.gst,
    total: pkg.total,
    perPersonCost: pkg.perPersonCost,
    pricing: pkg.pricing ?? undefined,
  }));
}

function packagesFromOverrides(
  overrides: Record<string, unknown>,
  fallback: PackageSource[],
): PackageSource[] {
  if (!Array.isArray(overrides.packages)) return fallback;
  return (overrides.packages as Record<string, unknown>[]).map((pkg, index) => {
    const oldId = typeof pkg.id === "string" && pkg.id ? pkg.id : null;
    const matched = oldId ? fallback.find((f) => f.oldId === oldId) : undefined;
    return {
      oldId,
      name: String(pkg.name || matched?.name || "Package"),
      sortOrder: Number(pkg.sortOrder ?? matched?.sortOrder ?? index) || index,
      isSelected: Boolean(pkg.isSelected ?? matched?.isSelected ?? false),
      description:
        pkg.description !== undefined
          ? (pkg.description as string | null)
          : (matched?.description ?? null),
      hotels: pkg.hotels ?? matched?.hotels ?? [],
      flights: pkg.flights ?? matched?.flights ?? [],
      transfers: pkg.transfers ?? matched?.transfers ?? [],
      activities: pkg.activities ?? matched?.activities ?? [],
      meals: pkg.meals ?? matched?.meals ?? [],
      itinerary: pkg.itinerary ?? matched?.itinerary ?? [],
      visa: pkg.visa !== undefined ? pkg.visa : matched?.visa,
      insurance: pkg.insurance !== undefined ? pkg.insurance : matched?.insurance,
      addOns: pkg.addOns ?? matched?.addOns ?? [],
      inclusions: pkg.inclusions ?? matched?.inclusions ?? [],
      exclusions: pkg.exclusions ?? matched?.exclusions ?? [],
      totalNetCost: toInt(pkg.totalNetCost ?? matched?.totalNetCost, 0),
      totalSelling: toInt(pkg.totalSelling ?? matched?.totalSelling, 0),
      grossProfit: toInt(pkg.grossProfit ?? matched?.grossProfit, 0),
      gst: toInt(pkg.gst ?? matched?.gst, 0),
      total: toInt(pkg.total ?? matched?.total, 0),
      perPersonCost: toInt(pkg.perPersonCost ?? matched?.perPersonCost, 0),
      pricing: pkg.pricing !== undefined ? pkg.pricing : matched?.pricing,
    };
  });
}

/**
 * Create a fresh Draft quotation cloned from `source` (plus optional wizard overrides).
 * Runs quotation + packages + selectedPackageId remap + Version 1 + audit in one transaction
 * with unique quoteNo allocation/retry.
 *
 * Never mutates the source quotation. Never copies lifecycle, booking, share, document,
 * approval, revision, customer-access, or version-history child rows.
 */
export async function cloneQuotationAsDraft(input: CloneQuotationInput) {
  const { source, actor, overrides } = input;
  const fromDb = packagesFromSource(source);
  const packageSources = overrides ? packagesFromOverrides(overrides, fromDb) : fromDb;

  return runWithUniqueQuoteNo(async (tx, quoteNo) => {
    const o = overrides || null;

    const created = await tx.quotation.create({
      data: {
        quoteNo,
        agencyId: overrideOr(o, "agencyId", source.agencyId) as string | null,
        branchId: input.branchId !== undefined ? input.branchId : source.branchId,
        customerName: String(overrideOr(o, "customerName", source.customerName) || "Customer"),
        service: String(overrideOr(o, "service", source.service) || "Holiday"),
        items: toInt(overrideOr(o, "items", source.items), source.items || 1),
        amount: toInt(overrideOr(o, "amount", source.amount), 0),
        gst: toInt(overrideOr(o, "gst", source.gst), 0),
        total: toInt(overrideOr(o, "total", source.total), 0),
        status: "Draft",
        validTill: String(overrideOr(o, "validTill", source.validTill) || source.validTill),
        quoteDate: todayYmd(),
        createdById: actor.userId || null,
        createdBy: actor.email || source.createdBy || "System",
        isInternational: Boolean(overrideOr(o, "isInternational", source.isInternational)),
        contactPerson: emptyToNull(overrideOr(o, "contactPerson", source.contactPerson)),
        contactEmail: emptyToNull(overrideOr(o, "contactEmail", source.contactEmail)),
        contactPhone: emptyToNull(overrideOr(o, "contactPhone", source.contactPhone)),
        destination: emptyToNull(overrideOr(o, "destination", source.destination)),
        country: emptyToNull(overrideOr(o, "country", source.country)),
        coverImage: emptyToNull(overrideOr(o, "coverImage", source.coverImage)),
        departureCity: emptyToNull(overrideOr(o, "departureCity", source.departureCity)),
        travelDates: emptyToNull(overrideOr(o, "travelDates", source.travelDates)),
        travelStartDate: emptyToNull(overrideOr(o, "travelStartDate", source.travelStartDate)),
        travelEndDate: emptyToNull(overrideOr(o, "travelEndDate", source.travelEndDate)),
        returnDate: emptyToNull(overrideOr(o, "returnDate", source.returnDate)),
        nights: (() => {
          const v = overrideOr(o, "nights", source.nights);
          return v == null ? null : toInt(v, 0);
        })(),
        days: (() => {
          const v = overrideOr(o, "days", source.days);
          return v == null ? null : toInt(v, 0);
        })(),
        adults: Math.max(1, toInt(overrideOr(o, "adults", source.adults), source.adults ?? 2) || 2),
        children: Math.max(0, toInt(overrideOr(o, "children", source.children), source.children ?? 0)),
        infants: Math.max(0, toInt(overrideOr(o, "infants", source.infants), source.infants ?? 0)),
        rooms: Math.max(1, toInt(overrideOr(o, "rooms", source.rooms), source.rooms ?? 1) || 1),
        hotelStarPreference: emptyToNull(overrideOr(o, "hotelStarPreference", source.hotelStarPreference)),
        roomTypePreference: emptyToNull(overrideOr(o, "roomTypePreference", source.roomTypePreference)),
        mealPlanPreference: emptyToNull(overrideOr(o, "mealPlanPreference", source.mealPlanPreference)),
        nationality: emptyToNull(overrideOr(o, "nationality", source.nationality)),
        landOnly: Boolean(overrideOr(o, "landOnly", source.landOnly)),
        estimatedBookingDate: emptyToNull(overrideOr(o, "estimatedBookingDate", source.estimatedBookingDate)),
        tripCities: asJson(overrideOr(o, "tripCities", source.tripCities ?? []), []),
        location: emptyToNull(overrideOr(o, "location", source.location)),
        budget: (() => {
          const v: unknown = o && o.budget !== undefined ? o.budget : source.budget;
          if (v == null || v === "") return null;
          return toInt(v, 0);
        })(),
        currency: String(overrideOr(o, "currency", source.currency) || "INR"),
        baseCurrency: String(overrideOr(o, "baseCurrency", source.baseCurrency) || source.currency || "INR"),
        exchangeRate: toFloat(overrideOr(o, "exchangeRate", source.exchangeRate), source.exchangeRate || 1) || 1,
        exchangeRateExplicit: Boolean(overrideOr(o, "exchangeRateExplicit", source.exchangeRateExplicit)),
        packageIncludes: asJson(overrideOr(o, "packageIncludes", source.packageIncludes ?? []), []),
        packageExcludes: asJson(overrideOr(o, "packageExcludes", source.packageExcludes ?? []), []),
        termsAndConditions: emptyToNull(overrideOr(o, "termsAndConditions", source.termsAndConditions)),
        paymentTerms: emptyToNull(overrideOr(o, "paymentTerms", source.paymentTerms)),
        cancellationPolicy: emptyToNull(overrideOr(o, "cancellationPolicy", source.cancellationPolicy)),
        refundPolicy: emptyToNull(overrideOr(o, "refundPolicy", source.refundPolicy)),
        hotelTerms: emptyToNull(overrideOr(o, "hotelTerms", source.hotelTerms)),
        flightTerms: emptyToNull(overrideOr(o, "flightTerms", source.flightTerms)),
        visaTerms: emptyToNull(overrideOr(o, "visaTerms", source.visaTerms)),
        insuranceTerms: emptyToNull(overrideOr(o, "insuranceTerms", source.insuranceTerms)),
        forceMajeure: emptyToNull(overrideOr(o, "forceMajeure", source.forceMajeure)),
        travelDisclaimer: emptyToNull(overrideOr(o, "travelDisclaimer", source.travelDisclaimer)),
        termsSnapshot: optionalJson(overrideOr(o, "termsSnapshot", source.termsSnapshot)),
        templateSnapshot: optionalJson(overrideOr(o, "templateSnapshot", source.templateSnapshot)),
        appliedTemplateId: emptyToNull(overrideOr(o, "appliedTemplateId", source.appliedTemplateId)),
        salesExecutiveName: emptyToNull(overrideOr(o, "salesExecutiveName", source.salesExecutiveName)),
        salesExecutivePhone: emptyToNull(overrideOr(o, "salesExecutivePhone", source.salesExecutivePhone)),
        salesExecutiveEmail: emptyToNull(overrideOr(o, "salesExecutiveEmail", source.salesExecutiveEmail)),
        agentName: emptyToNull(overrideOr(o, "agentName", source.agentName)),
        agentId: emptyToNull(overrideOr(o, "agentId", source.agentId)),
        agentCode: emptyToNull(overrideOr(o, "agentCode", source.agentCode)),
        agencyCode: emptyToNull(overrideOr(o, "agencyCode", source.agencyCode)),
        specialRequests: emptyToNull(overrideOr(o, "specialRequests", source.specialRequests)),
        internalNotes: emptyToNull(overrideOr(o, "internalNotes", source.internalNotes)),
        lineItems: asJson(overrideOr(o, "lineItems", source.lineItems ?? []), []),
        couponCode: emptyToNull(overrideOr(o, "couponCode", source.couponCode)),
        couponDiscount: toInt(overrideOr(o, "couponDiscount", source.couponDiscount), source.couponDiscount || 0),
        enquiryRef: emptyToNull(overrideOr(o, "enquiryRef", source.enquiryRef)),
        leadId: emptyToNull(overrideOr(o, "leadId", source.leadId)),
        travelProposalId: emptyToNull(overrideOr(o, "travelProposalId", source.travelProposalId)),
        totalNetCost: toInt(overrideOr(o, "totalNetCost", source.totalNetCost), 0),
        totalSelling: toInt(overrideOr(o, "totalSelling", source.totalSelling), 0),
        grossProfit: toInt(overrideOr(o, "grossProfit", source.grossProfit), 0),
        profitMargin: toFloat(overrideOr(o, "profitMargin", source.profitMargin), source.profitMargin || 0),
        discountType: emptyToNull(overrideOr(o, "discountType", source.discountType)),
        discountValue: toFloat(overrideOr(o, "discountValue", source.discountValue), source.discountValue || 0),
        discountAmount: toInt(overrideOr(o, "discountAmount", source.discountAmount), 0),
        taxRate: toFloat(overrideOr(o, "taxRate", source.taxRate), source.taxRate || 0),
        taxRuleId: emptyToNull(overrideOr(o, "taxRuleId", source.taxRuleId)),
        taxableAmount: toInt(overrideOr(o, "taxableAmount", source.taxableAmount), 0),
        trevioMarkupType:
          overrideOr(o, "trevioMarkupType", source.trevioMarkupType) === "Fixed" ? "Fixed" : "Percentage",
        trevioMarkupValue: toFloat(overrideOr(o, "trevioMarkupValue", source.trevioMarkupValue), source.trevioMarkupValue || 0),
        agentMarkupType:
          overrideOr(o, "agentMarkupType", source.agentMarkupType) === "Percentage" ? "Percentage" : "Fixed",
        agentMarkup: Math.max(0, toInt(overrideOr(o, "agentMarkup", source.agentMarkup), source.agentMarkup || 0)),
        baseSellingTotal: toInt(overrideOr(o, "baseSellingTotal", source.baseSellingTotal), source.baseSellingTotal || 0),
        pricingStatus: String(overrideOr(o, "pricingStatus", source.pricingStatus) || "OK"),
        perPersonCost: toInt(overrideOr(o, "perPersonCost", source.perPersonCost), 0),
        approvalStatus: "Draft",
        currentVersion: 1,
        wizardStep: Math.max(
          1,
          toInt(
            input.wizardStep ?? overrideOr(o, "wizardStep", 1),
            1,
          ) || 1,
        ),
        // Explicitly leave lifecycle / booking / acceptance unset (fresh Draft).
        // Do NOT set: accepted*, rejectedReason, convertedBooking*, archivedAt, deletedAt, expiredAt
        selectedPackageId: null,
      },
    });

    const packageIdMap = new Map<string, string>();
    const createdPackages: Array<{ id: string; isSelected: boolean; oldId?: string | null }> = [];

    for (const pkg of packageSources) {
      const row = await tx.quotationPackage.create({
        data: {
          quotationId: created.id,
          name: pkg.name,
          sortOrder: pkg.sortOrder,
          isSelected: pkg.isSelected,
          description: pkg.description ?? undefined,
          hotels: asJson(pkg.hotels, []),
          flights: asJson(pkg.flights, []),
          transfers: asJson(pkg.transfers, []),
          activities: asJson(pkg.activities, []),
          meals: asJson(pkg.meals, []),
          itinerary: asJson(pkg.itinerary, []),
          visa: optionalJson(pkg.visa),
          insurance: optionalJson(pkg.insurance),
          addOns: asJson(pkg.addOns, []),
          inclusions: asJson(pkg.inclusions, []),
          exclusions: asJson(pkg.exclusions, []),
          totalNetCost: pkg.totalNetCost,
          totalSelling: pkg.totalSelling,
          grossProfit: pkg.grossProfit,
          gst: pkg.gst,
          total: pkg.total,
          perPersonCost: pkg.perPersonCost,
          pricing: optionalJson(pkg.pricing),
        },
      });
      if (pkg.oldId) packageIdMap.set(pkg.oldId, row.id);
      createdPackages.push({ id: row.id, isSelected: row.isSelected, oldId: pkg.oldId });
    }

    const desiredSelected =
      emptyToNull(overrideOr(o, "selectedPackageId", source.selectedPackageId)) ||
      createdPackages.find((p) => p.isSelected)?.oldId ||
      null;

    let remappedSelected: string | null = null;
    if (desiredSelected && packageIdMap.has(desiredSelected)) {
      remappedSelected = packageIdMap.get(desiredSelected) || null;
    } else if (desiredSelected && createdPackages.some((p) => p.id === desiredSelected)) {
      // Already a new id (unusual) — keep.
      remappedSelected = desiredSelected;
    } else {
      remappedSelected = createdPackages.find((p) => p.isSelected)?.id
        || createdPackages[0]?.id
        || null;
    }

    if (remappedSelected) {
      await tx.quotation.update({
        where: { id: created.id },
        data: { selectedPackageId: remappedSelected },
      });
      await tx.quotationPackage.updateMany({
        where: { quotationId: created.id },
        data: { isSelected: false },
      });
      await tx.quotationPackage.update({
        where: { id: remappedSelected },
        data: { isSelected: true },
      });
    }

    const full = await tx.quotation.findUnique({
      where: { id: created.id },
      include: QUOTE_INCLUDE,
    });
    if (!full) {
      throw new Error("Failed to reload cloned quotation");
    }

    await ensureInitialQuotationVersion({
      quotationId: created.id,
      createdByName: actor.email || "System",
      createdById: actor.userId || undefined,
      changeSummary: "Version 1",
      client: tx as QuotationDbClient,
      full: full as unknown as Record<string, unknown>,
    });

    await writeQuoteAudit({
      req: input.req,
      agencyId: created.agencyId,
      quotationId: created.id,
      action: input.auditAction,
      details: input.auditDetails || `From ${source.quoteNo}`,
      updatedValue: {
        sourceQuotationId: source.id,
        sourceQuoteNo: source.quoteNo,
        quoteNo: created.quoteNo,
      },
      client: tx as QuotationDbClient,
    });

    const withVersion = await tx.quotation.findUnique({
      where: { id: created.id },
      include: QUOTE_INCLUDE,
    });
    return withVersion || full;
  });
}
