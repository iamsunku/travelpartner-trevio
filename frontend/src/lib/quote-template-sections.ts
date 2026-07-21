import type { QuoteSectionType } from "@/types";

export interface QuoteSectionDef {
  type: QuoteSectionType;
  label: string;
  description: string;
  allowMultiple?: boolean;
}

export const QUOTE_SECTION_DEFS: QuoteSectionDef[] = [
  { type: "COVER", label: "Cover", description: "Hero cover page with package summary" },
  { type: "OVERVIEW", label: "Overview", description: "Package overview and traveller details" },
  { type: "DESTINATION_HIGHLIGHTS", label: "Destination Highlights", description: "Key highlights and experiences" },
  { type: "ITINERARY", label: "Day-wise Itinerary", description: "Day-by-day schedule" },
  { type: "HOTELS", label: "Hotels", description: "Accommodation details" },
  { type: "ACTIVITIES", label: "Activities", description: "Experiences and tours" },
  { type: "FLIGHTS", label: "Flights", description: "Flight segments" },
  { type: "TRANSFERS", label: "Transfers", description: "Ground transfers" },
  { type: "PRICING", label: "Pricing Summary", description: "Cost breakdown and total" },
  { type: "INCLUSIONS", label: "Inclusions", description: "What's included" },
  { type: "EXCLUSIONS", label: "Exclusions", description: "What's not included" },
  { type: "VISA", label: "Visa Information", description: "Visa requirements" },
  { type: "TERMS", label: "Terms & Conditions", description: "Booking terms" },
  { type: "CANCELLATION", label: "Cancellation Policy", description: "Cancellation rules" },
  { type: "NOTES", label: "Important Notes", description: "Additional notes" },
  { type: "CONTACT", label: "Contact Information", description: "Sales consultant contact" },
  { type: "CUSTOM_HTML", label: "Custom HTML Block", description: "Free-form HTML content", allowMultiple: true },
];

export function sectionLabel(type: QuoteSectionType): string {
  return QUOTE_SECTION_DEFS.find((d) => d.type === type)?.label ?? type;
}

export function defaultSectionTitle(type: QuoteSectionType): string {
  return sectionLabel(type);
}

export const REQUIRED_DEFAULT_SECTIONS: QuoteSectionType[] = ["COVER", "ITINERARY", "PRICING"];

export function validateDefaultSections(sections: { sectionType: QuoteSectionType; isVisible: boolean }[]): string | null {
  const visible = new Set(sections.filter((s) => s.isVisible).map((s) => s.sectionType));
  if (!visible.has("COVER")) return "Template must include a visible Cover section";
  if (!visible.has("ITINERARY")) return "Template must include a visible Itinerary section";
  if (!visible.has("PRICING")) return "Template must include a visible Pricing section";
  return null;
}
