import type { Booking } from "@/types";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(n: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(n || 0);
}

function openPrint(html: string, title: string) {
  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.document.title = title;
  return true;
}

const BASE_STYLES = `
  * { box-sizing: border-box; }
  body { font-family: Inter, system-ui, sans-serif; color: #111; margin: 0; padding: 24px; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  h2 { font-size: 16px; margin: 20px 0 8px; }
  .muted { color: #666; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; font-size: 12px; }
  th { background: #f8fafc; }
  .totals td { font-weight: 600; }
  .day { margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #eee; }
  @media print { body { padding: 12px; } }
`;

export type BookingInvoiceDoc = {
  invoiceNo: string;
  invoiceType: string;
  amount?: number;
  gst?: number;
  taxableAmount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  gstRate?: number;
  gstNumber?: string | null;
  total: number;
  amountPaid?: number;
  balanceAmount?: number;
  lineItems?: { description: string; amount: number }[];
  notes?: string | null;
  createdAt?: string;
};

export type DocumentBranding = {
  agencyName?: string;
  logoUrl?: string;
  footerText?: string;
};

export function downloadBookingItinerary(booking: Booking, branding?: DocumentBranding): boolean {
  const days = Array.isArray(booking.itinerary) ? booking.itinerary : [];
  const dayHtml = days.length
    ? days.map((day, i) => {
        const items = Array.isArray(day.items) ? (day.items as Array<Record<string, unknown>>) : [];
        const itemRows = items.map((it) => `
          <tr>
            <td>${escapeHtml(it.activityName || it.title || "Activity")}</td>
            <td>${escapeHtml(it.pickupLocation || it.location || "—")}</td>
            <td>${escapeHtml(it.time || it.startTime || "—")}</td>
          </tr>
        `).join("");
        return `
          <div class="day">
            <h2>Day ${i + 1}: ${escapeHtml(day.title || `Day ${i + 1}`)}</h2>
            ${items.length ? `<table><thead><tr><th>Activity</th><th>Location</th><th>Time</th></tr></thead><tbody>${itemRows}</tbody></table>` : "<p class='muted'>As per package</p>"}
          </div>
        `;
      }).join("")
    : "<p class='muted'>Itinerary will be shared by your travel coordinator.</p>";

  const transfers = (booking.services || []).filter((s) => s.serviceType === "Transfer");
  const driverHtml = transfers
    .filter((s) => s.driverDetails?.driverName)
    .map((s) => `<p><strong>${escapeHtml(s.title)}</strong> — Driver: ${escapeHtml(s.driverDetails?.driverName)} · ${escapeHtml(s.driverDetails?.vehicleNumber)} · ${escapeHtml(s.driverDetails?.driverPhone)}</p>`)
    .join("");

  const brandName = branding?.agencyName || booking.agentAgencyName || booking.agency || "Your Travel Partner";
  const logoHtml = branding?.logoUrl || booking.agentAgencyLogo
    ? `<img src="${escapeHtml(branding?.logoUrl || booking.agentAgencyLogo)}" alt="" style="max-height:56px;max-width:200px;margin-bottom:12px" />`
    : "";

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(booking.bookingRef)} Itinerary</title><style>${BASE_STYLES}</style></head><body>
    ${logoHtml}
    <h1>Trip Itinerary</h1>
    <p class="muted">${escapeHtml(brandName)}</p>
    <p class="muted">${escapeHtml(booking.bookingRef)} · ${escapeHtml(booking.customerName)} · ${escapeHtml(booking.destination || booking.route)}</p>
    <p class="muted">Travel: ${escapeHtml(booking.travelDate)}</p>
    ${dayHtml}
    ${driverHtml ? `<h2>Transfer contacts</h2>${driverHtml}` : ""}
    ${branding?.footerText ? `<p class="muted" style="margin-top:24px">${escapeHtml(branding.footerText)}</p>` : ""}
    <script>window.onload = () => window.print();</script>
  </body></html>`;

  return openPrint(html, `${booking.bookingRef} — Itinerary`);
}

export function downloadBookingInvoice(booking: Booking, invoice: BookingInvoiceDoc): boolean {
  const lines = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
  const rows = lines.map((l) => `
    <tr>
      <td>${escapeHtml(l.description)}</td>
      <td style="text-align:right">${l.amount ? money(l.amount) : "—"}</td>
    </tr>
  `).join("");

  const gstRows = invoice.igst
    ? `<tr><td>IGST (${invoice.gstRate || 5}%)</td><td style="text-align:right">${money(invoice.igst)}</td></tr>`
    : `<tr><td>CGST</td><td style="text-align:right">${money(invoice.cgst || 0)}</td></tr>
       <tr><td>SGST</td><td style="text-align:right">${money(invoice.sgst || 0)}</td></tr>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(invoice.invoiceNo)}</title><style>${BASE_STYLES}</style></head><body>
    <h1>${escapeHtml(invoice.invoiceType)}</h1>
    <p class="muted">${escapeHtml(invoice.invoiceNo)} · ${escapeHtml(booking.bookingRef)} · ${escapeHtml(booking.customerName)}</p>
    ${invoice.gstNumber ? `<p class="muted">GSTIN: ${escapeHtml(invoice.gstNumber)}</p>` : ""}
    <table>
      <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
      <tbody class="totals">
        <tr><td>Taxable value</td><td style="text-align:right">${money(invoice.taxableAmount ?? invoice.amount ?? 0)}</td></tr>
        ${gstRows}
        <tr><td>Total</td><td style="text-align:right">${money(invoice.total)}</td></tr>
        <tr><td>Paid</td><td style="text-align:right">${money(invoice.amountPaid ?? booking.amountPaid ?? 0)}</td></tr>
        <tr><td>Balance</td><td style="text-align:right">${money(invoice.balanceAmount ?? booking.balanceAmount ?? 0)}</td></tr>
      </tbody>
    </table>
    ${invoice.notes ? `<p class="muted" style="margin-top:16px">${escapeHtml(invoice.notes)}</p>` : ""}
    <script>window.onload = () => window.print();</script>
  </body></html>`;

  return openPrint(html, invoice.invoiceNo);
}
