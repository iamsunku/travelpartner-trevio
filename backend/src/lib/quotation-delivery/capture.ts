/** In-memory capture store for quotation delivery tests / explicit capture mode. Not production. */

export type CapturedEmail = {
  to: string;
  subject: string;
  html: string;
  attachmentName?: string;
  attachmentBytes?: number;
  quotationId?: string;
  at: string;
};

export type CapturedWhatsApp = {
  to: string;
  body: string;
  attachmentName?: string;
  attachmentBytes?: number;
  quotationId?: string;
  at: string;
};

const emails: CapturedEmail[] = [];
const whatsapps: CapturedWhatsApp[] = [];

export function resetDeliveryCaptures() {
  emails.length = 0;
  whatsapps.length = 0;
}

export function getCapturedEmails(): CapturedEmail[] {
  return [...emails];
}

export function getCapturedWhatsApps(): CapturedWhatsApp[] {
  return [...whatsapps];
}

export function captureEmail(entry: Omit<CapturedEmail, "at">) {
  emails.push({ ...entry, at: new Date().toISOString() });
}

export function captureWhatsApp(entry: Omit<CapturedWhatsApp, "at">) {
  whatsapps.push({ ...entry, at: new Date().toISOString() });
}
