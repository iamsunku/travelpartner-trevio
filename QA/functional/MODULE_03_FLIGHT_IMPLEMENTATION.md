# MODULE 03A — Flights Corrections Implementation

**Date:** 2026-09-16  
**Mode:** Targeted corrections to the existing Flights module (no rewrite / no new architecture).  
**Audit baseline:** `QA/functional/MODULE_03_FLIGHT_CLIENT_REQUIREMENTS_AUDIT.md`

---

## 1. Files changed

| File | Change |
|------|--------|
| `frontend/src/components/views/quotation-wizard.tsx` | Self-book blanks; API search UI; land-only; agent cost hide; itinerary sync; catalog date; passenger snapshot |
| `frontend/src/lib/quote-flight-itinerary.ts` | **New** — merge/strip auto flight itinerary items |
| `frontend/src/lib/quote-flight-itinerary.test.ts` | **New** — merge/dedupe unit test |
| `backend/src/lib/flight-quote.ts` | MOCK source; arrivalDate; full field map; blank manual template |
| `backend/src/lib/amadeus.ts` | Adults/children/infants/cabin/returnDate; leg flatten; arrival dates |
| `backend/src/lib/mock-data.ts` | Dates, cabin, direction, overnight arrivalDate |
| `backend/src/lib/types.ts` | Optional flight date/journey fields |
| `backend/src/app.ts` | Search params (trip type, pax, cabin, segments); mock vs live labeling |
| `backend/src/lib/contracted-rates.ts` | `MOCK` rate source; freeze treats MOCK like MANUAL |
| `backend/src/lib/pricing.ts` | MOCK pricing path; sellingPrice fallback |
| `backend/src/lib/quotation-pdf/model.ts` | arrivalDate, stops, sellingPrice (customer-safe) |
| `backend/src/lib/quotation-pdf/render.ts` | Render new flight fields |
| `backend/src/lib/quotation-to-booking.ts` | Richer flight notes (times, baggage, source, pax, PNR) |
| `backend/src/__tests__/module-03a-flights.test.ts` | **New** targeted tests |
| `backend/src/__tests__/product-inventory.test.ts` | Manual template expectations updated |

**Schema:** no Prisma migrations. Flight seat/inventory remains **NOT IMPLEMENTED** (no inventory fields on `FlightProduct`).

---

## 2. UI changes

- Self-booked template: **no** invented ₹12k/₹15k; `source=MANUAL`, `selfBooked=true`, commercial fields omitted until entered.
- API Search panel: One Way / Round Trip / Multi-city; From/To/dates; Adults/Children/Infants; Cabin; mock/live banners.
- No hardcoded `DEL` / `BOM` fallbacks — empty until Basic Details IATA or user entry.
- Flight editor fields extended: `airlineCode`, `arrivalDate`, `stops`.
- Agents/customers: `costPrice` / `markup` / `supplier` hidden in shared `ServiceEditor`.
- Land-only: Flights step skipped in next/back; nav disabled with toast; placeholder message on step.
- Catalog pick: segment date left blank (user sets intended date); passenger snapshot + `segmentIndex` applied.

---

## 3. API changes

`GET /api/flights/search` now accepts:

- `tripType=one_way|round_trip|multi_city`
- `origin`, `destination`, `departureDate`, `returnDate`
- `adults`, `children`, `infants`, `cabinClass`
- `segments` JSON for multi-city
- **Requires** origin/destination (no BOM/DEL defaults)

Response includes:

- `provider`: `amadeus` | `mock`
- `source`: `live` | `demo`
- `rateSource`: `AMADEUS_API` | `MOCK`
- `demo: true` + message when mock

---

## 4. Backend changes

- Amadeus search passes pax + cabin + returnDate; round-trip offers flattened to outbound/return legs with shared `journeyId`.
- Multi-city live: sequential Amadeus one-way per segment (tagged `segmentIndex`).
- Mock generator supports the same trip shapes for local/dev.
- Freeze/pricing recognize `MOCK` alongside `AMADEUS_API` / `MANUAL`.

---

## 5. Schema changes

**None.** Contracted flight seat availability remains unsupported in DB → documented as NOT IMPLEMENTED (no fake availability).

---

## 6. Self-booked changes

| Before | After |
|--------|-------|
| cost 12000 / sell 15000 / fare 15000 | Fields omitted; `selfBooked: true` |
| Still `MANUAL` | Still `MANUAL` (not contracted) |
| User-entered amounts | Still price via existing `priceLine` when provided |

---

## 7. API search changes

- Connected to Basic Details defaults (departure IATA, destination IATA when resolvable, travel dates, pax).
- Multi-city segment editor in the existing popover (not a new page).
- Mock results never labeled `AMADEUS_API`.

---

## 8. Catalog changes

- Applicable contracted rate gate **preserved**.
- Cost still withheld from agents via `presentApplicableRate`.
- Date no longer forced to trip start; `rateTravelDate` still used for rate window on save.
- Passenger snapshot + `segmentIndex` added non-breaking.

---

## 9. Multi-segment handling

- Continues to use `packages[].flights[]` (one record per segment).
- Adds optional `segmentIndex`, `journeyId`, `direction` without breaking old quotes.

---

## 10. Flight → itinerary integration

- New `mergeFlightsIntoItinerary` / `stripAutoFlightItems`.
- Auto items tagged `autoFromFlight` / days `autoFromFlightDay`.
- Hotel rebuild re-merges flights; flight edits refresh auto flight items without wiping hotel/manual content where possible.
- Hotel days now carry calendar `date` for matching.

---

## 11. PDF changes

- Minimal model/render updates: arrival date, stops, customer-safe selling price.
- Cost / contracted / markup still excluded.

---

## 12. Booking changes

- Notes now include route, dep/arr dates & times, duration, stops, baggage, cabin, source, pax snapshot, PNR.
- Internal `costPrice` / `sellingPrice` columns unchanged (permissioned elsewhere).

---

## 13. Security changes

- Backend sanitize paths unchanged (still strip cost for agents/customers).
- UI: hide internal cost fields for `travel_agent` / `customer` in `ServiceEditor`.

---

## 14. Tests executed

| Suite | Result |
|-------|--------|
| `backend/src/__tests__/module-03a-flights.test.ts` | **22/22 PASS** (with product-inventory) |
| `backend/src/__tests__/product-inventory.test.ts` | **PASS** |
| `frontend/src/lib/quote-flight-itinerary.test.ts` | **PASS** (1) |
| Live Amadeus HTTP | **ENVIRONMENT BLOCKED** — no keys in `backend/.env` |
| Browser E2E save/reload/version | **BLOCKED** — not executed this session |

---

## 15. PASS / FAIL / PARTIAL / BLOCKED results

| ID | Item | Result | Notes |
|----|------|--------|-------|
| A | One-way API search | **PASS** (unit/mock path) | Backend + UI wired; mock verified |
| B | Round-trip search | **PASS** (unit/mock path) | Mock + Amadeus param path |
| C | Multi-city search | **PASS** (unit/mock path) | Segments JSON + mock |
| D | Adults/children propagation | **PASS** | Sent on search; snapshotted on line |
| E | Cabin propagation | **PASS** | Query + Amadeus travelClass |
| F | Destination default | **PASS** | No DEL; requires user/Basic Details IATA |
| G | Mock provider labeling | **PASS** | `rateSource=MOCK`, UI banner |
| H | Live Amadeus | **ENVIRONMENT BLOCKED** | No credentials |
| I | Self-book blank commercials | **PASS** | Unit + template |
| J | Manual entered selling price | **PASS** | Pricing unit |
| K | API field preservation | **PASS** | Unit |
| L | Arrival date | **PASS** | Unit + fields |
| M | Multiple segments | **PASS** | Unit |
| N | Contracted rate validation | **PASS** (logic preserved) | Gate unchanged; blank date allowed |
| O | Agent cost security | **PASS** (API unit + UI hide) | Live agent UI not browser-tested |
| P | Flight → itinerary | **PASS** | Merge unit test + wizard wiring |
| Q | Flight → PDF | **PASS** | Model unit |
| R | Flight → booking | **PARTIAL** | Notes enriched; full convert E2E not run |
| S | Save/reload | **BLOCKED** | Not browser-executed |
| T | Versioning/freeze | **PARTIAL** | Freeze/MOCK source code verified; version E2E not run |
| U | Land-only workflow | **PASS** (code) | next/back/nav skip |

---

## 16. Remaining known limitations

1. **Flight catalogue seat/inventory availability** — NOT IMPLEMENTED (no schema support; not faked).
2. **Live Amadeus** — depends on agency API keys; this environment uses mock by default.
3. **Multi-city live Amadeus** — sequential one-way searches per segment (not a single Amadeus multi-city POST offer).
4. **Round-trip fare split** — total offer price shared across legs for display; not a true per-leg fare breakup from Amadeus.
5. **Browser E2E** for save/reload/version/land-only not executed in this pass.
6. Catalog contracted pick still requires the user to enter the intended segment **date** after selection (intentional — no longer forced to trip start).

---

*Implementation complete for Module 03A scope. Unrelated modules were not redesigned.*
