/**
 * Phase 13 — QuoteTemplate content extraction + merge (TM-02).
 * Uses existing QuoteTemplateSection.settings.content — no parallel template system.
 */

export type TemplateContentBlob = {
  text?: string;
  items?: string[];
  itinerary?: Array<Record<string, unknown>>;
  hotels?: Array<Record<string, unknown>>;
  flights?: Array<Record<string, unknown>>;
  transfers?: Array<Record<string, unknown>>;
  activities?: Array<Record<string, unknown>>;
  meals?: Array<Record<string, unknown>>;
};

export type ExtractedTemplateContent = {
  templateId: string;
  templateName: string;
  appliedAt: string;
  overview?: string;
  highlights?: string[];
  termsAndConditions?: string;
  cancellationPolicy?: string;
  paymentTerms?: string;
  notes?: string;
  visaNotes?: string;
  inclusions?: string[];
  exclusions?: string[];
  itinerary?: Array<Record<string, unknown>>;
  hotels?: Array<Record<string, unknown>>;
  flights?: Array<Record<string, unknown>>;
  transfers?: Array<Record<string, unknown>>;
  activities?: Array<Record<string, unknown>>;
  meals?: Array<Record<string, unknown>>;
};

type SectionLike = {
  sectionType: string;
  isVisible?: boolean;
  settings?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function contentOf(section: SectionLike): TemplateContentBlob {
  const settings = asRecord(section.settings) || {};
  const content = asRecord(settings.content) || {};
  // Legacy: some builders store placeholder text directly
  if (!content.text && typeof settings.placeholder === "string") {
    content.text = settings.placeholder;
  }
  if (!content.items && Array.isArray(settings.items)) {
    content.items = settings.items.map(String);
  }
  return content as TemplateContentBlob;
}

/** Strip commercial fields so templates cannot inject supplier/contracted cost. */
export function sanitizeTemplateServiceLines(lines: Array<Record<string, unknown>> | undefined): Array<Record<string, unknown>> {
  if (!Array.isArray(lines)) return [];
  return lines.map((raw) => {
    const line = { ...raw };
    delete line.costPrice;
    delete line.contractedCost;
    delete line.quotedCostPrice;
    delete line.supplierCost;
    delete line.supplier;
    delete line.supplierId;
    delete line.supplierName;
    delete line.trevioMarkup;
    delete line.trevioMarkupAmount;
    delete line.trevioSellingPrice;
    delete line.rateSnapshot;
    delete line.rateId;
    // Template lines without productId are sample/manual content only
    if (!line.productId) {
      line.source = "MANUAL";
      delete line.productType;
    } else {
      line.source = "CONTRACTED_PRODUCT";
    }
    return line;
  });
}

export function extractTemplateContent(input: {
  templateId: string;
  templateName: string;
  sections: SectionLike[];
}): ExtractedTemplateContent {
  const out: ExtractedTemplateContent = {
    templateId: input.templateId,
    templateName: input.templateName,
    appliedAt: new Date().toISOString(),
  };
  for (const section of input.sections) {
    if (section.isVisible === false) continue;
    const c = contentOf(section);
    const type = section.sectionType;
    if (type === "OVERVIEW" && c.text) out.overview = c.text;
    if (type === "DESTINATION_HIGHLIGHTS" && (c.items?.length || c.text)) {
      out.highlights = c.items?.length ? c.items : String(c.text || "").split("\n").map((s) => s.trim()).filter(Boolean);
    }
    if (type === "TERMS" && c.text) out.termsAndConditions = c.text;
    if (type === "CANCELLATION" && c.text) out.cancellationPolicy = c.text;
    if (type === "NOTES" && c.text) out.notes = c.text;
    if (type === "VISA" && c.text) out.visaNotes = c.text;
    if (type === "CONTACT" && c.text) out.paymentTerms = out.paymentTerms || c.text;
    if (type === "INCLUSIONS" && (c.items?.length || c.text)) {
      out.inclusions = c.items?.length ? c.items : String(c.text || "").split("\n").map((s) => s.trim()).filter(Boolean);
    }
    if (type === "EXCLUSIONS" && (c.items?.length || c.text)) {
      out.exclusions = c.items?.length ? c.items : String(c.text || "").split("\n").map((s) => s.trim()).filter(Boolean);
    }
    if (type === "ITINERARY" && Array.isArray(c.itinerary)) out.itinerary = c.itinerary;
    if (type === "HOTELS" && Array.isArray(c.hotels)) out.hotels = sanitizeTemplateServiceLines(c.hotels);
    if (type === "FLIGHTS" && Array.isArray(c.flights)) out.flights = sanitizeTemplateServiceLines(c.flights);
    if (type === "TRANSFERS" && Array.isArray(c.transfers)) out.transfers = sanitizeTemplateServiceLines(c.transfers);
    if (type === "ACTIVITIES" && Array.isArray(c.activities)) out.activities = sanitizeTemplateServiceLines(c.activities);
  }
  return out;
}

function isEmptyText(value: unknown): boolean {
  return !value || !String(value).trim();
}

function isEmptyArray(value: unknown): boolean {
  return !Array.isArray(value) || value.length === 0;
}

export type MergeMode = "fill-empty" | "merge-append";

/**
 * Deterministic merge into one package + quotation scalar fields.
 * Never silently overwrites non-empty user data in fill-empty mode.
 */
export function mergeTemplateIntoQuotation(input: {
  mode: MergeMode;
  quote: Record<string, unknown>;
  pkg: Record<string, unknown>;
  content: ExtractedTemplateContent;
}): {
  quotePatch: Record<string, unknown>;
  packagePatch: Record<string, unknown>;
  appliedFields: string[];
} {
  const mode = input.mode;
  const quotePatch: Record<string, unknown> = {};
  const packagePatch: Record<string, unknown> = {};
  const appliedFields: string[] = [];
  const c = input.content;

  const setQuote = (key: string, value: unknown, empty: boolean) => {
    if (value == null) return;
    if (mode === "fill-empty" && !empty) return;
    quotePatch[key] = value;
    appliedFields.push(`quote.${key}`);
  };
  const setPkgArr = (key: string, value: Array<Record<string, unknown>> | string[] | undefined) => {
    if (!value?.length) return;
    const current = input.pkg[key];
    if (mode === "fill-empty" && !isEmptyArray(current)) return;
    if (mode === "merge-append" && Array.isArray(current) && current.length) {
      packagePatch[key] = [...(current as unknown[]), ...value];
    } else {
      packagePatch[key] = value;
    }
    appliedFields.push(`package.${key}`);
  };

  if (c.termsAndConditions) setQuote("termsAndConditions", c.termsAndConditions, isEmptyText(input.quote.termsAndConditions));
  if (c.cancellationPolicy) setQuote("cancellationPolicy", c.cancellationPolicy, isEmptyText(input.quote.cancellationPolicy));
  if (c.paymentTerms) setQuote("paymentTerms", c.paymentTerms, isEmptyText(input.quote.paymentTerms));
  if (c.notes) setQuote("specialRequests", c.notes, isEmptyText(input.quote.specialRequests));
  if (c.overview) {
    const descEmpty = isEmptyText(input.pkg.description);
    if (mode === "fill-empty" ? descEmpty : true) {
      packagePatch.description = c.overview;
      appliedFields.push("package.description");
    }
  }
  if (c.inclusions) setPkgArr("inclusions", c.inclusions);
  if (c.exclusions) setPkgArr("exclusions", c.exclusions);
  if (c.itinerary) setPkgArr("itinerary", c.itinerary);
  if (c.hotels) setPkgArr("hotels", c.hotels);
  if (c.flights) setPkgArr("flights", c.flights);
  if (c.transfers) setPkgArr("transfers", c.transfers);
  if (c.activities) setPkgArr("activities", c.activities);
  if (c.meals) setPkgArr("meals", c.meals);
  if (c.visaNotes) {
    const visa = asRecord(input.pkg.visa) || {};
    if (mode === "fill-empty" && visa.catalogueRecommendation) {
      /* keep */
    } else {
      packagePatch.visa = {
        ...visa,
        enabled: visa.enabled ?? true,
        remarks: c.visaNotes,
        catalogueRecommendation: c.visaNotes,
      };
      appliedFields.push("package.visa");
    }
  }
  if (c.highlights?.length && isEmptyArray(input.quote.packageIncludes) && mode === "fill-empty") {
    quotePatch.packageIncludes = c.highlights;
    appliedFields.push("quote.packageIncludes");
  }

  return { quotePatch, packagePatch, appliedFields };
}
