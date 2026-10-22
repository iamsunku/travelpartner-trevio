import PDFDocument from "pdfkit";
import { loadImageBuffer } from "../proposal-pdf/images.js";
import { pdfMoney, pdfSafeText } from "../pdf-text.js";
import { pickUnusedDestinationImage } from "./destination-images.js";
import type { QuotationPdfModel, QuotationPdfPackage } from "./model.js";

/* ── Page geometry ─────────────────────────────────────────────── */
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 44;
const HEADER_H = 34;
const FOOTER_H = 40;
const CONTENT_TOP = MARGIN + HEADER_H;
const CONTENT_BOTTOM = FOOTER_H + 18;

/* ── Brand palette (aligned with Trevio Global UI) ─────────────── */
const NAVY = "#0B1220";
const INK = "#1A2332";
const MUTED = "#5B6575";
const RULE = "#D8DDE6";
const SOFT = "#F4F1EB";
const IVORY = "#FBF9F6";
const TEAL = "#2A9D8F";
const WHITE = "#FFFFFF";

const FONT_REG = "Helvetica";
const FONT_BOLD = "Helvetica-Bold";
const DISPLAY = "Times-Bold";
const DISPLAY_REG = "Times-Roman";

type Doc = PDFKit.PDFDocument;

type Layout = {
  doc: Doc;
  model: QuotationPdfModel;
  pageCount: number;
  contentPageNo: number;
  /** Pages that should receive header/footer/page numbers (1-based PDF page index). */
  contentPages: Set<number>;
};

function money(amount: number, currency: string): string {
  return pdfMoney(amount, currency);
}

function contentWidth(): number {
  return PAGE_W - MARGIN * 2;
}

function contentRight(): number {
  return PAGE_W - MARGIN;
}

function remainingSpace(doc: Doc): number {
  return PAGE_H - CONTENT_BOTTOM - doc.y;
}

function measure(doc: Doc, text: string, width: number, fontSize: number, font = FONT_REG): number {
  doc.font(font).fontSize(fontSize);
  return doc.heightOfString(pdfSafeText(text), { width });
}

function meaningfulDescription(text?: string | null): string | undefined {
  const t = String(text || "").trim();
  if (t.length < 40) return undefined;
  return t;
}

/** Always pin the flow cursor to the left content margin after absolute draws. */
function resetFlow(doc: Doc, y?: number) {
  doc.x = MARGIN;
  if (y != null) doc.y = y;
}

/**
 * Flowing text that is guaranteed to start at the left margin and never
 * request a width that extends past the printable right edge.
 */
function flowText(
  doc: Doc,
  text: string,
  opts: {
    font?: string;
    size?: number;
    color?: string;
    x?: number;
    width?: number;
    align?: "left" | "center" | "right" | "justify";
    lineGap?: number;
    characterSpacing?: number;
  } = {},
) {
  // Leave a 4pt safety inset so PDFKit margin math / characterSpacing cannot clip.
  const x = opts.x ?? MARGIN;
  const maxW = contentRight() - x - 4;
  const width = Math.min(opts.width ?? maxW, maxW);
  resetFlow(doc);
  doc.fillColor(opts.color || INK)
    .font(opts.font || FONT_REG)
    .fontSize(opts.size ?? 9.5)
    .text(pdfSafeText(text), x, doc.y, {
      width: Math.max(40, width),
      align: opts.align,
      lineGap: opts.lineGap,
      characterSpacing: opts.characterSpacing,
    });
  resetFlow(doc);
}

function isUsableEmail(value?: string | null): boolean {
  const s = String(value || "").trim();
  if (!s) return false;
  if (/not[-_]?an[-_]?email/i.test(s)) return false;
  if (/^(n\/?a|none|null|undefined|test|example|placeholder)$/i.test(s)) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return false;
  if (/@(example\.|test\.|invalid$)/i.test(s)) return false;
  return true;
}

function isUsablePhone(value?: string | null): boolean {
  const s = String(value || "").trim();
  if (!s) return false;
  if (/not[-_]?a[-_]?phone|placeholder|\bn\/?a\b|^null$|^undefined$/i.test(s)) return false;
  const digits = s.replace(/\D/g, "");
  return digits.length >= 8;
}

function isUsableContactLine(value?: string | null): boolean {
  const s = String(value || "").trim();
  if (!s) return false;
  // Word-bound placeholder tokens only — avoid matching substrings like "na" inside "Ananya".
  if (/not[-_]?an[-_]?email|placeholder|\bn\/?a\b|^null$|^undefined$/i.test(s)) return false;
  return true;
}

/** Grouped authorized contacts for the investment summary (source fields only). */
export function authorizedContactGroups(model: QuotationPdfModel): Array<{ heading: string; lines: string[] }> {
  const groups: Array<{ heading: string; lines: string[] }> = [];
  if (model.validTill) {
    groups.push({ heading: "Validity", lines: [`Valid until ${model.validTill}`] });
  }
  const customer: string[] = [];
  if (model.customerName) customer.push(model.customerName);
  if (isUsableEmail(model.contactEmail)) customer.push(model.contactEmail!);
  if (isUsablePhone(model.contactPhone)) customer.push(model.contactPhone!);
  if (customer.length) groups.push({ heading: "Customer", lines: customer });

  const partner: string[] = [];
  if (isUsablePhone(model.branding.phone)) partner.push(model.branding.phone!);
  if (isUsableEmail(model.branding.email)) partner.push(model.branding.email!);
  if (partner.length) groups.push({ heading: "Partner desk", lines: partner });

  if (isUsableContactLine(model.salesContact)) {
    groups.push({ heading: "Sales", lines: [String(model.salesContact)] });
  }
  if (model.agentName) {
    groups.push({ heading: "Advisor", lines: [model.agentName] });
  }
  return groups;
}

/** Flat contact lines — for tests and any callers that need a simple list. */
export function authorizedContactLines(model: QuotationPdfModel): string[] {
  return authorizedContactGroups(model).flatMap((g) =>
    g.lines.map((line, i) => (i === 0 ? `${g.heading}: ${line}` : `  ${line}`)),
  );
}

/**
 * Commercial rows for presentation only — amounts come from the PDF model.
 * Service totals are informational and must never be added again to packageBase/finalPrice.
 */
export function commercialDisplayRows(
  pkg: QuotationPdfPackage,
  adults: number,
): Array<{ label: string; value: string; emphasize?: boolean; muted?: boolean; component?: boolean }> {
  const currency = pkg.pricing.currency;
  const rows: Array<{ label: string; value: string; emphasize?: boolean; muted?: boolean; component?: boolean }> = [];
  for (const row of pkg.serviceTotals) {
    let label = `${row.label} (informational)`;
    if (row.label === "Hotels" && row.basis === "room_night_extended" && row.detail) {
      label = `Hotels · ${row.detail}`;
    } else if (row.label === "Hotels" && row.basis === "lump_selling") {
      label = "Hotels (stay total)";
    } else if (row.label === "Hotels" && row.basis === "unextended_unit") {
      label = "Hotels (unit sell — nights/rooms incomplete)";
    }
    rows.push({
      label,
      value: money(row.amount, currency),
      muted: true,
      component: true,
    });
  }
  rows.push({
    label: "Package total (before tax)",
    value: money(pkg.pricing.packageBase, currency),
  });
  if (pkg.pricing.perAdultPrice > 0) {
    const paxHint = adults > 0 ? ` · ${adults} adult${adults === 1 ? "" : "s"}` : "";
    rows.push({
      label: `Per adult share${paxHint}`,
      value: money(pkg.pricing.perAdultPrice, currency),
      muted: true,
    });
  }
  if (pkg.pricing.perChildPrice > 0) {
    rows.push({
      label: "Per child share",
      value: money(pkg.pricing.perChildPrice, currency),
      muted: true,
    });
  }
  if (pkg.pricing.taxConfigured && pkg.pricing.taxAmount != null) {
    rows.push({
      label: `Taxes / service charges${pkg.pricing.taxRate != null ? ` (${pkg.pricing.taxRate}%)` : ""}`,
      value: money(pkg.pricing.taxAmount, currency),
    });
  }
  rows.push({
    label: "TOTAL PAYABLE",
    value: money(pkg.pricing.finalPrice || pkg.pricing.packageBase, currency),
    emphasize: true,
  });
  return rows;
}

/* ── Image helpers ─────────────────────────────────────────────── */

async function drawImage(
  doc: Doc,
  src: string | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  mode: "fit" | "cover" = "cover",
): Promise<boolean> {
  if (!src) return false;
  const buf = await loadImageBuffer(src);
  if (!buf) return false;
  try {
    doc.save();
    doc.rect(x, y, w, h).clip();
    if (mode === "cover") {
      doc.image(buf, x, y, { cover: [w, h], align: "center", valign: "center" });
    } else {
      doc.image(buf, x, y, { fit: [w, h], align: "center", valign: "center" });
    }
    doc.restore();
    doc.x = MARGIN;
    doc.y = y + h;
    return true;
  } catch {
    try { doc.restore(); } catch { /* ignore */ }
    return false;
  }
}

function softImagePlaceholder(doc: Doc, x: number, y: number, w: number, h: number, label = "") {
  doc.save();
  doc.rect(x, y, w, h).fill(SOFT);
  if (label) {
    doc.fillColor(MUTED).font(FONT_REG).fontSize(9)
      .text(pdfSafeText(label), x + 8, y + h / 2 - 6, { width: w - 16, align: "center" });
  }
  doc.restore();
  doc.x = MARGIN;
  doc.y = y + h;
}

async function drawImageOrSoft(
  doc: Doc,
  src: string | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  fallbacks: Array<string | undefined> = [],
  placeholderLabel = "",
): Promise<boolean> {
  const candidates = [src, ...fallbacks].filter(Boolean) as string[];
  for (const candidate of candidates) {
    const ok = await drawImage(doc, candidate, x, y, w, h, "cover");
    if (ok) return true;
  }
  softImagePlaceholder(doc, x, y, w, h, placeholderLabel);
  return false;
}

/* ── Layout / pagination ───────────────────────────────────────── */

function drawHeaderFooter(layout: Layout, pageIndex: number) {
  if (!layout.contentPages.has(pageIndex)) return;
  const { doc, model } = layout;
  const prevBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  const savedY = doc.y;
  const savedX = doc.x;

  // Header: document company brand (Trevio Global) — not the travel-agency trading name.
  doc.save();
  doc.rect(0, 0, PAGE_W, HEADER_H + 10).fill(IVORY);
  doc.moveTo(MARGIN, HEADER_H + 8).lineTo(PAGE_W - MARGIN, HEADER_H + 8)
    .strokeColor(RULE).lineWidth(0.7).stroke();
  doc.fillColor(NAVY).font(FONT_BOLD).fontSize(8)
    .text(pdfSafeText(model.branding.brandName || "Trevio Global").toUpperCase(), MARGIN, 14, {
      width: contentWidth() * 0.45,
      lineBreak: false,
    });
  doc.fillColor(MUTED).font(FONT_REG).fontSize(8)
    .text(pdfSafeText(model.quoteNo), MARGIN, 14, {
      width: contentWidth(),
      align: "right",
      lineBreak: false,
    });
  doc.restore();

  // Footer
  const pageLabel = String(layout.contentPageNo).padStart(2, "0");
  doc.save();
  doc.moveTo(MARGIN, PAGE_H - FOOTER_H).lineTo(PAGE_W - MARGIN, PAGE_H - FOOTER_H)
    .strokeColor(RULE).lineWidth(0.6).stroke();
  doc.fillColor(MUTED).font(FONT_REG).fontSize(8)
    .text(pdfSafeText(model.destination), MARGIN, PAGE_H - FOOTER_H + 12, {
      width: contentWidth() * 0.55,
      lineBreak: false,
    });
  doc.fillColor(NAVY).font(FONT_BOLD).fontSize(9)
    .text(pageLabel, MARGIN, PAGE_H - FOOTER_H + 11, {
      width: contentWidth(),
      align: "right",
      lineBreak: false,
    });
  doc.restore();

  doc.x = savedX;
  doc.y = savedY;
  doc.page.margins.bottom = prevBottom;
}

function markContentPage(layout: Layout) {
  layout.contentPageNo += 1;
  layout.contentPages.add(layout.pageCount);
  drawHeaderFooter(layout, layout.pageCount);
}

function addContentPage(layout: Layout) {
  layout.doc.addPage();
  layout.pageCount += 1;
  layout.doc.x = MARGIN;
  layout.doc.y = CONTENT_TOP;
  markContentPage(layout);
}

function ensureSpace(layout: Layout, needed: number) {
  if (remainingSpace(layout.doc) < needed) {
    addContentPage(layout);
  }
}

function sectionHeading(layout: Layout, title: string, subtitle?: string) {
  const { doc, model } = layout;
  const blockH = subtitle ? 42 : 30;
  ensureSpace(layout, blockH + 8);
  doc.x = MARGIN;
  doc.fillColor(TEAL).font(FONT_BOLD).fontSize(8)
    .text(pdfSafeText(model.branding.brandName || "Trevio Global").toUpperCase(), MARGIN, doc.y, {
      width: contentWidth(),
      characterSpacing: 1.4,
    });
  doc.moveDown(0.15);
  doc.fillColor(NAVY).font(DISPLAY).fontSize(22)
    .text(pdfSafeText(title), MARGIN, doc.y, { width: contentWidth() });
  if (subtitle) {
    doc.moveDown(0.15);
    doc.fillColor(MUTED).font(FONT_REG).fontSize(9)
      .text(pdfSafeText(subtitle), { width: contentWidth() });
  }
  doc.moveDown(0.45);
  doc.save();
  doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + 48, doc.y).strokeColor(TEAL).lineWidth(2).stroke();
  doc.restore();
  doc.moveDown(0.55);
}

function dayActivityLines(day: QuotationPdfPackage["itinerary"][number]): string[] {
  const lines: string[] = [];
  for (const place of day.places || []) {
    if (place?.name) {
      const extra = [place.famousFor, place.description].filter(Boolean).join(" — ");
      lines.push(extra ? `${place.name} — ${extra}` : place.name);
    }
  }
  for (const item of day.items || []) {
    const type = String(item.itemType || "").toUpperCase();
    if (type === "HOTEL" || type === "ACCOMMODATION") continue;
    const parts = [item.activityName, item.description].filter(Boolean);
    if (item.pickupTime) parts.push(`Pickup ${item.pickupTime}`);
    const text = parts.join(" — ");
    if (text) {
      if (type === "TRANSFER") lines.push(`Transfer: ${text}`);
      else if (type === "MEAL") lines.push(`Meal: ${text}`);
      else lines.push(text);
    }
  }
  return lines;
}

/**
 * Itinerary images must NOT default to hotel bedrooms.
 * Prefer day/activity/place imagery; rotate unused destination photos.
 * Leisure days skip the cover hero (often the same landmark repeated).
 */
function dayImage(
  day: QuotationPdfPackage["itinerary"][number],
  pkg: QuotationPdfPackage,
  model: QuotationPdfModel,
  dayIndex: number,
  usedDestImages: Set<string>,
  isLeisureDay = false,
): string | undefined {
  const hotelUrls = new Set(
    pkg.hotels.map((h) => String(h.imageUrl || "").trim()).filter(Boolean),
  );
  const isHotelPhoto = (url?: string) => Boolean(url && hotelUrls.has(String(url).trim()));
  const coverHero = String(model.coverImage || model.destinationImages[0] || "").trim();

  if (day.coverImage && !isHotelPhoto(day.coverImage) && !(isLeisureDay && day.coverImage === coverHero)) {
    usedDestImages.add(day.coverImage);
    return day.coverImage;
  }

  const placeImg = day.places?.find((p) => p.imageUrl && !isHotelPhoto(p.imageUrl))?.imageUrl;
  if (placeImg) {
    usedDestImages.add(placeImg);
    return placeImg;
  }

  const dayDate = String(day.date || "").trim();
  const dayCity = String(day.city || "").trim().toLowerCase();
  const matchedActivity = pkg.activities.find((a) => {
    if (!a.imageUrl || isHotelPhoto(a.imageUrl)) return false;
    if (dayDate && a.date && String(a.date) === dayDate) return true;
    if (dayCity && a.city && String(a.city).toLowerCase() === dayCity) return true;
    return false;
  });
  if (matchedActivity?.imageUrl) {
    usedDestImages.add(matchedActivity.imageUrl);
    return matchedActivity.imageUrl;
  }

  // Prefer variety: start further into the pool for leisure / later days; avoid cover hero first.
  const pool = (model.destinationImages || []).filter((u) => !isLeisureDay || u !== coverHero);
  const start = isLeisureDay ? Math.max(1, dayIndex + 1) : dayIndex;
  return pickUnusedDestinationImage(pool.length ? pool : model.destinationImages || [], usedDestImages, start);
}

function isReturnFlight(f: QuotationPdfPackage["flights"][number], index: number, all: QuotationPdfPackage["flights"]): boolean {
  const dir = String(f.direction || f.tripType || "").toLowerCase();
  if (dir.includes("return") || dir.includes("inbound")) return true;
  if (dir.includes("outbound") || dir.includes("one_way") || dir.includes("one-way")) return false;
  if (all.length >= 2 && index === all.length - 1) {
    const first = all[0];
    if (first.from && first.to && f.from && f.to && first.from === f.to && first.to === f.from) return true;
  }
  return false;
}

/* ── Cover ─────────────────────────────────────────────────────── */

async function renderCover(layout: Layout) {
  const { doc, model } = layout;
  const prevBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  const fallbacks = [
    model.coverImage,
    ...model.destinationImages,
    model.closingImage,
    model.packages[0]?.activities.find((a) => a.imageUrl)?.imageUrl,
  ];
  let drawn = false;
  for (const src of fallbacks) {
    if (!src) continue;
    drawn = await drawImage(doc, src, 0, 0, PAGE_W, PAGE_H, "cover");
    if (drawn) break;
  }
  if (!drawn) doc.rect(0, 0, PAGE_W, PAGE_H).fill(NAVY);
  else {
    doc.rect(0, 0, PAGE_W, PAGE_H).fillOpacity(0.42).fill(NAVY).fillOpacity(1);
    doc.rect(0, PAGE_H * 0.55, PAGE_W, PAGE_H * 0.45).fillOpacity(0.35).fill("#000000").fillOpacity(1);
  }

  // Brand mark
  let logoDrawn = false;
  if (model.branding.logo) {
    logoDrawn = await drawImage(doc, model.branding.logo, MARGIN, 36, 120, 40, "fit");
  }
  if (!logoDrawn) {
    doc.fillColor(WHITE).font(FONT_BOLD).fontSize(11)
      .text(pdfSafeText(model.branding.brandName || "Trevio Global").toUpperCase(), MARGIN, 42, {
        characterSpacing: 2,
        lineBreak: false,
      });
  }

  doc.fillColor(TEAL).font(FONT_BOLD).fontSize(9)
    .text("TRAVEL PROPOSAL", MARGIN, 96, { characterSpacing: 2.2, lineBreak: false });

  doc.fillColor(WHITE).font(DISPLAY).fontSize(36)
    .text(pdfSafeText(model.destinationName), MARGIN, 118, {
      width: contentWidth(),
    });
  if (model.country) {
    doc.fillColor(WHITE).fillOpacity(0.85).font(FONT_REG).fontSize(12)
      .text(pdfSafeText(model.country), MARGIN, doc.y + 4, { width: contentWidth() });
    doc.fillOpacity(1);
  }

  // Meta card
  const cardY = PAGE_H - 210;
  doc.save();
  doc.roundedRect(MARGIN, cardY, contentWidth(), 150, 8).fillOpacity(0.88).fill(WHITE).fillOpacity(1);
  doc.restore();

  const meta: Array<[string, string]> = [];
  if (model.customerName) meta.push(["Prepared for", model.customerName]);
  meta.push(["Quotation", model.quoteNo]);
  if (model.validTill) meta.push(["Valid until", model.validTill]);
  meta.push(["Travel", model.travelDatesShort || model.travelDates]);
  if (model.nightsLabel) meta.push(["Duration", model.nightsLabel]);
  meta.push(["Travellers", model.paxSummary]);

  let my = cardY + 16;
  const colW = (contentWidth() - 16) / 2;
  for (let i = 0; i < meta.length; i += 1) {
    const [label, value] = meta[i];
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + 12 + col * colW;
    const y = my + row * 42;
    doc.fillColor(MUTED).font(FONT_BOLD).fontSize(7)
      .text(label.toUpperCase(), x, y, { width: colW - 10, characterSpacing: 0.8 });
    doc.fillColor(NAVY).font(FONT_BOLD).fontSize(10)
      .text(pdfSafeText(value), x, y + 12, { width: colW - 10 });
  }

  doc.fillColor(MUTED).font(FONT_REG).fontSize(8)
    .text(`Prepared by ${pdfSafeText(model.agentName)}`, MARGIN, PAGE_H - 36, {
      width: contentWidth(),
      align: "center",
      lineBreak: false,
    });

  doc.page.margins.bottom = prevBottom;
  doc.y = CONTENT_TOP;
}

/* ── Trip overview + investment snapshot ───────────────────────── */

async function renderOverview(layout: Layout, pkg: QuotationPdfPackage) {
  const { doc, model } = layout;
  addContentPage(layout);
  sectionHeading(layout, "Trip Overview", "Investment snapshot and journey essentials");

  // Compact hero — leave room for notes without fabricating filler.
  const heroH = 128;
  ensureSpace(layout, heroH + 16);
  const heroY = doc.y;
  await drawImageOrSoft(
    doc,
    model.destinationImages[0] || model.coverImage,
    MARGIN,
    heroY,
    contentWidth(),
    heroH,
    model.destinationImages.slice(1),
  );
  resetFlow(doc, heroY + heroH + 12);

  flowText(doc, pdfSafeText(model.letterDate), { font: FONT_REG, size: 9, color: INK });
  doc.moveDown(0.2);
  flowText(doc, `Dear ${pdfSafeText(model.customerName)},`, { font: FONT_BOLD, size: 11, color: INK });
  doc.moveDown(0.3);

  const destIntro = meaningfulDescription(model.destinationDescription);
  if (destIntro) {
    const short = destIntro.length > 360 ? `${destIntro.slice(0, 357)}...` : destIntro;
    ensureSpace(layout, measure(doc, short, contentWidth(), 9.5) + 10);
    doc.font(FONT_REG).fontSize(9.5).fillColor(MUTED)
      .text(pdfSafeText(short), { width: contentWidth(), align: "justify", lineGap: 1.4 });
    doc.moveDown(0.4);
  }

  // Summary + pricing cards side by side when space allows
  const total = pkg.pricing.finalPrice || pkg.pricing.packageBase;
  const currency = pkg.pricing.currency;
  const summaryRows: Array<[string, string]> = [
    ["Destination", model.destination],
    ["Travel dates", model.travelDatesShort || model.travelDates],
    ["Travellers", model.paxSummary],
  ];
  if (pkg.name) summaryRows.push(["Package", pkg.name]);
  if (model.hotelSummary) summaryRows.push(["Hotel", model.hotelSummary]);
  const primaryHotel = pkg.hotels[0];
  if (primaryHotel?.roomType) summaryRows.push(["Room", primaryHotel.roomType]);
  if (primaryHotel?.mealPlan) summaryRows.push(["Meal plan", primaryHotel.mealPlan]);
  if (model.landCostPerPerson != null) {
    summaryRows.push(["Land / person", money(model.landCostPerPerson, currency)]);
  }
  if (model.flightCostPerPerson != null) {
    summaryRows.push(["Flight / person", money(model.flightCostPerPerson, currency)]);
  }

  const leftW = contentWidth() * 0.58;
  const rightW = contentWidth() - leftW - 14;
  const rowH = 22;
  const tableH = summaryRows.length * rowH + 8;
  const priceCardH = 118;
  const blockH = Math.max(tableH, priceCardH);
  ensureSpace(layout, blockH + 16);

  const startY = doc.y;
  let y = startY;
  for (const [label, value] of summaryRows) {
    doc.fillColor(MUTED).font(FONT_REG).fontSize(8)
      .text(label.toUpperCase(), MARGIN, y + 5, { width: 88, lineBreak: false });
    doc.fillColor(INK).font(FONT_BOLD).fontSize(9)
      .text(pdfSafeText(value), MARGIN + 92, y + 4, { width: leftW - 96 });
    y += rowH;
    doc.save();
    doc.moveTo(MARGIN, y - 2).lineTo(MARGIN + leftW, y - 2).strokeColor(RULE).lineWidth(0.5).stroke();
    doc.restore();
  }

  // Price card
  const px = MARGIN + leftW + 14;
  doc.save();
  doc.roundedRect(px, startY, rightW, priceCardH, 8).fill(NAVY);
  doc.restore();
  doc.fillColor(TEAL).font(FONT_BOLD).fontSize(7)
    .text("TOTAL PACKAGE", px + 12, startY + 14, { width: rightW - 24, characterSpacing: 1 });
  doc.fillColor(WHITE).font(DISPLAY).fontSize(18)
    .text(money(total, currency), px + 12, startY + 32, { width: rightW - 24 });
  let py = startY + 62;
  if (pkg.pricing.perAdultPrice > 0) {
    doc.fillColor(WHITE).fillOpacity(0.8).font(FONT_REG).fontSize(8)
      .text(`Per adult  ${money(pkg.pricing.perAdultPrice, currency)}`, px + 12, py, { width: rightW - 24 });
    doc.fillOpacity(1);
    py += 14;
  }
  if (pkg.pricing.perChildPrice > 0) {
    doc.fillColor(WHITE).fillOpacity(0.8).font(FONT_REG).fontSize(8)
      .text(`Per child  ${money(pkg.pricing.perChildPrice, currency)}`, px + 12, py, { width: rightW - 24 });
    doc.fillOpacity(1);
    py += 14;
  }
  if (pkg.pricing.taxConfigured && pkg.pricing.taxAmount != null) {
    doc.fillColor(WHITE).fillOpacity(0.7).font(FONT_REG).fontSize(8)
      .text(
        `Tax${pkg.pricing.taxRate != null ? ` (${pkg.pricing.taxRate}%)` : ""}  ${money(pkg.pricing.taxAmount, currency)}`,
        px + 12,
        py,
        { width: rightW - 24 },
      );
    doc.fillOpacity(1);
  }

  // Critical: absolute price-card draws leave doc.x near the right edge.
  resetFlow(doc, startY + blockH + 16);

  if (model.overviewNotes.length) {
    const noteWidth = contentWidth() - 40;
    let notesBodyH = 0;
    for (const note of model.overviewNotes) {
      notesBodyH += measure(doc, `•  ${note}`, noteWidth, 9.5) + 8;
    }
    const noteCardH = 32 + notesBodyH + 14;
    ensureSpace(layout, Math.min(noteCardH + 8, remainingSpace(doc)));
    const ny = doc.y;
    doc.save();
    doc.roundedRect(MARGIN, ny, contentWidth(), noteCardH, 8).fill(IVORY);
    doc.roundedRect(MARGIN, ny, 4, noteCardH, 2).fill(TEAL);
    doc.restore();
    doc.fillColor(NAVY).font(FONT_BOLD).fontSize(8.5)
      .text("PLEASE NOTE", MARGIN + 18, ny + 12, {
        width: contentWidth() - 36,
        characterSpacing: 0.7,
        lineBreak: false,
      });
    let ty = ny + 30;
    for (const note of model.overviewNotes) {
      doc.fillColor(INK).font(FONT_REG).fontSize(9.5)
        .text(`•  ${pdfSafeText(note)}`, MARGIN + 18, ty, { width: noteWidth, lineGap: 1.8 });
      ty = doc.y + 6;
    }
    resetFlow(doc, Math.max(ny + noteCardH, ty) + 8);
  }
  resetFlow(doc);
}

/* ── Itinerary ─────────────────────────────────────────────────── */

async function renderItinerary(layout: Layout, pkg: QuotationPdfPackage) {
  if (!pkg.itinerary.length) return;
  const { doc, model } = layout;
  const usedDestImages = new Set<string>();
  // Pre-seed cover hero so leisure/fallback days avoid repeating the cover landmark.
  if (model.coverImage) usedDestImages.add(model.coverImage);
  if (model.destinationImages[0]) usedDestImages.add(model.destinationImages[0]);

  const imgW = 160;
  const gap = 14;
  const textW = contentWidth() - imgW - gap;
  const DAY_IMG_H = 100;
  const headingBudget = 56;
  const LEISURE_ROW_H = 40;
  const LEISURE_GAP = 8;
  const allLeisure = pkg.itinerary.every((d) => dayActivityLines(d).length === 0);
  // Keep heading + Day 1 (+ remaining leisure days) together — do not orphan Day 1 under overview.
  const leisureBlockH = headingBudget
    + 16
    + pkg.itinerary.length * (LEISURE_ROW_H + LEISURE_GAP)
    + 12;
  const minShared = allLeisure
    ? leisureBlockH
    : headingBudget + DAY_IMG_H + 120;
  if (remainingSpace(doc) < minShared) {
    addContentPage(layout);
  } else {
    resetFlow(doc, doc.y + 10);
    doc.save();
    doc.moveTo(MARGIN, doc.y).lineTo(contentRight(), doc.y).strokeColor(RULE).lineWidth(0.7).stroke();
    doc.restore();
    resetFlow(doc, doc.y + 14);
  }

  let headingDrawn = false;
  const drawItineraryHeading = () => {
    if (headingDrawn) return;
    sectionHeading(layout, "Itinerary", "Day-wise journey plan");
    headingDrawn = true;
  };
  drawItineraryHeading();

  // One restrained destination strip on a dedicated leisure itinerary page (helps vertical balance).
  if (allLeisure && model.destinationImages[0]) {
    const bannerH = 64;
    const daysH = pkg.itinerary.length * (LEISURE_ROW_H + LEISURE_GAP);
    if (remainingSpace(doc) >= bannerH + daysH + 48) {
      const by = doc.y;
      await drawImageOrSoft(doc, model.destinationImages[0], MARGIN, by, contentWidth(), bannerH, [], "");
      usedDestImages.add(model.destinationImages[0]);
      resetFlow(doc, by + bannerH + 14);
    }
  }

  for (let dayIndex = 0; dayIndex < pkg.itinerary.length; dayIndex += 1) {
    const day = pkg.itinerary[dayIndex];
    const lines = dayActivityLines(day);
    const isLeisureDay = lines.length === 0;
    const bodyLines = lines;
    const rawTitle = String(day.title || day.city || "Journey");
    const cleanedTitle = rawTitle.replace(/^day\s*\d+\s*[:\-—–]?\s*/i, "").trim() || rawTitle;
    const dateBit = day.date ? ` · ${day.date}` : "";
    const cityBit = day.city ? ` · ${day.city}` : "";
    const title = `Day ${day.day}${dateBit}${cityBit}`;
    // Leisure days always use a restrained status label — do not echo date/city titles as the status.
    const subtitle = isLeisureDay
      ? "At leisure"
      : (cleanedTitle || "Journey");

    // Leisure: compact row — day / status / meal — no repeated placeholder imagery or copy.
    if (isLeisureDay) {
      const leisureH = LEISURE_ROW_H;
      // Keep leisure days contiguous; if a break is forced mid-list, continue without re-heading.
      if (remainingSpace(doc) < leisureH + LEISURE_GAP) addContentPage(layout);
      const y = doc.y;
      doc.save();
      doc.roundedRect(MARGIN, y, contentWidth(), leisureH, 5).fill(IVORY);
      doc.rect(MARGIN, y, 3, leisureH).fill(TEAL);
      doc.restore();

      const left = pdfSafeText(title).toUpperCase();
      const right = day.mealPlan ? `Meal: ${pdfSafeText(day.mealPlan)}` : "";
      doc.fillColor(TEAL).font(FONT_BOLD).fontSize(8)
        .text(left, MARGIN + 12, y + 14, { width: contentWidth() * 0.48, lineBreak: false });
      doc.fillColor(NAVY).font(FONT_BOLD).fontSize(10)
        .text(pdfSafeText(subtitle), MARGIN + contentWidth() * 0.5, y + 13, {
          width: contentWidth() * 0.22,
          lineBreak: false,
        });
      if (right) {
        doc.fillColor(MUTED).font(FONT_REG).fontSize(8.5)
          .text(right, MARGIN + 12, y + 14, {
            width: contentWidth() - 24,
            align: "right",
            lineBreak: false,
          });
      }
      resetFlow(doc, y + leisureH + LEISURE_GAP);
      continue;
    }

    let textH = 26 + measure(doc, subtitle, textW, 10, FONT_BOLD) + 6;
    for (const line of bodyLines) {
      textH += measure(doc, line, textW, 9) + 3;
    }
    if (day.mealPlan) textH += 14;
    const imgH = DAY_IMG_H;
    const blockH = Math.max(imgH, textH) + 12;

    if (remainingSpace(doc) < Math.min(blockH, imgH + 36)) {
      addContentPage(layout);
    }

    const y = doc.y;
    const imgSrc = dayImage(day, pkg, model, dayIndex, usedDestImages, false);
    await drawImageOrSoft(doc, imgSrc, MARGIN, y, imgW, imgH, [], "Experience");

    const tx = MARGIN + imgW + gap;
    doc.fillColor(TEAL).font(FONT_BOLD).fontSize(8)
      .text(pdfSafeText(title).toUpperCase(), tx, y, { width: textW, characterSpacing: 0.5 });
    doc.fillColor(NAVY).font(FONT_BOLD).fontSize(11)
      .text(pdfSafeText(subtitle), tx, y + 14, { width: textW });

    let ty = y + 14 + measure(doc, subtitle, textW, 11, FONT_BOLD) + 8;
    for (const line of bodyLines) {
      const h = measure(doc, `· ${line}`, textW, 9);
      if (ty + h > PAGE_H - CONTENT_BOTTOM) {
        addContentPage(layout);
        ty = doc.y;
      }
      doc.fillColor(INK).font(FONT_REG).fontSize(9)
        .text(`· ${pdfSafeText(line)}`, tx, ty, { width: textW });
      ty = doc.y + 2;
    }
    if (day.mealPlan) {
      if (ty + 14 > PAGE_H - CONTENT_BOTTOM) {
        addContentPage(layout);
        ty = doc.y;
      }
      doc.fillColor(MUTED).font(FONT_BOLD).fontSize(8)
        .text(`Meal plan: ${pdfSafeText(day.mealPlan)}`, tx, ty + 4, { width: textW });
      ty = doc.y;
    }

    resetFlow(doc, Math.max(y + imgH, ty) + 14);
  }
}

/* ── Flights ───────────────────────────────────────────────────── */

async function renderFlights(layout: Layout, pkg: QuotationPdfPackage) {
  if (!pkg.flights.length) return;
  const { doc, model } = layout;

  ensureSpace(layout, 140);
  if (remainingSpace(doc) < 160) addContentPage(layout);
  sectionHeading(layout, "Flights", "Airline sectors for this proposal");

  for (let index = 0; index < pkg.flights.length; index += 1) {
    const flight = pkg.flights[index];
    const returning = isReturnFlight(flight, index, pkg.flights);
    const sector = pdfSafeText([flight.from, flight.to].filter(Boolean).join(" -> ") || "Sector as discussed");
    ensureSpace(layout, 96);

    const barY = doc.y;
    doc.save();
    doc.roundedRect(MARGIN, barY, contentWidth(), 22, 4).fill(SOFT);
    doc.restore();
    doc.fillColor(NAVY).font(FONT_BOLD).fontSize(9)
      .text(
        pdfSafeText(`${returning ? "RETURN" : "OUTBOUND"}  ${sector}${flight.date ? `  ·  ${flight.date}` : ""}${flight.duration ? `  ·  ${flight.duration}` : ""}`),
        MARGIN + 10,
        barY + 6,
        { width: contentWidth() - 20, lineBreak: false },
      );
    doc.y = barY + 30;

    const left = [
      flight.airline,
      flight.flightNo,
      flight.aircraft,
      flight.cabin,
      flight.baggage ? `Baggage ${flight.baggage}` : "",
    ].filter(Boolean);
    const right = [
      [flight.depTime, flight.date].filter(Boolean).join("  "),
      flight.from ? `Depart ${flight.from}` : "",
      [flight.arrTime, flight.arrivalDate || flight.date].filter(Boolean).join("  "),
      flight.to ? `Arrive ${flight.to}` : "",
      flight.stops != null ? `${flight.stops} stop${flight.stops === 1 ? "" : "s"}` : "",
    ].filter(Boolean);

    const colW = contentWidth() / 2 - 10;
    const startY = doc.y;
    let ly = startY;
    for (const line of left) {
      doc.fillColor(INK).font(FONT_REG).fontSize(9.5).text(pdfSafeText(line), MARGIN, ly, { width: colW });
      ly = doc.y + 3;
    }
    let ry = startY;
    for (const line of right) {
      doc.fillColor(NAVY).font(FONT_BOLD).fontSize(10).text(pdfSafeText(line), MARGIN + colW + 16, ry, { width: colW });
      ry = doc.y + 4;
    }
    doc.y = Math.max(ly, ry) + 12;
  }

  if (model.flightTerms) {
    ensureSpace(layout, 28);
    doc.fillColor(MUTED).font(FONT_REG).fontSize(8.5).text(pdfSafeText(model.flightTerms), { width: contentWidth() });
  }
}

/* ── Accommodation ─────────────────────────────────────────────── */

async function renderAccommodation(layout: Layout, pkg: QuotationPdfPackage) {
  if (!pkg.hotels.length) return;
  const { doc } = layout;

  const cardImgW = 188;
  const cardImgHMax = 132;
  const cardMin = 56 + 110 + 24;

  // Clear break from itinerary — prefer a fresh page when the card won't sit cleanly.
  if (remainingSpace(doc) < cardMin) {
    addContentPage(layout);
  } else {
    // Extra air after a leisure itinerary improves vertical balance without filler content.
    resetFlow(doc, doc.y + 22);
    doc.save();
    doc.moveTo(MARGIN, doc.y).lineTo(contentRight(), doc.y).strokeColor(RULE).lineWidth(0.7).stroke();
    doc.restore();
    resetFlow(doc, doc.y + 18);
  }

  let headingDrawn = false;
  const drawHotelHeading = () => {
    if (headingDrawn) return;
    sectionHeading(layout, "Accommodation", "Stay details for your journey");
    headingDrawn = true;
  };
  drawHotelHeading();

  for (let i = 0; i < pkg.hotels.length; i += 1) {
    const hotel = pkg.hotels[i];
    const details: Array<[string, string]> = [["Property", hotel.hotelName]];
    if (hotel.starCategory) details.push(["Category", `${String(hotel.starCategory).replace(/star/i, "").trim()} Star`]);
    if (hotel.address) details.push(["Address", hotel.address]);
    if (hotel.nights != null) details.push(["Duration", `${hotel.nights} Night${Number(hotel.nights) === 1 ? "" : "s"}`]);
    if (hotel.highlight) details.push(["Highlight", hotel.highlight]);
    if (hotel.roomType) details.push(["Room", hotel.roomType]);
    if (hotel.mealPlan) details.push(["Meal plan", hotel.mealPlan]);
    if (hotel.checkIn) details.push(["Check-in", hotel.checkIn]);
    if (hotel.checkOut) details.push(["Check-out", hotel.checkOut]);
    if (hotel.selfBooked) details.push(["Booking", "Self-booked by customer / agent"]);

    const detailColW = contentWidth() - cardImgW - 28;
    const TOP_PAD = 12;
    const BOTTOM_PAD = 14;
    const SIDE_PAD = 10;
    const detailsH = details.reduce((sum, [, value]) => {
      const labelH = 9;
      const valueH = measure(doc, value, detailColW, 9);
      return sum + labelH + 1 + valueH + 6;
    }, 0);
    // Fit image height to details so the card does not grow a large empty band.
    const cardImgH = Math.min(cardImgHMax, Math.max(100, detailsH));
    const cardH = Math.max(cardImgH, detailsH) + TOP_PAD + BOTTOM_PAD;
    if (remainingSpace(doc) < cardH + 16) {
      addContentPage(layout);
      // Continuations do not repeat the section title.
    }

    const y = doc.y;
    doc.save();
    doc.roundedRect(MARGIN, y, contentWidth(), cardH, 8).fill(IVORY);
    doc.restore();

    // Hotel-only imagery — never destination photos as hotel stand-ins.
    await drawImageOrSoft(
      doc,
      hotel.imageUrl,
      MARGIN + SIDE_PAD,
      y + TOP_PAD,
      cardImgW,
      cardImgH,
      [],
      "Property image",
    );

    let ty = y + TOP_PAD;
    const tx = MARGIN + cardImgW + 20;
    for (const [label, value] of details) {
      doc.fillColor(MUTED).font(FONT_BOLD).fontSize(7)
        .text(label.toUpperCase(), tx, ty, { width: detailColW, characterSpacing: 0.5 });
      ty = doc.y + 1;
      doc.fillColor(INK).font(FONT_REG).fontSize(9)
        .text(pdfSafeText(value), tx, ty, { width: detailColW });
      ty = doc.y + 6;
    }

    const contentBottom = Math.max(y + TOP_PAD + cardImgH, ty) + BOTTOM_PAD;
    resetFlow(doc, Math.max(y + cardH, contentBottom) + 20);
  }
}

/* ── Inclusions & exclusions ───────────────────────────────────── */

async function renderInclusionsExclusions(layout: Layout, pkg: QuotationPdfPackage) {
  if (!pkg.inclusions.length && !pkg.exclusions.length) return;
  const { doc } = layout;

  ensureSpace(layout, 120);
  if (remainingSpace(doc) < 140) addContentPage(layout);
  else resetFlow(doc, doc.y + 8);
  sectionHeading(layout, "Inclusions & Exclusions");

  const colGap = 24;
  const colW = (contentWidth() - colGap) / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + colW + colGap;

  const paintColumnHeads = (y: number) => {
    doc.fillColor(NAVY).font(FONT_BOLD).fontSize(11).text("INCLUSIONS", leftX, y, { width: colW });
    doc.font(FONT_BOLD).fontSize(11).text("EXCLUSIONS", rightX, y, { width: colW });
    doc.save();
    doc.moveTo(leftX, y + 16).lineTo(leftX + 72, y + 16).strokeColor(TEAL).lineWidth(1.5).stroke();
    doc.moveTo(rightX, y + 16).lineTo(rightX + 72, y + 16).strokeColor(TEAL).lineWidth(1.5).stroke();
    doc.restore();
    return y + 28;
  };

  // Flatten inclusion lines for sequential draw (keep groups together).
  type Line = { text: string; bold?: boolean; side: "L" | "R" };
  const lines: Line[] = [];
  if (pkg.inclusionGroups.length) {
    for (const group of pkg.inclusionGroups) {
      lines.push({ text: group.label.toUpperCase(), bold: true, side: "L" });
      for (const item of group.items) lines.push({ text: `+ ${item}`, side: "L" });
      lines.push({ text: " ", side: "L" });
    }
  } else {
    for (const item of pkg.inclusions) lines.push({ text: `+ ${item}`, side: "L" });
  }
  for (const item of pkg.exclusions) lines.push({ text: `- ${item}`, side: "R" });

  let ly = paintColumnHeads(doc.y);
  let ry = ly;

  for (const line of lines) {
    const x = line.side === "L" ? leftX : rightX;
    const yRef = line.side === "L" ? ly : ry;
    const h = measure(doc, line.text.trim() || " ", colW, line.bold ? 9.5 : 9) + (line.bold ? 6 : 4);
    if (yRef + h > PAGE_H - CONTENT_BOTTOM) {
      addContentPage(layout);
      ly = paintColumnHeads(doc.y);
      ry = ly;
    }
    const y = line.side === "L" ? ly : ry;
    if (line.text.trim()) {
      doc.fillColor(line.side === "R" ? MUTED : INK)
        .font(line.bold ? FONT_BOLD : FONT_REG)
        .fontSize(line.bold ? 9.5 : 9)
        .text(pdfSafeText(line.text), x, y, { width: colW });
    }
    if (line.side === "L") ly = (line.text.trim() ? doc.y : y) + (line.bold ? 6 : 4);
    else ry = (line.text.trim() ? doc.y : y) + 4;
  }

  doc.x = MARGIN;
  doc.y = Math.max(ly, ry) + 10;
}

/* ── Add-ons ───────────────────────────────────────────────────── */

function renderAddOns(layout: Layout, pkg: QuotationPdfPackage) {
  if (!pkg.addOns.length) return;
  const { doc } = layout;
  ensureSpace(layout, 60);
  if (remainingSpace(doc) < 70) addContentPage(layout);
  sectionHeading(layout, "Add-ons");

  for (const addon of pkg.addOns) {
    ensureSpace(layout, 36);
    doc.fillColor(NAVY).font(FONT_BOLD).fontSize(11).text(pdfSafeText(addon.name || "Add-on"), { width: contentWidth() });
    const meta = [
      addon.description,
      addon.date,
      addon.city,
      addon.quantity != null && addon.quantity > 1 ? `Qty ${addon.quantity}` : "",
      addon.sellingPrice != null ? money(addon.sellingPrice, addon.currency || "INR") : "",
    ].filter(Boolean).join(" · ");
    if (meta) {
      doc.font(FONT_REG).fontSize(9).fillColor(MUTED).text(pdfSafeText(meta), { width: contentWidth() });
    }
    doc.moveDown(0.4);
  }
}

/* ── Visa / Insurance ──────────────────────────────────────────── */

function renderInfoBlock(
  layout: Layout,
  title: string,
  bits: string[],
) {
  if (!bits.length) return;
  const { doc } = layout;
  ensureSpace(layout, 50);
  if (remainingSpace(doc) < 60) addContentPage(layout);
  sectionHeading(layout, title);
  for (const bit of bits) {
    ensureSpace(layout, 18);
    doc.fillColor(INK).font(FONT_REG).fontSize(9.5).text(pdfSafeText(bit), { width: contentWidth() });
    doc.moveDown(0.15);
  }
}

/* ── Commercial summary + policies ─────────────────────────────── */

function renderCommercialSummary(layout: Layout, pkg: QuotationPdfPackage) {
  const { doc, model } = layout;

  const rows = commercialDisplayRows(pkg, model.adults);

  // Keep heading + line items + TOTAL PAYABLE together — avoid orphaning the total.
  const pricingBlockH = 56 + rows.reduce((sum, row) => sum + (row.emphasize ? 52 : row.muted ? 18 : 22), 0) + 20;
  if (remainingSpace(doc) < pricingBlockH) addContentPage(layout);
  sectionHeading(layout, "Investment Summary", "Customer-facing commercial breakdown");

  const componentRows = rows.filter((r) => r.component);
  const mainRows = rows.filter((r) => !r.component);

  if (componentRows.length) {
    flowText(doc, "Included services (informational — already in package total)", {
      font: FONT_BOLD,
      size: 8,
      color: MUTED,
      characterSpacing: 0.2,
    });
    doc.moveDown(0.15);
    for (const row of componentRows) {
      ensureSpace(layout, 18);
      const y = doc.y;
      doc.fillColor(MUTED).font(FONT_REG).fontSize(9)
        .text(row.label, MARGIN, y, { width: contentWidth() * 0.6, lineBreak: false });
      doc.fillColor(MUTED).font(FONT_BOLD).fontSize(9)
        .text(row.value, MARGIN, y, { width: contentWidth(), align: "right", lineBreak: false });
      resetFlow(doc, y + 16);
    }
    resetFlow(doc, doc.y + 6);
    doc.save();
    doc.moveTo(MARGIN, doc.y).lineTo(contentRight(), doc.y).strokeColor(RULE).lineWidth(0.5).stroke();
    doc.restore();
    resetFlow(doc, doc.y + 10);
  }

  for (const row of mainRows) {
    if (!row.emphasize) ensureSpace(layout, 26);
    else if (remainingSpace(doc) < 52) {
      addContentPage(layout);
      sectionHeading(layout, "Investment Summary", "Customer-facing commercial breakdown");
    }
    const y = doc.y;
    if (row.emphasize) {
      doc.save();
      doc.roundedRect(MARGIN, y, contentWidth(), 40, 6).fill(NAVY);
      doc.restore();
      doc.fillColor(WHITE).font(FONT_BOLD).fontSize(11)
        .text(row.label, MARGIN + 12, y + 13, { width: contentWidth() * 0.45, lineBreak: false });
      doc.font(DISPLAY).fontSize(16)
        .text(row.value, MARGIN + 12, y + 10, { width: contentWidth() - 24, align: "right", lineBreak: false });
      resetFlow(doc, y + 52);
    } else {
      const color = row.muted ? MUTED : INK;
      doc.fillColor(MUTED).font(FONT_REG).fontSize(row.muted ? 9 : 10)
        .text(row.label, MARGIN, y, { width: contentWidth() * 0.6, lineBreak: false });
      doc.fillColor(color).font(FONT_BOLD).fontSize(row.muted ? 9.5 : 10.5)
        .text(row.value, MARGIN, y, { width: contentWidth(), align: "right", lineBreak: false });
      resetFlow(doc, y + (row.muted ? 18 : 22));
    }
  }

  resetFlow(doc, doc.y + 12);

  const policyBlocks: Array<[string, string]> = (
    [
      ["Payment", model.paymentTerms],
      ["Cancellation", model.cancellationPolicy],
      ["Refund", model.refundPolicy],
      ["Terms", model.termsAndConditions],
      ["Hotel terms", model.hotelTerms],
      ["Traveller notes", model.travelDisclaimer],
      ["Force majeure", model.forceMajeure],
      ["Special requests", model.specialRequests],
      ["Visa notes", model.visaNote || model.visaTerms],
      ["Insurance notes", model.insuranceNote || model.insuranceTerms],
    ] as Array<[string, string | undefined]>
  ).filter((row): row is [string, string] => Boolean(row[1]?.trim()));

  const contactGroups = authorizedContactGroups(model);
  const contactRows = Math.ceil(contactGroups.length / 2);
  const contactsBudget = contactGroups.length ? 22 + contactRows * 34 : 0;

  // Two-column policy blocks — leave room for contacts on the same page when practical.
  const colGap = 16;
  const colW = (contentWidth() - colGap) / 2;
  let col = 0;
  let rowTop = doc.y;
  let rowBottom = doc.y;

  for (const [title, body] of policyBlocks) {
    const bodyH = measure(doc, body, colW, 8.5) + 24;
    if (col === 0 && remainingSpace(doc) < bodyH + 6) {
      addContentPage(layout);
      rowTop = doc.y;
      rowBottom = doc.y;
    }
    if (col === 1 && rowTop + bodyH > PAGE_H - CONTENT_BOTTOM) {
      addContentPage(layout);
      col = 0;
      rowTop = doc.y;
      rowBottom = doc.y;
    }

    const x = col === 0 ? MARGIN : MARGIN + colW + colGap;
    const y = col === 0 ? Math.max(doc.y, rowTop) : rowTop;
    doc.fillColor(NAVY).font(FONT_BOLD).fontSize(8.5)
      .text(title.toUpperCase(), x, y, { width: colW, characterSpacing: 0.4 });
    doc.fillColor(MUTED).font(FONT_REG).fontSize(8.5)
      .text(pdfSafeText(body), x, doc.y + 2, { width: colW });
    rowBottom = Math.max(rowBottom, doc.y + 8);
    if (col === 0) {
      col = 1;
    } else {
      col = 0;
      resetFlow(doc, rowBottom + 8);
      rowTop = doc.y;
      rowBottom = doc.y;
    }
  }
  if (col === 1) resetFlow(doc, rowBottom + 10);
  else resetFlow(doc, doc.y + 4);

  if (contactGroups.length) {
    // Prefer packing contacts under policies — only break when fewer than ~2 contact rows fit.
    if (remainingSpace(doc) < Math.min(contactsBudget, 64)) {
      addContentPage(layout);
    }
    flowText(doc, "CONTACTS & VALIDITY", {
      font: FONT_BOLD,
      size: 9,
      color: NAVY,
      characterSpacing: 0.5,
    });
    doc.moveDown(0.2);
    const cGap = 16;
    const cW = (contentWidth() - cGap) / 2;
    let cCol = 0;
    let cTop = doc.y;
    let cBottom = doc.y;
    for (const group of contactGroups) {
      const blockH = 12 + group.lines.length * 11;
      if (cCol === 0 && remainingSpace(doc) < blockH + 4) {
        addContentPage(layout);
        cTop = doc.y;
        cBottom = doc.y;
      }
      if (cCol === 1 && cTop + blockH > PAGE_H - CONTENT_BOTTOM) {
        addContentPage(layout);
        cCol = 0;
        cTop = doc.y;
        cBottom = doc.y;
      }
      const x = cCol === 0 ? MARGIN : MARGIN + cW + cGap;
      const y = cCol === 0 ? Math.max(doc.y, cTop) : cTop;
      doc.fillColor(TEAL).font(FONT_BOLD).fontSize(7.5)
        .text(group.heading.toUpperCase(), x, y, { width: cW, characterSpacing: 0.5 });
      let ly = doc.y + 2;
      for (const line of group.lines) {
        doc.fillColor(INK).font(FONT_REG).fontSize(9)
          .text(pdfSafeText(line), x, ly, { width: cW });
        ly = doc.y + 1;
      }
      cBottom = Math.max(cBottom, ly + 6);
      if (cCol === 0) {
        cCol = 1;
      } else {
        cCol = 0;
        resetFlow(doc, cBottom);
        cTop = doc.y;
        cBottom = doc.y;
      }
    }
    if (cCol === 1) resetFlow(doc, cBottom);
    else resetFlow(doc);
  }
  resetFlow(doc);
}

/* ── Closing ───────────────────────────────────────────────────── */

async function renderClosing(layout: Layout) {
  const { doc, model } = layout;
  doc.addPage();
  layout.pageCount += 1;
  const prevBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  // Prefer a complementary destination frame — avoid identical cover reuse when possible.
  const cover = model.coverImage || model.destinationImages[0];
  const alt = model.destinationImages.find((u) => u && u !== cover)
    || model.closingImage
    || cover
    || model.destinationImages[0];
  const img = alt;
  if (img) {
    const ok = await drawImage(doc, img, 0, 0, PAGE_W, PAGE_H, "cover");
    if (!ok) doc.rect(0, 0, PAGE_W, PAGE_H).fill(NAVY);
    else doc.rect(0, 0, PAGE_W, PAGE_H).fillOpacity(0.48).fill(NAVY).fillOpacity(1);
  } else {
    doc.rect(0, 0, PAGE_W, PAGE_H).fill(NAVY);
  }

  doc.fillColor(TEAL).font(FONT_BOLD).fontSize(9)
    .text("READY TO CONFIRM?", MARGIN, PAGE_H * 0.22, {
      width: contentWidth(),
      align: "center",
      characterSpacing: 2,
      lineBreak: false,
    });

  doc.fillColor(WHITE).font(DISPLAY).fontSize(28)
    .text("Curated for your journey", MARGIN, PAGE_H * 0.28, {
      width: contentWidth(),
      align: "center",
    });

  let logoDrawn = false;
  if (model.branding.logo) {
    logoDrawn = await drawImage(doc, model.branding.logo, PAGE_W / 2 - 70, PAGE_H * 0.4, 140, 56, "fit");
  }
  if (!logoDrawn) {
    doc.font(FONT_BOLD).fontSize(14).fillColor(WHITE)
      .text(pdfSafeText(model.branding.brandName || "Trevio Global").toUpperCase(), MARGIN, PAGE_H * 0.42, {
        width: contentWidth(),
        align: "center",
        characterSpacing: 2,
      });
  }

  // Closing keeps identity + one reach-out channel; full contacts live on Investment Summary.
  let cy = PAGE_H * 0.5;
  if (model.customerName) {
    doc.fillColor(WHITE).fillOpacity(0.75).font(FONT_BOLD).fontSize(8)
      .text("PREPARED FOR", MARGIN, cy, {
        width: contentWidth(),
        align: "center",
        characterSpacing: 0.6,
        lineBreak: false,
      });
    doc.fillOpacity(1);
    cy = doc.y + 6;
    doc.fillColor(WHITE).font(DISPLAY_REG).fontSize(14)
      .text(pdfSafeText(model.customerName), MARGIN, cy, {
        width: contentWidth(),
        align: "center",
      });
    cy = doc.y + 14;
  }
  if (model.agentName) {
    doc.fillColor(WHITE).fillOpacity(0.75).font(FONT_BOLD).fontSize(8)
      .text("YOUR ADVISOR", MARGIN, cy, {
        width: contentWidth(),
        align: "center",
        characterSpacing: 0.6,
        lineBreak: false,
      });
    doc.fillOpacity(1);
    cy = doc.y + 6;
    doc.fillColor(WHITE).font(FONT_REG).fontSize(12)
      .text(pdfSafeText(model.agentName), MARGIN, cy, {
        width: contentWidth(),
        align: "center",
      });
    cy = doc.y + 18;
  }

  // Prefer partner desk, else sales, else customer phone — never invent contacts.
  const reachOut = isUsablePhone(model.branding.phone)
    ? model.branding.phone
    : isUsableContactLine(model.salesContact)
      ? model.salesContact
      : isUsablePhone(model.contactPhone)
        ? model.contactPhone
        : "";
  const closingLines = [
    reachOut ? String(reachOut) : "",
    model.quoteNo ? `Ref: ${model.quoteNo}` : "",
  ].filter(Boolean);

  for (const line of closingLines) {
    doc.fillColor(WHITE).fillOpacity(0.85).font(FONT_REG).fontSize(10)
      .text(pdfSafeText(String(line)), MARGIN, cy, { width: contentWidth(), align: "center" });
    doc.fillOpacity(1);
    cy = doc.y + 4;
  }

  doc.fillColor(WHITE).fillOpacity(0.7).font(FONT_REG).fontSize(9)
    .text("Contact your Trevio advisor to confirm this quotation.", MARGIN, PAGE_H - 56, {
      width: contentWidth(),
      align: "center",
      lineBreak: false,
    });
  doc.fillOpacity(1);

  doc.page.margins.bottom = prevBottom;
}

/* ── Orchestration ─────────────────────────────────────────────── */

export async function renderQuotationPdf(model: QuotationPdfModel): Promise<{ buffer: Buffer; pageCount: number }> {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: CONTENT_TOP, bottom: CONTENT_BOTTOM, left: MARGIN, right: MARGIN },
    autoFirstPage: true,
    info: { Title: `${model.quoteNo} — ${model.destinationName}`, Author: model.branding.brandName },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));

  const layout: Layout = {
    doc,
    model,
    pageCount: 1,
    contentPageNo: 0,
    contentPages: new Set(),
  };

  // Cover — unnumbered
  await renderCover(layout);

  const primary = model.packages[0];
  if (!primary) {
    doc.end();
    await new Promise<void>((resolve) => doc.on("end", () => resolve()));
    return { buffer: Buffer.concat(chunks), pageCount: layout.pageCount };
  }

  await renderOverview(layout, primary);

  for (let i = 1; i < model.packages.length; i += 1) {
    const pkg = model.packages[i];
    ensureSpace(layout, 70);
    if (remainingSpace(doc) < 80) addContentPage(layout);
    sectionHeading(layout, pkg.name, "Alternative package option");
    if (pkg.description) {
      doc.fillColor(MUTED).font(FONT_REG).fontSize(9.5)
        .text(pdfSafeText(pkg.description), { width: contentWidth() });
      doc.moveDown(0.35);
    }
    doc.fillColor(NAVY).font(FONT_BOLD).fontSize(12)
      .text(`Total payable: ${money(pkg.pricing.finalPrice || pkg.pricing.packageBase, pkg.pricing.currency)}`);
    doc.moveDown(0.6);
  }

  await renderItinerary(layout, primary);
  await renderFlights(layout, primary);
  await renderAccommodation(layout, primary);
  await renderInclusionsExclusions(layout, primary);
  renderAddOns(layout, primary);

  if (primary.visa?.enabled) {
    renderInfoBlock(layout, "Visa", [
      primary.visa.visaType && `Type: ${primary.visa.visaType}`,
      primary.visa.entryType && `Entry: ${primary.visa.entryType}`,
      primary.visa.processingTime && `Processing: ${primary.visa.processingTime}`,
      primary.visa.feeLabel && `Fee: ${primary.visa.feeLabel}`,
      primary.visa.documentsRequired && `Documents: ${primary.visa.documentsRequired}`,
      primary.visa.notes,
    ].filter(Boolean) as string[]);
  }

  if (primary.insurance?.enabled) {
    renderInfoBlock(layout, "Insurance", [
      primary.insurance.provider && `Provider: ${primary.insurance.provider}`,
      primary.insurance.planName && `Plan: ${primary.insurance.planName}`,
      primary.insurance.coverage && `Coverage: ${primary.insurance.coverage}`,
      primary.insurance.premiumLabel && `Premium: ${primary.insurance.premiumLabel}`,
      primary.insurance.notes,
    ].filter(Boolean) as string[]);
  }

  renderCommercialSummary(layout, primary);
  await renderClosing(layout);

  doc.end();
  await new Promise<void>((resolve) => doc.on("end", () => resolve()));
  return { buffer: Buffer.concat(chunks), pageCount: layout.pageCount };
}
