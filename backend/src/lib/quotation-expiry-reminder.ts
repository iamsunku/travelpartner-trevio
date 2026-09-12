import { db } from "./db.js";
import { logger } from "./logger.js";
import {
  calendarDateUtc,
  EXPIRY_ELIGIBLE_STATUSES,
  isExpiryEligibleStatus,
  isPastValidTill,
} from "./quotation-expiry.js";
import { createCustomerAccessLink, resolveAppOrigin } from "./quotation-customer-access.js";
import { sendQuotationEmail } from "./quotation-delivery/email-provider.js";
import {
  assertCustomerSafeDeliveryText,
  buildExpiryReminderEmailHtml,
  buildExpiryReminderSubject,
} from "./quotation-delivery/customer-message.js";

/**
 * Phase 17 — EXP-02 pre-expiry reminder emails
 *
 * Original EXP-02 requires a reminder before expiry but does not specify lead time.
 * Timing is therefore configurable via QUOTE_EXPIRY_REMINDER_DAYS_BEFORE (default 3).
 *
 * Does NOT change Phase 8 expiry semantics or mark quotations Expired.
 */

export const REMINDER_KIND_PRE_EXPIRY = "PRE_EXPIRY";

/** Default chosen because EXP-02 did not specify an interval — documented in PHASE_17 report. */
export const DEFAULT_REMINDER_DAYS_BEFORE = 3;

const ATTEMPTED_RECLAIM_MS = 15 * 60 * 1000;

export type ReminderRunResult = {
  scanned: number;
  sent: number;
  skipped: number;
  failed: number;
  notConfigured: number;
  errors: number;
  today: string;
  daysBefore: number;
};

export type ReminderRunOptions = {
  agencyWhere?: Record<string, unknown>;
  now?: Date;
  limit?: number;
  daysBefore?: number;
  dryRun?: boolean;
  appOrigin?: string;
};

export function remindersEnabled(): boolean {
  return process.env.QUOTE_EXPIRY_REMINDER_ENABLED !== "false";
}

export function reminderDaysBefore(override?: number): number {
  if (typeof override === "number" && Number.isFinite(override) && override >= 0) {
    return Math.min(Math.floor(override), 90);
  }
  const raw = process.env.QUOTE_EXPIRY_REMINDER_DAYS_BEFORE;
  if (raw === undefined || raw === "") return DEFAULT_REMINDER_DAYS_BEFORE;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_REMINDER_DAYS_BEFORE;
  return Math.min(Math.floor(n), 90);
}

/** Add calendar days to a YYYY-MM-DD string in UTC. */
export function addCalendarDaysUtc(ymd: string, days: number): string {
  const base = ymd.trim().slice(0, 10);
  const d = new Date(`${base}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysUntilValidTill(validTill: string, today: string): number | null {
  const till = validTill?.trim().slice(0, 10);
  const day = today?.trim().slice(0, 10);
  if (!till || !day || !/^\d{4}-\d{2}-\d{2}$/.test(till) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return null;
  }
  const a = Date.parse(`${day}T00:00:00.000Z`);
  const b = Date.parse(`${till}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Reminder window: still valid (validTill >= today) and within daysBefore inclusive.
 * Inclusive window so a missed exact-day tick still sends once (idempotent claim).
 */
export function isReminderDue(
  validTill: string | null | undefined,
  now: Date = new Date(),
  daysBefore: number = DEFAULT_REMINDER_DAYS_BEFORE,
): boolean {
  if (!validTill) return false;
  if (isPastValidTill(validTill, now)) return false;
  const days = daysUntilValidTill(validTill.trim().slice(0, 10), calendarDateUtc(now));
  if (days === null) return false;
  return days >= 0 && days <= daysBefore;
}

export function isReminderEligibleStatus(status: string | null | undefined): boolean {
  return isExpiryEligibleStatus(status);
}

function isUniqueViolation(err: unknown): boolean {
  return Boolean(
    err
    && typeof err === "object"
    && "code" in err
    && (err as { code?: string }).code === "P2002",
  );
}

function validEmail(value: string | null | undefined): value is string {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()));
}

async function claimReminder(opts: {
  quotationId: string;
  validTill: string;
  versionNumber: number;
  daysBefore: number;
  recipientEmail: string;
  subject: string;
}): Promise<{ id: string; claimed: boolean }> {
  try {
    const row = await db.quotationExpiryReminder.create({
      data: {
        quotationId: opts.quotationId,
        validTill: opts.validTill,
        versionNumber: opts.versionNumber,
        reminderKind: REMINDER_KIND_PRE_EXPIRY,
        daysBefore: opts.daysBefore,
        status: "Attempted",
        recipientEmail: opts.recipientEmail,
        subject: opts.subject,
      },
    });
    return { id: row.id, claimed: true };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const existing = await db.quotationExpiryReminder.findUnique({
      where: {
        quotationId_validTill_reminderKind_versionNumber: {
          quotationId: opts.quotationId,
          validTill: opts.validTill,
          reminderKind: REMINDER_KIND_PRE_EXPIRY,
          versionNumber: opts.versionNumber,
        },
      },
    });
    if (!existing) return { id: "", claimed: false };
    if (existing.status === "Sent") return { id: existing.id, claimed: false };

    const age = Date.now() - new Date(existing.createdAt).getTime();
    const reclaimable =
      existing.status === "NotConfigured"
      || existing.status === "Failed"
      || (existing.status === "Attempted" && age >= ATTEMPTED_RECLAIM_MS);

    if (!reclaimable) return { id: existing.id, claimed: false };

    const updated = await db.quotationExpiryReminder.updateMany({
      where: {
        id: existing.id,
        status: { in: ["NotConfigured", "Failed", "Attempted"] },
      },
      data: {
        status: "Attempted",
        daysBefore: opts.daysBefore,
        recipientEmail: opts.recipientEmail,
        subject: opts.subject,
        error: null,
        provider: null,
        providerMessageId: null,
        sentAt: null,
      },
    });
    return { id: existing.id, claimed: updated.count > 0 };
  }
}

async function markReminder(
  id: string,
  data: {
    status: "Sent" | "Failed" | "NotConfigured";
    provider?: string;
    providerMessageId?: string;
    error?: string;
    sentAt?: Date | null;
  },
): Promise<void> {
  await db.quotationExpiryReminder.update({
    where: { id },
    data: {
      status: data.status,
      provider: data.provider ?? null,
      providerMessageId: data.providerMessageId ?? null,
      error: data.error ?? null,
      sentAt: data.sentAt === undefined ? undefined : data.sentAt,
    },
  });
}

/**
 * Scan eligible quotations and send at most one pre-expiry reminder email per
 * (quotationId, validTill, versionNumber) event.
 */
export async function runExpiryReminders(opts: ReminderRunOptions = {}): Promise<ReminderRunResult> {
  const now = opts.now ?? new Date();
  const today = calendarDateUtc(now);
  const daysBefore = reminderDaysBefore(opts.daysBefore);
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 1000);
  const agencyWhere = opts.agencyWhere ?? {};
  const maxValidTill = addCalendarDaysUtc(today, daysBefore);

  const summary: ReminderRunResult = {
    scanned: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    notConfigured: 0,
    errors: 0,
    today,
    daysBefore,
  };

  const candidates = await db.quotation.findMany({
    where: {
      ...agencyWhere,
      deletedAt: null,
      status: { in: [...EXPIRY_ELIGIBLE_STATUSES] },
      validTill: { gte: today, lte: maxValidTill },
      contactEmail: { not: null },
    },
    take: limit,
    orderBy: [{ validTill: "asc" }, { updatedAt: "asc" }],
    select: {
      id: true,
      quoteNo: true,
      agencyId: true,
      status: true,
      validTill: true,
      currentVersion: true,
      contactEmail: true,
      customerName: true,
      destination: true,
      travelDates: true,
      travelStartDate: true,
      travelEndDate: true,
      packages: { select: { id: true } },
    },
  });

  summary.scanned = candidates.length;

  if (opts.dryRun) {
    summary.sent = candidates.filter((q) =>
      isReminderDue(q.validTill, now, daysBefore) && validEmail(q.contactEmail),
    ).length;
    return summary;
  }

  for (const q of candidates) {
    try {
      if (!isReminderEligibleStatus(q.status) || q.status === "Expired") {
        summary.skipped += 1;
        continue;
      }
      if (!isReminderDue(q.validTill, now, daysBefore)) {
        summary.skipped += 1;
        continue;
      }
      const recipient = q.contactEmail?.trim() || "";
      if (!validEmail(recipient)) {
        summary.skipped += 1;
        continue;
      }

      const versionNumber = q.currentVersion || 1;
      const validTill = q.validTill.trim().slice(0, 10);
      const subject = buildExpiryReminderSubject(q.quoteNo, validTill);

      const claim = await claimReminder({
        quotationId: q.id,
        validTill,
        versionNumber,
        daysBefore,
        recipientEmail: recipient,
        subject,
      });
      if (!claim.claimed || !claim.id) {
        summary.skipped += 1;
        continue;
      }

      let customerLink: string | null = null;
      try {
        const access = await createCustomerAccessLink({
          quotationId: q.id,
          createdByName: "expiry-reminder",
          appOrigin: resolveAppOrigin(opts.appOrigin),
        });
        customerLink = access.url;
      } catch (linkErr) {
        logger.warn({ err: linkErr, quotationId: q.id }, "expiry reminder: customer link unavailable");
      }

      const html = buildExpiryReminderEmailHtml(
        {
          quoteNo: q.quoteNo,
          customerName: q.customerName,
          destination: q.destination,
          travelDates: q.travelDates,
          travelStartDate: q.travelStartDate,
          travelEndDate: q.travelEndDate,
          packageCount: q.packages?.length || 0,
          validTill,
        },
        customerLink,
      );

      const leaks = assertCustomerSafeDeliveryText(html);
      if (leaks.length) {
        await markReminder(claim.id, {
          status: "Failed",
          error: `Blocked unsafe content: ${leaks.join(", ")}`,
        });
        summary.failed += 1;
        continue;
      }

      if (customerLink && !/\/q\/[A-Za-z0-9_-]{20,}/.test(customerLink)) {
        await markReminder(claim.id, {
          status: "Failed",
          error: "Customer link is not a secure token URL",
        });
        summary.failed += 1;
        continue;
      }

      const result = await sendQuotationEmail({
        to: recipient,
        subject,
        html,
        agencyId: q.agencyId || undefined,
        quotationId: q.id,
      });

      if (!result.configured) {
        await markReminder(claim.id, {
          status: "NotConfigured",
          provider: result.provider,
          error: result.error || "Email provider is not configured",
        });
        summary.notConfigured += 1;
        continue;
      }

      if (!result.ok) {
        await markReminder(claim.id, {
          status: "Failed",
          provider: result.provider,
          error: result.error || "Email send failed",
        });
        summary.failed += 1;
        continue;
      }

      await markReminder(claim.id, {
        status: "Sent",
        provider: result.provider,
        providerMessageId: result.messageId,
        sentAt: now,
      });
      summary.sent += 1;
    } catch (err) {
      summary.errors += 1;
      logger.error({ err, quotationId: q.id }, "expiry reminder failed");
    }
  }

  return summary;
}
