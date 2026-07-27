import { formatProductPrice } from "@/lib/currency";

export type ProductQuoteLine = {
  type: "hotel" | "activity" | "transfer";
  title: string;
  description?: string;
  imageUrl?: string;
  qty: number;
  unitPrice: number;
  currency: string;
  meta?: string;
};

export type ProductQuotePdfData = {
  quoteNo?: string;
  customerName: string;
  contactEmail?: string;
  contactPhone?: string;
  destination: string;
  travelDates: string;
  adults?: number;
  children?: number;
  lines: ProductQuoteLine[];
  includes?: string[];
  excludes?: string[];
  paymentTerms?: string;
  cancellationPolicy?: string;
  currency: string;
  gst?: number;
  createdBy?: string;
  agencyName?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function downloadProductQuotationPdf(data: ProductQuotePdfData): boolean {
  const currency = data.currency || "INR";
  const subtotal = data.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const gst = data.gst ?? Math.round(subtotal * 0.18);
  const total = subtotal + gst;
  const quoteNo = data.quoteNo || `PQ-${Date.now().toString().slice(-6)}`;
  const brand = data.agencyName || "Trevio Global";

  const lineCards = data.lines.map((line) => {
    const img = line.imageUrl
      ? `<img src="${escapeHtml(line.imageUrl)}" alt="" style="width:120px;height:80px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0" />`
      : `<div style="width:120px;height:80px;border-radius:8px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:11px;color:#94a3b8">${escapeHtml(line.type)}</div>`;
    const lineTotal = formatProductPrice(line.qty * line.unitPrice, line.currency || currency);
    const unit = formatProductPrice(line.unitPrice, line.currency || currency);
    return `
      <div style="display:flex;gap:14px;border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:10px">
        ${img}
        <div style="flex:1">
          <div style="font-weight:600;font-size:14px">${escapeHtml(line.title)}</div>
          ${line.meta ? `<div style="font-size:11px;color:#64748b;margin-top:2px">${escapeHtml(line.meta)}</div>` : ""}
          ${line.description ? `<div style="font-size:12px;color:#475569;margin-top:4px">${escapeHtml(line.description)}</div>` : ""}
          <div style="font-size:12px;margin-top:6px">Qty: ${line.qty} × ${unit} = <strong>${lineTotal}</strong></div>
        </div>
      </div>`;
  }).join("");

  const includes = (data.includes || []).map((i) => `<li>${escapeHtml(i)}</li>`).join("") || "<li>As per selected products</li>";
  const excludes = (data.excludes || []).map((i) => `<li>${escapeHtml(i)}</li>`).join("") || "<li>Personal expenses, tips, visa fees unless specified</li>";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Quotation ${escapeHtml(quoteNo)}</title>
  <style>
    @page { margin: 18mm; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; color: #0f172a; line-height: 1.45; }
    .brand { font-size: 20px; font-weight: 700; color: #0f766e; margin: 0; }
    .muted { color: #64748b; font-size: 12px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f766e; padding-bottom: 12px; margin-bottom: 18px; }
    h2 { font-size: 15px; margin: 16px 0 8px; color: #0f766e; }
    .box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-top: 6px; font-size: 13px; }
    .totals { margin-top: 12px; width: 280px; margin-left: auto; font-size: 13px; }
    .totals td { padding: 4px 0; }
    .grand { font-weight: 700; font-size: 15px; border-top: 1px solid #cbd5e1; padding-top: 8px; }
    ul { margin: 6px 0 0 18px; padding: 0; font-size: 13px; }
    .footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 11px; color: #64748b; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <p class="brand">${escapeHtml(brand)}</p>
      <p class="muted">Product-based travel quotation</p>
    </div>
    <div style="text-align:right">
      <div><strong>${escapeHtml(quoteNo)}</strong></div>
      <div class="muted">${new Date().toLocaleDateString("en-IN")}</div>
      <div class="muted">Prepared by ${escapeHtml(data.createdBy || "Team")}</div>
    </div>
  </div>

  <h2>Customer</h2>
  <div class="box">
    <strong>${escapeHtml(data.customerName)}</strong><br/>
    ${data.contactEmail ? `Email: ${escapeHtml(data.contactEmail)}<br/>` : ""}
    ${data.contactPhone ? `Phone: ${escapeHtml(data.contactPhone)}` : ""}
  </div>

  <h2>Trip</h2>
  <div class="box">
    Destination: <strong>${escapeHtml(data.destination)}</strong><br/>
    Travel dates: ${escapeHtml(data.travelDates)}<br/>
    Pax: ${data.adults ?? 0} Adults${(data.children ?? 0) > 0 ? ` · ${data.children} Children` : ""}
  </div>

  <h2>Selected Products</h2>
  ${lineCards || "<p class='muted'>No products selected.</p>"}

  <h2>Includes</h2>
  <ul>${includes}</ul>

  <h2>Excludes</h2>
  <ul>${excludes}</ul>

  <table class="totals">
    <tr><td>Subtotal</td><td style="text-align:right">${formatProductPrice(subtotal, currency)}</td></tr>
    <tr><td>GST @ 18%</td><td style="text-align:right">${formatProductPrice(gst, currency)}</td></tr>
    <tr class="grand"><td>Grand Total</td><td style="text-align:right">${formatProductPrice(total, currency)}</td></tr>
  </table>

  <h2>Terms</h2>
  <div class="box">
    <p><strong>Payment:</strong> ${escapeHtml(data.paymentTerms || "50% advance, balance before travel")}</p>
    <p><strong>Cancellation:</strong> ${escapeHtml(data.cancellationPolicy || "As per supplier policy")}</p>
  </div>

  <div class="footer">Quotation valid 14 days. Rates subject to availability and admin-approved product rates.</div>
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
