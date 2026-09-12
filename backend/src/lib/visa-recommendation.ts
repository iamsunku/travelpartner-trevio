/**
 * Phase 12 — Destination catalogue visa recommendation (not immigration advice).
 * Uses Destination.visaRequired / visaDetails only.
 */

export type VisaCatalogueRecommendation = {
  source: "destination_catalogue";
  destinationName: string;
  country?: string | null;
  visaTypicallyRequired: boolean;
  catalogueDetails: string;
  suggestedVisaType: string;
  suggestedEntryType: string;
  disclaimer: string;
};

const DISCLAIMER =
  "Catalogue recommendation only — not legal or immigration advice. Confirm eligibility, fees, processing time, and documents with the relevant authority or your visa partner before travel.";

export function buildVisaCatalogueRecommendation(input: {
  name: string;
  country?: string | null;
  visaRequired?: boolean | null;
  visaDetails?: string | null;
}): VisaCatalogueRecommendation {
  const required = Boolean(input.visaRequired);
  const details =
    (input.visaDetails && String(input.visaDetails).trim()) ||
    (required
      ? `Visa is typically required for ${input.name}.`
      : `Visa is often not required for ${input.name}. Confirm before travel.`);

  return {
    source: "destination_catalogue",
    destinationName: input.name,
    country: input.country || null,
    visaTypicallyRequired: required,
    catalogueDetails: details,
    suggestedVisaType: required ? "Tourist" : "Not typically required",
    suggestedEntryType: "Single Entry",
    disclaimer: DISCLAIMER,
  };
}

/** Map recommendation into quotation visa JSON (catalogue selection, not underwriting). */
export function visaJsonFromRecommendation(
  rec: VisaCatalogueRecommendation,
  opts: { enableService?: boolean; sellingPrice?: number; costPrice?: number } = {},
): Record<string, unknown> {
  const enable = opts.enableService ?? rec.visaTypicallyRequired;
  return {
    enabled: enable,
    visaType: rec.suggestedVisaType,
    entryType: rec.suggestedEntryType,
    processingTime: "",
    feeNotes: "",
    documentsRequired: "",
    appointmentNote: "",
    catalogueRecommendation: rec.catalogueDetails,
    disclaimer: rec.disclaimer,
    required: rec.visaTypicallyRequired,
    sellingPrice: Math.round(Number(opts.sellingPrice ?? 0)),
    costPrice: Math.round(Number(opts.costPrice ?? 0)),
    remarks: rec.disclaimer,
  };
}
