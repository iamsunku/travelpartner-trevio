# Phase 17 — Quotation Expiry Reminder Emails (EXP-02)

## Verdict

**PASS** — EXP-02 pre-expiry reminder emails implemented on the existing Phase 6 email provider and Phase 8 expiry scheduler, without changing expiry semantics, customer acceptance, booking conversion, pricing/tax, agent registration, PDF, or WhatsApp.

---

## 1. Original EXP-02 requirement

| Source | Statement |
| --- | --- |
| `TREVIO_REQUIREMENT_MATRIX.csv` EXP-02 | “Expiry reminders” — previously **MISSING**; notes: in-app notify on expiry only; **no email reminder before expiry** |
| EXP-01 | Validity date + automatic expiry + reminder + renewal (reminder historically missing) |
| `PHASE_08_QUOTATION_EXPIRY.md` | Explicitly left EXP-02 unimplemented: *no configured reminder period; policy not invented* |
| `PHASE_14_FINAL_RECONCILIATION.md` | Listed EXP-02 as remaining **NOT IMPLEMENTED** |

### Timing ambiguity (documented choice)

**EXP-02 requires a pre-expiry reminder email but does not specify lead time** (e.g. “3 days before”).

**Chosen configurable behavior (not invented as a fixed business rule):**

| Setting | Default | Meaning |
| --- | --- | --- |
| `QUOTE_EXPIRY_REMINDER_DAYS_BEFORE` | `3` | Remind when `validTill` is within the next N UTC calendar days **inclusive** (including the validity day itself) |
| `QUOTE_EXPIRY_REMINDER_ENABLED` | `true` (unless `"false"`) | Disable reminder emails without disabling Phase 8 expiry |

Inclusive window ensures a missed exact-day poll still sends **once** (idempotent claim). Same-day validity (`validTill === today`) remains valid per Phase 8; a reminder on that day is allowed and does **not** expire the quote.

Classification of timing choice: **PASS** (configurable) with requirement gap noted as **DATA LIMITATION** / spec incompleteness — not a product invent beyond documented default.

---

## 2. Existing Phase 8 expiry behavior (preserved)

| Rule | Status |
| --- | --- |
| UTC calendar date boundary `validTill < today` | **Unchanged** |
| Same-day validity (`validTill === today` still valid) | **Unchanged** |
| Eligible statuses → Expired | **Unchanged** (`Sent to Agent`, `Sent`, `Customer Reviewing`, `Accepted`) |
| Draft / Rejected / Converted / Archived never auto-expired | **Unchanged** |
| Reminder job marks Expired? | **No** — reminders never call expiry transitions |
| Renewal / extend | **Unchanged** |

Classification: **PASS**

---

## 3. Reminder design

### Eligible quotations

Must satisfy **all** of:

1. `deletedAt IS NULL`
2. Status in Phase 8 `EXPIRY_ELIGIBLE_STATUSES`
3. Valid `validTill` (`YYYY-MM-DD`) still not past (`validTill >= today`)
4. Within reminder window (`daysUntilValidTill <= daysBefore`)
5. Valid `contactEmail`

**Not reminded:** Draft, Rejected, Converted, Expired, Archived, missing/invalid email, past `validTill`, deleted.

### Recipient

`Quotation.contactEmail` (same customer contact model as Phase 6 delivery).

### Content (customer-safe)

Subject: `Reminder: Quotation {quoteNo} expires on {validTill}`

Body includes: customer name, quote number, destination/travel dates, expiry date, optional package-count note, secure `/q/:token` link when creatable.

**Never included:** contracted cost, supplier cost/names, internal notes/remarks, profit, agent markup, trevio markup.

### Customer link

Uses existing `createCustomerAccessLink` → `PUBLIC_APP_ORIGIN` (or CORS fallback) + `/q/{rawToken}`.

Does not expose raw quotation IDs as authorization. If link creation fails (send gates), email still sends without a link (no insecure fallback URL).

### Version safety

Durable claim key: `(quotationId, validTill, reminderKind=PRE_EXPIRY, versionNumber=currentVersion)`.

Material edit / new version → new claim allowed for that version. Historical versions are not rewritten.

---

## 4. Scheduler behavior

`startQuotationExpiryScheduler` (unchanged poll/env controls) now each tick:

1. `runExpiryReminders()` (if reminders enabled)
2. `runExpireDueQuotations()` (Phase 8)

Reminder failure does not block expiry. Expiry failure does not block the next reminder tick.

Disable expiry poller: `QUOTE_EXPIRY_SCHEDULER=false`  
Disable reminders only: `QUOTE_EXPIRY_REMINDER_ENABLED=false`

Classification: **PASS**

---

## 5. Duplicate / idempotency strategy

Persistent table `QuotationExpiryReminder` with unique constraint on  
`(quotationId, validTill, reminderKind, versionNumber)`.

Flow:

1. Insert claim `status=Attempted` (or reclaim `NotConfigured` / `Failed` / stale `Attempted` ≥ 15 minutes)
2. Unique conflict + `Sent` → skip (no second email)
3. Send via Phase 6 `sendQuotationEmail`
4. Update claim → `Sent` | `Failed` | `NotConfigured`

Safe across API restart, multi-instance, duplicate scheduler ticks, and repeated encounters of the same quotation.

Classification: **PASS**

---

## 6. Email behavior (Phase 6 provider)

Reuses `sendQuotationEmail` only — **no second email service**.

| Provider state | Claim status | Fake success? |
| --- | --- | --- |
| Capture (tests) | Sent | N/A (test) |
| SMTP / SendGrid configured | Sent on success | No |
| Unconfigured / `none` | `NotConfigured` | **No** (`ok:false`, `configured:false`) |
| Provider error | `Failed` | No |

Classification: **PASS**

---

## 7. Security / privacy checks

| Check | Result |
| --- | --- |
| Customer-safe HTML (`assertCustomerSafeDeliveryText`) | **PASS** |
| Secure `/q/:token` link (no public quote-id URL) | **PASS** |
| No WhatsApp changes | **PASS** |
| No PDF / acceptance / conversion / tax / registration changes | **PASS** |

---

## 8. Tests

File: `backend/src/__tests__/quotation-expiry-reminder.test.ts`

| ID | Case | Result |
| --- | --- | --- |
| A | Eligible quotation receives one reminder | **PASS** |
| B | Ineligible does not receive reminder | **PASS** |
| C | Already Expired does not receive reminder | **PASS** |
| D | Duplicate scheduler execution no duplicate send | **PASS** |
| E | Restart / re-execution idempotent | **PASS** |
| F | Correct current version referenced in claim | **PASS** |
| G | Customer-safe information only | **PASS** |
| H | Secure customer response link used | **PASS** |
| I | Unconfigured email → NotConfigured, no fake success | **PASS** |
| J | Existing Phase 8 expiry tests | **PASS** |
| K | Existing Phase 6 delivery tests | **PASS** |

Regression (relevant Phase 1–16 suites including versions, customer response, booking, pricing, contracted rates, documents, inventory, templates, quote-access): **165 PASS** (14 files) + Phase 17 **13 PASS**.

| Suite | Result | Notes |
| --- | --- | --- |
| Phase 17 reminder | **PASS** (13) | New |
| Phase 6 delivery + Phase 8 expiry | **PASS** | J/K regression |
| Phase 1–16 unit suites (14 files) | **PASS** (165) | No Phase 17 coupling |
| Phase 16 GST consistency | **PASS** | Re-run clean |
| Phase 15 agent registration | **19 PASS / 1 PRE-EXISTING** | `G. authorized admin can approve` timed out at 30s against live DB — unrelated to EXP-02; not modified |
| Smoke `SEED_DEMO_PASSWORD` | **BLOCKED** / **PRE-EXISTING** | Env not set |
| Smoke forgot-password | **PRE-EXISTING** timeout | Unrelated |

backend `tsc --noEmit`: **PASS**  
frontend `tsc --noEmit`: **PASS**

---

## 9. Configuration requirements

```env
# Phase 17 / EXP-02
QUOTE_EXPIRY_REMINDER_ENABLED=true
QUOTE_EXPIRY_REMINDER_DAYS_BEFORE=3

# Shared with Phase 8 scheduler
QUOTE_EXPIRY_SCHEDULER=true
QUOTE_EXPIRY_POLL_MS=60000

# Shared with Phase 6 email
SMTP_* or SENDGRID_*   # or QUOTATION_EMAIL_PROVIDER=capture for tests
PUBLIC_APP_ORIGIN=https://your-frontend.example   # customer /q/:token links
```

Migration: `backend/prisma/migrations/20260912260000_quotation_expiry_reminder/migration.sql`

---

## 10. Environment limitations

| Item | Classification |
| --- | --- |
| Live SMTP/SendGrid without credentials | **ENVIRONMENT BLOCKED** (records `NotConfigured`, no fake success) |
| EXP-02 unspecified lead time | Spec gap; default `3` documented + configurable → **PASS** with note |
| Smoke `SEED_DEMO_PASSWORD` / forgot-password timeout | **PRE-EXISTING** / **BLOCKED** (unchanged) |
| In-process scheduler (not distributed queue) | Same as Phase 8; multi-instance safety via DB unique claim → **PASS** |

---

## 11. Files touched

| File | Role |
| --- | --- |
| `backend/prisma/schema.prisma` | `QuotationExpiryReminder` model |
| `backend/prisma/migrations/20260912260000_quotation_expiry_reminder/` | Migration |
| `backend/src/lib/quotation-expiry-reminder.ts` | Reminder eligibility, claim, send |
| `backend/src/lib/quotation-expiry-scheduler.ts` | Hook reminder into existing poller |
| `backend/src/lib/quotation-delivery/customer-message.ts` | Reminder HTML/subject |
| `backend/.env.example` | Config docs |
| `backend/src/__tests__/quotation-expiry-reminder.test.ts` | Phase 17 tests |
| `QA/functional/PHASE_17_EXPIRY_REMINDERS.md` | This report |

---

## 12. Explicit non-goals (honored)

- No rewrite of Phase 8 expiry status machine
- No customer acceptance / booking conversion / pricing-tax / agent registration / PDF / WhatsApp changes
- Phase 18 **not started**

---

## Summary classifications

| Area | Classification |
| --- | --- |
| EXP-02 reminder email | **PASS** |
| Configurable timing (spec gap) | **PASS** (documented default) |
| Phase 8 expiry semantics preserved | **PASS** |
| Phase 6 email reuse / no fake success | **PASS** |
| Idempotency / version safety / privacy | **PASS** |
| Phase 17 + Phase 6/8 tests | **PASS** |
| Live email without credentials | **ENVIRONMENT BLOCKED** |
| Unrelated smoke password/timeout issues | **PRE-EXISTING** |
