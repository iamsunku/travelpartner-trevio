import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addCalendarDaysUtc,
  DEFAULT_REMINDER_DAYS_BEFORE,
  daysUntilValidTill,
  isReminderDue,
  isReminderEligibleStatus,
  reminderDaysBefore,
  runExpiryReminders,
} from "../lib/quotation-expiry-reminder.js";
import { calendarDateUtc, isPastValidTill } from "../lib/quotation-expiry.js";
import {
  assertCustomerSafeDeliveryText,
  buildExpiryReminderEmailHtml,
  buildExpiryReminderSubject,
} from "../lib/quotation-delivery/customer-message.js";
import {
  getCapturedEmails,
  resetDeliveryCaptures,
} from "../lib/quotation-delivery/capture.js";

vi.mock("../lib/db.js", () => {
  return {
    db: {
      quotation: {
        findMany: vi.fn(),
      },
      quotationExpiryReminder: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    },
  };
});

vi.mock("../lib/quotation-customer-access.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/quotation-customer-access.js")>();
  return {
    ...actual,
    createCustomerAccessLink: vi.fn(),
  };
});

import { db } from "../lib/db.js";
import { createCustomerAccessLink } from "../lib/quotation-customer-access.js";

const findMany = db.quotation.findMany as ReturnType<typeof vi.fn>;
const reminderCreate = db.quotationExpiryReminder.create as ReturnType<typeof vi.fn>;
const reminderFindUnique = db.quotationExpiryReminder.findUnique as ReturnType<typeof vi.fn>;
const reminderUpdate = db.quotationExpiryReminder.update as ReturnType<typeof vi.fn>;
const reminderUpdateMany = db.quotationExpiryReminder.updateMany as ReturnType<typeof vi.fn>;
const createLink = createCustomerAccessLink as ReturnType<typeof vi.fn>;

const NOW = new Date("2026-09-12T12:00:00.000Z");
const TODAY = "2026-09-12";

function eligibleQuote(overrides: Record<string, unknown> = {}) {
  return {
    id: "q-eligible",
    quoteNo: "TG-QT-2026-R01",
    agencyId: "ag1",
    status: "Sent to Agent",
    validTill: "2026-09-15",
    currentVersion: 2,
    contactEmail: "guest@example.com",
    customerName: "Dillip Traveller",
    destination: "Bali",
    travelDates: null,
    travelStartDate: "2026-10-01",
    travelEndDate: "2026-10-05",
    packages: [{ id: "p1" }, { id: "p2" }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetDeliveryCaptures();
  process.env.QUOTATION_EMAIL_PROVIDER = "capture";
  process.env.PUBLIC_APP_ORIGIN = "http://localhost:3100";
  delete process.env.QUOTE_EXPIRY_REMINDER_DAYS_BEFORE;
  delete process.env.QUOTE_EXPIRY_REMINDER_ENABLED;

  findMany.mockResolvedValue([]);
  reminderCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "rem-1",
    ...data,
    createdAt: NOW,
    updatedAt: NOW,
  }));
  reminderFindUnique.mockResolvedValue(null);
  reminderUpdate.mockResolvedValue({});
  reminderUpdateMany.mockResolvedValue({ count: 1 });
  createLink.mockResolvedValue({
    rawToken: "tok_secure_customer_access_token_abc123xyz",
    accessId: "acc-1",
    versionNumber: 2,
    expiresAt: null,
    url: "http://localhost:3100/q/tok_secure_customer_access_token_abc123xyz",
  });
});

afterEach(() => {
  resetDeliveryCaptures();
  delete process.env.QUOTATION_EMAIL_PROVIDER;
  delete process.env.PUBLIC_APP_ORIGIN;
  delete process.env.QUOTE_EXPIRY_REMINDER_DAYS_BEFORE;
});

describe("phase 17 EXP-02 timing helpers", () => {
  it("default days-before is configurable and defaults to 3 (EXP-02 interval unspecified)", () => {
    expect(DEFAULT_REMINDER_DAYS_BEFORE).toBe(3);
    expect(reminderDaysBefore()).toBe(3);
    process.env.QUOTE_EXPIRY_REMINDER_DAYS_BEFORE = "1";
    expect(reminderDaysBefore()).toBe(1);
    process.env.QUOTE_EXPIRY_REMINDER_DAYS_BEFORE = "0";
    expect(reminderDaysBefore()).toBe(0);
  });

  it("daysUntilValidTill and inclusive reminder window", () => {
    expect(daysUntilValidTill("2026-09-15", TODAY)).toBe(3);
    expect(isReminderDue("2026-09-15", NOW, 3)).toBe(true);
    expect(isReminderDue("2026-09-16", NOW, 3)).toBe(false);
    expect(isReminderDue("2026-09-12", NOW, 3)).toBe(true);
    expect(isReminderDue("2026-09-11", NOW, 3)).toBe(false);
    expect(isPastValidTill("2026-09-11", NOW)).toBe(true);
  });

  it("addCalendarDaysUtc matches Phase 8 UTC calendar dates", () => {
    expect(addCalendarDaysUtc(TODAY, 3)).toBe("2026-09-15");
    expect(calendarDateUtc(NOW)).toBe(TODAY);
  });

  it("eligible statuses align with Phase 8 expiry eligibility", () => {
    expect(isReminderEligibleStatus("Sent to Agent")).toBe(true);
    expect(isReminderEligibleStatus("Customer Reviewing")).toBe(true);
    expect(isReminderEligibleStatus("Accepted")).toBe(true);
    expect(isReminderEligibleStatus("Draft")).toBe(false);
    expect(isReminderEligibleStatus("Rejected")).toBe(false);
    expect(isReminderEligibleStatus("Converted to Booking")).toBe(false);
    expect(isReminderEligibleStatus("Expired")).toBe(false);
  });
});

describe("phase 17 EXP-02 reminder emails", () => {
  it("A. eligible quotation receives one reminder", async () => {
    findMany.mockResolvedValue([eligibleQuote()]);
    const result = await runExpiryReminders({ now: NOW, daysBefore: 3 });
    expect(result.sent).toBe(1);
    expect(result.scanned).toBe(1);
    const captured = getCapturedEmails();
    expect(captured).toHaveLength(1);
    expect(captured[0].to).toBe("guest@example.com");
    expect(captured[0].subject).toBe(buildExpiryReminderSubject("TG-QT-2026-R01", "2026-09-15"));
    expect(captured[0].html).toContain("2026-09-15");
    expect(captured[0].html).toContain("TG-QT-2026-R01");
    expect(reminderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "Sent", provider: "capture" }),
      }),
    );
  });

  it("B. ineligible quotation does not receive reminder", async () => {
    findMany.mockResolvedValue([
      eligibleQuote({ id: "q-draft", status: "Draft", quoteNo: "TG-QT-DRAFT" }),
    ]);
    // findMany is status-filtered in production; still guard in loop
    findMany.mockResolvedValue([]);
    const empty = await runExpiryReminders({ now: NOW, daysBefore: 3 });
    expect(empty.sent).toBe(0);
    expect(getCapturedEmails()).toHaveLength(0);

    findMany.mockResolvedValue([
      eligibleQuote({ id: "q-rejected", status: "Rejected" }),
    ]);
    const rejected = await runExpiryReminders({ now: NOW, daysBefore: 3 });
    expect(rejected.sent).toBe(0);
    expect(rejected.skipped).toBe(1);
    expect(getCapturedEmails()).toHaveLength(0);
  });

  it("C. already expired quotation does not receive reminder", async () => {
    findMany.mockResolvedValue([
      eligibleQuote({
        id: "q-expired",
        status: "Expired",
        validTill: "2026-09-10",
      }),
    ]);
    const result = await runExpiryReminders({ now: NOW, daysBefore: 3 });
    expect(result.sent).toBe(0);
    expect(getCapturedEmails()).toHaveLength(0);
  });

  it("D+E. duplicate scheduler execution / restart remains idempotent", async () => {
    findMany.mockResolvedValue([eligibleQuote()]);
    const first = await runExpiryReminders({ now: NOW, daysBefore: 3 });
    expect(first.sent).toBe(1);
    expect(getCapturedEmails()).toHaveLength(1);

    // Second tick: unique claim already Sent
    reminderCreate.mockRejectedValue({ code: "P2002" });
    reminderFindUnique.mockResolvedValue({
      id: "rem-1",
      status: "Sent",
      createdAt: NOW,
    });
    const second = await runExpiryReminders({ now: NOW, daysBefore: 3 });
    expect(second.sent).toBe(0);
    expect(second.skipped).toBe(1);
    expect(getCapturedEmails()).toHaveLength(1);
  });

  it("F. reminder references current quotation version", async () => {
    findMany.mockResolvedValue([eligibleQuote({ currentVersion: 3, quoteNo: "TG-QT-V3" })]);
    await runExpiryReminders({ now: NOW, daysBefore: 3 });
    expect(reminderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          versionNumber: 3,
          validTill: "2026-09-15",
          reminderKind: "PRE_EXPIRY",
        }),
      }),
    );
    expect(createLink).toHaveBeenCalled();
  });

  it("G. customer-safe information only", async () => {
    const html = buildExpiryReminderEmailHtml({
      quoteNo: "TG-QT-2026-R01",
      customerName: "Dillip Traveller",
      destination: "Bali",
      travelStartDate: "2026-10-01",
      travelEndDate: "2026-10-05",
      packageCount: 2,
      validTill: "2026-09-15",
    }, "http://localhost:3100/q/tok_secure_customer_access_token_abc123xyz");
    expect(assertCustomerSafeDeliveryText(html)).toEqual([]);
    expect(html).not.toMatch(/contracted|supplier|markup|profit|internal|costPrice/i);
    expect(html).toContain("2026-09-15");
    expect(html).toContain("TG-QT-2026-R01");

    findMany.mockResolvedValue([eligibleQuote()]);
    await runExpiryReminders({ now: NOW, daysBefore: 3 });
    expect(assertCustomerSafeDeliveryText(getCapturedEmails()[0].html)).toEqual([]);
  });

  it("H. secure customer response link is used", async () => {
    findMany.mockResolvedValue([eligibleQuote()]);
    await runExpiryReminders({ now: NOW, daysBefore: 3 });
    const html = getCapturedEmails()[0].html;
    expect(html).toContain("/q/tok_secure_customer_access_token_abc123xyz");
    expect(html).not.toMatch(/\/quotations\/q-eligible|quotationId=q-eligible/i);
    expect(createLink).toHaveBeenCalledWith(
      expect.objectContaining({ quotationId: "q-eligible" }),
    );
  });

  it("I. unconfigured email provider does not produce fake success", async () => {
    process.env.QUOTATION_EMAIL_PROVIDER = "none";
    findMany.mockResolvedValue([eligibleQuote()]);
    const result = await runExpiryReminders({ now: NOW, daysBefore: 3 });
    expect(result.sent).toBe(0);
    expect(result.notConfigured).toBe(1);
    expect(getCapturedEmails()).toHaveLength(0);
    expect(reminderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "NotConfigured" }),
      }),
    );
  });

  it("converted / missing email / past validTill are skipped", async () => {
    findMany.mockResolvedValue([
      eligibleQuote({ id: "q1", status: "Converted to Booking" }),
      eligibleQuote({ id: "q2", contactEmail: null }),
      eligibleQuote({ id: "q3", validTill: "2026-09-10" }),
    ]);
    const result = await runExpiryReminders({ now: NOW, daysBefore: 3 });
    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(3);
    expect(getCapturedEmails()).toHaveLength(0);
  });
});
