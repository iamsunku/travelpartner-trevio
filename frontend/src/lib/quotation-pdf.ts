export function downloadInternationalQuotationPdf(data: {
  quoteNo?: string;
  customerName: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  destination: string;
  travelDates: string;
  adults?: number;
  children?: number;
  infants?: number;
  hotelStarPreference?: string;
  location?: string;
  currency?: string;
  includes?: string[];
  excludes?: string[];
  paymentTerms?: string;
  cancellationPolicy?: string;
  amount: number;
  gst: number;
  total: number;
  createdBy?: string;
}) {
  const currency = data.currency || "INR";
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

  const quoteNo = data.quoteNo || `IQ-${Date.now().toString().slice(-6)}`;
  const includes = (data.includes || []).map((i) => `<li>${escapeHtml(i)}</li>`).join("") || "<li>—</li>";
  const excludes = (data.excludes || []).map((i) => `<li>${escapeHtml(i)}</li>`).join("") || "<li>—</li>";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>International Quotation ${escapeHtml(quoteNo)}</title>
  <style>
    @page { margin: 24mm; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; line-height: 1.45; }
    .brand { font-size: 22px; letter-spacing: 0.08em; text-transform: uppercase; color: #0f766e; margin: 0; }
    .muted { color: #64748b; font-size: 12px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f766e; padding-bottom: 12px; margin-bottom: 20px; }
    h2 { font-size: 16px; margin: 18px 0 8px; color: #0f766e; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    td, th { text-align: left; padding: 6px 0; font-size: 13px; vertical-align: top; }
    .box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-top: 8px; }
    .totals { margin-top: 16px; width: 280px; margin-left: auto; }
    .totals td { padding: 4px 0; }
    .totals .grand { font-weight: bold; font-size: 15px; border-top: 1px solid #cbd5e1; padding-top: 8px; }
    ul { margin: 6px 0 0 18px; padding: 0; }
    li { margin-bottom: 4px; font-size: 13px; }
    .footer { margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 11px; color: #64748b; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <p class="brand">Wanderlust Travels</p>
      <p class="muted">International Holiday Quotation</p>
    </div>
    <div style="text-align:right">
      <div><strong>${escapeHtml(quoteNo)}</strong></div>
      <div class="muted">${new Date().toLocaleDateString("en-IN")}</div>
      <div class="muted">Prepared by ${escapeHtml(data.createdBy || "Sales Executive")}</div>
    </div>
  </div>

  <h2>Customer Details</h2>
  <div class="box">
    <table>
      <tr><th style="width:35%">Customer</th><td>${escapeHtml(data.customerName)}</td></tr>
      <tr><th>Contact Person</th><td>${escapeHtml(data.contactPerson || "—")}</td></tr>
      <tr><th>Email</th><td>${escapeHtml(data.contactEmail || "—")}</td></tr>
      <tr><th>Phone</th><td>${escapeHtml(data.contactPhone || "—")}</td></tr>
    </table>
  </div>

  <h2>Travel Details</h2>
  <div class="box">
    <table>
      <tr><th style="width:35%">Destination</th><td>${escapeHtml(data.destination)}</td></tr>
      <tr><th>Travel Dates</th><td>${escapeHtml(data.travelDates)}</td></tr>
      <tr><th>Location Preference</th><td>${escapeHtml(data.location || "—")}</td></tr>
      <tr><th>Hotel Star</th><td>${escapeHtml(data.hotelStarPreference || "—")}★</td></tr>
      <tr><th>Pax</th><td>${data.adults ?? 0} Adults · ${data.children ?? 0} Children · ${data.infants ?? 0} Infants</td></tr>
    </table>
  </div>

  <h2>Package Includes</h2>
  <ul>${includes}</ul>

  <h2>Package Excludes</h2>
  <ul>${excludes}</ul>

  <h2>Commercials</h2>
  <table class="totals">
    <tr><td>Subtotal</td><td style="text-align:right">${fmt(data.amount)}</td></tr>
    <tr><td>GST @ 18%</td><td style="text-align:right">${fmt(data.gst)}</td></tr>
    <tr class="grand"><td>Total</td><td style="text-align:right">${fmt(data.total)}</td></tr>
  </table>

  <h2>Terms</h2>
  <div class="box">
    <p><strong>Payment Terms:</strong> ${escapeHtml(data.paymentTerms || "—")}</p>
    <p><strong>Cancellation Policy:</strong> ${escapeHtml(data.cancellationPolicy || "—")}</p>
  </div>

  <div class="footer">
    This quotation is valid for 14 days from the date of issue. Prices are subject to availability and supplier confirmation.
  </div>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
