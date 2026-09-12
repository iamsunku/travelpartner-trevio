# Phase 6 — Real customer quotation delivery (Email + WhatsApp)

## 1. Scope

Implement real server-side customer quotation delivery by **email** and **WhatsApp**, attaching the Phase 5 customer PDF stored via Phase 4. Preserve Phases 1–5. Stop after Phase 6 (no versioning, portal, payment gateway, or booking redesign).

## 2. Existing infrastructure discovered

| Area | Finding |
| --- | --- |
| Email | `backend/src/lib/email.ts` — nodemailer SMTP + optional SendGrid. Agency keys via `api-key-config`. `EMAIL_DRY_RUN` / Vitest returned success without SMTP for transactional mail (not acceptable for quotation “delivered”). |
| Share API | `POST /api/quotations/:id/share` recorded `QuotationShare`, emailed a **link** (no PDF), or returned `mailto` / `wa.me` URLs. |
| Frontend | `shareQuotationViaEmail` / `shareQuotationViaWhatsApp` opened client mailto / wa.me; Draft could be marked Sent in UI. |
| WhatsApp | No Business API. Twilio SID/token fields existed for SMS-adjacent config only. |
| PDF | Phase 5 `generateQuotationPdf` + Phase 4 private storage. |
| Gates | Phase 1 `quoteSendBlockReason` already blocks draft/unapproved send. |

Requirement matrix (`DASH-10`, `DASH-11`, `SH-02`) correctly marked email/WhatsApp as PARTIAL / fake-capable.

## 3. Email implementation

```
POST /api/quotations/:id/email
Body: { recipient?, message? }
```

Flow: authenticate → authorize quote → Phase 1 send gate → rate/tax finalization check → ensure customer PDF → attach PDF → provider send → append `QuotationShare` row → audit.

Customer body is short (name, quote no, destination, dates, optional note). No cost/markup/internal fields.

## 4. WhatsApp implementation

```
POST /api/quotations/:id/whatsapp
Body: { recipient?, message? }
```

Same gates + PDF. Message is short customer-safe text. PDF sent via Meta Cloud API media upload, or Twilio with a **short-lived HMAC media URL** (`GET /api/delivery-media/:token`) that only serves the matching `CUSTOMER_QUOTATION_PDF`.

## 5. Provider abstraction

| Provider | Modes |
| --- | --- |
| Email | SMTP, SendGrid, `capture` (tests), `none` (explicit disable) |
| WhatsApp | Meta Cloud API, Twilio WhatsApp, `capture`, `none` |

Unconfigured production paths return `configured: false`, HTTP **503**, and `QuotationShare.status = NotConfigured`. They never report fake production success.

Capture mode is for automated tests only (`QUOTATION_*_PROVIDER=capture`).

## 6. PDF integration

`ensureCustomerPdf` reuses the latest `CUSTOMER_QUOTATION_PDF` when it is newer than or equal to `quotation.updatedAt`; otherwise generates via Phase 5. Only `visibility=CUSTOMER` / `relatedEntity=CUSTOMER_QUOTATION_PDF` documents are delivered. Internal documents are refused.

## 7. Delivery / audit records

Extended `QuotationShare` (append-only attempts):

- `documentId`, `provider`, `providerMessageId`, `failureReason`, `attachmentName`, `initiatedById`, `packageCount`, `deliveredAt`
- Status: `Attempted` → `Sent` | `Failed` | `NotConfigured`

Failed attempts remain distinguishable. Clicking send without provider confirmation does **not** mark success.

## 8. Approval / send gating

Uses existing `quoteSendBlockReason`. Delivery success may advance send workflow (`Sent to Agent` / `Customer Reviewing`) only after provider success. Delivery does **not** approve, accept, or convert.

`POST /share` with Email/WhatsApp returns **410** pointing to the dedicated endpoints. Link share remains for tracking only.

## 9. Security tests

`backend/src/__tests__/quotation-delivery.test.ts`

| ID | Case | Result |
| --- | --- | --- |
| A–C | Agent ownership for delivery access | PASS |
| D–F | Draft / unapproved blocked by send gate | PASS |
| G | Customer text excludes cost/markup/notes | PASS |
| H | Media token scoped; tamper rejected | PASS |
| I+L | Capture email/WhatsApp attaches PDF metadata | PASS |
| J | Missing provider ≠ success | PASS |
| K | Provider failure recorded as failed | PASS |
| M | Repeated deliveries independent | PASS |
| N | Multi-package count in message | PASS |

## 10. Regression tests

| Suite | Result |
| --- | --- |
| quote-access (Phase 1) | PASS |
| contracted-rates (Phase 2) | PASS |
| pricing (Phase 3) | PASS |
| documents (Phase 4) | PASS |
| quotation-pdf (Phase 5) | PASS |
| quotation-delivery (Phase 6) | PASS (12) |
| Combined Phase 1–6 relevant | **65 PASS**, 7 skipped, **2 FAIL (smoke PRE-EXISTING)** |
| Backend `tsc --noEmit` | PASS |
| Frontend typecheck | PRE-EXISTING `bookings.tsx` `operations_executive` |

## 11. Environment / configuration

Documented in `backend/.env.example`:

**Email:** `SMTP_*`, `SENDGRID_*`, optional `QUOTATION_EMAIL_PROVIDER=capture|none`

**WhatsApp:** `QUOTATION_WHATSAPP_PROVIDER=auto|meta|twilio|capture|none`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `DELIVERY_MEDIA_SECRET`

No secrets committed.

**Production provider configuration during testing:** NOT available (local suite used `capture` / `none` only).

## 12. Known limitations

- Live SMTP/SendGrid/Meta/Twilio were not exercised against real external accounts in this environment.
- Twilio media requires a reachable API host for the short-lived token URL.
- Capture mode must never be enabled in production.
- Old client mailto/wa.me helpers are deprecated wrappers around the real APIs.

## 13. Known pre-existing failures

| Issue | Classification |
| --- | --- |
| Smoke: `SEED_DEMO_PASSWORD` unset | BLOCKED / PRE-EXISTING |
| Smoke: forgot-password timeout ~5s | PRE-EXISTING |
| Frontend: `bookings.tsx` role comparison vs `operations_executive` | PRE-EXISTING |

## 14. Files changed

- `backend/prisma/schema.prisma` — QuotationShare delivery fields
- `backend/prisma/migrations/20260912190000_quotation_delivery/migration.sql`
- `backend/src/lib/quotation-delivery/*` — providers, messages, orchestrator, capture
- `backend/src/routes/quotations.ts` — `/email`, `/whatsapp`, `/delivery-media`, share 410
- `backend/src/__tests__/quotation-delivery.test.ts`
- `backend/.env.example`
- `frontend/src/lib/api.ts` — email/whatsapp clients; keep server 403 messages
- `frontend/src/lib/quotation-actions.ts` — real delivery helpers
- `frontend/src/components/views/quotations.tsx`
- `frontend/src/components/views/agent-quotation-dialog.tsx`
- `frontend/src/components/shared/product-quote-builder.tsx`
- `QA/functional/PHASE_06_EMAIL_WHATSAPP.md` — this report

## 15. Database migration

`20260912190000_quotation_delivery` — columns on `QuotationShare` + index on `documentId`. Applied successfully in the test environment.

## 16. Final verdict

**PASS** for Phase 6 implementation scope: real server-side email/WhatsApp delivery abstractions, Phase 5 PDF attachment, Phase 1 gates, append-only delivery audit, frontend wired off mailto/wa.me fakes.

Production live-provider send: **NOT IMPLEMENTED against live credentials in this run** (providers ready; config absent) — classified **BLOCKED** for live end-to-end proof until SMTP/WhatsApp secrets are supplied.

Counts:

| Status | Count |
| --- | --- |
| PASS | 65 (Phase 1–6 relevant + delivery) |
| FAIL | 0 new |
| BLOCKED | 1 (live seeded login smoke) + live provider E2E without secrets |
| PRE-EXISTING | 2 smoke failures + 1 frontend typecheck |
| NOT IMPLEMENTED | Phase 7+ features (versioning, portal, etc.) |

---

**STOP.** Phase 6 complete.
