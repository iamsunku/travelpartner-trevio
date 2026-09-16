# MODULE 05A — Transfers & Activities Core Corrections (Implementation)

**Source audit:** `QA/functional/MODULE_05_TRANSFERS_ACTIVITIES_CLIENT_REQUIREMENTS_AUDIT.md`  
**Mode:** Targeted corrections only — no wizard rewrite, no new page, no live third-party transfer/activity APIs.  
**Date:** 2026-09-16

---

## 1. Files changed

| Area | Path |
|------|------|
| Hotel endpoints | `frontend/src/lib/quote-trip-stays.ts` |
| Auto transfers + city/date helpers | `frontend/src/lib/quote-transfers.ts` **(new)** |
| Itinerary sync | `frontend/src/lib/quote-itinerary-sync.ts` |
| Wizard UI / editors | `frontend/src/components/views/quotation-wizard.tsx` |
| PDF model | `backend/src/lib/quotation-pdf/model.ts` |
| PDF render | `backend/src/lib/quotation-pdf/render.ts` |
| Booking notes | `backend/src/lib/quotation-to-booking.ts` |
| Frontend tests | `frontend/src/lib/quote-transfers.test.ts` **(new)** |
| Backend tests | `backend/src/__tests__/module-05a-transfers-activities.test.ts` **(new)** |

---

## 2. UI changes

Preserved existing Transfers / Activities sections, Catalog, Add self-booked, and ServiceEditor.

Additions (minimal):

- **Suggest transfer routes** button (step 4)
- Transfer fields: pickup time, pax, duration, currency, voucher, remarks
- Activity fields: city (trip-city select), editable duration, voucher, remarks
- Self-booked badge copy clarifies prices are user-entered only
- Pickup/drop hotel picker now lists **catalogue + self-booked** hotels

---

## 3. Transfer changes

| Item | Result |
|------|--------|
| Editor fields | PASS — type, date, pickupTime, pickup, drop, vehicle, pax, duration, currency, voucher, remarks, supplier, cost/sell |
| Default date | PARTIAL — self-book / single-city uses first stay check-in; multi-city catalog leaves date blank (not trip-start hardcode) |
| Pax default | PASS — adults + children from Basic Details |
| Currency | PASS — defaults from quotation currency; editable |
| Pickup time → itinerary | PASS — `packages.transfers[].pickupTime` → itinerary item |

---

## 4. Activity changes

| Item | Result |
|------|--------|
| City field | PASS — select from trip cities |
| City default | PASS — single-city auto; multi-city requires user choice |
| Date default | PASS — `defaultActivityDateForCity` (mid-stay when nights > 1) |
| Outside-window date | PARTIAL — warning shown; override allowed |
| Duration editable | PASS |
| Adults/children | PASS — still default from Basic Details |
| timeSlot / closingTime | PASS — preserved |

---

## 5. Self-booked behavior

| Check | Verdict |
|-------|---------|
| Transfer no invented 1500/2200 | **PASS** |
| Activity no invented adult/child/cost/sell | **PASS** |
| `source: MANUAL`, `selfBooked: true` | **PASS** |
| Manual price entry still allowed | **PASS** (fields remain; blank until user enters) |

---

## 6. Hotel endpoint integration

`hotelTransferLocations()` includes:

- Catalogue hotels (address if present; else `HotelName, City`)
- Self-booked hotels with address (Module 02 preserved)
- Catalogue hotels without address (name + city — no invented street address)

Legacy `selfBookedHotelTransferLocations` kept as filtered wrapper for older call sites.

---

## 7. Multi-city logic

Stay windows drive:

- Transfer suggestion dates (arrival / intercity / departure)
- Activity city → default date inside that city’s window
- Catalog transfer date blank when multiple cities (user chooses)

---

## 8. Auto transfer suggestions

Stable keys:

- `AUTO_ARRIVAL`
- `AUTO_CITY_TRANSFER_{FROM}_{TO}`
- `AUTO_DEPARTURE`

Rules:

- Requires hotel endpoint per city
- Airport ends left **blank** (no invented airport codes)
- No invented prices
- `mergeAutoTransfers` dedupes by `autoKey` and date+pickup+drop+type
- Does not delete manual transfers

---

## 9. Activity city/date logic

Helpers in `quote-transfers.ts`:

- `defaultActivityDateForCity`
- `isDateInCityStay`

Itinerary day city comes from activity city when creating/ensuring the day.

---

## 10. Itinerary integration

Module 04A sync preserved and enriched:

- Transfer: type, route, pickupTime, vehicle, duration, pax, remarks, voucher; `sourceKey` prefers `autoKey`
- Activity: name, city in description, duration, timeSlot, pax, remarks, voucher
- Same-day hotel + transfer + activity coexist; regenerate does not duplicate

---

## 11. PDF integration

Customer-safe enrichments (no redesign):

- Transfers: date, pickup/drop/route, pickupTime, vehicle, duration, pax, remarks, sellingPrice + currency
- Activities Highlights: name, city, date, duration, time, pax, ticket, sellingPrice + currency, description
- Cost / contracted / markup **not** mapped

---

## 12. Booking integration

`quotation-to-booking` service notes now include transfer/activity operational fields (time, duration, pax, voucher, source, city, description). Selling price still flows via existing service line pricing; cost remains internal.

---

## 13. Pricing / security

- Catalog still requires applicable contracted rate (unchanged)
- Agent UI still hides `costPrice` / supplier fields
- `sanitizeQuotationForRole` strips cost/supplier for agents/customers — verified by unit test
- Self-booked no longer seeds fake commercial values

---

## 14. Tests executed

```
backend: npm test -- src/__tests__/module-05a-transfers-activities.test.ts  → 3 passed
backend: quotation-pdf + module-03a regression → 18 passed
frontend: npx vitest run quote-transfers.test.ts quote-itinerary-sync.test.ts → 13 passed
```

Browser E2E save/reload and versioning: **not executed**.

---

## 15. PASS / FAIL / PARTIAL / BLOCKED results

| # | Requirement | Verdict |
|---|-------------|---------|
| 1 | Self-booked transfer no fake price | **PASS** |
| 2 | Self-booked activity no fake price | **PASS** |
| 3 | Transfer pickup time | **PASS** |
| 4 | Transfer pax | **PASS** |
| 5 | Transfer remarks | **PASS** |
| 6 | Transfer currency | **PASS** |
| 7 | Activity city | **PASS** |
| 8 | Activity duration editable | **PASS** |
| 9 | Activity city/date consistency | **PASS** (soft warning on override) |
| 10 | Catalogue hotel transfer endpoint | **PASS** |
| 11 | Self-booked hotel transfer endpoint | **PASS** |
| 12 | Multi-city transfer date | **PARTIAL** (suggestions + safer defaults; no full auto-assign on every add) |
| 13–15 | Auto arrival / intercity / departure | **PASS** (when hotels exist) |
| 16 | Auto-transfer dedupe | **PASS** |
| 17–18 | Activity / transfer → itinerary | **PASS** (unit) |
| 19 | Same-day transfer + activity | **PASS** (unit) |
| 20–21 | Transfer / activity PDF | **PASS** (unit) |
| 22–23 | Transfer / activity booking notes | **PASS** (code + unit shape) |
| 24 | Agent cost security | **PASS** (unit) |
| 25 | Save/reload E2E | **BLOCKED** |
| 26 | Versioning E2E | **BLOCKED** |
| — | Live transfer/activity API | **NOT IMPLEMENTED** (by design this phase) |
| — | Activity inventory / blackout freeze | **NOT IMPLEMENTED** (no fake inventory) |

---

## 16. Remaining limitations

1. Airport endpoints on auto routes stay blank until staff fill them (intentional — no invented codes).
2. Auto suggestions require a hotel row per city; missing hotel skips that segment.
3. Activity blackout / availability freeze not wired like hotels.
4. Browser save/reload and frozen-version E2E not run.
5. Transfer type labels remain free-form UI taxonomy (not DB Private/Shared taxonomy).

---

## 17. Live API status

| Integration | Status |
|-------------|--------|
| Amadeus / third-party transfers | **NOT IMPLEMENTED** |
| Live activity supplier APIs | **NOT IMPLEMENTED** |
| Internal TransferProduct / ActivityProduct catalog | Unchanged — still contracted-rate gated |

Do not treat catalog as live API results.
