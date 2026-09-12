# Phase 10 — One-click quotation → booking conversion

## 1. Scope

Harden quotation → booking conversion into a **single, transactional, idempotent, version-aware** path. Preserve Phases 1–9. No booking-management expansion, payments, or portals. Stop after Phase 10.

## 2. Existing conversion behavior discovered

| Area | Finding |
| --- | --- |
| Path | `POST /api/quotations/:id/proceed-to-booking` in `bms.ts` |
| mark-converted | Already disabled (410-style message) since Phase 1 |
| Partial transaction | Booking create + quote claim + docs were in `$transaction`; passengers, services, itinerary, ops tasks were **outside** |
| Race | Duplicate check without unique DB constraint (BK-02) |
| Version | Phase 9 `acceptedVersionNumber` checked; booking did **not** store version |
| Packages | Fell back to `packages[0]` if none selected — could mix intent |
| Pricing | Snapshot partial; used DB quote totals (good) but incomplete package pricing |
| Matrix | DASH-08 / LC-10 / BK-01 / BK-02 PARTIAL |

## 3. Authoritative conversion path

**Only:** `convertQuotationToBooking()` → `POST /api/quotations/:id/proceed-to-booking`

`POST .../mark-converted` remains blocked.

## 4. Preconditions (server)

1. Authenticated internal user (agents **403**)
2. Quotation exists in agency scope
3. Not already Converted (idempotent return if booking exists)
4. Status **Accepted**
5. `acceptedVersionNumber === currentVersion`
6. Approvals via `quoteConversionBlockReason`
7. Not Expired / past `validTill` (eager check)
8. Customer name present
9. Travel dates resolvable
10. Pricing/rates finalizable
11. Multi-package: explicit `selectedPackageId` or single `isSelected`
12. Optimistic lock: status/version/convertedBookingId still match inside transaction

Client-supplied totals/status/version are **ignored**.

## 5. Transaction strategy

Single `db.$transaction` performs:

- re-validate quote lock
- optional travel-date fill-in on quote
- create booking (+ `quotationVersionNumber`, locked pricing snapshot)
- claim quotation → `Converted to Booking` (`updateMany` count must be 1)
- passenger slots
- package service lines / defaults
- itinerary + travelDetails
- ops tasks
- document association (Phase 4)
- lead → Won (when present)

Failure → full rollback. Test hooks: `setConversionTestFailAfter(...)` (test-only).

Wallet commission credit remains **best-effort outside** the transaction (non-fatal; documented).

## 6. Idempotency / concurrency

| Mechanism | Role |
| --- | --- |
| Early return if status Converted + booking exists | Idempotent API (200 + `idempotent: true`) |
| `Booking.quotationId` **UNIQUE** | DB rejects concurrent second booking |
| `updateMany` claim with Accepted + version + `convertedBookingId: null` | Only one winner |
| P2002 unique catch | Returns existing booking |

## 7. Booking data transfer

From **selected package only**: hotels, flights, transfers, activities, meals, visa, insurance, itinerary, add-ons → `BookingService` / `BookingAddOn`; itinerary JSON; terms; includes/excludes; traveller counts; currency; destination/nights.

Passenger rows are placeholder slots (existing BMS pattern) — real names collected post-conversion.

## 8. Pricing / costing snapshot

Locked `pricingSnapshot` includes quote totals, net cost, tax fields, selected package pricing (contracted/customer/final/markup amounts for **internal** use), version numbers, `lockedAt`.

Agent booking APIs continue to strip cost/profit/supplier and nested snapshot cost layers.

## 9. Multi-package behavior

- 1 package → used automatically
- 2+ packages → require `selectedPackageId` or exactly one `isSelected`
- Never merges lines from multiple packages

## 10. Document transfer

`copyQuoteDocumentsToBooking` inside the transaction: links quote docs to booking; creates `BookingDocument` rows; preserves visibility/storage keys (Phase 4).

## 11. Version traceability

| Field | Location |
| --- | --- |
| `quotationId`, `quoteNo` | Booking |
| `quotationVersionNumber` | Booking (new) |
| `convertedBookingId`, `convertedAt`, `convertedBy` | Quotation |
| `acceptedVersionNumber` | Quotation (unchanged historical acceptance) |

## 12. Status integrity

`Accepted → Converted to Booking` only after booking create + successful claim. Invalid statuses fail with no mutation.

## 13. Error handling

Clear codes: `NOT_FOUND`, `NOT_ACCEPTED`, `EXPIRED`, `VERSION_MISMATCH`, `APPROVAL_REQUIRED`, `PACKAGE_SELECTION_REQUIRED`, `ALREADY_CONVERTED`, `STALE_VERSION`, etc. No stack traces to clients.

## 14. Frontend changes

`quotations.tsx` Convert action: busy state retained; treats idempotent 200 and 409-with-booking as success showing `bookingRef`.

## 15. Database migration

`20260912230000_booking_conversion` — **applied**

- `Booking.quotationVersionNumber`
- Unique index `Booking_quotationId_key`
- Safe dedupe of duplicate `quotationId` rows before unique (extra links nulled; first kept)

## 16. Existing-data consistency audit

Read-only `auditConversionConsistency()` against live DB:

| Check | Result |
| --- | --- |
| Converted without booking | **0** |
| Bookings with quoteNo but no quotationId | **0** |
| Duplicate bookings per quotationId | **0** |

Remediation (if future orphans appear): do **not** auto-mutate; investigate manually; re-link or revert status with ops approval.

## 17. Security tests

Phase 10 suite covers B–I, J–L, M–N, O, S–T, U (unit/mock). A (agent 403) preserved in route. P/Q/R by design (no delete of docs/versions/responses).

| Status | Count |
| --- | --- |
| Phase 10 tests | **13 PASS** |
| Phase 1–10 relevant | **121 PASS** |
| Backend tsc | **PASS** |
| FAIL (new) | **0** |

## 18. Transaction rollback test

| Hook | Result |
| --- | --- |
| `after_booking_create` | Throws; claim `updateMany` **not** called → no Converted |
| `after_services` | Throws `TEST_FAIL` → conversion incomplete to caller |
| claim `count === 0` | 409 ALREADY_CONVERTED |

## 19. Regression test results

| Suite | Result |
| --- | --- |
| quote-access, contracted-rates, pricing, documents, pdf, delivery, versions, expiry, customer-response, quotations, to-booking | **121 PASS** |
| Frontend tsc | **PRE-EXISTING** `bookings.tsx` / `operations_executive` |

## 20. Known limitations

- Passenger names remain placeholder slots until BMS passenger collection
- Commission wallet credit is outside the DB transaction
- No redesign of booking management UI/workflows
- Multi-package without selection fails conversion (intentional)

## 21. Known pre-existing failures

- Smoke `SEED_DEMO_PASSWORD` **BLOCKED**
- Smoke forgot-password timeout **PRE-EXISTING**
- Frontend `bookings.tsx` `operations_executive` **PRE-EXISTING**

## 22. Files changed

- `backend/src/lib/quotation-to-booking.ts` (new)
- `backend/src/routes/bms.ts` (thin proceed-to-booking)
- `backend/prisma/schema.prisma` + migration `20260912230000_booking_conversion`
- `backend/src/__tests__/quotation-to-booking.test.ts`
- `frontend/src/components/views/quotations.tsx`, `frontend/src/lib/api.ts`
- `QA/functional/PHASE_10_BOOKING_CONVERSION.md`

## 23. Final verdict

**PASS** — Conversion is single-path, transactional for required booking materialization, idempotent under retry/concurrency, version-aware, and audited clean on current data. Phase 10 stop condition met.
