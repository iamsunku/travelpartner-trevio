import { db } from "../db.js";
import { logger } from "../logger.js";
import { isAgentLike, buildTermsSnapshot, writeQuoteAudit } from "../quotations.js";
import { agentCanAccessQuote, agentQuoteScope, quoteSendBlockReason } from "../quote-access.js";
import { generateQuotationPdf, QuotationPdfError } from "../quotation-pdf/index.js";
import { readPrivateObject } from "../document-storage.js";
import { quoteUnresolvedRateReason } from "../contracted-rates.js";
import { pricingBlockReason, TAX_CONFIGURATION_REQUIRED } from "../pricing.js";
import { sendQuotationEmail } from "./email-provider.js";
import {
  createDeliveryMediaToken,
  normalizeWhatsAppPhone,
  sendQuotationWhatsApp,
} from "./whatsapp-provider.js";
import {
  assertCustomerSafeDeliveryText,
  buildQuotationEmailHtml,
  buildQuotationWhatsAppBody,
} from "./customer-message.js";
import { createCustomerAccessLink, resolveAppOrigin } from "../quotation-customer-access.js";

export class QuotationDeliveryError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "QuotationDeliveryError";
    this.statusCode = statusCode;
  }
}

export type DeliveryChannel = "Email" | "WhatsApp";

export type DeliverQuotationInput = {
  quotationId: string;
  channel: DeliveryChannel;
  agencyScope: Record<string, unknown>;
  role?: string;
  userId?: string;
  email?: string;
  recipient?: string;
  message?: string;
  /** Public API origin for Twilio media fetch, e.g. https://api.example.com */
  publicBaseUrl?: string;
  /** Frontend origin used to build the secure customer response URL. */
  appOrigin?: string;
};

function pricingFinalizationBlock(packages: Array<{ pricing?: unknown }> | undefined): string | null {
  if (!packages?.length) return TAX_CONFIGURATION_REQUIRED;
  for (const pkg of packages) {
    const pricing = pkg.pricing as { unresolved?: boolean; taxRequired?: boolean } | null;
    if (!pricing || pricing.unresolved || pricing.taxRequired) {
      return pricingBlockReason(pricing || { taxRequired: true });
    }
  }
  return null;
}

async function ensureCustomerPdf(input: {
  quotationId: string;
  agencyScope: Record<string, unknown>;
  role?: string;
  userId?: string;
  email?: string;
  quoteUpdatedAt: Date;
  currentVersion: number;
}): Promise<{ documentId: string; fileName: string; storageKey: string; mimeType: string; buffer: Buffer; packageCount: number; versionNumber: number }> {
  const latest = await db.quotationDocument.findFirst({
    where: {
      quotationId: input.quotationId,
      relatedEntity: "CUSTOMER_QUOTATION_PDF",
      visibility: "CUSTOMER",
      mimeType: "application/pdf",
      storageKey: { not: null },
      versionNumber: input.currentVersion,
    },
    orderBy: { createdAt: "desc" },
  });

  if (latest?.storageKey && latest.createdAt >= input.quoteUpdatedAt) {
    const buffer = await readPrivateObject(latest.storageKey);
    if (buffer && buffer.length > 4 && buffer.subarray(0, 4).toString() === "%PDF") {
      const pkgCount = await db.quotationPackage.count({ where: { quotationId: input.quotationId } });
      return {
        documentId: latest.id,
        fileName: latest.fileName,
        storageKey: latest.storageKey,
        mimeType: latest.mimeType || "application/pdf",
        buffer,
        packageCount: pkgCount,
        versionNumber: latest.versionNumber || input.currentVersion,
      };
    }
  }

  const generated = await generateQuotationPdf({
    quotationId: input.quotationId,
    agencyScope: input.agencyScope,
    role: input.role,
    userId: input.userId,
    email: input.email,
    mode: "customer",
  });
  const doc = await db.quotationDocument.findUnique({ where: { id: generated.document.id } });
  if (!doc?.storageKey) throw new QuotationDeliveryError("Customer PDF was generated but storage is missing.", 500);
  const buffer = await readPrivateObject(doc.storageKey);
  if (!buffer?.length) throw new QuotationDeliveryError("Customer PDF could not be read from private storage.", 500);
  if (doc.visibility !== "CUSTOMER" || doc.relatedEntity !== "CUSTOMER_QUOTATION_PDF") {
    throw new QuotationDeliveryError("Refusing to deliver a non-customer document.", 500);
  }
  return {
    documentId: doc.id,
    fileName: doc.fileName,
    storageKey: doc.storageKey,
    mimeType: doc.mimeType || "application/pdf",
    buffer,
    packageCount: generated.packageCount,
    versionNumber: doc.versionNumber || input.currentVersion,
  };
}

async function maybeAdvanceSendStatus(quote: {
  id: string;
  status: string;
  approvalStatus: string | null;
  agencyId: string | null;
}, role?: string) {
  // Delivery success may advance send workflow; never approves/accepts/converts.
  if (["Pending Approval"].includes(quote.status) && quote.approvalStatus === "Approved" && !isAgentLike(role)) {
    await db.quotation.update({
      where: { id: quote.id },
      data: { status: "Sent to Agent", termsSnapshot: buildTermsSnapshot(quote as never) },
    });
  } else if (quote.status === "Sent to Agent") {
    await db.quotation.update({ where: { id: quote.id }, data: { status: "Customer Reviewing" } });
  } else if (isAgentLike(role) && ["Sent to Agent", "Approved"].includes(quote.status)) {
    await db.quotation.update({ where: { id: quote.id }, data: { status: "Customer Reviewing" } });
  }
}

/**
 * Real customer quotation delivery (email or WhatsApp) using Phase 5 customer PDF.
 * Append-only QuotationShare rows record attempts; success requires provider confirmation.
 */
export async function deliverQuotation(input: DeliverQuotationInput) {
  const quote = await db.quotation.findFirst({
    where: {
      id: input.quotationId,
      deletedAt: null,
      ...input.agencyScope,
      ...agentQuoteScope(input.role, input.userId),
    },
    include: {
      packages: { orderBy: { sortOrder: "asc" } },
      approvals: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!quote) throw new QuotationDeliveryError("Quotation not found", 404);
  if (isAgentLike(input.role) && !agentCanAccessQuote(input.role, input.userId, quote)) {
    throw new QuotationDeliveryError("Quotation not found", 404);
  }

  const blocked = quoteSendBlockReason(quote);
  if (blocked) throw new QuotationDeliveryError(blocked, 403);

  const unresolved = quoteUnresolvedRateReason(quote.packages as unknown as Array<Record<string, unknown>>)
    || pricingFinalizationBlock(quote.packages);
  if (unresolved) throw new QuotationDeliveryError(unresolved, 400);

  const recipient = String(
    input.recipient
    || (input.channel === "Email" ? quote.contactEmail : quote.contactPhone)
    || "",
  ).trim();
  if (!recipient) {
    throw new QuotationDeliveryError(
      input.channel === "Email" ? "Customer email is required." : "Customer WhatsApp phone is required.",
      400,
    );
  }
  if (input.channel === "Email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new QuotationDeliveryError("Invalid email recipient.", 400);
  }
  if (input.channel === "WhatsApp" && !normalizeWhatsAppPhone(recipient)) {
    throw new QuotationDeliveryError("Invalid WhatsApp phone number.", 400);
  }

  const pdf = await ensureCustomerPdf({
    quotationId: quote.id,
    agencyScope: input.agencyScope,
    role: input.role,
    userId: input.userId,
    email: input.email,
    quoteUpdatedAt: quote.updatedAt,
    currentVersion: quote.currentVersion || 1,
  });

  const summary = {
    quoteNo: quote.quoteNo,
    customerName: quote.customerName,
    destination: quote.destination,
    travelDates: quote.travelDates,
    travelStartDate: quote.travelStartDate,
    travelEndDate: quote.travelEndDate,
    packageCount: pdf.packageCount,
  };
  let customerLink: string | null = null;
  try {
    const access = await createCustomerAccessLink({
      quotationId: quote.id,
      createdById: input.userId,
      createdByName: input.email,
      appOrigin: resolveAppOrigin(input.appOrigin),
    });
    customerLink = access.url;
  } catch (err) {
    logger.warn({ err, quotationId: quote.id }, "customer response link not attached to delivery");
  }
  const extra = input.message?.trim() || undefined;
  const emailHtml = buildQuotationEmailHtml(summary, extra, customerLink);
  const waBody = buildQuotationWhatsAppBody(summary, extra, customerLink);
  const leaks = [
    ...assertCustomerSafeDeliveryText(emailHtml),
    ...assertCustomerSafeDeliveryText(waBody),
    ...assertCustomerSafeDeliveryText(extra || ""),
  ];
  if (leaks.length) {
    throw new QuotationDeliveryError("Delivery blocked: message contained restricted content.", 500);
  }

  const share = await db.quotationShare.create({
    data: {
      quotationId: quote.id,
      channel: input.channel,
      recipient,
      senderName: input.email || null,
      initiatedById: input.userId || null,
      message: extra || null,
      status: "Attempted",
      documentId: pdf.documentId,
      attachmentName: pdf.fileName,
      packageCount: pdf.packageCount,
      versionNumber: pdf.versionNumber,
    },
  });

  let result: { ok: boolean; configured: boolean; provider: string; messageId?: string; error?: string };

  if (input.channel === "Email") {
    result = await sendQuotationEmail({
      to: recipient,
      subject: `Quotation ${quote.quoteNo} — ${quote.destination || "Travel"}`,
      html: emailHtml,
      agencyId: quote.agencyId,
      quotationId: quote.id,
      attachments: [{
        filename: pdf.fileName,
        content: pdf.buffer,
        contentType: "application/pdf",
      }],
    });
  } else {
    let publicMediaUrl: string | undefined;
    if (input.publicBaseUrl) {
      const token = createDeliveryMediaToken({
        quotationId: quote.id,
        documentId: pdf.documentId,
        storageKey: pdf.storageKey,
        filename: pdf.fileName,
        mimeType: pdf.mimeType,
      });
      publicMediaUrl = `${input.publicBaseUrl.replace(/\/$/, "")}/api/delivery-media/${token}`;
    }
    result = await sendQuotationWhatsApp({
      to: recipient,
      body: waBody,
      agencyId: quote.agencyId,
      quotationId: quote.id,
      publicBaseUrl: publicMediaUrl,
      document: {
        filename: pdf.fileName,
        content: pdf.buffer,
        mimeType: "application/pdf",
      },
    });
  }

  const status = result.ok ? "Sent" : result.configured ? "Failed" : "NotConfigured";
  const updated = await db.quotationShare.update({
    where: { id: share.id },
    data: {
      status,
      provider: result.provider,
      providerMessageId: result.messageId || null,
      failureReason: result.ok ? null : (result.error || "Delivery failed"),
      deliveredAt: result.ok ? new Date() : null,
    },
  });

  if (result.ok) {
    await maybeAdvanceSendStatus(quote, input.role);
  }

  await writeQuoteAudit({
    req: {
      auth: { userId: input.userId, email: input.email, role: input.role },
      ip: undefined,
    } as Parameters<typeof writeQuoteAudit>[0]["req"],
    agencyId: quote.agencyId,
    quotationId: quote.id,
    action: result.ok
      ? (input.channel === "Email" ? "Quotation Email Delivered" : "Quotation WhatsApp Delivered")
      : (input.channel === "Email" ? "Quotation Email Failed" : "Quotation WhatsApp Failed"),
    details: recipient,
    updatedValue: {
      shareId: updated.id,
      status,
      provider: result.provider,
      documentId: pdf.documentId,
      configured: result.configured,
      error: result.error,
    },
  }).catch((e) => logger.warn(e));

  return {
    ok: result.ok,
    configured: result.configured,
    error: result.ok ? undefined : (result.error || "Delivery failed"),
    delivery: {
      id: updated.id,
      channel: updated.channel,
      status: updated.status,
      recipient: updated.recipient,
      provider: updated.provider,
      providerMessageId: updated.providerMessageId,
      documentId: updated.documentId,
      attachmentName: updated.attachmentName,
      packageCount: updated.packageCount,
      versionNumber: updated.versionNumber,
      deliveredAt: updated.deliveredAt,
      failureReason: updated.failureReason,
      createdAt: updated.createdAt,
    },
    document: {
      id: pdf.documentId,
      fileName: pdf.fileName,
      mimeType: pdf.mimeType,
      sizeBytes: pdf.buffer.length,
      visibility: "CUSTOMER" as const,
      versionNumber: pdf.versionNumber,
    },
    quoteId: quote.id,
    quoteNo: quote.quoteNo,
    versionNumber: pdf.versionNumber,
  };
}

export { QuotationPdfError };
