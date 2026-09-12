import { logger } from "./logger.js";
import { runExpireDueQuotations } from "./quotation-expiry.js";
import { remindersEnabled, runExpiryReminders } from "./quotation-expiry-reminder.js";

let running = false;
let timer: ReturnType<typeof setInterval> | null = null;
let started = false;

/**
 * Smallest safe in-process poller. Idempotent expiry + in-process mutex.
 * Multi-instance safety relies on updateMany status/validTill predicates
 * (only one worker wins each row). Disable with QUOTE_EXPIRY_SCHEDULER=false.
 *
 * Phase 17: also runs EXP-02 pre-expiry reminder emails (durable claim table).
 * Reminder job never marks quotations Expired.
 */
export function startQuotationExpiryScheduler(): void {
  if (started) return;
  if (process.env.NODE_ENV === "test") return;
  if (process.env.QUOTE_EXPIRY_SCHEDULER === "false") return;

  started = true;
  const pollMs = Number(process.env.QUOTE_EXPIRY_POLL_MS || 60_000);
  const startupDelayMs = Number(process.env.QUOTE_EXPIRY_STARTUP_DELAY_MS || 5_000);

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      if (remindersEnabled()) {
        try {
          const reminders = await runExpiryReminders({});
          if (
            reminders.sent > 0
            || reminders.failed > 0
            || reminders.notConfigured > 0
            || reminders.errors > 0
          ) {
            logger.info(
              {
                sent: reminders.sent,
                scanned: reminders.scanned,
                skipped: reminders.skipped,
                failed: reminders.failed,
                notConfigured: reminders.notConfigured,
                errors: reminders.errors,
                today: reminders.today,
                daysBefore: reminders.daysBefore,
              },
              "quotation expiry reminder job",
            );
          }
        } catch (err) {
          logger.error({ err }, "quotation expiry reminder job failed");
        }
      }

      const result = await runExpireDueQuotations({});
      if (result.expired > 0 || result.errors > 0) {
        logger.info(
          { expired: result.expired, scanned: result.scanned, errors: result.errors, today: result.today },
          "quotation expiry job",
        );
      }
    } catch (err) {
      logger.error({ err }, "quotation expiry job failed");
    } finally {
      running = false;
    }
  };

  setTimeout(() => {
    void tick();
  }, Math.max(0, startupDelayMs)).unref?.();

  timer = setInterval(() => {
    void tick();
  }, Math.max(10_000, pollMs));
  timer.unref?.();

  logger.info({ pollMs, startupDelayMs }, "quotation expiry scheduler started");
}

export function stopQuotationExpiryScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  started = false;
  running = false;
}

/** Test helper: whether a tick is currently in flight. */
export function isQuotationExpiryJobRunning(): boolean {
  return running;
}
