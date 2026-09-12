# Phase 9 — Customer accept / reject / request-revision workflow

## 1. Scope

Secure, version-aware **customer response** flow without customer login/portal:

Customer opens secure link → Accept / Reject / Request Revision → response recorded against quotation **and version** → internal users see history → only **Accepted** current version remains eligible for booking conversion.

Phases 1–8 preserved. Stop after Phase 9.

## 2. Existing customer-response functionality discovered

| Area | Finding |
| --- | --- |
| Accept / reject / revision | Authenticated `POST /api/quotations/:id/accept\|reject\|request-revision` (staff/agent) — **no public customer link** |
| Share | Link share used `/?view=quotations&quoteId=` (login required) — not a customer response surface |
| Email / WhatsApp | Phase 6 PDF delivery; messages asked customer to reply to advisor — **no response URL** |
| Frontend | No `/q/...` customer page; accept actions lived inside authenticated quotation UI |
| SEC-03 | Customer role / portal marked MISSING — intentional for this phase |
| Versions | Phase 7 `currentVersion` existed; acceptance was **not** version-bound |
| Conversion | Required `Accepted` + approval; did **not** check accepted version vs current |

## 3. Customer access / token model

| Item | Design |
| --- | --- |
| Raw token | `crypto.randomBytes(32)` → `base64url` (not quote id / quote no) |
| Storage | **SHA-256 hash only** (`tokenHash` unique) |
| Binding | `quotationId` + `versionNumber` at issue time |
| Expiry | `expiresAt` = end of UTC day for `validTill` |
| Revocation | `revokedAt`; bulk revoke on material revision / restore |
| Issue | `POST /api/quotations/:id/customer-link` (auth + send gate); also on Link share + email/WhatsApp delivery |
| URL | `{PUBLIC_APP_ORIGIN\|CORS_ORIGIN\|appOrigin}/q/{token}` |

## 4. Customer-safe quotation view

`buildCustomerSafeQuotationView()` returns selling-facing fields only (quote no, guest, destination, dates, travellers, packages itinerary/hotels/flights, inclusions/exclusions, terms, totals, validity, version).

Strips: contracted/supplier cost, markups, profit, internal notes, approval comments, supplier ids.

Public GET does **not** return quotation `id` or `tokenHash`.

## 5. Accept flow

Validates: token → access → not revoked/expired link → quotation exists → not operationally expired (eager Phase 8 check) → `access.versionNumber === currentVersion` → approval/send eligibility → status machine.

Then: append `QuotationCustomerResponse` (`Accept`), set status `Accepted`, `acceptedAt`, `acceptedVersionNumber = currentVersion`. No auto-booking.

Idempotent: Accept again on same version returns success without duplicate conflicting state.

## 6. Reject flow

Same access/expiry/version/approval gates. Append response + `Rejected` + optional reason. History/PDF/delivery/versions retained.

## 7. Revision-request flow

Requires customer comment. Append response + `QuotationRevision` row + status `Revision Requested`. Does **not** mutate package content or auto-create a new commercial version (Phase 7 applies when staff save meaningful changes).

## 8. Version binding

- Access token pinned to `versionNumber` at issue
- Response stores `versionNumber`
- Mismatch → **409 VERSION_MISMATCH** (no accept of v2 via v1 link)
- Conversion requires `acceptedVersionNumber === currentVersion`
- Material post-approval edit (Phase 7) clears acceptance fields + revokes links
- Restore clears acceptance + revokes links; new revision needs re-approval + new link

## 9. Expiry interaction

Phase 8 authoritative. Response endpoints call `isPastValidTill` and may run eager `runExpireDueQuotations` for that row. Expired / past-validity → **400**; no Accept/Reject/Revision.

## 10. Approval interaction

Link creation and first-time responses require `quoteSendBlockReason` clearance. Customer token cannot bypass Team Lead / Finance approval. After material edit, approval Draft + links revoked.

## 11. Booking conversion interaction

`proceed-to-booking` additionally checks `quoteAcceptedVersionBlockReason`. Version 1 acceptance **cannot** convert Version 2.

## 12. Security controls

- Hashed tokens; raw token returned once to authorized issuer
- Dedicated customer rate limiter
- Token cannot address arbitrary quotation IDs
- Agent-scoped listing of responses via existing quote access
- No raw token logging in success paths

## 13. Audit trail

Append-only `QuotationCustomerResponse` + `writeQuoteAudit` + in-app `notifyQuote`. Prior version responses remain readable history.

## 14. Frontend changes

| Surface | Change |
| --- | --- |
| `/q/[token]` | Public customer response page (no login) |
| Quotation detail | Copy customer link; customer responses list |
| Delivery helpers | Pass `appOrigin` so email/WhatsApp include `/q/...` |

## 15. Database migration

`20260912220000_customer_response` — **applied**

- `Quotation.acceptedVersionNumber` (+ backfill for existing Accepted/Converted)
- `QuotationCustomerAccess`
- `QuotationCustomerResponse`
- Indexes on tokenHash, quotationId, version, createdAt

## 16. Tests

| Suite | Result |
| --- | --- |
| Phase 9 `quotation-customer-response.test.ts` | **15 PASS** |
| Phase 1–9 relevant (excl. smoke) | **108 PASS** |
| Backend `tsc --noEmit` | **PASS** |
| Frontend `tsc --noEmit` | **PRE-EXISTING** `bookings.tsx` / `operations_executive` |

Security coverage mapped in tests: A–B, C, D–E/T, F–G, H, I–J, K–M, N–O, P, Q, R, S (unit/mock). Integration of full HTTP stack covered by route wiring + mocked service paths.

| Status | Count |
| --- | --- |
| PASS | 108 (+ backend typecheck) |
| FAIL (new) | 0 |
| BLOCKED | 1 (SEED_DEMO_PASSWORD smoke — not re-run as new) |
| PRE-EXISTING | forgot-password timeout; bookings.tsx typecheck |
| NOT IMPLEMENTED | Customer login/portal/dashboard (by design) |

## 17. Known limitations

- No customer account or multi-quote dashboard
- Customer page is read/respond only (no PDF download on the public page in this phase)
- Link URL requires `PUBLIC_APP_ORIGIN`, request `appOrigin`, or `CORS_ORIGIN`
- Staff authenticated accept still available; also writes an append-only response row when possible

## 18. Known pre-existing failures

- Smoke: `SEED_DEMO_PASSWORD` unset → **BLOCKED**
- Smoke: forgot-password timeout → **PRE-EXISTING**
- Frontend: `bookings.tsx` `operations_executive` → **PRE-EXISTING**

## 19. Files changed

**Backend:** `quotation-customer-access.ts`, `routes/customer-quotations.ts`, `app.ts`, `quotations.ts`, `bms.ts`, `quotation-versions.ts`, `quotation-delivery/*`, `prisma/schema.prisma`, migration `20260912220000_customer_response`, `.env.example`, `__tests__/quotation-customer-response.test.ts`

**Frontend:** `app/q/[token]/page.tsx`, `lib/api.ts`, `lib/quotation-actions.ts`, `components/views/quotations.tsx`

**Docs:** `QA/functional/PHASE_09_CUSTOMER_ACCEPTANCE.md`

## 20. Final verdict

**PASS** — Secure tokenized customer Accept / Reject / Request Revision is live, version-bound, expiry- and approval-aware, and conversion-safe. Phase 9 stop condition met; no Phase 10+ work.
