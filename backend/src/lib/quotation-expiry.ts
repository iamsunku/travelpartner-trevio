import { db } from "./db.js";
import { logger } from "./logger.js";
import { notifyQuote } from "./quotations.js";

/**
 * Phase 8 — Quotation expiry semantics
 *
 * `Quotation.validTill` is a calendar date string `YYYY-MM-DD` (not a DateTime).
 * A quotation is past validity when `validTill < calendarDateUtc(now)`.
 * Equality (`validTill === today`) remains valid through the end of that UTC calendar day.
 *
 * Status transition to `Expired` is only applied for EXPIRY_ELIGIBLE_STATUSES.
 * Draft / In Progress / Pending Approval / Revision Requested / Rejected /
 * Converted / Archived are never auto-expired (state machine + EXP-01).
 */

/** Statuses that may transition to Expired when validTill has passed. */
export const EXPIRY_ELIGIBLE_STATUSES = [
  "Sent to Agent",
  "Sent", // legacy alias
  "Customer Reviewing",
  "Accepted",
] as const;

export type ExpiryEligibleStatus = (typeof EXPIRY_ELIGIBLE_STATUSES)[number];

export type ExpiryRunResult = {
  scanned: number;
  expired: number;
  skipped: number;
  errors: number;
  today: string;
};

/** UTC calendar date `YYYY-MM-DD` — matches existing `toISOString().slice(0, 10)` convention. */
export function calendarDateUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** True when validTill is a non-empty date string strictly before `today`. */
export function isPastValidTill(
  validTill: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!validTill || typeof validTill !== "string") return false;
  const till = validTill.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(till)) return false;
  return till < calendarDateUtc(now);
}

export function isExpiryEligibleStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return (EXPIRY_ELIGIBLE_STATUSES as readonly string[]).includes(status);
}

/**
 * Delivery / accept / convert gate: status already Expired, or eligible status
 * whose validTill has passed (defense in depth before the job runs).
 */
export function quotePastValidityBlockReason(
  quote: { status?: string | null; validTill?: string | null },
  now: Date = new Date(),
): string | null {
  const status = quote.status === "Sent" ? "Sent to Agent" : quote.status || "";
  if (status === "Expired") {
    return "An expired quotation cannot be used until it is renewed.";
  }
  if (status === "Converted to Booking" || status === "Archived" || status === "Rejected") {
    return null;
  }
  if (isPastValidTill(quote.validTill, now) && isExpiryEligibleStatus(quote.status || "")) {
    return "This quotation’s validity date has passed. Renew before continuing.";
  }
  return null;
}

/** Default validity for a restored revision when the snapshot’s validTill is stale. */
export function freshValidTill(now: Date = new Date(), days = 7): string {
  const d = new Date(now.getTime() + days * 86400000);
  return calendarDateUtc(d);
}

export type ExpireDueOptions = {
  agencyWhere?: Record<string, unknown>;
  now?: Date;
  limit?: number;
  /** When true, only count eligible rows — no updates or notifications. */
  dryRun?: boolean;
};

/**
 * Idempotent server-side expiry. Safe to re-run and safe under concurrent workers:
 * each row is updated with `updateMany` that re-checks eligible status + past validTill.
 * Notifications fire only when this worker actually transitioned the row.
 */
export async function expireDueQuotations(
  agencyWhereOrOpts: Record<string, unknown> | ExpireDueOptions = {},
): Promise<number> {
  const opts: ExpireDueOptions =
    agencyWhereOrOpts && ("agencyWhere" in agencyWhereOrOpts || "now" in agencyWhereOrOpts || "limit" in agencyWhereOrOpts || "dryRun" in agencyWhereOrOpts)
      ? (agencyWhereOrOpts as ExpireDueOptions)
      : { agencyWhere: agencyWhereOrOpts as Record<string, unknown> };

  const result = await runExpireDueQuotations(opts);
  return result.expired;
}

export async function runExpireDueQuotations(opts: ExpireDueOptions = {}): Promise<ExpiryRunResult> {
  const now = opts.now ?? new Date();
  const today = calendarDateUtc(now);
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 1000);
  const agencyWhere = opts.agencyWhere ?? {};

  const due = await db.quotation.findMany({
    where: {
      ...agencyWhere,
      deletedAt: null,
      status: { in: [...EXPIRY_ELIGIBLE_STATUSES] },
      validTill: { lt: today },
    },
    take: limit,
    orderBy: { validTill: "asc" },
    select: { id: true, quoteNo: true, agencyId: true, status: true, validTill: true },
  });

  const summary: ExpiryRunResult = {
    scanned: due.length,
    expired: 0,
    skipped: 0,
    errors: 0,
    today,
  };

  if (opts.dryRun) {
    summary.expired = due.length;
    return summary;
  }

  for (const q of due) {
    try {
      const updated = await db.quotation.updateMany({
        where: {
          id: q.id,
          deletedAt: null,
          status: { in: [...EXPIRY_ELIGIBLE_STATUSES] },
          validTill: { lt: today },
        },
        data: {
          status: "Expired",
          expiredAt: now,
        },
      });
      if (updated.count === 0) {
        summary.skipped += 1;
        continue;
      }
      summary.expired += 1;
      try {
        await notifyQuote({
          agencyId: q.agencyId,
          title: "Quote expired",
          message: `${q.quoteNo} expired`,
        });
      } catch (notifyErr) {
        logger.warn({ err: notifyErr, quotationId: q.id }, "expiry notification failed");
      }
    } catch (err) {
      summary.errors += 1;
      logger.error({ err, quotationId: q.id }, "failed to expire quotation");
    }
  }

  return summary;
}
