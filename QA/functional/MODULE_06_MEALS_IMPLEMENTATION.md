# MODULE 06A — Meals Core Corrections (Implementation)

**Source audit:** `QA/functional/MODULE_06_MEALS_CLIENT_REQUIREMENTS_AUDIT.md`  
**Mode:** Targeted corrections only — no wizard rewrite, no new page, no live meal API.  
**Date:** 2026-09-16

---

## 1. Files changed

| Area | Path |
|------|------|
| Meal helpers (new) | `frontend/src/lib/quote-meals.ts` |
| Meals tests (new) | `frontend/src/lib/quote-meals.test.ts` |
| Itinerary sync | `frontend/src/lib/quote-itinerary-sync.ts` |
| Wizard UI | `frontend/src/components/views/quotation-wizard.tsx` |
| PDF model | `backend/src/lib/quotation-pdf/model.ts` |
| PDF render | `backend/src/lib/quotation-pdf/render.ts` |
| Booking conversion | `backend/src/lib/quotation-to-booking.ts` |
| Backend tests (new) | `backend/src/__tests__/module-06a-meals.test.ts` |

---

## 2. UI changes

Preserved Meals step, Catalog, Add self-booked, ServiceEditor.

Added/expanded fields:

- `mealType` (+ Snacks, Other)
- `city` (trip-city select)
- `restaurant`, `location`, `cuisine`, `description`, `dietary`
- `date`, `time`, `duration`
- `adults`, `children`, `infants`
- `currency`, `voucher`, `remarks`
- rates / cost / sell (manual entry only for self-booked)

Warnings on meal rows:

- Hotel breakfast may already be included (awareness only)
- Date outside city stay window
- City orphaned from trip plan

---

## 3. Self-booked changes

| Before | After |
|--------|-------|
| `adultRate: 1200`, `childRate: 800`, `costPrice: 900`, `sellingPrice: 1200` | No invented commercial fields |
| `source: MANUAL` only | `source: MANUAL` + `selfBooked: true` |
| Date = trip start | City-aware stay default, or blank if multi-city |

Manual pricing fields remain available when staff enter values.

---

## 4. City handling

- Explicit `city` on meal lines
- Trip-city select from Basic Details
- Catalog: `product.city → meal.city` (no longer dumped into `cuisine`)
- Cuisine preserved separately
- Orphan flag when city removed from trip plan (meal not deleted)

---

## 5. Date handling

- Defaults via `defaultMealDateForCity` (same mid-stay preference as activities)
- Multi-city with unknown city → blank date (user must choose)
- Warning when date outside stay window (override allowed)
- City change resets invalid date to a valid default (`dateSource: AUTO`)

---

## 6. Multi-city synchronization

`syncMealRowsToTripStays` runs with hotel sync when stay windows change:

| `dateSource` | Behavior |
|--------------|----------|
| `AUTO` | Date moved into city’s new window |
| `MANUAL` / legacy | Date preserved; `dateInvalid` flagged if outside window |

City removal → `cityOrphan` + reason; meal kept for reassignment.

---

## 7. Meal types

Select options: **Breakfast, Lunch, Dinner, Snacks, Other**.

Structured `mealType` retained (not free-text replacement).

---

## 8. Meal fields

Added: city, location, description (editor), currency, voucher, remarks, time, duration, infants.  
Dietary kept separate from remarks.

---

## 9. Hotel breakfast awareness

`hotelBreakfastDuplicationWarning`:

- Only for meal type Breakfast
- Matches hotel with breakfast-like `mealPlan` in same city / stay dates
- Phuket breakfast does not warn about Krabi dinner
- Does **not** auto-delete or zero price
- Does **not** auto-set `includedInPlan`

---

## 10. Pricing

- Contracted catalog path unchanged (applicable rate required)
- Default unit remains `PER_PASSENGER`
- Self-booked: only user-entered commercial values
- No fake defaults

---

## 11. Security

- Agent UI still hides `costPrice`
- `sanitizeQuotationForRole` still strips cost/supplier — unit tested
- PDF excludes cost fields

---

## 12. Itinerary integration

Meal item now carries:

- type, city (day + description), restaurant, location, description, pax, time → `pickupTime`, duration, remarks, voucher  
- dietary kept in description as `Dietary: …`  
- `sourceKey = meal:{id}` — no regenerate duplicates

---

## 13. PDF integration

Meals section enriched with city, time, location, pax, duration, remarks, voucher, selling price + currency. Costs omitted.

---

## 14. Booking integration

New conversions use service type **`Meal`** (was `Other`).  
Notes include city, location, date, time, duration, pax, dietary, voucher, source, description.  
`remarks` still appended via `lineNote`. Old bookings unchanged.

---

## 15. Save / reload testing

Browser E2E: **BLOCKED** (not executed).

---

## 16. Versioning testing

Architecture still snapshots `meals` + rate freeze. Browser Version 1/2 immutability: **BLOCKED**.

---

## 17. Automated tests

```
frontend: quote-meals.test.ts + quote-itinerary-sync.test.ts → 14 passed
backend:  module-06a-meals.test.ts + quotation-pdf.test.ts → 8 passed
```

---

## 18. PASS / FAIL / PARTIAL / BLOCKED results

| # | Item | Verdict |
|---|------|---------|
| 1–3 | Self-book no fake price / selfBooked | **PASS** |
| 4–5 | City + catalog city mapping | **PASS** |
| 6–8 | Date default / validation / city change | **PASS** |
| 9–13 | Meal types + pax | **PASS** |
| 14–24 | Location/description/currency/voucher/remarks/time/duration | **PASS** |
| 25–26 | Hotel breakfast warning (city-aware) | **PASS** |
| 27–28 | Itinerary + dedupe | **PASS** (unit) |
| 29 | PDF | **PASS** (unit) |
| 30 | Booking service type Meal + notes | **PASS** (code) |
| 31 | Agent cost security | **PASS** (unit) |
| 32 | Contracted-rate gate | **PASS** (unchanged) |
| 33 | Save/reload E2E | **BLOCKED** |
| 34 | Versioning E2E | **BLOCKED** |

---

## 19. Live API status

**NOT IMPLEMENTED** (by design this phase)

---

## 20. Inventory status

MealProduct blackout / inventory freeze: **NOT IMPLEMENTED** (no fake availability)

---

## 21. Remaining limitations

1. Browser save/reload and version freeze not E2E-verified  
2. `includedInPlan` still manual/legacy — not auto-set from hotel meal plan text  
3. Legacy meals without `city` / `dateSource` treated as MANUAL for sync  
4. Booking schema comment still lists classic types; `Meal` is a free-string serviceType  
5. No live meal supplier API  

*End of MODULE 06A implementation report.*
