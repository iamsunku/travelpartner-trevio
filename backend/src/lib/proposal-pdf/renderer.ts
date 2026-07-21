import PDFDocument from "pdfkit";
import { loadImageBuffer, PLACEHOLDER_PNG } from "./images.js";
import type {
  PdfBranding,
  PdfDocumentContent,
  PdfRenderResult,
  PdfTemplateMeta,
  PdfTemplateSection,
} from "./types.js";

type Doc = PDFKit.PDFDocument;

const MARGIN = 48;
const HEADER_H = 36;
const FOOTER_H = 40;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function money(amount: number, currency: string): string {
  const abs = Math.abs(amount);
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 0,
    }).format(amount < 0 ? -abs : abs);
  } catch {
    return `${currency} ${amount.toLocaleString("en-IN")}`;
  }
}

function pageSize(meta: PdfTemplateMeta): [number, number] {
  const a4: [number, number] = [595.28, 841.89];
  const letter: [number, number] = [612, 792];
  const base = meta.pageSize === "LETTER" ? letter : a4;
  return meta.orientation === "landscape" ? [base[1], base[0]] : base;
}

function contentWidth(doc: Doc): number {
  return doc.page.width - MARGIN * 2;
}

function contentBottom(doc: Doc): number {
  return doc.page.height - FOOTER_H - 8;
}

function ensureSpace(doc: Doc, branding: PdfBranding, needed: number): void {
  if (doc.y + needed > contentBottom(doc)) {
    doc.addPage();
    drawHeader(doc, branding);
    doc.y = MARGIN + HEADER_H + 8;
  }
}

function drawHeader(doc: Doc, branding: PdfBranding): void {
  const [r, g, b] = hexToRgb(branding.primaryColor);
  doc.save();
  doc.rect(0, 0, doc.page.width, 6).fill([r, g, b]);
  doc.fillColor("#1a1a1a").font("Helvetica-Bold").fontSize(9);
  doc.text(branding.agencyName, MARGIN, 14, {
    width: contentWidth(doc) / 2,
    align: "left",
    lineBreak: false,
  });
  doc.fillColor("#666666").font("Helvetica").fontSize(8);
  doc.text("Travel Proposal", MARGIN + contentWidth(doc) / 2, 14, {
    width: contentWidth(doc) / 2,
    align: "right",
    lineBreak: false,
  });
  doc
    .moveTo(MARGIN, HEADER_H)
    .lineTo(doc.page.width - MARGIN, HEADER_H)
    .strokeColor("#e5e7eb")
    .lineWidth(0.5)
    .stroke();
  doc.restore();
}

function drawFooter(doc: Doc, branding: PdfBranding, pageNumber: number, totalHint?: number): void {
  const y = doc.page.height - FOOTER_H + 8;
  doc.save();
  doc
    .moveTo(MARGIN, y - 6)
    .lineTo(doc.page.width - MARGIN, y - 6)
    .strokeColor("#e5e7eb")
    .lineWidth(0.5)
    .stroke();
  doc.fillColor("#6b7280").font("Helvetica").fontSize(8);
  doc.text(branding.footerText || branding.agencyName, MARGIN, y, {
    width: contentWidth(doc) * 0.65,
    align: "left",
    lineBreak: false,
  });
  if (branding.showPageNumbers) {
    const label = totalHint ? `Page ${pageNumber} of ${totalHint}` : `Page ${pageNumber}`;
    doc.text(label, MARGIN + contentWidth(doc) * 0.65, y, {
      width: contentWidth(doc) * 0.35,
      align: "right",
      lineBreak: false,
    });
  }
  doc.restore();
}

function sectionTitle(doc: Doc, branding: PdfBranding, title: string): void {
  ensureSpace(doc, branding, 40);
  const [r, g, b] = hexToRgb(branding.primaryColor);
  const y = doc.y;
  doc.rect(MARGIN, y, 4, 18).fill([r, g, b]);
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(14);
  doc.text(title, MARGIN + 12, y + 2, { width: contentWidth(doc) - 12 });
  doc.moveDown(0.6);
}

function bodyText(doc: Doc, text: string, opts?: { color?: string; size?: number; bold?: boolean }): void {
  doc
    .fillColor(opts?.color ?? "#374151")
    .font(opts?.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(opts?.size ?? 10)
    .text(text || "—", { width: contentWidth(doc), align: "left" });
}

function bulletList(doc: Doc, branding: PdfBranding, items: string[]): void {
  if (!items.length) {
    bodyText(doc, "No items listed.", { color: "#9ca3af" });
    return;
  }
  for (const item of items) {
    ensureSpace(doc, branding, 22);
    const y = doc.y;
    const [r, g, b] = hexToRgb(branding.secondaryColor);
    doc.circle(MARGIN + 4, y + 6, 2.5).fill([r, g, b]);
    doc
      .fillColor("#374151")
      .font("Helvetica")
      .fontSize(10)
      .text(item, MARGIN + 14, y, { width: contentWidth(doc) - 14 });
    doc.moveDown(0.25);
  }
}

async function drawImage(
  doc: Doc,
  src: string | null,
  x: number,
  y: number,
  w: number,
  h: number,
  radius = 4
): Promise<void> {
  const buffer = (await loadImageBuffer(src)) ?? PLACEHOLDER_PNG;
  doc.save();
  try {
    // Clip rounded rect
    doc.roundedRect(x, y, w, h, radius).clip();
    doc.image(buffer, x, y, { cover: [w, h], align: "center", valign: "center" });
  } catch {
    doc.roundedRect(x, y, w, h, radius).fill("#f3f4f6");
    doc.fillColor("#9ca3af").font("Helvetica").fontSize(9);
    doc.text("Image unavailable", x, y + h / 2 - 6, { width: w, align: "center" });
  }
  doc.restore();
}

async function renderCover(
  doc: Doc,
  branding: PdfBranding,
  content: PdfDocumentContent
): Promise<void> {
  const w = doc.page.width;
  const h = doc.page.height;
  const [pr, pg, pb] = hexToRgb(branding.primaryColor);
  const [sr, sg, sb] = hexToRgb(branding.secondaryColor);

  // Hero band
  doc.rect(0, 0, w, h * 0.48).fill([pr, pg, pb]);
  if (content.heroImage) {
    try {
      const buf = (await loadImageBuffer(content.heroImage)) ?? null;
      if (buf) {
        doc.save();
        doc.rect(0, 0, w, h * 0.48).clip();
        doc.image(buf, 0, 0, { cover: [w, h * 0.48] });
        doc.restore();
        doc.save();
        doc.rect(0, 0, w, h * 0.48).fillOpacity(0.45).fill([pr, pg, pb]);
        doc.restore();
      }
    } catch {
      /* keep solid brand color */
    }
  }

  // Logo
  if (branding.logo) {
    try {
      const logoBuf = await loadImageBuffer(branding.logo);
      if (logoBuf) doc.image(logoBuf, MARGIN, 36, { fit: [120, 48] });
    } catch {
      /* skip broken logo */
    }
  } else {
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(16).text(branding.agencyName, MARGIN, 44);
  }

  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(28);
  doc.text(content.proposalTitle, MARGIN, h * 0.22, { width: w - MARGIN * 2 });

  doc.font("Helvetica").fontSize(12).fillOpacity(0.95);
  doc.text(content.destination, MARGIN, undefined, { width: w - MARGIN * 2 });
  doc.fillOpacity(1);

  // Meta panel
  const panelY = h * 0.52;
  doc.roundedRect(MARGIN, panelY, w - MARGIN * 2, 210, 8).fill("#ffffff").strokeColor("#e5e7eb").lineWidth(1).stroke();

  const meta: [string, string][] = [
    ["Prepared for", content.customerName],
    ["Destination", content.destination],
    ["Travel Dates", content.travelDates],
    ["Duration", content.duration],
    ["Proposal No.", content.proposalNumber],
    ["Generated", content.generatedDate],
    ["Valid Until", content.validUntil],
    ["Travellers", content.paxLabel],
  ];

  let col = 0;
  let row = 0;
  const colW = (w - MARGIN * 2 - 32) / 2;
  for (const [label, value] of meta) {
    const x = MARGIN + 16 + col * colW;
    const y = panelY + 18 + row * 44;
    doc.fillColor("#6b7280").font("Helvetica").fontSize(8).text(label.toUpperCase(), x, y);
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(11).text(value || "—", x, y + 12, {
      width: colW - 12,
    });
    col += 1;
    if (col > 1) {
      col = 0;
      row += 1;
    }
  }

  // Accent bar
  doc.rect(0, h - 10, w, 10).fill([sr, sg, sb]);
}

async function renderOverview(
  doc: Doc,
  branding: PdfBranding,
  content: PdfDocumentContent,
  title: string
): Promise<void> {
  sectionTitle(doc, branding, title);
  bodyText(doc, `A curated ${content.duration} journey to ${content.destination} for ${content.customerName}.`, {
    size: 11,
  });
  doc.moveDown(0.5);
  bodyText(doc, `Travel window: ${content.travelDates}`);
  bodyText(doc, `Party size: ${content.paxLabel}`);
  if (content.customerEmail) bodyText(doc, `Email: ${content.customerEmail}`);
  if (content.customerPhone) bodyText(doc, `Phone: ${content.customerPhone}`);
  doc.moveDown(0.8);
}

async function renderHighlights(
  doc: Doc,
  branding: PdfBranding,
  content: PdfDocumentContent,
  title: string
): Promise<void> {
  sectionTitle(doc, branding, title);
  bulletList(doc, branding, content.highlights);
  doc.moveDown(0.6);
}

async function renderItinerary(
  doc: Doc,
  branding: PdfBranding,
  content: PdfDocumentContent,
  title: string
): Promise<void> {
  sectionTitle(doc, branding, title);
  const [pr, pg, pb] = hexToRgb(branding.primaryColor);
  const [sr, sg, sb] = hexToRgb(branding.secondaryColor);

  if (!content.days.length) {
    bodyText(doc, "Itinerary details will be shared shortly.", { color: "#9ca3af" });
    return;
  }

  for (const day of content.days) {
    const cardH = 56 + day.items.length * 36;
    ensureSpace(doc, branding, Math.min(cardH, 160));

    const startY = doc.y;
    doc.roundedRect(MARGIN, startY, contentWidth(doc), 28, 4).fill([pr, pg, pb]);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(11);
    doc.text(`Day ${day.dayNumber}  ·  ${day.title}`, MARGIN + 12, startY + 8, {
      width: contentWidth(doc) - 24,
    });
    doc.y = startY + 36;

    if (!day.items.length) {
      bodyText(doc, "Free day / details to be confirmed.", { color: "#9ca3af", size: 9 });
      doc.moveDown(0.5);
      continue;
    }

    for (const item of day.items) {
      ensureSpace(doc, branding, 42);
      const y = doc.y;
      doc.circle(MARGIN + 8, y + 6, 3).fill([sr, sg, sb]);
      if (item !== day.items[day.items.length - 1]) {
        doc
          .moveTo(MARGIN + 8, y + 10)
          .lineTo(MARGIN + 8, y + 34)
          .strokeColor("#d1d5db")
          .lineWidth(1)
          .stroke();
      }
      const period = item.period !== "Anytime" ? `${item.period}` : "";
      const timeBit = item.time ? `${item.time}` : "";
      const meta = [period, timeBit].filter(Boolean).join(" · ");
      doc.fillColor("#6b7280").font("Helvetica").fontSize(8).text(meta || "Schedule", MARGIN + 20, y);
      doc
        .fillColor("#111827")
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(item.title, MARGIN + 20, y + 11, { width: contentWidth(doc) - 28 });
      if (item.description) {
        doc
          .fillColor("#4b5563")
          .font("Helvetica")
          .fontSize(9)
          .text(item.description, MARGIN + 20, doc.y + 2, { width: contentWidth(doc) - 28 });
      }
      doc.moveDown(0.45);
    }
    doc.moveDown(0.5);
  }
}

async function renderHotels(
  doc: Doc,
  branding: PdfBranding,
  content: PdfDocumentContent,
  title: string
): Promise<void> {
  sectionTitle(doc, branding, title);
  for (const hotel of content.hotels) {
    ensureSpace(doc, branding, 120);
    const y = doc.y;
    const imgW = 110;
    const imgH = 78;
    await drawImage(doc, hotel.image, MARGIN, y, imgW, imgH);
    const textX = MARGIN + imgW + 14;
    const textW = contentWidth(doc) - imgW - 14;
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(12).text(hotel.name, textX, y, { width: textW });
    doc
      .fillColor(branding.secondaryColor)
      .font("Helvetica")
      .fontSize(9)
      .text(`${hotel.category}${hotel.city ? ` · ${hotel.city}` : ""}${hotel.nights ? ` · ${hotel.nights} Nights` : ""}`, {
        width: textW,
      });
    doc
      .fillColor("#4b5563")
      .font("Helvetica")
      .fontSize(9)
      .text(hotel.description.slice(0, 220), { width: textW });
    if (hotel.amenities.length) {
      doc
        .fillColor("#6b7280")
        .font("Helvetica")
        .fontSize(8)
        .text(`Amenities: ${hotel.amenities.slice(0, 8).join(" · ")}`, { width: textW });
    }
    doc.y = Math.max(doc.y, y + imgH) + 14;
  }
}

async function renderActivities(
  doc: Doc,
  branding: PdfBranding,
  content: PdfDocumentContent,
  title: string
): Promise<void> {
  sectionTitle(doc, branding, title);
  if (!content.activities.length) {
    bodyText(doc, "Activities are woven into the day-wise itinerary.", { color: "#9ca3af" });
    return;
  }
  for (const activity of content.activities) {
    ensureSpace(doc, branding, 100);
    const y = doc.y;
    await drawImage(doc, activity.image, MARGIN, y, 96, 68);
    const textX = MARGIN + 110;
    const textW = contentWidth(doc) - 110;
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(11).text(activity.name, textX, y, { width: textW });
    doc.fillColor(branding.primaryColor).font("Helvetica").fontSize(9).text(`Duration: ${activity.duration}`, {
      width: textW,
    });
    if (activity.location) {
      doc.fillColor("#6b7280").font("Helvetica").fontSize(8).text(activity.location, { width: textW });
    }
    doc
      .fillColor("#4b5563")
      .font("Helvetica")
      .fontSize(9)
      .text(activity.description.slice(0, 240), { width: textW });
    doc.y = Math.max(doc.y, y + 68) + 12;
  }
}

async function renderTransfers(
  doc: Doc,
  branding: PdfBranding,
  content: PdfDocumentContent,
  title: string
): Promise<void> {
  sectionTitle(doc, branding, title);
  for (const transfer of content.transfers) {
    ensureSpace(doc, branding, 70);
    const y = doc.y;
    doc.roundedRect(MARGIN, y, contentWidth(doc), 58, 6).strokeColor("#e5e7eb").lineWidth(1).stroke();
    doc
      .fillColor("#111827")
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(transfer.name, MARGIN + 12, y + 10, { width: contentWidth(doc) - 24 });
    doc
      .fillColor("#4b5563")
      .font("Helvetica")
      .fontSize(9)
      .text(
        `Vehicle: ${transfer.vehicle}  ·  Type: ${transfer.type}\nPickup: ${transfer.pickup}  →  Drop: ${transfer.drop}${
          transfer.notes ? `\nNotes: ${transfer.notes}` : ""
        }`,
        MARGIN + 12,
        y + 26,
        { width: contentWidth(doc) - 24 }
      );
    doc.y = y + 70;
  }
}

async function renderFlights(
  doc: Doc,
  branding: PdfBranding,
  content: PdfDocumentContent,
  title: string
): Promise<void> {
  sectionTitle(doc, branding, title);
  if (!content.flights.length) {
    bodyText(doc, "Flight segments are not included in this proposal version.", { color: "#9ca3af" });
    return;
  }
  for (const flight of content.flights) {
    ensureSpace(doc, branding, 40);
    bodyText(doc, `${flight.airline} — ${flight.route}`, { bold: true });
    if (flight.notes) bodyText(doc, flight.notes, { size: 9, color: "#6b7280" });
    doc.moveDown(0.3);
  }
}

async function renderPricing(
  doc: Doc,
  branding: PdfBranding,
  content: PdfDocumentContent,
  title: string
): Promise<void> {
  sectionTitle(doc, branding, title);
  ensureSpace(doc, branding, 40 + content.pricing.rows.length * 24);
  const [pr, pg, pb] = hexToRgb(branding.primaryColor);
  const tableX = MARGIN;
  const tableW = contentWidth(doc);
  const labelW = tableW * 0.65;
  const valueW = tableW * 0.35;

  // Header
  const hy = doc.y;
  doc.rect(tableX, hy, tableW, 22).fill([pr, pg, pb]);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(10);
  doc.text("Description", tableX + 10, hy + 6, { width: labelW - 12 });
  doc.text("Amount", tableX + labelW, hy + 6, { width: valueW - 10, align: "right" });
  doc.y = hy + 26;

  for (const row of content.pricing.rows) {
    ensureSpace(doc, branding, 24);
    const y = doc.y;
    if (row.emphasis) {
      doc.rect(tableX, y - 2, tableW, 22).fill("#f0f9ff");
      doc.fillColor(branding.primaryColor).font("Helvetica-Bold").fontSize(11);
    } else {
      doc.fillColor("#374151").font("Helvetica").fontSize(10);
    }
    doc.text(row.label, tableX + 10, y + 2, { width: labelW - 12 });
    doc.text(money(row.amount, content.pricing.currency), tableX + labelW, y + 2, {
      width: valueW - 10,
      align: "right",
    });
    doc
      .moveTo(tableX, y + 20)
      .lineTo(tableX + tableW, y + 20)
      .strokeColor("#e5e7eb")
      .lineWidth(0.4)
      .stroke();
    doc.y = y + 22;
  }
  doc.moveDown(0.8);
}

async function renderTextBlock(
  doc: Doc,
  branding: PdfBranding,
  title: string,
  text: string
): Promise<void> {
  sectionTitle(doc, branding, title);
  bodyText(doc, text || "—");
  doc.moveDown(0.6);
}

async function renderListSection(
  doc: Doc,
  branding: PdfBranding,
  title: string,
  items: string[]
): Promise<void> {
  sectionTitle(doc, branding, title);
  bulletList(doc, branding, items);
  doc.moveDown(0.6);
}

async function renderVisa(
  doc: Doc,
  branding: PdfBranding,
  content: PdfDocumentContent,
  title: string
): Promise<void> {
  sectionTitle(doc, branding, title);
  bodyText(doc, content.visaRequired ? "Visa required for this destination." : "Visa may not be required — please verify.", {
    bold: true,
  });
  doc.moveDown(0.3);
  bodyText(doc, content.visaDetails);
  doc.moveDown(0.6);
}

async function renderContact(
  doc: Doc,
  branding: PdfBranding,
  content: PdfDocumentContent,
  title: string
): Promise<void> {
  sectionTitle(doc, branding, title);
  bodyText(doc, branding.agencyName, { bold: true, size: 12 });
  if (branding.agencyPhone || content.contact.phone) {
    bodyText(doc, `Phone: ${branding.agencyPhone || content.contact.phone}`);
  }
  if (branding.agencyEmail || content.contact.email) {
    bodyText(doc, `Email: ${branding.agencyEmail || content.contact.email}`);
  }
  if (branding.agencyAddress) bodyText(doc, branding.agencyAddress);
  bodyText(doc, `${content.contact.name} · ${content.contact.designation}`, { size: 9, color: "#6b7280" });
  doc.moveDown(0.6);
}

async function renderCustomHtml(
  doc: Doc,
  branding: PdfBranding,
  content: PdfDocumentContent,
  title: string
): Promise<void> {
  sectionTitle(doc, branding, title);
  // Strip tags — PDFKit is not an HTML engine; render plain text gracefully
  const plain = (content.customHtml || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  bodyText(doc, plain || "Additional information.");
  doc.moveDown(0.6);
}

const SECTION_TITLES: Record<string, string> = {
  COVER: "Cover",
  OVERVIEW: "Overview",
  DESTINATION_HIGHLIGHTS: "Destination Highlights",
  ITINERARY: "Day-wise Itinerary",
  HOTELS: "Hotels",
  ACTIVITIES: "Activities",
  FLIGHTS: "Flights",
  TRANSFERS: "Transfers",
  PRICING: "Pricing Summary",
  INCLUSIONS: "Inclusions",
  EXCLUSIONS: "Exclusions",
  VISA: "Visa Information",
  TERMS: "Terms & Conditions",
  CANCELLATION: "Cancellation Policy",
  NOTES: "Important Notes",
  CONTACT: "Contact Information",
  CUSTOM_HTML: "Additional Information",
};

async function renderSection(
  doc: Doc,
  branding: PdfBranding,
  content: PdfDocumentContent,
  section: PdfTemplateSection
): Promise<void> {
  const title = section.customTitle || SECTION_TITLES[section.sectionType] || section.sectionType;

  switch (section.sectionType) {
    case "COVER":
      // Cover is rendered as its own page before the loop for first cover;
      // subsequent COVERs are skipped.
      break;
    case "OVERVIEW":
      await renderOverview(doc, branding, content, title);
      break;
    case "DESTINATION_HIGHLIGHTS":
      await renderHighlights(doc, branding, content, title);
      break;
    case "ITINERARY":
      await renderItinerary(doc, branding, content, title);
      break;
    case "HOTELS":
      await renderHotels(doc, branding, content, title);
      break;
    case "ACTIVITIES":
      await renderActivities(doc, branding, content, title);
      break;
    case "FLIGHTS":
      await renderFlights(doc, branding, content, title);
      break;
    case "TRANSFERS":
      await renderTransfers(doc, branding, content, title);
      break;
    case "PRICING":
      await renderPricing(doc, branding, content, title);
      break;
    case "INCLUSIONS":
      await renderListSection(doc, branding, title, content.inclusions);
      break;
    case "EXCLUSIONS":
      await renderListSection(doc, branding, title, content.exclusions);
      break;
    case "VISA":
      await renderVisa(doc, branding, content, title);
      break;
    case "TERMS":
      await renderTextBlock(doc, branding, title, content.termsText);
      break;
    case "CANCELLATION":
      await renderTextBlock(doc, branding, title, content.cancellationText);
      break;
    case "NOTES":
      await renderTextBlock(doc, branding, title, content.notes);
      break;
    case "CONTACT":
      await renderContact(doc, branding, content, title);
      break;
    case "CUSTOM_HTML":
      await renderCustomHtml(doc, branding, content, title);
      break;
    default:
      // Unknown section — never crash
      sectionTitle(doc, branding, title);
      bodyText(doc, "This section could not be rendered.", { color: "#9ca3af" });
  }
}

/**
 * Core PDFKit renderer — programmatic multi-page PDF (not HTML/print).
 */
export async function renderProposalPdf(opts: {
  branding: PdfBranding;
  template: PdfTemplateMeta;
  content: PdfDocumentContent;
  fileName: string;
}): Promise<PdfRenderResult> {
  const { branding, template, content, fileName } = opts;
  const size = pageSize(template);

  const doc = new PDFDocument({
    size,
    margins: { top: MARGIN + HEADER_H, bottom: FOOTER_H + 8, left: MARGIN, right: MARGIN },
    info: {
      Title: `${content.proposalNumber} — ${content.proposalTitle}`,
      Author: branding.agencyName,
      Subject: "Travel Proposal",
      Creator: "Trevio Proposal Rendering Engine",
    },
    autoFirstPage: true,
    bufferPages: true,
  });

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const sections = template.sections;
  const hasCover = sections.some((s) => s.sectionType === "COVER");

  if (hasCover) {
    // Cover uses full bleed — temporarily ignore standard margins by drawing freely
    await renderCover(doc, branding, content);
  }

  const bodySections = sections.filter((s) => s.sectionType !== "COVER");
  if (bodySections.length) {
    if (hasCover) {
      doc.addPage();
    }
    drawHeader(doc, branding);
    doc.y = MARGIN + HEADER_H + 10;

    // Optional watermark text
    if (branding.watermark) {
      doc.save();
      doc
        .fillColor("#111827")
        .opacity(0.04)
        .font("Helvetica-Bold")
        .fontSize(48)
        .rotate(-30, { origin: [doc.page.width / 2, doc.page.height / 2] })
        .text(branding.watermark, doc.page.width / 2 - 160, doc.page.height / 2, {
          width: 320,
          align: "center",
          lineBreak: false,
        });
      doc.restore();
    }

    for (const section of bodySections) {
      try {
        await renderSection(doc, branding, content, section);
      } catch {
        sectionTitle(doc, branding, section.customTitle || section.sectionType);
        bodyText(doc, "This section could not be rendered completely.", { color: "#9ca3af" });
      }
    }
  }

  // Stamp headers/footers on all pages (skip cover footer style lightly)
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const isCover = hasCover && i === 0;
    if (!isCover) {
      drawHeader(doc, branding);
      drawFooter(doc, branding, i + 1, range.count);
    } else if (branding.showPageNumbers) {
      // subtle page mark on cover
      doc.fillColor("#ffffff").font("Helvetica").fontSize(8).opacity(0.8);
      doc.text(`1 / ${range.count}`, MARGIN, doc.page.height - 28, {
        width: contentWidth(doc),
        align: "right",
      });
      doc.opacity(1);
    }
  }

  doc.end();
  const buffer = await done;

  return {
    buffer,
    pageCount: range.count,
    fileName,
  };
}
