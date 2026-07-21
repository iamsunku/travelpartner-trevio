import type { PdfBranding, PdfRenderInput, PdfTemplateMeta, PdfTemplateSection, PdfSectionType } from "./types.js";

function str(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function hexOrDefault(value: unknown, fallback: string): string {
  const v = str(value, fallback).trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : fallback;
}

export function resolveBranding(input: PdfRenderInput): PdfBranding {
  const template = (input.snapshot.template ?? {}) as Record<string, unknown>;
  const branding = (input.snapshot.branding ?? {}) as Record<string, unknown>;
  const agency = input.agency ?? {};

  const footerText = str(template.footerText ?? branding.footerText, "");
  const agencyName =
    str(agency.name) ||
    footerText.split("·")[0]?.trim() ||
    "Travel Agency";

  return {
    primaryColor: hexOrDefault(template.primaryColor ?? branding.primaryColor, "#2A7BBD"),
    secondaryColor: hexOrDefault(template.secondaryColor ?? branding.secondaryColor, "#00A79D"),
    fontFamily: str(template.fontFamily ?? branding.fontFamily, "Helvetica"),
    logo: str(template.logo ?? branding.logo ?? agency.logo) || null,
    watermark: str(template.watermark ?? branding.watermark) || null,
    footerText: footerText || `${agencyName} · Confidential Travel Proposal`,
    backgroundImage: str(template.backgroundImage ?? branding.backgroundImage) || null,
    showPageNumbers: Boolean(template.showPageNumbers ?? branding.showPageNumbers ?? true),
    agencyName,
    agencyPhone: str(agency.phone),
    agencyEmail: str(agency.email),
    agencyAddress: str(agency.address),
  };
}

export function resolveTemplateMeta(input: PdfRenderInput): PdfTemplateMeta {
  const template = (input.snapshot.template ?? {}) as Record<string, unknown>;
  const rawSections = Array.isArray(template.sections) ? (template.sections as Record<string, unknown>[]) : [];

  const sections: PdfTemplateSection[] = rawSections
    .map((s, idx) => ({
      sectionType: str(s.sectionType, "CUSTOM_HTML") as PdfSectionType,
      sortOrder: Number(s.sortOrder ?? idx),
      isVisible: s.isVisible !== false,
      customTitle: s.customTitle != null ? str(s.customTitle) : null,
      settings: (s.settings as Record<string, unknown>) ?? {},
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Fallback default sections when template missing sections array
  let effective =
    sections.length > 0
      ? sections
      : ([
          "COVER",
          "OVERVIEW",
          "DESTINATION_HIGHLIGHTS",
          "ITINERARY",
          "HOTELS",
          "ACTIVITIES",
          "TRANSFERS",
          "PRICING",
          "INCLUSIONS",
          "EXCLUSIONS",
          "VISA",
          "TERMS",
          "CANCELLATION",
          "NOTES",
          "CONTACT",
        ] as PdfSectionType[]).map((sectionType, sortOrder) => ({
          sectionType,
          sortOrder,
          isVisible: true,
          customTitle: null,
          settings: {},
        }));

  // Older templates may omit ACTIVITIES — insert after HOTELS when missing so package activities still render.
  if (!effective.some((s) => s.sectionType === "ACTIVITIES")) {
    const hotelsIdx = effective.findIndex((s) => s.sectionType === "HOTELS");
    const insertAt = hotelsIdx >= 0 ? hotelsIdx + 1 : Math.max(0, effective.findIndex((s) => s.sectionType === "ITINERARY") + 1);
    effective = [
      ...effective.slice(0, insertAt),
      {
        sectionType: "ACTIVITIES" as PdfSectionType,
        sortOrder: insertAt,
        isVisible: true,
        customTitle: null,
        settings: {},
      },
      ...effective.slice(insertAt),
    ];
  }

  effective = effective.filter((s) => s.isVisible);

  const pageSizeRaw = str(template.pageSize, "A4").toUpperCase();
  const orientationRaw = str(template.orientation, "portrait").toLowerCase();

  return {
    pageSize: pageSizeRaw === "LETTER" ? "LETTER" : "A4",
    orientation: orientationRaw === "landscape" ? "landscape" : "portrait",
    theme: str(template.theme, "Classic"),
    sections: effective,
  };
}