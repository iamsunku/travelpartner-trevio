import type { ProposalSnapshotData } from "../proposal-snapshot.js";

export type PdfSectionType =
  | "COVER"
  | "OVERVIEW"
  | "DESTINATION_HIGHLIGHTS"
  | "ITINERARY"
  | "HOTELS"
  | "ACTIVITIES"
  | "FLIGHTS"
  | "TRANSFERS"
  | "PRICING"
  | "INCLUSIONS"
  | "EXCLUSIONS"
  | "VISA"
  | "TERMS"
  | "CANCELLATION"
  | "NOTES"
  | "CONTACT"
  | "CUSTOM_HTML";

export type PdfPageSize = "A4" | "LETTER";
export type PdfOrientation = "portrait" | "landscape";

export interface PdfBranding {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  logo: string | null;
  watermark: string | null;
  footerText: string | null;
  backgroundImage: string | null;
  showPageNumbers: boolean;
  agencyName: string;
  agencyPhone: string;
  agencyEmail: string;
  agencyAddress: string;
}

export interface PdfTemplateSection {
  sectionType: PdfSectionType;
  sortOrder: number;
  isVisible: boolean;
  customTitle: string | null;
  settings: Record<string, unknown>;
}

export interface PdfTemplateMeta {
  pageSize: PdfPageSize;
  orientation: PdfOrientation;
  theme: string;
  sections: PdfTemplateSection[];
}

export interface PdfItineraryItem {
  time: string;
  title: string;
  description: string;
  period: "Morning" | "Afternoon" | "Evening" | "Anytime";
}

export interface PdfItineraryDay {
  dayNumber: number;
  title: string;
  items: PdfItineraryItem[];
}

export interface PdfHotel {
  name: string;
  category: string;
  description: string;
  amenities: string[];
  image: string | null;
  nights: number;
  city: string;
}

export interface PdfActivity {
  name: string;
  description: string;
  duration: string;
  image: string | null;
  location: string;
}

export interface PdfTransfer {
  name: string;
  vehicle: string;
  pickup: string;
  drop: string;
  notes: string;
  type: string;
}

export interface PdfPricingRow {
  label: string;
  amount: number;
  emphasis?: boolean;
}

export interface PdfDocumentContent {
  proposalNumber: string;
  proposalTitle: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  paxLabel: string;
  destination: string;
  travelDates: string;
  duration: string;
  generatedDate: string;
  validUntil: string;
  heroImage: string | null;
  highlights: string[];
  days: PdfItineraryDay[];
  hotels: PdfHotel[];
  activities: PdfActivity[];
  transfers: PdfTransfer[];
  flights: { airline: string; route: string; notes: string }[];
  pricing: {
    currency: string;
    rows: PdfPricingRow[];
    total: number;
  };
  inclusions: string[];
  exclusions: string[];
  visaRequired: boolean;
  visaDetails: string;
  termsText: string;
  cancellationText: string;
  notes: string;
  contact: {
    name: string;
    designation: string;
    phone: string;
    email: string;
  };
  customHtml: string;
}

export interface PdfRenderInput {
  proposalId: string;
  proposalNumber: string;
  versionNumber: number;
  validUntil?: string | Date | null;
  notes?: string | null;
  snapshot: ProposalSnapshotData;
  agency?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    logo?: string | null;
  } | null;
}

export interface PdfRenderResult {
  buffer: Buffer;
  pageCount: number;
  fileName: string;
}

export interface GeneratePdfOptions {
  force?: boolean;
  generatedByName?: string | null;
}

export const PDF_ELIGIBLE_STATUSES = [
  "Internal Review",
  "Approved",
  "Sent",
  "Viewed",
  "Accepted",
  "Booked",
] as const;

export function isPdfEligibleStatus(status: string): boolean {
  return (PDF_ELIGIBLE_STATUSES as readonly string[]).includes(status);
}
