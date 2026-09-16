# MODULE 03 — Flight Client Requirements Audit (Audit Only)

**Purpose:** Compare the **existing Quotation Wizard Flights step** and related backend (catalogue products, contracted rates, Amadeus/mock search, pricing, PDF, booking conversion, versioning) against client Module 03 flight requirements.

**Mode:** AUDIT ONLY — no application code, schema, API, UI, PDF, or conversion logic was changed for this report.

**Primary surface:**  
`quotation-wizard.tsx` Flights step (`step === 2`) → Catalog / API Search / Add Self-Booked → package `flights[]` → `POST/PUT` quotation wizard (`freezePackageLines` + pricing) → itinerary / PDF / booking.

**Audit date:** 2026-09-16  
**Method:** Static UI → API → backend → DB/schema code tracing. Live browser E2E with seeded flight catalogue + live Amadeus credentials was **not** executed in this pass. Items that require runtime data or provider keys are marked `BLOCKED`, `ENVIRONMENT BLOCKED`, or `DATA LIMITATION` as appropriate.

**Verdict scale:** `PASS` | `PARTIAL` | `FAIL` | `NOT IMPLEMENTED` | `BLOCKED` | `DATA LIMITATION`

---

## 1. Executive Summary

The Flights step **exists** with three entry paths (Catalog, API Search, Add Self-Booked) and a full manual field editor. Catalog selection is **gated on applicable contracted rates** (not free-form catalogue pricing). API Search is **wired** to Amadeus when agency keys are configured, otherwise it **falls back to mock** `generateFlights` — and this environment’s `backend/.env` has **no** Amadeus/flight provider keys (`FLIGHT_PROVIDER` defaults to `mock`).

Critical gaps vs client expectations:

| Area | Verdict | One-line finding |
|------|---------|------------------|
| Catalog as contracted flights | **PARTIAL** | Rate gate works; no flight availability/seat check; date defaults to trip start |
| API Search live provider | **PARTIAL** / **BLOCKED** here | Code path exists; env defaults to mock |
| Search parameters | **FAIL** | Origin/dest/date only; no return, multi-city search, pax, cabin in UI |
| Multi-segment as independent lines | **PASS** | `flights[]` supports multiple independent rows |
| Self-booked commercial treatment | **FAIL** | Invents ₹12,000 / ₹15,000 like pre-fix hotels |
| Flight → Itinerary | **NOT IMPLEMENTED** | Itinerary builds from hotels only |
| Cost security (API) | **PASS** | Role sanitization strips contracted cost |
| Cost security (agent UX) | **PARTIAL** | Applicable API hides cost; wizard still edits `costPrice` fields for staff paths |
| PDF flight block | **PARTIAL** | Route/times/cabin/baggage survive; stops & selling price per segment do not |
| Booking conversion | **PARTIAL** | Title + route/date/cabin + PNR→confirmation; times/baggage/source dropped from notes |

**Overall readiness for client Module 03:** not ready as a complete flight commercial module. Strongest areas are multi-line segments, catalogue rate gating, and API cost scrubbing. Weakest are API search parameters, self-booked invented pricing, and zero flight→itinerary sync.

---

## 2. Existing UI

**Location:** `frontend/src/components/views/quotation-wizard.tsx`, `step === 2` → `ServiceEditor` title `"Flights"`.

**Controls present:**

| Control | Evidence |
|---------|----------|
| Catalog | `CatalogPicker` with `kind="flights"` → `GET /api/products/flights` + `GET /api/contracted-rates/applicable` |
| API Search | `FlightApiSearch` button `"API search"` → `GET /api/flights/search` |
| Add Self-Booked | Button `"Add self-booked"` → clones `template` with `source: "MANUAL"` |
| Manual form fields | `airline`, `flightNumber`, `from`, `to`, `date`, `depTime`, `arrTime`, `duration`, `baggage`, `cabinClass`, `currency`, `pnr`, `remarks`, `costPrice`, `sellingPrice`, `fare` |
| Supporting docs | `FlightDocumentsAttach` (ticket / confirmation / invoice) after draft has `quotationId` |

**Template defaults (self-book):**  
`costPrice: 12000`, `sellingPrice: 15000`, `fare: 15000`, `cabinClass: "Economy"`, `from` prefilled from `departureIata(form.departureCity)`.

**Not present as hotel-style tabs:** no “Recommended / All / Self Booked” tab strip — three actions sit side-by-side.

---

## 3. Catalog Audit

### Trace

```
UI CatalogPicker (flights)
  → GET /api/products/flights  (FlightProduct rows, stripCatalogForRole)
  → on select: GET /api/contracted-rates/applicable?productType=FLIGHT&productId&travelDate[&cabinClass]
  → if !applicable || !rateId → toast, refuse pick
  → package.flights[] line source=CONTRACTED_PRODUCT + rateId + cost/selling when role can see cost
  → save: freezePackageLines → getApplicableContractedRate → rateSnapshot (frozen)
  → pricing: productType FLIGHT → PER_PASSENGER × quote adults (+ children extras if metadata)
```

### Does Catalog represent contracted flights?

| Requirement | Verdict | Evidence |
|-------------|---------|----------|
| Internal contracted flight products | **PASS** | `FlightProduct` model + products routes; pick requires `CONTRACTED_PRODUCT` |
| Contracted flight rates | **PASS** | `ContractedRate` with `productType=FLIGHT`; pick blocked without applicable rate |
| Supplier information | **PARTIAL** | `supplierId` on `FlightProduct`; agents get supplier stripped via `stripCatalogForRole` |
| Validity dates | **PASS** | `validFrom` / `validTo` on rate; applicable window checked for `travelDate` |
| Applicable rate selection | **PASS** | Cabin class can be passed as variant; ambiguous rates rejected |
| Flight availability | **NOT IMPLEMENTED** | Unlike hotels, `freezeLine` has **no** flight inventory/seat check |

### Does the system treat arbitrary catalogue records as contracted?

**No (selection path).** Listing can show Active/Approved `FlightProduct` rows, but **selection fails** without an applicable contracted rate (`NO_VALID_RATE` toast). Forged client `CONTRACTED_PRODUCT` lines are re-resolved server-side by `freezePackageLines`.

### Rate / date behaviour

| Check | Verdict | Notes |
|-------|---------|-------|
| Travel-date validity | **PASS** | Applicable endpoint requires ISO `travelDate` |
| Expired rates | **PASS** (logic) | Outside `validFrom`–`validTo` → not applicable |
| Future rates | **PASS** (logic) | Same window logic |
| Rate snapshot | **PASS** | `buildRateSnapshot` + `frozen: true` on save |
| Selected flight persistence | **PASS** | Stored in `packages[].flights` JSON on quotation |
| Segment date from catalogue | **PARTIAL** | `catalogToRow` sets `date: form.travelStartDate` for every pick — not per-city/segment |

**Catalog overall: PARTIAL**

---

## 4. API Search Audit

### Trace

```
FlightApiSearch.search()
  → GET /api/flights/search?origin&destination&departureDate&count=6
  → requireAuth + requirePermission("flights")
  → getAgencyApiKeys(agencyId)
  → if flightProvider==="amadeus" && key+secret → searchAmadeusFlights
       (Amadeus OAuth + GET {host}/v2/shopping/flight-offers)
  → else mock generateFlights(origin, destination, count)
  → publicFlightSearchResult (sanitized public fields)
  → UI onPick → source: "AMADEUS_API" line (even when mock!)
```

### Provider identification

| Item | Finding |
|------|---------|
| Provider name | **Amadeus** when configured; else **mock** |
| API endpoint/service | `…/v2/shopping/flight-offers` via `amadeus.ts` (`amadeusHost` test/prod) |
| Auth / config | Agency/platform/`FLIGHT_PROVIDER` + `FLIGHT_API_KEY` / `FLIGHT_API_SECRET` (`api-key-config.ts`) |
| Search request | Origin, destination, departureDate, adults (backend default **1**), currency INR, max |
| Search response | Mapped to `Flight` then `publicFlightSearchResult` |
| Mapping into Trevio line | UI pick maps subset; helper `flightLineFromSearchResult` exists but UI does **not** use it |
| Error handling | Toast on failure; 400 if provider set without keys; 502 on Amadeus errors |

### Environment (this workspace)

- `backend/.env` contains **no** `FLIGHT_PROVIDER` / `FLIGHT_API_KEY` / Amadeus entries.
- Default provider: **`mock`**.
- Therefore live Amadeus behaviour is **not verified by execution** here.

| Claim | Verdict |
|-------|---------|
| UI “API Search” exists | **PASS** |
| Backend route connected | **PASS** |
| Live Amadeus in this env | **BLOCKED** / **ENVIRONMENT BLOCKED** |
| Correct source tagging when mock | **FAIL** — mock results still tagged `source: "AMADEUS_API"` |

**API Search overall: PARTIAL** (wired code; often mock; incomplete pick mapping)

---

## 5. Self-Booked Audit

### Trace

```
Add self-booked → { ...template, source: "MANUAL", flightDocuments: [] }
  → editable ServiceEditor fields (incl. PNR, cost, sell, fare)
  → FlightDocumentsAttach after quotationId
  → freezeLine: MANUAL → delete contractedCost; keep line as-is
  → priceLine: MANUAL uses costPrice/fare as lump sum (splitShared), not PER_PASSENGER contracted
```

| Requirement | Verdict | Evidence |
|-------------|---------|----------|
| Manual flight entry | **PASS** | Full field list |
| Important flight details | **PASS** | Airline, number, route, date, times, duration, cabin, baggage |
| PNR | **PASS** | Field present; booking maps `pnr` → `confirmationNo` |
| Baggage | **PASS** | Field present |
| Supporting documents | **PARTIAL** | Upload UI exists; requires saved draft; visibility `"AGENT"` |
| Cost / selling / currency | **FAIL** commercially | Defaults invent **12000 / 15000**; not blank like fixed hotel self-book |
| Save / reload | **PASS** (code path) | Persisted in package JSON |
| Versioning | **PASS** | `flights` in `PACKAGE_MATERIAL_KEYS` |
| Incorrect catalogue/contracted pricing | **PASS** (does not apply contracted) | MANUAL skips contracted freeze; **but** invented defaults are still wrong commercially |

**Self-Booked overall: PARTIAL** (UX complete; commercial defaults fail client intent)

---

## 6. Search Parameters

| Parameter | Supported? | Verdict |
|-----------|------------|---------|
| Origin | Yes (UI + API) | **PASS** — default from departure city IATA when available, else `BOM` |
| Destination | Yes (UI + API) | **PARTIAL** — UI defaults hardcoded **`DEL`**, not quote destination |
| Departure date | Yes | **PARTIAL** — uses `travelStartDate`; not editable inside search popover |
| Return date | No | **NOT IMPLEMENTED** |
| One-way | Implicit only | **PARTIAL** — only one-way search exists |
| Round trip | No | **NOT IMPLEMENTED** |
| Multi-city **search** | No | **NOT IMPLEMENTED** (multi-**line** add is separate — see §8) |
| Adults | Backend Amadeus accepts; UI never sends | **FAIL** — Amadeus defaults to **1** adult |
| Children | No | **NOT IMPLEMENTED** |
| Infants | No | **NOT IMPLEMENTED** |
| Cabin class (search) | No | **NOT IMPLEMENTED** in search query |

**Basic Details passenger connection for API Search: FAIL**  
Quote `adults` / `children` / `infants` are used by **pricing** for contracted lines, not by `FlightApiSearch`.

**Search Parameters overall: FAIL**

---

## 7. Flight Result Fields

### API / mock search result (`publicFlightSearchResult`)

Present: airline, airlineCode, flightNumber, origin, destination, departTime, arriveTime, duration, stops, price, currency, cabin, seatsLeft, refundable, aircraft, baggage.

### Persisted on pick (UI `onPick`)

| Field | On search result | Copied to quote line | Verdict |
|-------|------------------|----------------------|---------|
| Airline | Yes | Yes | **PASS** |
| Airline code | Yes | **No** | **FAIL** |
| Flight number | Yes | Yes | **PASS** |
| Origin airport | Yes | Yes (`from`) | **PASS** |
| Destination airport | Yes | Yes (`to`) | **PASS** |
| Departure date | Via travelDate | Yes | **PASS** |
| Departure time | Yes | Yes | **PASS** |
| Arrival date | Not separate | **Missing** | **FAIL** |
| Arrival time | Yes | Yes | **PASS** |
| Duration | Yes | Yes | **PASS** |
| Stops | Yes | **No** | **FAIL** |
| Baggage | Yes | Yes | **PASS** |
| Cabin class | Yes | Yes | **PASS** |
| Fare / price | Yes | Yes (`fare`/`sellingPrice`) | **PASS** |
| Currency | Yes | Yes | **PASS** |
| Fare conditions / refundable | `refundable` flag | **Not copied** | **FAIL** |

### Catalog product fields

`FlightProduct` stores airline, flightNumber, origin, destinationAirport, times, duration, cabin, baggage, currency — **no** stops, airline code, fare conditions, or seat inventory.

**Flight Result Fields overall: PARTIAL**

---

## 8. Multi-Segment Audit

**Client example:** BLR→HKT (18 Oct), HKT→KBV (21 Oct), KBV→BLR (24 Oct) as independent segments.

| Requirement | Verdict | Evidence |
|-------------|---------|----------|
| Multiple independent flight lines on one quotation | **PASS** | `packages[].flights` is an array; user can add N catalog/API/manual rows |
| Per-segment origin / destination / date / time / airline / number / fare / baggage / cabin | **PASS** | Each row has its own editable fields |
| Multi-city **search** that returns a linked journey | **NOT IMPLEMENTED** | Search is single OD only |
| Automatic date alignment to itinerary days | **NOT IMPLEMENTED** | See §13 |
| Structured segment index / journey id | **NOT IMPLEMENTED** | Order = array order only |

**Do not treat a single flight record as multi-city:** correctly, the product uses **multiple records**. That satisfies the critical multi-segment storage requirement.

**Multi-Segment overall: PASS** (as independent lines; not as linked multi-city search)

---

## 9. Pricing Audit

### Contracted flights

```
ContractedRate.contractedCost
  → rateSnapshot on freeze
  → priceLine: FLIGHT unit PER_PASSENGER → × adults (+ child/infant extras if present)
  → quote layers: contractedCost → trevioMarkup → agentMarkup → customerPrice (+ tax)
```

| Check | Verdict |
|-------|---------|
| Contracted cost → Trevio markup → Agent markup → Customer price | **PASS** (quote-level `pricing.ts` layers) |
| Per-passenger multiplication for contracted flights | **PASS** (`defaultUnit` FLIGHT → `PER_PASSENGER`) |
| Catalogue display / selling seed | **PARTIAL** | `catalogDisplayPrice` for FLIGHT uses `product.displayPrice` (not on schema) → often **0**; engine still prices from snapshot |

### Self-booked / API

| Source | Treatment | Verdict |
|--------|-----------|---------|
| `MANUAL` | Uses explicit `costPrice`/`fare` as **lump sum** (`splitShared`), not × passengers | **PARTIAL** — intentional non-contracted path, but defaults invent amounts |
| `AMADEUS_API` | Same lump-sum path; UI sets `costPrice: 0`, `fare`/`sellingPrice` = search price | **PARTIAL** — customer fare present; internal cost 0 |

**Pricing overall: PARTIAL**

---

## 10. Cost Security Audit

### Backend / API

| Surface | Verdict | Evidence |
|---------|---------|----------|
| Quotation GET/list for agent/customer | **PASS** | `sanitizeQuotationForRole` strips `costPrice`, `contractedCost`, supplier, trevio markup, profit |
| Customer quotation access | **PASS** | `quotation-customer-access` sensitive key list |
| Catalogue list for agents | **PASS** | `stripCatalogForRole` strips supplier/cost keys |
| Applicable rate for agents | **PASS** | `presentApplicableRate` omits `contractedCost` unless `canViewContractedCost` |
| Flight search response | **PASS** | `publicFlightSearchResult` + `assertNoProviderSecrets` |
| Customer PDF model | **PASS** | Sensitive keys excluded; flight map has no cost fields |

### Frontend / role UX

| Check | Verdict | Notes |
|-------|---------|-------|
| Agent never sees contracted cost via applicable API | **PASS** | `contractedCost` omitted |
| Agent pick sets `costPrice` from rate | **PASS** (safe) | `hasInternalCost` false → cost not written |
| Wizard still shows `costPrice` input fields | **PARTIAL** | Same editor for staff; agents with wizard access see the field (empty for contracted after sanitize) |
| Live E2E role matrix executed | **Not executed** | Mark runtime confirmation **BLOCKED** without logged-in multi-role session |

**Cost Security overall: PASS (API) / PARTIAL (UI field exposure)** → scorecard: **PARTIAL**

---

## 11. Basic Details Integration

| Basic Details field | Used by Flights? | Verdict |
|---------------------|------------------|---------|
| Adults / children / infants | Pricing context for contracted; **not** API search | **PARTIAL** |
| Travel start date | Catalog applicable date; API departureDate; catalog line `date` | **PASS** |
| Departure city | Prefills `from` / API defaultFrom via IATA helper | **PASS** |
| Destination | Catalog filter context; **not** API `to` default | **PARTIAL** |
| Land-only flag | Stored on form; Flights step **still shown** at `step === 2` | **FAIL** (no skip) |
| Hardcoded passenger counts in search | Amadeus adults default **1** when omitted | **FAIL** |
| Hardcoded dates | Search uses travel date; mock Amadeus fallback date = today+7 if missing | **PARTIAL** |
| Hardcoded OD in API UI | `to` defaults **`DEL`**; `from` fallback **`BOM`** | **FAIL** |

**Basic Details Integration overall: PARTIAL**

---

## 12. Quotation Integration

| Field | Stored on line / quote? | Verdict |
|-------|-------------------------|---------|
| Quote ID | Parent quotation | **PASS** |
| Flight / product reference | `productId` (catalog); search id not persisted as product | **PARTIAL** |
| Segment | Implicit array index | **PARTIAL** |
| Route | `from` / `to` | **PASS** |
| Date | `date` | **PASS** |
| Passenger count on line | Not stored on flight row | **FAIL** |
| Fare / selling / currency | Yes | **PASS** |
| Source | `CONTRACTED_PRODUCT` / `AMADEUS_API` / `MANUAL` | **PASS** (mock mis-tagged) |
| Snapshot / version | `rateSnapshot` for contracted; versions include `flights` | **PASS** |

Save/reload: wizard payload includes `flights`; freeze on write. **Live save/reload not executed** this pass → persistence logic **PASS** by code; runtime confirm **BLOCKED**.

**Quotation Integration overall: PARTIAL**

---

## 13. Itinerary Integration

**Client expectation:** Selected flight (e.g. 18 Oct Bengaluru → Phuket) appears on the correct itinerary day with airline, number, times.

**Evidence:**

- Itinerary helper is **`buildItineraryFromHotels` only**.
- Flights step does **not** call any flight→itinerary sync.
- Itinerary UI copy: *“Days are prepared from your hotel stays…”*.

| Expected | Actual | Verdict |
|----------|--------|---------|
| Auto flight day entry | None | **NOT IMPLEMENTED** |
| Multi-segment on correct dates | None | **NOT IMPLEMENTED** |
| Airline / flight number / times on itinerary | Lost entirely unless user types manually | **FAIL** |

**Data lost Flights → Itinerary:** essentially **all** flight operational fields (airline, number, route, times, baggage, cabin, fare).

**Itinerary Integration overall: NOT IMPLEMENTED**

---

## 14. PDF Integration

**Path:** `quotation-pdf/model.ts` `mapFlights` → `render.ts` “Flight itinerary”.

| Field | Survives PDF? | Verdict |
|-------|---------------|---------|
| Airline | Yes | **PASS** |
| Flight number | Yes (`flightNo`) | **PASS** |
| Route | Yes | **PASS** |
| Date | Yes | **PASS** |
| Departure / arrival times | Yes | **PASS** |
| Duration | Yes | **PASS** |
| Stops | No | **FAIL** |
| Baggage | Yes | **PASS** |
| Cabin class | Yes | **PASS** |
| Customer-safe selling price (per flight) | No (package totals only) | **FAIL** |
| Cost / contracted | Correctly excluded | **PASS** |

**PDF Integration overall: PARTIAL**

---

## 15. Booking Integration

**Path:** `quotation-to-booking.ts` → `bookingService` type `"Flight"`.

| Field | Preserved? | How |
|-------|------------|-----|
| Airline + flight number | Yes | Service `title` |
| Route | Yes | Notes |
| Date | Yes | Notes |
| Cabin | Yes | Notes |
| Times | **No** | Dropped from notes |
| Duration / stops / baggage | **No** | Dropped |
| Passenger count | **No** | Not on line / notes |
| Fare / selling | Yes | `sellingPrice` column |
| Cost | Yes (internal booking) | `costPrice` / `quotedCostPrice` |
| Source | **No** | Not in notes |
| PNR | Yes | `confirmationNo` from `pnr` |
| Documents URLs | Partial | `voucherUrl` / `ticketUrl` if present on line |

**Booking Integration overall: PARTIAL**

---

## 16. Versioning

| Step | Verdict | Evidence |
|------|---------|----------|
| Create quote → select flight → save | **PASS** (code) | Wizard packages JSON |
| Create/update version | **PASS** | `/api/quotations/:id/versions`; material fingerprint includes `flights` |
| Freeze contracted rate snapshot | **PASS** | `freezePackageLines` / `rateSnapshot.frozen` |
| Immutability of snapshot after freeze | **PASS** | `preservedSnapshotCost` reuses frozen snapshot when valid |
| MANUAL / AMADEUS lines | **PARTIAL** | Not rate-snapshotted; full line JSON versioned as package content |

Live create→version→restore for flights **not executed** this pass.

**Versioning overall: PASS** (contracted); **PARTIAL** (API/manual commercial freeze depth)

---

## 17. Defects

1. **Self-booked invents prices** (`costPrice: 12000`, `sellingPrice`/`fare: 15000`) — fails client “no invented commercial amounts” pattern already fixed for hotels.
2. **API Search UI defaults** destination to `DEL` and does not send adults/children/cabin/return.
3. **Mock search results labelled `AMADEUS_API`** — false provider attribution.
4. **Pick drops** `stops`, `airlineCode`, `refundable` / fare conditions.
5. **No flight → itinerary** automatic population.
6. **Booking notes drop** times, baggage, source, passenger counts.
7. **PDF omits** stops and per-flight selling price.
8. **`landOnly` does not skip** Flights step.
9. **Catalogue line date** always seeded from trip start date.
10. **No catalogue flight availability** / seat inventory enforcement.
11. Agent-facing wizard still exposes **costPrice** field controls (API strips values; UX incomplete).

---

## 18. Missing Features

- Round-trip and multi-city **search** (linked itineraries).
- Search filters: adults, children, infants, cabin class, return date.
- Arrival **date** as first-class field (overnight flights).
- Fare conditions / refundable persistence.
- Flight segment → day-wise itinerary sync.
- Per-flight customer price on PDF.
- Flight inventory / availability for contracted catalogue products.
- Distinct UI labelling when provider is mock vs live Amadeus.
- Passenger count stored on each flight line.

---

## 19. Environment Blockers

| Blocker | Impact | Classification |
|---------|--------|----------------|
| No Amadeus / `FLIGHT_*` keys in local `backend/.env` | Search returns **mock** demo flights | **ENVIRONMENT BLOCKED** |
| Flight catalogue / contracted rates may be empty in DB | Catalog picker shows empty / all picks fail applicable | **DATA LIMITATION** |
| Multi-role browser sessions not run | Cost-leak UX for agents not visually confirmed | **BLOCKED** (test execution) |
| Live save/reload / PDF download / booking convert not executed | Persistence & render verified by code only | **BLOCKED** (test execution) |

**Do not treat mock search as live Amadeus PASS.**

---

## 20. Final Scorecard

| # | Area | Verdict |
|---|------|---------|
| 1A | Catalog entry source | **PARTIAL** |
| 1B | API Search entry source | **PARTIAL** |
| 1C | Self-Booked entry source | **PARTIAL** |
| 2 | Catalog = contracted products/rates | **PARTIAL** |
| 3 | API Search live provider | **PARTIAL** / **BLOCKED** in this env |
| 4 | Search parameters | **FAIL** |
| 5 | Flight result field completeness | **PARTIAL** |
| 6 | Multi-segment independent lines | **PASS** |
| 7 | Self-booked completeness & commercial treatment | **PARTIAL** |
| 8 | Pricing flow | **PARTIAL** |
| 9 | Cost security | **PARTIAL** |
| 10 | Basic Details integration | **PARTIAL** |
| 11 | Quotation persistence | **PARTIAL** |
| 12 | Itinerary integration | **NOT IMPLEMENTED** |
| 13 | PDF integration | **PARTIAL** |
| 14 | Booking integration | **PARTIAL** |
| 15 | Versioning / freeze | **PASS** (contracted) |
| 16 | Environment / data | **BLOCKED** + **DATA LIMITATION** |

### Roll-up

| Category | Count |
|----------|-------|
| PASS | 2 (multi-segment lines; contracted versioning/freeze) |
| PARTIAL | 12 |
| FAIL | 1 (search parameters) |
| NOT IMPLEMENTED | 1 (flight → itinerary) |
| BLOCKED / DATA LIMITATION | Provider keys + unexecuted live E2E |

**Module 03 client readiness:** **not ready** for sign-off. The existing three-button UI is real and partially wired, but API search is parameter-thin and usually mock here, self-booked invents prices, and selected flights never flow into the itinerary module.

---

## Evidence index (key files)

| Layer | Path |
|-------|------|
| UI Flights step | `frontend/src/components/views/quotation-wizard.tsx` |
| API search route | `backend/src/app.ts` (`GET /api/flights/search`) |
| Amadeus client | `backend/src/lib/amadeus.ts` |
| Mock flights | `backend/src/lib/mock-data.ts` (`generateFlights`) |
| Public mapping | `backend/src/lib/flight-quote.ts` |
| Flight products | `backend/src/routes/products.ts` (`registerFlightRoutes`) |
| Schema | `backend/prisma/schema.prisma` (`FlightProduct`, `ContractedRate`) |
| Rates / freeze | `backend/src/lib/contracted-rates.ts` |
| Pricing | `backend/src/lib/pricing.ts` |
| Role sanitize | `backend/src/lib/quotations.ts`, `quote-access.ts` |
| PDF | `backend/src/lib/quotation-pdf/model.ts`, `render.ts` |
| Booking | `backend/src/lib/quotation-to-booking.ts` |
| Versions | `backend/src/lib/quotation-versions.ts` |
| API keys | `backend/src/lib/api-key-config.ts` |

---

*End of audit. No application code was modified.*
