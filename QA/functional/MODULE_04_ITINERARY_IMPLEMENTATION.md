# MODULE 04A — Itinerary Corrections Implementation

**Date:** 2026-09-16  
**Mode:** Targeted corrections to the existing Itinerary step (no new page / no wizard redesign).  
**Audit baseline:** `QA/functional/MODULE_04_ITINERARY_CLIENT_REQUIREMENTS_AUDIT.md`

---

## 1. Files changed

| File | Change |
|------|--------|
| `frontend/src/lib/quote-itinerary-sync.ts` | **New** — safe multi-service itinerary sync |
| `frontend/src/lib/quote-itinerary-sync.test.ts` | **New** — unit coverage |
| `frontend/src/lib/quote-flight-itinerary.ts` | Facade re-export (03A compatibility) |
| `frontend/src/components/views/quotation-wizard.tsx` | Date UI, badges, regenerate, sync hooks, ops fields for all items |
| `backend/src/lib/quotation-pdf/model.ts` | Map `itemType` / `pickupTime` on itinerary items |
| `backend/src/lib/quotation-pdf/render.ts` | Prefix bullets with type + time when present |

**Schema:** no migration.

---

## 2. UI changes (existing day card)

- Header shows **Day N · formatted date · city**
- Editable **Date** field added (alongside city / meal plan)
- **Regenerate itinerary** button (safe auto refresh)
- Service **badges** (Flight / Hotel / Transfer / Activity / Meal / Manual)
- Operational fields for **all** items (removed first-4 limit)
- Copy previous day clears auto markers → MANUAL items
- Add Day marks `manualDay: true`

Preserved: cover, gallery, meal plan text, descriptions, Add/Copy/Save flow.

---

## 3. Data / model changes

Auto items carry:

- `itemType`: `FLIGHT` | `HOTEL` | `TRANSFER` | `ACTIVITY` | `MEAL` | `MANUAL`
- `sourceKey` (stable)
- `autoFromHotel` / `autoFromFlight` / `autoFromTransfer` / `autoFromActivity` / `autoFromMeal`
- line ids: `hotelLineId`, `flightLineId`, etc.

Legacy items without markers still render.

---

## 4. Day generation

- Prefer Module 02A **stay windows** (one day per night per city).
- Fallback: hotel `checkIn` + `nights`.
- **No** extra post-trip checkout-only day (e.g. no Day 6 on 23 Oct for Phuket 3n + Krabi 2n).
- Expected: Day 1–3 Phuket (18–20), Day 4–5 Krabi (21–22).

---

## 5. Multi-city synchronization

- Changing trip-city nights updates hotels **and** re-runs `syncPackageItinerary`.
- Cities on non-manual days refresh from new windows.
- Manual days outside range are **not** deleted.

---

## 6. Hotel integration

- Check-in on first night; stay items on intermediate nights; checkout on transition morning when next hotel shares check-out/check-in date.
- Description includes name, room type, meal plan, rooms, stay dates, nights when present.
- No cost fields.

---

## 7. Flight integration

- Preserves 03A merge behavior via unified sync.
- **Stops** included in description.
- Airline code, times, baggage, cabin, duration preserved.
- Dedupe by `sourceKey` / `flightLineId`.

---

## 8–10. Transfer / Activity / Meal

- Transfers with a `date` → itinerary day (pickup/drop/vehicle/time).
- Activities with a `date` → city/date/name/duration/pax.
- Meals module rows (`packages[].meals[]`) with a `date` → separate MEAL items (hotel meal-plan text remains independent).

---

## 11. Auto / manual tracking

- Sync strips only AUTO items, remembers `sourceKey` for ops/description preservation, re-inserts from package services.
- Manual items (`itemType: MANUAL` / no auto flags) and `manualDay` days survive.

---

## 12. Regeneration

- Explicit **Regenerate itinerary** control.
- Event-driven sync on hotel / flight / transfer / activity / meal / stay-window changes.
- Does not alter pricing collections or frozen versions.

---

## 13. Date handling

| Trigger | Behavior |
|---------|----------|
| Travel start / city nights | Stay windows → hotel sync + itinerary sync |
| Hotel / flight / transfer / activity / meal date | Sync on change |
| Manual day date edit | Editable; title can lock |

---

## 14. Security

- No contracted/supplier cost on itinerary items.
- Existing quotation sanitize paths unchanged.

---

## 15–16. PDF / Booking

- PDF itinerary bullets may show `[Type]` and pickup time; no redesign.
- Booking still stores full itinerary JSON + day “Other” services; no booking redesign.

---

## 17. Tests executed

| Suite | Result |
|-------|--------|
| `frontend/src/lib/quote-itinerary-sync.test.ts` | **7 PASS** |
| `frontend/src/lib/quote-flight-itinerary.test.ts` | **1 PASS** |
| Browser E2E save/reload | **BLOCKED** |
| Version restore E2E | **BLOCKED** |

---

## 18. PASS / FAIL / PARTIAL / BLOCKED

| Area | Result |
|------|--------|
| Date visible/editable | **PASS** (code) |
| Multi-city nights / no extra checkout | **PASS** (unit) |
| City-night change sync | **PASS** (unit) |
| Hotel → itinerary | **PASS** (unit) |
| Flight + stops | **PASS** (unit) |
| Transfer / Activity / Meal sync | **PASS** (unit) |
| Same-day multi-service + dedupe | **PASS** (unit) |
| Manual survival / regenerate | **PASS** (unit) |
| Ops fields all items | **PASS** (code) |
| Badges / itemType | **PASS** (code) |
| Pricing separation | **PASS** (unchanged) |
| Customer cost safety | **PASS** (model) |
| Save/reload browser | **BLOCKED** |
| Versioning browser | **BLOCKED** |

---

## 19. Remaining limitations

1. Transfers/activities/meals without a `date` are skipped (no guess).
2. Manual item interleaving order is “autos first, manuals after” on regenerate (non-aggressive; not drag-drop).
3. Hotel checkout appears on transition morning only when next stay shares that date (or date still in trip nights).
4. Live browser E2E not run in this environment.
5. PDF still does not print gallery/cover per day.

---

*Module 04A complete within scope. Unrelated modules not redesigned.*
