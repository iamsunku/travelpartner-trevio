# MODULE 04 — Existing Itinerary Builder Client Requirements Audit (Audit Only)

**Purpose:** Compare the **existing Quotation Wizard Itinerary step** (`step === 3`) and related persistence / PDF / booking / security paths against the client day-wise itinerary workflow.

**Mode:** AUDIT ONLY — no application code, schema, UI, PDF, or booking logic was modified for this report.

**Primary surface:**  
`quotation-wizard.tsx` Itinerary step → package `itinerary[]` JSON → quotation save/versions → PDF `mapItinerary` / booking `itinerary` + day “Other” services.

**Related feeders:**  
`buildItineraryFromHotels` · `mergeFlightsIntoItinerary` / `stripAutoFlightItems` (`quote-flight-itinerary.ts`) · Module 02A `buildTripCityStayWindows` / `syncHotelRowsToTripStays`.

**Audit date:** 2026-09-16  
**Method:** Static UI → state → API/persistence → PDF/booking code tracing. Live browser E2E (save/reload, multi-city UI, regenerate, version restore) was **not** executed. Runtime-only claims are marked `BLOCKED`.

**Verdict scale:** `PASS` | `PARTIAL` | `FAIL` | `NOT IMPLEMENTED` | `BLOCKED` | `DATA LIMITATION`

---

## 1. Executive summary

The Itinerary step is a **manual day editor** with **partial auto-fill from Hotels and Flights only**. Transfers, Activities, and Meals **do not** feed the itinerary. Day calendar dates are stored when hotels/flights sync, but the **Itinerary UI does not show or edit a dedicated Date field**.

| Area | Verdict | One-line finding |
|------|---------|------------------|
| Generation sources | **PARTIAL** | Hotels + Flights only |
| Per-city day dates from hotel stays | **PARTIAL** | Uses hotel `checkIn`/`nights` (02A); extra checkout day; no auto-rebuild when nights change |
| Hotel detail preservation | **PARTIAL** | Name/city/meal text only — not rooms/room type/check-in-out structured |
| Flight merge (03A) | **PARTIAL** | Date-matched merge works; stops omitted; UI date not visible |
| Transfer / Activity / Meal → itinerary | **NOT IMPLEMENTED** | Separate wizard steps only |
| Manual vs auto survival | **FAIL** / **PARTIAL** | Flight strip preserves non-flight items; full hotel rebuild can wipe item edits while `autoFromHotel` remains |
| Pricing separation | **PASS** | Itinerary not in pricing collections |
| Customer/agent cost exposure via itinerary | **PASS** | No cost fields on itinerary items; sanitize still applied to package |
| Save/reload / version E2E | **BLOCKED** | Code path exists; not browser-executed |
| PDF | **PARTIAL** | Day/title/city/date/items/mealPlan; ops fields dropped |
| Booking | **PARTIAL** | Full JSON stored; also flattened to weak “Other” day services |

**Overall:** Not ready for client sign-off as a full multi-service day builder. Strongest: hotel-driven day skeleton + 03A flight merge. Weakest: no transfer/activity/meal feed, invisible dates in UI, stale itinerary when trip nights change, fragile manual-edit protection on hotel regenerate.

---

## 2. Existing itinerary UI

**Location:** `quotation-wizard.tsx`, `step === 3`.

| Control | Present? | Notes |
|---------|----------|-------|
| Day-wise list | Yes | One card per day |
| Day number | Partial | Via editable `title` / `day` index — not a separate “Day N” + date header |
| City / place | Yes | `Field` |
| Meal plan | Yes | Free-text `Field` |
| Day cover image URL | Yes | |
| Gallery photos | Yes | `GalleryUrlsField` |
| Description / activities | Yes | Multiline textarea of item `activityName`s |
| Pickup / Duration / Vehicle / Guide / Voucher / Remarks | Yes | Only for **first 4** items per day |
| Copy previous day | Yes | |
| Add Day | Yes | |
| Delete day | Yes | Trash on day |
| Save Draft / Save & Continue | Yes | Wizard chrome (persist) |
| Dedicated calendar **Date** field | **No** | `day.date` exists in data model but **not rendered** for view/edit |
| Drag-reorder days/items | **No** | |
| Explicit “Regenerate itinerary” button | **No** | Regeneration is side-effect of hotel add / flight change |

Default package stub: single day with “Airport Arrival” / “Meet & greet” (placeholder).

---

## 3. Day generation

### How days are created

1. **On hotel confirm** (`onHotelAdded`), if `canAutoSyncItinerary`:  
   `buildItineraryFromHotels(hotels)` → then `mergeFlightsIntoItinerary(..., flights)`.
2. **On flight change**: `mergeFlightsIntoItinerary` into existing days (or rebuild base from hotels if empty).
3. **Manual**: Add Day / Copy previous day.
4. **Not from** Basic Details trip cities alone, Transfers, Activities, or Meals.

### `buildItineraryFromHotels` algorithm

- Sort hotels by `checkIn`.
- For each hotel: for `n = 0 .. nights-1`, create a day with:
  - `date = checkIn + n days`
  - `city = tripCity || city`
  - `hotelName`, `mealPlan` (hotel meal or Dinner/Breakfast default)
  - `autoFromHotel: true`
  - One item: Arrival & check-in (first overall night) or “Sightseeing / leisure”; description `Stay at {hotelName}`
- After all hotels: **one extra** “Checkout & departure” day on **last hotel’s `checkOut`**.

### Client example vs code

| Expected (Phuket 3n + Krabi 2n, start 18 Oct) | Actual (if hotels dated 18→21 and 21→23) |
|-----------------------------------------------|------------------------------------------|
| Day 1–3 Phuket (18–20) | Same night-days |
| Day 4–5 Krabi (21–22) | Same |
| (no day 6 in client example) | **Extra** Day 6 Checkout on **23 Oct** |

| Check | Verdict |
|-------|---------|
| Day number sequential | **PASS** |
| Calendar date stored | **PASS** (on `day.date`) |
| Calendar date visible in UI | **FAIL** |
| City from hotel stay | **PASS** (when hotel city/tripCity set) |
| City transition by hotel check-in | **PASS** (logic) |
| Nights → night-days | **PASS** |
| Days count vs client expectation | **PARTIAL** (extra checkout day) |
| Uses whole-trip hotel dates only | **PASS** avoidance — uses **per-hotel** `checkIn`/`nights` (02A-aligned **if** hotel rows are correctly dated) |

**Day generation overall: PARTIAL**

---

## 4. Multi-city logic

Trip plan windows (`buildTripCityStayWindows`) compute per-city check-in/out. Hotels sync via `syncHotelRowsToTripStays` when nights/order/start date change.

| Scenario | Itinerary behavior | Verdict |
|----------|--------------------|---------|
| 1 / 2 / 3 cities with correctly dated hotels | Days follow each hotel’s stay segment | **PARTIAL** (code path) |
| Changing city nights | Hotels update; **itinerary does not auto-rebuild** | **FAIL** (stale itinerary dates) |
| Hotels attached to city | Via `tripCity`/`city` on hotel line → itinerary city | **PARTIAL** |
| Trip cities alone (no hotels) | No auto day plan from cities | **NOT IMPLEMENTED** |

**Live 1/2/3-city UI matrix:** **BLOCKED** (not executed).

**Multi-city overall: PARTIAL**

---

## 5. Hotel integration

| Expected field in itinerary | Preserved? | How |
|-----------------------------|------------|-----|
| Hotel name | **PARTIAL** | `hotelName` + item description “Stay at …” |
| City | **PASS** | `day.city` |
| Check-in / check-out | **PARTIAL** | Encoded into day dates only; not shown as hotel stay fields |
| Nights | **PARTIAL** | Implied by day count; not stored on day |
| Rooms | **FAIL** | Not copied |
| Room type | **FAIL** | Not copied |
| Meal plan | **PARTIAL** | Copied to free-text `day.mealPlan` |

**Phuket must not run to 23 Oct:**  
If Module 02A hotel lines have Phuket `checkOut=21 Oct` and Krabi starts `21 Oct`, itinerary night-days stop Phuket at 20 Oct. **Logic supports this.** Depends on hotel rows being correctly dated; itinerary itself does not re-read trip windows.

**No hotel → transfer/activity auto items.**

**Hotel → itinerary overall: PARTIAL**

---

## 6. Flight integration (Module 03A)

| Expected | Actual | Verdict |
|----------|--------|---------|
| Appear on flight `date` | `mergeFlightsIntoItinerary` matches `day.date` | **PASS** (logic) |
| Multi-segment on correct dates | Sorted by date; creates `autoFromFlightDay` if needed | **PASS** (logic) |
| Airline / number / OD / times | In `activityName` + `description` + `pickupTime` | **PASS** |
| Duration | `duration` on item | **PASS** |
| Cabin / baggage | In description | **PASS** |
| Stops | **Not** included in `flightItineraryItem` | **FAIL** |
| Dedupe on re-merge | `flightLineId` + `stripAutoFlightItems` | **PASS** (unit tested in 03A) |

Flights without `date` (and no travelStart fallback used incorrectly): skipped if both empty — catalog flights with blank date may **not** appear until dated.

**Flight → itinerary overall: PARTIAL**

---

## 7. Transfer integration

| Check | Verdict |
|-------|---------|
| Auto-insert airport pickup/drop / hotel / intercity on day | **NOT IMPLEMENTED** |
| Transfers step → itinerary sync | **None** (`onChange` only patches `transfers`) |
| Self-booked hotel address for transfer drop | Used in **Transfers** UI locations helper only — **not** itinerary |

**Transfer → itinerary: NOT IMPLEMENTED**

---

## 8. Activity integration

| Check | Verdict |
|-------|---------|
| Auto-attach activity to city/date/day | **NOT IMPLEMENTED** |
| Activities step → itinerary | **None** |
| Manual typing of activity names in day textarea | **PASS** (manual only) |

**Activity → itinerary: NOT IMPLEMENTED** (as module feed)

---

## 9. Meal integration

| Check | Verdict |
|-------|---------|
| Day “Meal plan” connected to `packages[].meals[]` | **FAIL** — independent free text |
| Meals module → itinerary day items | **NOT IMPLEMENTED** |
| Seed from hotel meal plan | **PARTIAL** — one-way copy at hotel build time |

**Meal → itinerary: FAIL / NOT IMPLEMENTED** (text field only)

---

## 10. Manual editing

| Action | Supported? | Persisted in `itinerary[]`? |
|--------|------------|------------------------------|
| Add day | Yes | Yes |
| Delete day | Yes | Yes |
| Edit title / city / meal plan | Yes | Yes |
| Cover / gallery | Yes | Yes |
| Edit item names (textarea) | Yes | Yes |
| Ops fields (pickup…remarks) | First **4** items only | Yes when edited |
| Edit item `description` separately from name | **Weak** — textarea sets `description` from line text | Partial |
| Reorder days/items | **No** | N/A |
| Dedicated date edit | **No** in UI | `date` can exist from auto-gen |

**Manual editing overall: PARTIAL**

---

## 11. Automatic vs manual content

| Kind | Marker / behavior |
|------|-------------------|
| AUTO hotel days | `autoFromHotel: true`; items not separately tagged |
| AUTO flight items | `autoFromFlight: true`; optional `autoFromFlightDay` |
| AUTO transfer/activity/meal | None |
| MANUAL days | Add Day / Copy; lack auto flags → `canAutoSyncItinerary` becomes **false** |

### Critical regenerate vs edit behavior

| Sequence | Outcome |
|----------|---------|
| Generate from hotels → edit item text → **add another hotel** while all days still `autoFromHotel` | **Full rebuild** from hotels → **manual item text lost** |
| Generate → **Add Day** (manual) → add hotel | Rebuild **skipped** (`canAutoSync` false); toast keeps existing plan |
| Edit flights | `stripAutoFlightItems` then re-merge — hotel/manual non-flight items kept |
| Edit description on hotel item only (no new day) | Day still “auto-managed” → vulnerable to hotel rebuild |

**Auto vs manual overall: FAIL** for hotel-item edit survival; **PARTIAL** for flight-only refresh.

---

## 12. Regeneration / deduplication

| Risk | Verdict | Evidence |
|------|---------|----------|
| Duplicate flights | **PASS** (logic) | strip + `flightLineId` |
| Duplicate hotels on flight merge | **PASS** | Flight merge does not rebuild hotels |
| Duplicate hotels on hotel re-add | **N/A** — full replace of auto itinerary |
| Transfer/activity/meal dupes | **N/A** — not auto-inserted |
| Flight wipe of hotel/manual | **PASS** (logic) | strip only `autoFromFlight` |
| Hotel rebuild wipe of flight | **PARTIAL** | Rebuild then re-merge flights if flights still in package |

No dedicated regenerate control — behavior is event-driven only.

**Regeneration overall: PARTIAL**

---

## 13. Date handling

| Change | Hotel rows | Itinerary days |
|--------|------------|----------------|
| Travel start / city nights | `syncHotelRowsToTripStays` updates unlocked hotels | **No auto update** → **stale `day.date`** |
| Hotel replace / add (auto-sync on) | New rows | Rebuild dates from hotels |
| Flight date change | — | Flight items re-placed by new dates |
| Manual day date | — | **Cannot edit date in UI** |

**Date handling overall: FAIL** (stale after trip-plan changes; date not visible).

---

## 14. Pricing separation

`pricing.ts` `COLLECTIONS` = hotels, flights, transfers, activities, meals, addOns — **not** itinerary.

| Change | Affects quote price? |
|--------|----------------------|
| Description / photos / notes / day order | **No** → **PASS** |
| Underlying hotel/flight/transfer lines | Yes (separate commercial modules) — expected |

**Pricing separation: PASS**

---

## 15. Customer view

Customer quotation access sanitizes package lines including `itinerary` (strips sensitive keys if present). Itinerary items normally have **no** cost/supplier fields.

Customer-visible content (via API/PDF): day title, city, date (if stored), item names/descriptions, meal plan text. Structured flight/hotel also appear in **separate** PDF sections (not only itinerary bullets).

Restricted cost/profit: not on itinerary items; blocked by sanitize elsewhere → **PASS** for cost security.

Operational detail richness for customers: **PARTIAL** (PDF drops pickup/vehicle/guide/voucher).

**Customer view overall: PARTIAL**

---

## 16. Agent view

Agents use same itinerary editor. Package sanitize strips contracted cost on hotels/flights. Itinerary itself does not expose supplier cost.

| Check | Verdict |
|-------|---------|
| See operational day plan | **PASS** (if they can open wizard) |
| See contracted cost via itinerary | **PASS** (not present) |
| Live agent session verified | **BLOCKED** |

**Agent view overall: PASS** (API model) / **BLOCKED** (runtime)

---

## 17. Save / reload

Itinerary is part of package JSON on wizard persist. **Code path: present.**

Browser create → hotel → flight → edit → save → reload: **BLOCKED** (not executed).

**Save/reload: BLOCKED** (do not mark PASS from inspection alone)

---

## 18. Versioning

`PACKAGE_MATERIAL_KEYS` includes `itinerary`. Version create/fingerprint includes itinerary snapshot.

| Check | Verdict |
|-------|---------|
| Material fingerprint includes itinerary | **PASS** (code) |
| V1 immutable after V2 | **PASS** (versioning design) |
| Live version restore of itinerary | **BLOCKED** |

**Versioning: PARTIAL** (logic PASS; E2E BLOCKED)

---

## 19. PDF integration

`mapItinerary` → title, city, date, mealPlan, items (`activityName`, `description`).  
Render: day heading, city · date, bullets, meal plan line.

| Content | In itinerary PDF block? |
|---------|-------------------------|
| Day / title | Yes |
| Date / city | Yes if stored |
| Flight as itinerary bullet | Yes if merged into items |
| Hotel as stay blurb | Yes (“Stay at …”) |
| Transfer / activity / meal modules | Separate PDF sections; **not** from itinerary feed |
| Pickup / vehicle / guide / voucher | **No** |
| Cover/gallery images per day | Cover used only as possible package cover fallback — not day gallery |

**PDF: PARTIAL**

---

## 20. Booking integration

1. Full `selected.itinerary` JSON copied to `booking.itinerary` when non-empty.  
2. Each day also becomes a booking service `Other` with title = day title and notes = joined activity names; **cost/sell 0**.

| Lost / weakened | Notes |
|-----------------|-------|
| Structured flight/hotel on day | Prefer dedicated Flight/Hotel services from package lines |
| Ops fields | Only in JSON blob / weak notes |
| Dates/cities | In JSON; not first-class booking service columns |

**Booking: PARTIAL**

---

## 21. UI quality (observation only — no redesign)

| Topic | Observation | Verdict |
|-------|-------------|---------|
| Day clarity | Title editable; day index implicit | **PARTIAL** |
| City visibility | Clear field | **PASS** |
| Date visibility | Stored but **not shown** | **FAIL** |
| Service grouping | Flat item list; no Flight/Hotel/Transfer labels | **PARTIAL** |
| Multiple services/day | Possible as multiple lines | **PARTIAL** |
| Long descriptions | Textarea; advanced panel only first 4 items | **PARTIAL** |
| Duplicate content | Possible if user copies days | **PARTIAL** |
| Mobile | Same stacked cards; not device-tested | **BLOCKED** |

**UI quality overall: PARTIAL**

---

## 22. Defects

1. **Calendar date not shown/editable** on itinerary cards despite `day.date` in model.  
2. **Trip-plan night/start changes** update hotels but **leave itinerary stale**.  
3. **Hotel regenerate** while `autoFromHotel` days remain can **wipe manual item edits**.  
4. **No Transfer / Activity / Meal → itinerary** integration.  
5. **Meal plan** is disconnected free text, not Meals module.  
6. **Extra checkout day** vs client “nights = days” mental model.  
7. **Flight stops** not carried into itinerary items.  
8. **Ops editors capped at 4 items** per day.  
9. **No day/item reorder**.  
10. Hotel rooms / room type / explicit check-in-out not represented as itinerary fields.

---

## 23. Missing features

- Auto day generation from trip cities without hotels  
- Auto transfer / activity / meal day placement  
- Explicit Regenerate control with safe merge of manual content  
- Date field in UI  
- Service-type badges / grouping  
- Item-level auto tags for hotel (today only day-level `autoFromHotel`)  
- Full operational field editing for all items  
- Drag-and-drop ordering  

---

## 24. Environment blockers

| Blocker | Classification |
|---------|----------------|
| No browser E2E this pass (save/reload, multi-city matrix, regenerate, version restore, mobile) | **BLOCKED** |
| Empty seed hotels/flights in local DB | **DATA LIMITATION** (would affect manual validation) |

---

## 25. Final scorecard

| # | Area | Verdict |
|---|------|---------|
| 1 | Itinerary purpose / feeders | **PARTIAL** |
| 2 | Day generation | **PARTIAL** |
| 3 | Multi-city | **PARTIAL** |
| 4 | Hotel → itinerary | **PARTIAL** |
| 5 | Flight → itinerary | **PARTIAL** |
| 6 | Same-day multi-service coexistence | **PARTIAL** (hotel+flight yes; transfer no) |
| 7 | Transfer → itinerary | **NOT IMPLEMENTED** |
| 8 | Activity → itinerary | **NOT IMPLEMENTED** |
| 9 | Meal → itinerary | **NOT IMPLEMENTED** / **FAIL** (text only) |
| 10 | Manual editing | **PARTIAL** |
| 11 | Auto vs manual survival | **FAIL** |
| 12 | Regeneration / dedupe | **PARTIAL** |
| 13 | Date handling | **FAIL** |
| 14 | Pricing separation | **PASS** |
| 15 | Customer view | **PARTIAL** |
| 16 | Agent view | **PASS** / **BLOCKED** |
| 17 | Save / reload | **BLOCKED** |
| 18 | Versioning | **PARTIAL** |
| 19 | PDF | **PARTIAL** |
| 20 | Booking | **PARTIAL** |
| 21 | UI quality | **PARTIAL** |

### Scenario matrix (A–P)

| ID | Scenario | Verdict |
|----|----------|---------|
| A | One city / one hotel | **PARTIAL** (logic; E2E BLOCKED) |
| B | One city / hotel + flight | **PARTIAL** |
| C | Two cities / different hotels | **PARTIAL** |
| D | Two cities / hotels + flights | **PARTIAL** |
| E | Three cities | **PARTIAL** |
| F | Flight + transfer + hotel same day | **FAIL** (transfer not auto) |
| G | Activity + meal + hotel same day | **FAIL** (activity/meal not auto) |
| H | Change city nights | **FAIL** (itinerary stale) |
| I | Change hotel | **PARTIAL** |
| J | Change flight | **PARTIAL** / **PASS** logic |
| K | Regenerate | **PARTIAL** / **FAIL** on manual wipe |
| L | Add manual content | **PARTIAL** |
| M | Save/reload | **BLOCKED** |
| N | Versioning | **PARTIAL** / **BLOCKED** E2E |
| O | Customer-safe output | **PARTIAL** |
| P | Agent security | **PASS** (model) |

### Roll-up

| Category | Count (scorecard rows) |
|----------|------------------------|
| PASS | 1–2 |
| PARTIAL | Majority |
| FAIL | Auto/manual survival, date handling, same-day transfer/meal scenarios |
| NOT IMPLEMENTED | Transfer / Activity / Meal feeds |
| BLOCKED | Save/reload E2E, mobile, live agent session |

**Module 04 client readiness:** **not ready** for sign-off as a complete multi-service itinerary builder. Existing UI is usable for manual day editing and partial hotel/flight auto-fill, but date UX, trip-plan sync, manual-edit safety, and transfer/activity/meal integration are material gaps.

---

## Evidence index

| Topic | Path |
|-------|------|
| Itinerary UI + hotel/flight hooks | `frontend/src/components/views/quotation-wizard.tsx` |
| Flight merge | `frontend/src/lib/quote-flight-itinerary.ts` |
| Trip-city stay windows | `frontend/src/lib/quote-trip-stays.ts` |
| Pricing collections | `backend/src/lib/pricing.ts` |
| Versions | `backend/src/lib/quotation-versions.ts` |
| PDF | `backend/src/lib/quotation-pdf/model.ts`, `render.ts` |
| Booking | `backend/src/lib/quotation-to-booking.ts` |
| Customer sanitize | `backend/src/lib/quotation-customer-access.ts` |

---

*End of audit. No application code was modified.*
