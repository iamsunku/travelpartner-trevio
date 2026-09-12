import type { Quotation } from "@/types";
import { api, ApiError, apiFetchBlob } from "@/lib/api";
import { downloadInternationalQuotationPdf } from "@/lib/quotation-pdf";
import { downloadProductQuotationPdf, type ProductQuoteLine } from "@/lib/product-quotation-pdf";
import { downloadClientQuotationBrochure } from "@/lib/client-quotation-brochure";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function quoteLines(quote: Quotation): Array<{ description: string; qty: number; price: number; type?: string; imageUrl?: string; currency?: string }> {
  if (quote.lineItems && quote.lineItems.length > 0) return quote.lineItems;
  if (quote.items > 0) {
    const unit = Math.round(quote.amount / Math.max(quote.items, 1));
    return Array.from({ length: quote.items }, (_, i) => ({
      description: `${quote.service} package item ${i + 1}`,
      qty: 1,
      price: unit,
    }));
  }
  return [{ description: `${quote.service} package`, qty: 1, price: quote.amount }];
}

function downloadClassicQuotationPdf(quote: Quotation): boolean {
  const lines = quoteLines(quote);
  const currency = quote.currency || "INR";
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

  const rows = lines
    .map(
      (line, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(line.description)}</td>
        <td style="text-align:center">${line.qty}</td>
        <td style="text-align:right">${fmt(line.price)}</td>
        <td style="text-align:right">${fmt(line.qty * line.price)}</td>
      </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Quotation ${escapeHtml(quote.quoteNo)}</title>
  <style>
    @page { margin: 18mm; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; color: #0f172a; line-height: 1.45; }
    .brand { font-size: 20px; font-weight: 700; color: #0f766e; margin: 0; }
    .muted { color: #64748b; font-size: 12px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f766e; padding-bottom: 12px; margin-bottom: 20px; }
    h2 { font-size: 15px; margin: 18px 0 8px; color: #0f766e; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 6px; font-size: 12px; border-bottom: 1px solid #e2e8f0; }
    th { text-align: left; background: #f8fafc; }
    .box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; }
    .totals { width: 260px; margin-left: auto; margin-top: 16px; }
    .totals td { border: 0; padding: 4px 0; }
    .grand { font-weight: 700; font-size: 14px; border-top: 1px solid #cbd5e1 !important; padding-top: 8px !important; }
    .footer { margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 11px; color: #64748b; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <p class="brand">Trevio Global</p>
      <p class="muted">Travel Quotation · ${escapeHtml(quote.service)}</p>
    </div>
    <div style="text-align:right">
      <div><strong>${escapeHtml(quote.quoteNo)}</strong></div>
      <div class="muted">${new Date(quote.createdAt).toLocaleDateString("en-IN")}</div>
      <div class="muted">Prepared by ${escapeHtml(quote.createdBy)}</div>
    </div>
  </div>

  <h2>Customer</h2>
  <div class="box">
    <strong>${escapeHtml(quote.customerName)}</strong><br/>
    ${quote.contactEmail ? `Email: ${escapeHtml(quote.contactEmail)}<br/>` : ""}
    ${quote.contactPhone ? `Phone: ${escapeHtml(quote.contactPhone)}` : ""}
  </div>

  ${quote.destination || quote.travelDates ? `
  <h2>Trip</h2>
  <div class="box">
    ${quote.destination ? `Destination: <strong>${escapeHtml(quote.destination)}</strong><br/>` : ""}
    ${quote.travelDates ? `Travel dates: ${escapeHtml(quote.travelDates)}` : ""}
  </div>` : ""}

  <h2>Line Items</h2>
  <table>
    <thead>
      <tr><th>#</th><th>Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Amount</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <table class="totals">
    <tr><td>Subtotal</td><td style="text-align:right">${fmt(quote.amount)}</td></tr>
    <tr><td>GST</td><td style="text-align:right">${fmt(quote.gst)}</td></tr>
    <tr class="grand"><td>Grand Total</td><td style="text-align:right">${fmt(quote.total)}</td></tr>
  </table>

  <div class="footer">
    Valid till ${escapeHtml(new Date(quote.validTill).toLocaleDateString("en-IN"))}.
    Rates subject to availability. Please reply to confirm booking.
  </div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}

/** Generate a real server PDF (Phase 5) and download it. Falls back to brochure print only if the quote has no id. */
export async function downloadQuotationPdf(
  quote: Quotation,
  brochureOptions?: import("@/lib/client-quotation-brochure").ClientBrochureOptions,
  options?: { mode?: "customer" | "preview" },
): Promise<boolean> {
  if (quote.id) {
    try {
      const mode = options?.mode || "customer";
      const result = await api.generateQuotationPdf(quote.id, mode);
      const blob = await apiFetchBlob(result.document.downloadPath);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.document.fileName || `${quote.quoteNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 403 && options?.mode !== "preview") {
        throw e;
      }
      if (e instanceof ApiError && e.status === 403) throw e;
      // Non-approval failures can still use the brochure for offline preview when explicitly previewing.
      if (options?.mode === "preview") {
        return downloadClientQuotationBrochure(quote, brochureOptions);
      }
      throw e;
    }
  }
  const hasBrochure =
    Boolean(quote.packages?.length) ||
    Boolean(quote.destination && (quote.travelStartDate || quote.travelDates));
  if (hasBrochure || quote.service === "Holiday" || quote.service === "International") {
    return downloadClientQuotationBrochure(quote, brochureOptions);
  }
  const lines = quoteLines(quote);
  const hasProductImages = lines.some((l) => l.imageUrl || (l.type && ["hotel", "activity", "transfer"].includes(l.type)));

  if (hasProductImages || (quote.destination && lines.some((l) => l.type))) {
    const productLines: ProductQuoteLine[] = lines.map((l) => ({
      type: (["hotel", "activity", "transfer"].includes(l.type || "") ? l.type : "activity") as ProductQuoteLine["type"],
      title: l.description,
      imageUrl: l.imageUrl,
      qty: l.qty,
      unitPrice: l.price,
      currency: l.currency || quote.currency || "INR",
    }));
    return downloadProductQuotationPdf({
      quoteNo: quote.quoteNo,
      customerName: quote.customerName,
      contactEmail: quote.contactEmail,
      contactPhone: quote.contactPhone,
      destination: quote.destination || quote.service,
      travelDates: quote.travelDates || "As discussed",
      adults: quote.adults,
      children: quote.children,
      lines: productLines,
      includes: quote.packageIncludes,
      excludes: quote.packageExcludes,
      paymentTerms: quote.paymentTerms,
      cancellationPolicy: quote.cancellationPolicy,
      currency: quote.currency || "INR",
      gst: quote.gst,
      createdBy: quote.createdBy,
    });
  }

  if (quote.isInternational) {
    return downloadInternationalQuotationPdf({
      quoteNo: quote.quoteNo,
      customerName: quote.customerName,
      contactPerson: quote.contactPerson,
      contactEmail: quote.contactEmail,
      contactPhone: quote.contactPhone,
      destination: quote.destination || "International",
      travelDates: quote.travelDates || "As discussed",
      adults: quote.adults,
      children: quote.children,
      infants: quote.infants,
      hotelStarPreference: quote.hotelStarPreference,
      location: quote.location,
      currency: quote.currency,
      includes: quote.packageIncludes,
      excludes: quote.packageExcludes,
      paymentTerms: quote.paymentTerms,
      cancellationPolicy: quote.cancellationPolicy,
      amount: quote.amount,
      gst: quote.gst,
      total: quote.total,
      createdBy: quote.createdBy,
    });
  }

  return downloadClassicQuotationPdf(quote);
}

export function buildQuotationShareText(quote: Quotation): string {
  const dest = quote.destination ? `\nDestination: ${quote.destination}` : "";
  const dates = quote.travelDates ? `\nTravel: ${quote.travelDates}` : "";
  return (
    `Hello ${quote.customerName},\n\n` +
    `Please find our travel quotation ${quote.quoteNo}.${dest}${dates}\n` +
    `Prepared by ${quote.createdBy} · Trevio Global\n` +
    `The full quotation PDF will be delivered by the server when email/WhatsApp is sent.`
  );
}

/** Server-side email with Phase 5 customer PDF attachment. */
export async function deliverQuotationEmail(
  quote: Quotation,
  opts?: { recipient?: string; message?: string },
): Promise<{ ok: boolean; error?: string; deliveryId?: string }> {
  if (!quote.id) return { ok: false, error: "Save the quotation before emailing." };
  try {
    const res = await api.emailQuotation(quote.id, {
      recipient: opts?.recipient || quote.contactEmail,
      message: opts?.message,
      appOrigin: typeof window !== "undefined" ? window.location.origin : undefined,
    });
    return { ok: true, deliveryId: res.delivery.id };
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : "Email delivery failed" };
  }
}

/** Server-side WhatsApp with Phase 5 customer PDF. */
export async function deliverQuotationWhatsApp(
  quote: Quotation,
  opts?: { recipient?: string; message?: string },
): Promise<{ ok: boolean; error?: string; deliveryId?: string }> {
  if (!quote.id) return { ok: false, error: "Save the quotation before sending WhatsApp." };
  try {
    const res = await api.whatsappQuotation(quote.id, {
      recipient: opts?.recipient || quote.contactPhone,
      message: opts?.message,
      appOrigin: typeof window !== "undefined" ? window.location.origin : undefined,
    });
    return { ok: true, deliveryId: res.delivery.id };
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : "WhatsApp delivery failed" };
  }
}

/** @deprecated Client mailto is not real delivery. Prefer deliverQuotationEmail. */
export function shareQuotationViaEmail(quote: Quotation): void {
  void deliverQuotationEmail(quote);
}

/** @deprecated Client wa.me is not real delivery. Prefer deliverQuotationWhatsApp. */
export function shareQuotationViaWhatsApp(quote: Quotation, phoneOverride?: string): void {
  void deliverQuotationWhatsApp(quote, { recipient: phoneOverride || quote.contactPhone });
}

export { quoteLines as getQuotationLineItems };
