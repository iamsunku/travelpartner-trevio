import { afterEach, describe, expect, it, vi } from "vitest";
import { agentCanAccessQuote, quoteSendBlockReason } from "../lib/quote-access.js";
import {
  assertCustomerSafeDeliveryText,
  buildQuotationEmailHtml,
  buildQuotationWhatsAppBody,
} from "../lib/quotation-delivery/customer-message.js";
import { sendQuotationEmail } from "../lib/quotation-delivery/email-provider.js";
import {
  createDeliveryMediaToken,
  normalizeWhatsAppPhone,
  sendQuotationWhatsApp,
  verifyDeliveryMediaToken,
} from "../lib/quotation-delivery/whatsapp-provider.js";
import {
  getCapturedEmails,
  getCapturedWhatsApps,
  resetDeliveryCaptures,
} from "../lib/quotation-delivery/capture.js";

afterEach(() => {
  resetDeliveryCaptures();
  delete process.env.QUOTATION_EMAIL_PROVIDER;
  delete process.env.QUOTATION_WHATSAPP_PROVIDER;
  delete process.env.QUOTATION_DELIVERY_PROVIDER;
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASSWORD;
  delete process.env.SENDGRID_API_KEY;
  delete process.env.WHATSAPP_ACCESS_TOKEN;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.TWILIO_WHATSAPP_FROM;
});

const summary = {
  quoteNo: "TG-QT-2026-D01",
  customerName: "Dillip Traveller",
  destination: "Bali",
  travelStartDate: "2026-10-01",
  travelEndDate: "2026-10-05",
  packageCount: 2,
};

describe("phase 6 quotation delivery", () => {
  it("A-C. agents cannot access another agent's quotation for delivery", () => {
    const quote = { createdById: "agent-a", agentId: "agent-a" };
    expect(agentCanAccessQuote("travel_agent", "agent-a", quote)).toBe(true);
    expect(agentCanAccessQuote("travel_agent", "agent-b", quote)).toBe(false);
    expect(agentCanAccessQuote("sales_executive", "anyone", quote)).toBe(true);
  });

  it("D-F. draft and unapproved quotations cannot be delivered", () => {
    expect(quoteSendBlockReason({ status: "Draft", approvalStatus: "Draft", approvals: [] })).toMatch(/approval/i);
    expect(quoteSendBlockReason({
      status: "Pending Approval",
      approvalStatus: "Pending",
      approvals: [{ stage: "Team Lead", status: "Pending" }],
    })).toMatch(/approval/i);
    expect(quoteSendBlockReason({
      status: "In Progress",
      approvalStatus: "Draft",
      approvals: [],
    })).toMatch(/cannot be sent|approval/i);
  });

  it("G. customer-facing delivery text never includes internal fields", () => {
    const html = buildQuotationEmailHtml(summary, "Looking forward to hosting you.");
    const wa = buildQuotationWhatsAppBody(summary);
    expect(html).toContain("TG-QT-2026-D01");
    expect(html).toContain("Bali");
    expect(html).toContain("2 package options");
    expect(assertCustomerSafeDeliveryText(html)).toEqual([]);
    expect(assertCustomerSafeDeliveryText(wa)).toEqual([]);
    expect(assertCustomerSafeDeliveryText("contracted cost 10000")).not.toEqual([]);
    expect(assertCustomerSafeDeliveryText("trevio markup")).not.toEqual([]);
    expect(assertCustomerSafeDeliveryText("agent markup")).not.toEqual([]);
    expect(assertCustomerSafeDeliveryText("internalNotes leak")).not.toEqual([]);
    expect(html).not.toMatch(/contracted|supplier|markup|profit|internal/i);
    expect(wa).not.toMatch(/contracted|supplier|markup|profit|internal/i);
  });

  it("H. delivery media tokens are scoped to customer PDF storage keys", () => {
    const token = createDeliveryMediaToken({
      quotationId: "q1",
      documentId: "d1",
      storageKey: "documents/quote-q1/file.pdf",
      filename: "file.pdf",
      mimeType: "application/pdf",
      ttlSeconds: 60,
    });
    const parsed = verifyDeliveryMediaToken(token);
    expect(parsed?.documentId).toBe("d1");
    expect(parsed?.storageKey).toBe("documents/quote-q1/file.pdf");
    expect(verifyDeliveryMediaToken("tampered." + token.split(".")[1])).toBeNull();
  });

  it("N. multi-package summary is preserved in the customer message", () => {
    expect(buildQuotationEmailHtml(summary)).toContain("2 package options");
    expect(buildQuotationWhatsAppBody({ ...summary, packageCount: 3 })).toContain("3 package options");
  });

  it("J. missing email provider does not report successful production delivery", async () => {
    process.env.QUOTATION_EMAIL_PROVIDER = "none";
    const result = await sendQuotationEmail({
      to: "guest@example.com",
      subject: "Quote",
      html: "<p>Hi</p>",
      quotationId: "q1",
    });
    expect(result.ok).toBe(false);
    expect(result.configured).toBe(false);
    expect(result.provider).toBe("none");
    expect(getCapturedEmails()).toHaveLength(0);
  });

  it("I+L. capture email attaches the PDF and records a successful capture delivery", async () => {
    process.env.QUOTATION_EMAIL_PROVIDER = "capture";
    const pdf = Buffer.from("%PDF-1.4 sample");
    const result = await sendQuotationEmail({
      to: "guest@example.com",
      subject: "Quotation TG-QT-2026-D01 — Bali",
      html: buildQuotationEmailHtml(summary),
      quotationId: "q1",
      attachments: [{ filename: "TG-QT-2026-D01-customer.pdf", content: pdf, contentType: "application/pdf" }],
    });
    expect(result.ok).toBe(true);
    expect(result.provider).toBe("capture");
    expect(result.configured).toBe(true);
    const captured = getCapturedEmails();
    expect(captured).toHaveLength(1);
    expect(captured[0].attachmentName).toBe("TG-QT-2026-D01-customer.pdf");
    expect(captured[0].attachmentBytes).toBe(pdf.length);
    expect(captured[0].html).not.toMatch(/contracted|trevioMarkup|supplier/i);
  });

  it("J. missing WhatsApp provider does not fake success", async () => {
    process.env.QUOTATION_WHATSAPP_PROVIDER = "none";
    const result = await sendQuotationWhatsApp({
      to: "9876543210",
      body: buildQuotationWhatsAppBody(summary),
      quotationId: "q1",
      document: { filename: "q.pdf", content: Buffer.from("%PDF"), mimeType: "application/pdf" },
    });
    expect(result.ok).toBe(false);
    expect(result.configured).toBe(false);
    expect(getCapturedWhatsApps()).toHaveLength(0);
  });

  it("I+L. capture WhatsApp includes the PDF metadata", async () => {
    process.env.QUOTATION_WHATSAPP_PROVIDER = "capture";
    const pdf = Buffer.from("%PDF-1.4 wa");
    const result = await sendQuotationWhatsApp({
      to: "+91 98765 43210",
      body: buildQuotationWhatsAppBody(summary),
      quotationId: "q1",
      document: { filename: "quote.pdf", content: pdf, mimeType: "application/pdf" },
    });
    expect(result.ok).toBe(true);
    expect(result.provider).toBe("capture");
    const captured = getCapturedWhatsApps();
    expect(captured).toHaveLength(1);
    expect(captured[0].to).toBe("919876543210");
    expect(captured[0].attachmentName).toBe("quote.pdf");
    expect(captured[0].attachmentBytes).toBe(pdf.length);
  });

  it("K. provider failure is returned as failed (not success)", async () => {
    process.env.QUOTATION_WHATSAPP_PROVIDER = "meta";
    process.env.WHATSAPP_ACCESS_TOKEN = "token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: "upstream down" } }),
    } as Response);
    const result = await sendQuotationWhatsApp({
      to: "919876543210",
      body: "hello",
      quotationId: "q1",
      document: { filename: "q.pdf", content: Buffer.from("%PDF"), mimeType: "application/pdf" },
    });
    expect(result.ok).toBe(false);
    expect(result.configured).toBe(true);
    expect(result.error).toMatch(/upstream|failed/i);
    fetchMock.mockRestore();
  });

  it("M. repeated capture deliveries stay independent", async () => {
    process.env.QUOTATION_EMAIL_PROVIDER = "capture";
    await sendQuotationEmail({ to: "a@x.com", subject: "1", html: "<p>1</p>", quotationId: "q1" });
    await sendQuotationEmail({ to: "b@x.com", subject: "2", html: "<p>2</p>", quotationId: "q1" });
    expect(getCapturedEmails()).toHaveLength(2);
    expect(getCapturedEmails()[0].to).toBe("a@x.com");
    expect(getCapturedEmails()[1].to).toBe("b@x.com");
  });

  it("normalizes WhatsApp phone numbers", () => {
    expect(normalizeWhatsAppPhone("9876543210")).toBe("919876543210");
    expect(normalizeWhatsAppPhone("+91-98765-43210")).toBe("919876543210");
    expect(normalizeWhatsAppPhone("123")).toBeNull();
  });
});
