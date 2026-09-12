import { escapeHtml } from "../html.js";

export type CustomerSafeQuoteSummary = {
  quoteNo: string;
  customerName: string;
  destination?: string | null;
  travelDates?: string | null;
  travelStartDate?: string | null;
  travelEndDate?: string | null;
  packageCount?: number;
};

function travelLabel(q: CustomerSafeQuoteSummary): string {
  if (q.travelStartDate && q.travelEndDate) return `${q.travelStartDate} to ${q.travelEndDate}`;
  return q.travelDates || "as discussed";
}

/** Short customer-safe email HTML. Does not include pricing layers or internal fields. */
export function buildQuotationEmailHtml(
  q: CustomerSafeQuoteSummary,
  extraMessage?: string,
  customerLink?: string | null,
): string {
  const dest = q.destination || "your trip";
  const linkBlock = customerLink
    ? `<p><a href="${escapeHtml(customerLink)}">Review and respond to your quotation</a> (accept, reject, or request changes).</p>`
    : `<p>The full quotation details are in the attached PDF. Reply to this email or contact your travel advisor to proceed.</p>`;
  return `
    <p>Dear ${escapeHtml(q.customerName)},</p>
    <p>Please find attached your travel quotation <strong>${escapeHtml(q.quoteNo)}</strong>
    for ${escapeHtml(dest)} (${escapeHtml(travelLabel(q))}).</p>
    ${q.packageCount && q.packageCount > 1 ? `<p>This quotation includes ${q.packageCount} package options for your review.</p>` : ""}
    ${extraMessage ? `<p>${escapeHtml(extraMessage)}</p>` : ""}
    ${linkBlock}
    <p>Regards,<br/>Trevio Global</p>
  `;
}

/** EXP-02 pre-expiry reminder — customer-safe; no costs, markup, suppliers, or internals. */
export function buildExpiryReminderEmailHtml(
  q: CustomerSafeQuoteSummary & { validTill: string },
  customerLink?: string | null,
): string {
  const dest = q.destination || "your trip";
  const linkBlock = customerLink
    ? `<p><a href="${escapeHtml(customerLink)}">Review and respond to your quotation</a> before it expires.</p>`
    : `<p>Please contact your travel advisor if you would like to proceed before this quotation expires.</p>`;
  return `
    <p>Dear ${escapeHtml(q.customerName)},</p>
    <p>This is a friendly reminder that your travel quotation <strong>${escapeHtml(q.quoteNo)}</strong>
    for ${escapeHtml(dest)} (${escapeHtml(travelLabel(q))}) remains valid until
    <strong>${escapeHtml(q.validTill)}</strong>.</p>
    ${q.packageCount && q.packageCount > 1 ? `<p>This quotation includes ${q.packageCount} package options.</p>` : ""}
    ${linkBlock}
    <p>Regards,<br/>Trevio Global</p>
  `;
}

export function buildExpiryReminderSubject(quoteNo: string, validTill: string): string {
  return `Reminder: Quotation ${quoteNo} expires on ${validTill}`;
}

/** Short customer-safe WhatsApp text. No costs, markup, or internal notes. */
export function buildQuotationWhatsAppBody(
  q: CustomerSafeQuoteSummary,
  extraMessage?: string,
  customerLink?: string | null,
): string {
  const dest = q.destination || "your trip";
  const lines = [
    `Hello ${q.customerName},`,
    "",
    `Your travel quotation ${q.quoteNo} for ${dest} (${travelLabel(q)}) is ready.`,
  ];
  if (q.packageCount && q.packageCount > 1) {
    lines.push(`It includes ${q.packageCount} package options.`);
  }
  if (extraMessage?.trim()) {
    lines.push("", extraMessage.trim());
  }
  if (customerLink) {
    lines.push("", `Review and respond: ${customerLink}`);
  } else {
    lines.push("", "Please review the attached PDF. Contact your advisor to confirm.");
  }
  return lines.join("\n");
}

const FORBIDDEN = [
  /contracted\s*cost/i,
  /supplier\s*cost/i,
  /trevio\s*markup/i,
  /agent\s*markup/i,
  /totalNetCost/i,
  /grossProfit/i,
  /internalNotes/i,
  /approval\s*comment/i,
];

export function assertCustomerSafeDeliveryText(text: string): string[] {
  return FORBIDDEN.filter((re) => re.test(text)).map((re) => re.source);
}
