# MODULE 05 — Transfers & Activities Client Requirements Audit (Audit Only)

**Purpose:** Compare the **existing Quotation Wizard “Transfers & Activities” step** (`step === 4`) and related backend (products, contracted rates, pricing, Module 04A itinerary sync, PDF, booking) against client transfer/activity requirements.

**Mode:** AUDIT ONLY — no application code, schema, UI, PDF, or booking logic was modified for this report.

**Primary surface:**  
`quotation-wizard.tsx` step 4 → two `ServiceEditor` blocks (Transfers, Activities) → Catalog / Add self-booked → `packages[].transfers[]` / `activities[]` → freeze + pricing → `syncPackageItinerary` → PDF / booking.

**Audit date:** 2026-09-16  
**Method:** Static UI → API → backend → DB/schema code tracing. Live browser E2E, seeded catalogue data, and multi-role sessions were **not** executed. Runtime-only claims are `BLOCKED` / `DATA LIMITATION`.

**Verdict scale:** `PASS` | `PARTIAL` | `FAIL` | `NOT IMPLEMENTED` | `BLOCKED` | `DATA LIMITATION`

---

## 1. Executive summary

Transfers and Activities exist as catalogue + self-booked editors with contracted-rate gating on catalogue picks and Module 04A itinerary sync when a **date** is set. They are **not** client-ready for multi-city operational workflows.

| Theme | Verdict | One-line finding |
|-------|---------|------------------|
| Transfer catalog | **PARTIAL** | Internal `TransferProduct` + applicable rate — not live API |
| Transfer self-booked | **FAIL** | Invents ₹1,500 / ₹2,200 |
| Transfer fields | **PARTIAL** | No pickup time / pax / remarks / currency in editor |
| Hotel → transfer locations | **PARTIAL** | Only **self-booked** hotels with address; catalogue hotels excluded |
| Multi-city transfer dates | **FAIL** / **PARTIAL** | Date defaults to trip **start**; no auto city-segment dates |
| Activity catalog | **PARTIAL** | Internal `ActivityProduct`; not live API |
| Activity self-booked | **FAIL** | Invents rates/prices (2500/1500/2000/2500) |
| Activity city | **FAIL** | No city field on line; itinerary city often empty |
| Transfer/Activity → itinerary | **PARTIAL** | Works if date set; time/city weak |
| Pricing / cost security (API) | **PARTIAL** / **PASS** | Contracted path exists; agent UI hides costPrice |
| Save/reload / version E2E | **BLOCKED** | Not browser-executed |

**Overall:** Not ready for sign-off. Strongest: catalogue rate gate + 04A sync hooks. Weakest: invented self-book prices, trip-start date hardcoding, incomplete hotel→transfer linking, missing city on activities.

---

## 2. Existing UI

**Step label:** “Transfers & Activities” (`STEPS[4]`).

| Section | Controls |
|---------|----------|
| Transfers | Catalog picker + Add self-booked; fields: `transferType`, `date`, `pickup`, `drop`, `vehicleType`, `costPrice`, `sellingPrice`, `supplier` |
| Activities | Catalog + Add self-booked; fields: category, name, description, date, timeSlot, ticketType, adult/child rates, adults/children, supplier, imageUrl, cost/sell |

Shared patterns: `ServiceEditor`, contracted-rate check on catalog pick, agent `costPrice` hidden for travel_agent/customer.

No API Search for transfers/activities (unlike Flights).

---

## 3. Transfer source audit

### A. Catalog

```
CatalogPicker kind=transfers
  → GET /api/products/transfers?liveOnly=true[&destinationId][&q]
  → GET /api/contracted-rates/applicable?productType=TRANSFER&…
  → packages.transfers[] source=CONTRACTED_PRODUCT
  → freezePackageLines → rateSnapshot
```

| Check | Verdict |
|-------|---------|
| UI exists | **PASS** |
| Backend product API | **PASS** (`TransferProduct`) |
| Contracted rate required to pick | **PASS** |
| Live third-party transfer API | **NOT IMPLEMENTED** |

**Catalog: PARTIAL**

### B. Self-booked

| Check | Verdict |
|-------|---------|
| Add self-booked UI | **PASS** |
| `source: MANUAL` | **PASS** |
| Commercial defaults | **FAIL** — `costPrice: 1500`, `sellingPrice: 2200` invented |
| `selfBooked: true` like hotels/flights | **FAIL** — not set on template |

**Self-booked: FAIL** (commercially)

---

## 4. Transfer types

UI select options (`TRANSFER_TYPES`): Airport Pickup, Airport Drop, Hotel Transfer, Intercity Transfer, SIC, Private Vehicle, Coach.

DB `TransferProduct.transferType`: **Private | Shared | Both** (product model) — different taxonomy from quote UI labels.

| Client type | Supported? | Notes |
|-------------|------------|-------|
| Airport pickup / drop | **PARTIAL** | Label only; no structured airport logic |
| Hotel → Airport / Airport → Hotel | **PARTIAL** | Via free-text pickup/drop |
| Hotel → Hotel / City → City / Intercity | **PARTIAL** | Labels + free text; no auto multi-city routes |
| Point-to-point | **PARTIAL** | Free text |

No enforcement that type matches route. **Transfer types overall: PARTIAL**

---

## 5. Transfer fields

| Field | In editor? | Notes |
|-------|------------|-------|
| Date | Yes | Defaults to `travelStartDate` |
| Pickup / Drop | Yes | Free text + optional self-booked hotel address select |
| Pickup time | **No** | Not in `fields[]`; itinerary looks for `pickupTime` |
| Vehicle | Yes | `vehicleType` select |
| Vehicle category | **PARTIAL** | Same as vehicle type list |
| Pax count | **No** | |
| Duration | **No** | |
| Driver/guide | **No** | |
| Voucher | **No** | |
| Remarks | **No** | |
| Supplier | Yes | |
| Cost / selling | Yes | |
| Currency | **No** | Quote currency only |

**Transfer fields: PARTIAL**

---

## 6. Hotel / address integration

`hotelTransferLocations` = `selfBookedHotelTransferLocations(hotels)` — **only** lines with `selfBooked` / `source=MANUAL` **and** a non-empty address.

| Source | Usable as pickup/drop? |
|--------|-------------------------|
| Self-booked hotel with address | **PASS** (select UI) |
| Catalogue hotel | **FAIL** — excluded from helper |
| Hotel city without address | **FAIL** — address required |

**Hotel → Transfer: PARTIAL**

---

## 7. Multi-city transfers

Expected arrival / intercity / departure transfers are **not** auto-generated from trip cities or hotels.

Catalogue/self-book rows default `date: form.travelStartDate` — same date for every transfer unless manually changed.

No automatic association of transfer to Phuket vs Krabi vs Bangkok segment.

| Check | Verdict |
|-------|---------|
| User can manually set different dates/routes | **PASS** (fields exist) |
| Correct city/date defaults for multi-city | **FAIL** |
| Auto intercity hotel→hotel | **NOT IMPLEMENTED** |

**Multi-city transfers: FAIL**

---

## 8. Transfer pricing

Contracted: `applicable` → freeze snapshot → `TRANSFER` default unit `PER_VEHICLE` → quote markups.

Self-booked/MANUAL: uses explicit `costPrice` / fare path (invented defaults apply).

| Check | Verdict |
|-------|---------|
| Contracted cost → Trevio → Agent → Customer | **PASS** (quote pricing engine) |
| Rate validity on pick | **PASS** |
| Snapshot / freeze | **PASS** |
| Agent sees contracted cost via API | **PASS** (stripped) |
| Agent UI cost field | **PASS** (hidden) |
| Self-book invented prices | **FAIL** |

**Transfer pricing: PARTIAL**

---

## 9. Self-booked transfer

| Requirement | Verdict |
|-------------|---------|
| No invented cost/sell | **FAIL** |
| Manual source | **PASS** (`MANUAL`) |
| User-entered price | **PASS** (editable) |
| Date / pickup / drop / vehicle | **PASS** |
| Remarks | **FAIL** (no field) |
| Save/reload / version | **BLOCKED** (E2E) / **PASS** (JSON path) |

**Self-booked transfer: FAIL**

---

## 10. Transfer → itinerary (Module 04A)

`onChange` calls `syncItineraryFromPackage` with transfers. Items require `date`; skip if blank.

| Preserved in itinerary item | Verdict |
|-----------------------------|---------|
| Transfer type | **PASS** |
| Pickup / drop (in description) | **PASS** |
| Time | **FAIL** / **PARTIAL** — needs `pickupTime` not in editor |
| Vehicle | **PASS** |
| Remarks | **PARTIAL** — field unused in editor |
| Dedupe | **PASS** (`sourceKey`) |

**Transfer → itinerary: PARTIAL**

---

## 11. Transfer → PDF

`mapTransfers` + “Ground transfers” render.

| Field | Survives? |
|-------|-----------|
| Date | **PARTIAL** (mapped; shown) |
| Pickup location | **PARTIAL** (also falls back to pickupTime) |
| Drop | **FAIL** in render list (mapped but not rendered distinctly; route uses `from`/`to` unused by wizard) |
| Time | **FAIL** |
| Vehicle | **PASS** |
| Remarks | **FAIL** |
| Customer-safe price | **FAIL** (not mapped) |

**Transfer → PDF: PARTIAL** / **FAIL** on drop/time/price

---

## 12. Transfer → booking

Notes: vehicle, pickup, drop, date. Selling/cost on service columns.

| Lost / weak | Notes |
|-------------|-------|
| Pickup time | Not in notes |
| Source | Not in notes |
| Pax | N/A on line |
| Remarks / voucher | Missing |

**Transfer → booking: PARTIAL**

---

## 13. Activity source audit

### Catalog

```
GET /api/products/activities → ActivityProduct
→ contracted-rates/applicable
→ source=CONTRACTED_PRODUCT
```

Live activity API: **NOT IMPLEMENTED**. **Catalog: PARTIAL**

### Self-booked

Invented `adultRate: 2500`, `childRate: 1500`, `costPrice: 2000`, `sellingPrice: 2500`. **FAIL**

---

## 14. Activity catalog

| Capability | Verdict |
|------------|---------|
| Destination filter | **PARTIAL** — `destinationId` / q / location city query |
| Name / duration / prices on product | **PASS** (schema) |
| Category on product | **PARTIAL** — wizard uses `extra.category` (not first-class on schema snippet) |
| Pax on product | **PARTIAL** — quote line uses form adults/children |
| Availability / blackouts | **PARTIAL** — product has blackoutDates; freeze hotel-style inventory **not** applied to activities in freezeLine |
| Contracted rate | **PASS** on pick |
| Live API search | **NOT IMPLEMENTED** |

**Activity catalog: PARTIAL**

---

## 15. Activity fields

| Field | Editor? | Notes |
|-------|---------|-------|
| Name / description / date / timeSlot | Yes | Date defaults to trip start |
| Duration | **PARTIAL** | Copied on catalog pick; **not** in editable `fields[]` |
| Adults / children | Yes | From Basic Details defaults |
| City | **No** | Critical gap |
| End time | **PARTIAL** | `closingTime` on catalog pick only |
| Cost / sell / supplier | Yes | |
| Currency / voucher / remarks | **No** | |
| Documents | **PARTIAL** | `activityDocuments` array supported |

**Activity fields: PARTIAL**

---

## 16. Activity dates / cities

| Check | Verdict |
|-------|---------|
| Per-activity date field | **PASS** |
| Defaults to travel start (not city day) | **FAIL** for multi-city UX |
| Explicit city on line | **FAIL** |
| Itinerary city from `a.city` / `tripCity` | Usually empty → **FAIL** |

**Activity dates/cities: FAIL**

---

## 17. Activity pricing

Contracted: snapshot + `PER_PASSENGER` × adults (+ child rates if present). Markups at quote level.

Self-booked: invented amounts.

Agent cost stripped / UI hidden: **PASS**.

**Activity pricing: PARTIAL**

---

## 18. Self-booked activity

| Check | Verdict |
|-------|---------|
| No invented price | **FAIL** |
| Manual source | **PASS** |
| Date / name / description / pax | **PASS** |
| City | **FAIL** |
| Duration editable | **FAIL** (not in fields) |
| Save/version | **BLOCKED** E2E |

**Self-booked activity: FAIL**

---

## 19. Activity → itinerary

Sync on change if `date` set. Name, description, duration/timeSlot, pax in description. City often blank. Dedupe via `sourceKey`.

**Activity → itinerary: PARTIAL**

---

## 20. Activity → PDF

Highlights section: **name + description only** (first 8). Mapped date/duration/ticketType **not rendered** in that loop. No city, pax, or selling price.

**Activity → PDF: FAIL** / **PARTIAL** (name/description only)

---

## 21. Activity → booking

Notes: ticketType, date. Missing city, duration, pax, time, source, description.

**Activity → booking: PARTIAL**

---

## 22. Same-day services

04A itinerary allows multiple item types on one day (flight + transfer + hotel + activity + meal). Transfer + activity same day: **PASS** (logic) if both dated that day.

**Same-day: PARTIAL** (depends on user setting dates correctly)

---

## 23. Regeneration

Transfer/activity edits trigger sync; regenerate strips auto items by `sourceKey` and re-adds. Manual itinerary preserved. Pricing not driven by itinerary.

| Check | Verdict |
|-------|---------|
| No transfer/activity dupes | **PASS** (unit-covered in 04A) |
| Manual survival | **PASS** (04A design) |
| Unrelated hotel/flight wipe | **PASS** (item-level) |
| Frozen versions | Unchanged architecture — **PASS** (design) |

**Regeneration: PASS** (code) / E2E **BLOCKED**

---

## 24. Security

| Role surface | Verdict |
|--------------|---------|
| Applicable rate hides contractedCost for agents | **PASS** |
| Quotation sanitize | **PASS** |
| ServiceEditor hides costPrice for agents | **PASS** |
| Supplier on line for agents | **PARTIAL** — catalog strip supplier; line may still show supplier string from pick for staff; agents may see name field |
| Live multi-role E2E | **BLOCKED** |

**Security: PARTIAL**

---

## 25. Save / reload

Transfers/activities in package JSON + material fingerprint. **Code path PASS; browser E2E BLOCKED.**

---

## 26. Versioning

`transfers` / `activities` / `itinerary` in `PACKAGE_MATERIAL_KEYS`. Freeze for contracted lines. **PARTIAL** (logic) / **BLOCKED** (E2E)

---

## 27. Client workflow

User can manually add transfers/activities after hotels/flights/itinerary, but must **re-enter** dates/cities/routes that Basic Details + hotels already know. No auto airport pickup / intercity / departure from trip plan.

**Workflow fit: FAIL** for “without manually duplicating information.”

---

## 28. UI quality

| Topic | Verdict |
|-------|---------|
| Clear Transfers vs Activities sections | **PASS** |
| Catalog vs self-booked | **PASS** |
| Date visible | **PASS** (field exists) |
| City visible (activities) | **FAIL** |
| Pricing fields | **PASS** (staff); agent cost hidden |
| Empty state | **PASS** |
| Loading / errors | **PARTIAL** (catalog toast on rate fail) |
| Duplicate prevention UX | **PARTIAL** (no guard beyond itinerary sourceKey) |

**UI quality: PARTIAL**

---

## 29. Defects

1. Self-booked transfer invents ₹1500/₹2200.  
2. Self-booked activity invents adult/child/cost/sell amounts.  
3. Transfer/activity dates default to **trip start** for every row.  
4. No pickup time / remarks / pax / currency on transfer editor.  
5. Catalogue hotels not offered as transfer pickup/drop locations.  
6. No activity **city** field.  
7. PDF transfer drop/time/price weak; activity highlights omit date/city/duration.  
8. Booking notes drop time/source/pax/duration (activities).  
9. Transfer product type taxonomy ≠ quote UI labels.  
10. Multi-city transfer/activity routing not automated.

---

## 30. Missing features

- Auto arrival / intercity / departure transfer suggestions from trip cities + hotels  
- Live transfer/activity API search  
- Activity city + duration in editor  
- Transfer pickup time, remarks, voucher, pax  
- Catalogue hotel address as transfer endpoint  
- Customer-safe per-line transfer/activity prices on PDF  
- Availability enforcement for activities on freeze (beyond rate window)

---

## 31. Environment blockers

| Item | Class |
|------|-------|
| Browser E2E save/reload/version | **BLOCKED** |
| Empty transfer/activity catalogue | **DATA LIMITATION** |
| Live agent/customer UI session | **BLOCKED** |

---

## Final scorecard

| # | Area | Verdict |
|---|------|---------|
| 3 | Transfer sources | Catalog **PARTIAL** / Self-book **FAIL** |
| 4 | Transfer types | **PARTIAL** |
| 5 | Transfer fields | **PARTIAL** |
| 6 | Hotel address integration | **PARTIAL** |
| 7 | Multi-city transfers | **FAIL** |
| 8 | Transfer pricing | **PARTIAL** |
| 9 | Self-booked transfer | **FAIL** |
| 10 | Transfer → itinerary | **PARTIAL** |
| 11 | Transfer → PDF | **PARTIAL** |
| 12 | Transfer → booking | **PARTIAL** |
| 13 | Activity sources | Catalog **PARTIAL** / Self-book **FAIL** |
| 14 | Activity catalog | **PARTIAL** |
| 15 | Activity fields | **PARTIAL** |
| 16 | Activity dates/cities | **FAIL** |
| 17 | Activity pricing | **PARTIAL** |
| 18 | Self-booked activity | **FAIL** |
| 19 | Activity → itinerary | **PARTIAL** |
| 20 | Activity → PDF | **FAIL** |
| 21 | Activity → booking | **PARTIAL** |
| 22 | Same-day services | **PARTIAL** |
| 23 | Regeneration | **PASS** (code) |
| 24 | Security | **PARTIAL** |
| 25 | Save/reload | **BLOCKED** |
| 26 | Versioning | **PARTIAL** / **BLOCKED** |
| 28 | UI quality | **PARTIAL** |

### Test matrix (A–S)

| ID | Scenario | Verdict |
|----|----------|---------|
| A | Airport pickup | **PARTIAL** (label + free text) |
| B | Airport drop | **PARTIAL** |
| C | Hotel → hotel | **PARTIAL** (manual) |
| D | Intercity | **PARTIAL** (label only) |
| E | Self-booked transfer | **FAIL** |
| F | Transfer → itinerary | **PARTIAL** |
| G | Activity catalog | **PARTIAL** |
| H | Self-booked activity | **FAIL** |
| I | Activity date | **PARTIAL** |
| J | Activity city | **FAIL** |
| K | Activity → itinerary | **PARTIAL** |
| L | Transfer + activity same day | **PARTIAL** |
| M | Multi-city | **FAIL** |
| N | Pricing | **PARTIAL** |
| O | Agent security | **PARTIAL** / **PASS** API |
| P | Save/reload | **BLOCKED** |
| Q | Versioning | **BLOCKED** / **PARTIAL** |
| R | PDF | **PARTIAL** / **FAIL** activities |
| S | Booking | **PARTIAL** |

### Roll-up

Transfers & Activities are **usable as manual catalogue/self-book line editors** with contracted-rate protection and itinerary hooks, but **fail client multi-city operational expectations** and **self-book commercial hygiene**.

**Module 05 client readiness: not ready for sign-off.**

---

## Evidence index

| Topic | Path |
|-------|------|
| Wizard step 4 | `frontend/src/components/views/quotation-wizard.tsx` |
| Hotel transfer locations | `frontend/src/lib/quote-trip-stays.ts` |
| Itinerary sync | `frontend/src/lib/quote-itinerary-sync.ts` |
| Products API | `backend/src/routes/products.ts` |
| Schema | `backend/prisma/schema.prisma` (`TransferProduct`, `ActivityProduct`) |
| Pricing units | `backend/src/lib/pricing.ts` |
| PDF | `backend/src/lib/quotation-pdf/model.ts`, `render.ts` |
| Booking | `backend/src/lib/quotation-to-booking.ts` |

---

*End of audit. No application code was modified.*
