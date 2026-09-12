import nodemailer from "nodemailer";
import { logger } from "../logger.js";
import { getAgencyApiKeys, type DynamicApiKeys } from "../api-key-config.js";
import { captureEmail } from "./capture.js";

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export type QuotationEmailRequest = {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
  agencyId?: string | null;
  quotationId?: string;
};

export type QuotationEmailResult = {
  ok: boolean;
  configured: boolean;
  provider: "smtp" | "sendgrid" | "capture" | "none";
  messageId?: string;
  error?: string;
};

type SendGridMail = {
  setApiKey: (key: string) => void;
  send: (msg: {
    to: string;
    from: string;
    subject: string;
    html: string;
    attachments?: Array<{ content: string; filename: string; type: string; disposition: string }>;
  }) => Promise<unknown>;
};

function smtpReady(keys: DynamicApiKeys): boolean {
  return Boolean(keys.smtpHost && keys.smtpUser && keys.smtpPassword);
}

function fromAddress(keys: DynamicApiKeys): string {
  return keys.smtpFrom || keys.smtpUser || keys.sendgridFromEmail || "noreply@travelpartner.pro";
}

function buildSmtpTransport(keys: DynamicApiKeys): nodemailer.Transporter | null {
  if (!smtpReady(keys)) return null;
  const port = Number(keys.smtpPort || 587);
  const secure = keys.smtpSecure === "true" || port === 465;
  return nodemailer.createTransport({
    host: keys.smtpHost,
    port,
    secure,
    auth: {
      user: keys.smtpUser,
      pass: (keys.smtpPassword || "").replace(/\s/g, ""),
    },
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 12_000,
  });
}

async function loadSendGrid(apiKey?: string): Promise<SendGridMail | null> {
  if (!apiKey) return null;
  try {
    const mod = await import("@sendgrid/mail");
    const client = mod.default as SendGridMail;
    client.setApiKey(apiKey);
    return client;
  } catch {
    return null;
  }
}

function forceCapture(): boolean {
  return process.env.QUOTATION_EMAIL_PROVIDER === "capture"
    || process.env.QUOTATION_DELIVERY_PROVIDER === "capture";
}

function forceDisabled(): boolean {
  const v = process.env.QUOTATION_EMAIL_PROVIDER || process.env.QUOTATION_DELIVERY_PROVIDER;
  return v === "none" || v === "off" || v === "disabled";
}

function productionConfigured(keys: DynamicApiKeys): boolean {
  return smtpReady(keys) || Boolean(keys.sendgridApiKey);
}

/**
 * Quotation email delivery. Capture mode is for tests only.
 * Missing SMTP/SendGrid returns configured:false — never a fake production success.
 */
export async function sendQuotationEmail(req: QuotationEmailRequest): Promise<QuotationEmailResult> {
  const attachment = req.attachments?.[0];

  if (forceDisabled()) {
    return {
      ok: false,
      configured: false,
      provider: "none",
      error: "Email provider is disabled (QUOTATION_EMAIL_PROVIDER=none).",
    };
  }

  if (forceCapture()) {
    captureEmail({
      to: req.to,
      subject: req.subject,
      html: req.html,
      attachmentName: attachment?.filename,
      attachmentBytes: attachment?.content.length,
      quotationId: req.quotationId,
    });
    return { ok: true, configured: true, provider: "capture", messageId: `capture-email-${Date.now()}` };
  }

  try {
    const keys = await getAgencyApiKeys(req.agencyId);
    if (!productionConfigured(keys)) {
      return {
        ok: false,
        configured: false,
        provider: "none",
        error: "Email provider is not configured. Set SMTP_* or SENDGRID_* (or agency API keys).",
      };
    }

    const from = fromAddress(keys);
    const smtp = buildSmtpTransport(keys);
    if (smtp) {
      const info = await smtp.sendMail({
        to: req.to,
        from,
        subject: req.subject,
        html: req.html,
        attachments: (req.attachments || []).map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });
      logger.info({ to: req.to, provider: "smtp", quotationId: req.quotationId }, "quotation email sent");
      return {
        ok: true,
        configured: true,
        provider: "smtp",
        messageId: typeof info.messageId === "string" ? info.messageId : undefined,
      };
    }

    const sg = await loadSendGrid(keys.sendgridApiKey);
    if (sg) {
      await sg.send({
        to: req.to,
        from,
        subject: req.subject,
        html: req.html,
        attachments: (req.attachments || []).map((a) => ({
          content: a.content.toString("base64"),
          filename: a.filename,
          type: a.contentType,
          disposition: "attachment",
        })),
      });
      logger.info({ to: req.to, provider: "sendgrid", quotationId: req.quotationId }, "quotation email sent");
      return { ok: true, configured: true, provider: "sendgrid", messageId: `sendgrid-${Date.now()}` };
    }

    return {
      ok: false,
      configured: false,
      provider: "none",
      error: "Email provider packages/credentials are unavailable.",
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error({ err: message, quotationId: req.quotationId }, "quotation email failed");
    return { ok: false, configured: true, provider: "none", error: message };
  }
}
