import { createHmac, timingSafeEqual } from "crypto";
import { logger } from "../logger.js";
import { getAgencyApiKeys } from "../api-key-config.js";
import { captureWhatsApp } from "./capture.js";

export type WhatsAppDocument = {
  filename: string;
  content: Buffer;
  mimeType: string;
};

export type QuotationWhatsAppRequest = {
  to: string;
  body: string;
  document?: WhatsAppDocument;
  agencyId?: string | null;
  quotationId?: string;
  /** Absolute base URL for temporary media fetch (Twilio). */
  publicBaseUrl?: string;
};

export type QuotationWhatsAppResult = {
  ok: boolean;
  configured: boolean;
  provider: "meta" | "twilio" | "capture" | "none";
  messageId?: string;
  error?: string;
};

function forceCapture(): boolean {
  return process.env.QUOTATION_WHATSAPP_PROVIDER === "capture"
    || process.env.QUOTATION_DELIVERY_PROVIDER === "capture";
}

function forceDisabled(): boolean {
  const v = process.env.QUOTATION_WHATSAPP_PROVIDER || process.env.QUOTATION_DELIVERY_PROVIDER;
  return v === "none" || v === "off" || v === "disabled";
}

function mediaSecret(): string {
  return process.env.DELIVERY_MEDIA_SECRET || process.env.JWT_SECRET || "trevio-delivery-dev-secret";
}

/** E.164-ish digits with optional leading +. Strips spaces and punctuation. */
export function normalizeWhatsAppPhone(raw: string, defaultCountry = "91"): string | null {
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10 && defaultCountry) digits = `${defaultCountry}${digits}`;
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

export function createDeliveryMediaToken(payload: {
  quotationId: string;
  documentId: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  ttlSeconds?: number;
}): string {
  const exp = Math.floor(Date.now() / 1000) + (payload.ttlSeconds ?? 900);
  const body = Buffer.from(JSON.stringify({
    q: payload.quotationId,
    d: payload.documentId,
    k: payload.storageKey,
    f: payload.filename,
    m: payload.mimeType,
    exp,
  }), "utf8").toString("base64url");
  const sig = createHmac("sha256", mediaSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyDeliveryMediaToken(token: string): {
  quotationId: string;
  documentId: string;
  storageKey: string;
  filename: string;
  mimeType: string;
} | null {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", mediaSecret()).update(body).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      q: string; d: string; k: string; f: string; m: string; exp: number;
    };
    if (!parsed?.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      quotationId: parsed.q,
      documentId: parsed.d,
      storageKey: parsed.k,
      filename: parsed.f,
      mimeType: parsed.m,
    };
  } catch {
    return null;
  }
}

async function sendMetaWhatsApp(req: QuotationWhatsAppRequest, phone: string): Promise<QuotationWhatsAppResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_API_VERSION || "v21.0";
  if (!token || !phoneNumberId) {
    return { ok: false, configured: false, provider: "none", error: "WhatsApp Meta Cloud API is not configured." };
  }

  let mediaId: string | undefined;
  if (req.document) {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", "application/pdf");
    form.append("file", new Blob([new Uint8Array(req.document.content)], { type: req.document.mimeType }), req.document.filename);
    const uploadRes = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const uploadJson = await uploadRes.json().catch(() => ({})) as { id?: string; error?: { message?: string } };
    if (!uploadRes.ok || !uploadJson.id) {
      return {
        ok: false,
        configured: true,
        provider: "meta",
        error: uploadJson.error?.message || `WhatsApp media upload failed (${uploadRes.status})`,
      };
    }
    mediaId = uploadJson.id;
  }

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: phone,
    type: mediaId ? "document" : "text",
  };
  if (mediaId && req.document) {
    payload.document = { id: mediaId, filename: req.document.filename, caption: req.body.slice(0, 1024) };
  } else {
    payload.text = { body: req.body };
  }

  const sendRes = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const sendJson = await sendRes.json().catch(() => ({})) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string };
  };
  if (!sendRes.ok) {
    return {
      ok: false,
      configured: true,
      provider: "meta",
      error: sendJson.error?.message || `WhatsApp send failed (${sendRes.status})`,
    };
  }
  return {
    ok: true,
    configured: true,
    provider: "meta",
    messageId: sendJson.messages?.[0]?.id,
  };
}

async function sendTwilioWhatsApp(req: QuotationWhatsAppRequest, phone: string): Promise<QuotationWhatsAppResult> {
  const keys = await getAgencyApiKeys(req.agencyId);
  const sid = keys.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID;
  const auth = keys.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !auth || !from) {
    return {
      ok: false,
      configured: false,
      provider: "none",
      error: "WhatsApp Twilio is not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM).",
    };
  }

  const params = new URLSearchParams();
  params.set("From", from.startsWith("whatsapp:") ? from : `whatsapp:${from}`);
  params.set("To", `whatsapp:+${phone}`);
  params.set("Body", req.body);

  if (req.document && req.publicBaseUrl) {
    // Media URL must be fetchable by Twilio; callers pass a short-lived token URL.
    params.set("MediaUrl", req.publicBaseUrl);
  }

  const creds = Buffer.from(`${sid}:${auth}`).toString("base64");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const json = await res.json().catch(() => ({})) as { sid?: string; message?: string; error_message?: string };
  if (!res.ok) {
    return {
      ok: false,
      configured: true,
      provider: "twilio",
      error: json.message || json.error_message || `Twilio WhatsApp failed (${res.status})`,
    };
  }
  return { ok: true, configured: true, provider: "twilio", messageId: json.sid };
}

function preferredProvider(): "meta" | "twilio" | "auto" {
  const raw = (process.env.QUOTATION_WHATSAPP_PROVIDER || "auto").toLowerCase();
  if (raw === "meta" || raw === "twilio") return raw;
  return "auto";
}

function metaConfigured(): boolean {
  return Boolean(
    (process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_WHATSAPP_TOKEN)
    && (process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_WHATSAPP_PHONE_NUMBER_ID),
  );
}

function twilioEnvConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM);
}

/**
 * Server-side WhatsApp delivery. Capture mode is for tests only.
 * Unconfigured providers return configured:false — never a fake production success.
 */
export async function sendQuotationWhatsApp(req: QuotationWhatsAppRequest): Promise<QuotationWhatsAppResult> {
  const phone = normalizeWhatsAppPhone(req.to);
  if (!phone) {
    return { ok: false, configured: true, provider: "none", error: "Invalid WhatsApp recipient phone number." };
  }

  if (forceCapture()) {
    captureWhatsApp({
      to: phone,
      body: req.body,
      attachmentName: req.document?.filename,
      attachmentBytes: req.document?.content.length,
      quotationId: req.quotationId,
    });
    return { ok: true, configured: true, provider: "capture", messageId: `capture-wa-${Date.now()}` };
  }

  if (forceDisabled()) {
    return {
      ok: false,
      configured: false,
      provider: "none",
      error: "WhatsApp provider is disabled (QUOTATION_WHATSAPP_PROVIDER=none).",
    };
  }

  try {
    const pref = preferredProvider();
    if (pref === "meta" || (pref === "auto" && metaConfigured())) {
      return await sendMetaWhatsApp(req, phone);
    }
    if (pref === "twilio" || (pref === "auto" && twilioEnvConfigured())) {
      return await sendTwilioWhatsApp(req, phone);
    }
    if (twilioEnvConfigured() === false && !metaConfigured()) {
      return {
        ok: false,
        configured: false,
        provider: "none",
        error: "WhatsApp provider is not configured. Set Meta Cloud API or Twilio WhatsApp env vars.",
      };
    }
    // Agency Twilio keys without TWILIO_WHATSAPP_FROM still count as not fully configured.
    const keys = await getAgencyApiKeys(req.agencyId);
    if (keys.twilioAccountSid && keys.twilioAuthToken && !process.env.TWILIO_WHATSAPP_FROM) {
      return {
        ok: false,
        configured: false,
        provider: "none",
        error: "WhatsApp Twilio sender is missing. Set TWILIO_WHATSAPP_FROM.",
      };
    }
    return {
      ok: false,
      configured: false,
      provider: "none",
      error: "WhatsApp provider is not configured. Set Meta Cloud API or Twilio WhatsApp env vars.",
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error({ err: message, quotationId: req.quotationId }, "quotation whatsapp failed");
    return { ok: false, configured: true, provider: "none", error: message };
  }
}
