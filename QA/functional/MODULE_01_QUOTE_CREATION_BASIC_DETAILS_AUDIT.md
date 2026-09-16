# MODULE 01 — Quote Creation + Basic Details (Audit Only)

**Scope:** Trevio Global Quotation Management — create / basic-details flow vs client screen-recording expectations.  
**Mode:** AUDIT ONLY — no code, schema, or config changes were made for this report.  
**Primary path audited:** Staff **Create quotation** → `QuotationWizardDialog` → `POST/PUT /api/quotations/wizard` → Prisma `Quotation` (+ packages).  
**Secondary paths noted where relevant:** International quote dialog, Quick line-item quote, Product catalog quote, Travel Proposals itinerary (separate module).

**Audit date:** 2026-09-16  

---

## End-to-end code trace (primary path)

```
UI: quotations.tsx
  → Button "Create quotation" sets wizardOpen
  → QuotationWizardDialog (quotation-wizard.tsx) step 0 "Basic Details"
  → persist() builds payload (customer, dates, adults/children/infants, destination, salesExecutiveName, packages, …)
  → api.createQuotationWizard / api.saveQuotationWizard
API: frontend/src/lib/api.ts
  → POST /api/quotations/wizard
  → PUT  /api/quotations/:id/wizard
Backend: backend/src/routes/quotations.ts
  → db.quotation.create / db.quotation.update (+ QuotationPackage rows when packages present)
DB: backend/prisma/schema.prisma → model Quotation
Retrieval: GET /api/quotations/:id/full → mapApiQuotation → list/detail/wizard reload
```

Legacy / alternate creates:

| Path | Entry | API |
|------|--------|-----|
| Quick line items | `CreateQuotationDialog` in `quotations.tsx` | `POST /api/quotations` via `demo-data-store.addQuotation` → `api.createQuotation` (`backend/src/app.ts`) |
| International trip | `InternationalQuotationDialog` | Same local+`createQuotation` path; **free-text** departure/stars/nights |
| From CRM enquiry | Prefills wizard | Wizard create |
| Travel Proposals multi-city | `CreateItineraryProposalDialog` | `POST /api/travel-proposals/from-itinerary` — **not** Quotation Management |

---

## Requirement-by-requirement results

### 1. User clicks "Create Quote"

**Verdict: PASS**

**Evidence**

- Staff header action: `frontend/src/components/views/quotations.tsx` — **"Create quotation"** opens `QuotationWizardDialog`.
- Dashboard also exposes **"Create quotation"** / **"Create Quote"** shortcuts (`dashboard.tsx`).
- Opens empty wizard (`setEditWizardId(null); setWizardOpen(true)`).

---

### 2. Basic customer details — Customer/Guest Name + Customer Email ID

**Verdict: PASS**

**Evidence**

| Layer | Detail |
|-------|--------|
| UI | Wizard step 0: `Customer *`, `Email` (`contactEmail`), also Contact person / Phone (`quotation-wizard.tsx` ~818–822). |
| Payload | `customerName`, `contactEmail` in `persist()`. |
| API | Create/update wizard accept both. |
| DB | `Quotation.customerName` (required), `Quotation.contactEmail` (optional). |

**Notes**

- Email is **optional** in UI validation (only customer + destination required). Client showed email as a basic field; it exists and persists when filled.
- No separate “Guest Name” field — guest = `customerName`.

---

### 3. Origin / departure location (dropdown, e.g. Bengaluru)

**Verdict: FAIL**

**Client expects:** Selectable departure city from a dropdown (e.g. Bengaluru), used as trip origin.

**What exists today**

| Layer | Status |
|-------|--------|
| Primary wizard UI | **No** departure/origin field on Basic Details. Form state has no `departureCity`. |
| DB | `Quotation.departureCity String?` exists. |
| Backend wizard | Create accepts `body.departureCity`; update allows scalar `departureCity`. |
| International dialog | Free-text **"Departure City"** (`international-quotation.tsx`) — not a city-master dropdown. |
| Data source for cities | Destinations come from `/api/destinations` via `DestinationSelect` — used for **destination**, not origin. |

**Missing**

- Departure dropdown on Quotation Management create flow.
- Binding of a city master (or airport/city list) to origin.
- Proof that origin drives flights/search (not wired in wizard basic step).

**Frontend:** `quotation-wizard.tsx` (absent).  
**Backend:** `quotations.ts` create/update (field accepted if sent).  
**DB:** `departureCity`.  
**Tests:** No dedicated wizard departure-city UI/API test found.

---

### 4. Travel date (actual travel/start date, e.g. October 18)

**Verdict: PASS**

**Evidence**

- UI: **Start date** / **End date** (`type="date"`) on Basic Details; end date gated until start is set.
- Payload: `travelStartDate`, `travelEndDate`; `travelDates` derived from start.
- Backend: persisted on create/update; nights derived via `nightsBetween(start, end)`.
- DB: `travelStartDate`, `travelEndDate`, `travelDates`, `returnDate`.

---

### 5. Traveller details — adults, rooms, children/infants

**Verdict: PARTIAL**

**Client expects:** Adults + **number of rooms** at creation; children/infants if supported.

**What exists**

| Field | Basic Details wizard | Persisted | Notes |
|-------|----------------------|-----------|-------|
| Adults | Yes (default 2) | `Quotation.adults` | Required min 1 on backend |
| Children | Yes | `Quotation.children` | Supported |
| Infants | Yes | `Quotation.infants` | Supported |
| Rooms | **No quote-level field** | Per hotel line: `hotels[].rooms` (JSON in packages) | Default `rooms: 1` when adding hotel; costing uses rooms × nights (`quote-costing.ts`) |

**Missing vs client**

- Quote-level **Rooms** on Basic Details (alongside adults), persisted as a first-class requirement before hotels are chosen.

**Frontend:** `quotation-wizard.tsx` step 0 (pax only); rooms on Hotels step / `ServiceEditor`.  
**Backend/DB:** pax columns on `Quotation`; rooms only inside package hotel JSON.  
**Tests:** Pricing tests cover hotel `rooms` × `nights` (`pricing.test.ts`); not create-wizard rooms field.

---

### 6. Hotel requirement — star/category (e.g. 3-star) affecting inventory

**Verdict: PARTIAL**

**Client expects:** Star selection at creation that drives hotel inventory/search/filter.

**What exists**

| Mechanism | Behavior |
|-----------|----------|
| Main wizard Basic Details | **No** `hotelStarPreference` control. |
| Hotel **CatalogPicker** | Local filter `star` → query param `starCategory` on `/api/products/hotels` when picking hotels (`quotation-wizard.tsx` ~3448–3477). Affects search **at pick time**, not stored as quote preference from step 0. |
| Per hotel row | `starCategory` editable on hotel lines. |
| International dialog | Select for `hotelStarPreference` (3/4/5 etc.). |
| DB | `Quotation.hotelStarPreference` (+ room/meal preference strings). |
| Backend | Writable on **PUT** wizard (`scalarKeys`); **not** set on POST create body in current create handler (create path does not copy `hotelStarPreference`). |

**Gap**

- Preference is not part of primary Basic Details.
- Catalog star filter is ad-hoc UI state, not the saved quote requirement unless user later sets fields on update/international path.
- Preference does not auto-filter until hotel catalog is opened with a star choice.

---

### 7. Destination (Goa, Phuket, international)

**Verdict: PASS**

**Evidence**

- `DestinationSelect` → `GET /api/destinations?status=Active&q=…` (destination master).
- Free-text **Destination city \*** always available; Country + International checkbox.
- Optional **destination quote plans** include Thailand/Phuket, Singapore, Dubai, Europe, etc. (`destination-quote-plans.ts`).
- Persisted: `destination`, `country`, `isInternational`.
- International destinations work when master data / free-text provides them.

**DATA LIMITATION note:** Whether “Goa” / “Phuket” appear in the dropdown depends on seeded/active `Destination` rows in the environment — implementation exists; empty catalog would be a data issue.

---

### 8. Number of nights (e.g. Goa — 2 nights) — persisted and used downstream

**Verdict: PARTIAL**

**Client expects:** Explicit nights for the stay (and later per city).

**What exists**

- Main wizard: nights = **computed** from start/end (`useMemo`); displayed read-only; sent as `nights`; backend stores `nights`/`days`.
- Downstream: hotel line nights, PDF `nightsLabel`, costing, booking conversion metadata.
- International dialog: editable **Nights** number field.
- Destination plans: **suggested** nights (can auto-hint end date).

**Gaps**

- Cannot enter “2 nights” alone without setting end date (primary wizard).
- No **per-city nights** on Quotation Basic Details (see req 9).

---

### 9. Multi-city destination (add/remove cities; independent nights; no fixed mandatory itinerary)

**Verdict: FAIL** *(for Quotation Management create/basic details)*

**Client expects (quote creation):**

- Add cities e.g. Phuket 2N, Krabi 2N, Bangkok 2N  
- Customize / remove cities  
- Change nights per city independently  
- No fixed mandatory multi-city itinerary  

**What Quotation Management does**

| Capability | Present? |
|------------|----------|
| Quote-level list of `{ city, nights }` with add/remove | **No** |
| Single destination string | Yes |
| Optional destination **plans** (e.g. Thailand Phuket+Krabi sample) | Yes — optional loaders; can load full sample hotels/itinerary |
| Forced mandatory multi-city | No (plans are optional) |
| Itinerary step: add/remove **days**, free-text **City / place** per day | Yes — day plan, **not** city+nights planner |
| Hotel rows with different `city` | Yes — after hotels step |

**Where client-like multi-city *does* exist (different module)**

- `frontend/src/components/shared/create-itinerary-proposal-dialog.tsx`  
- `POST /api/travel-proposals/from-itinerary` with `cities: [{ city, nights }]`  
- Add City / remove / per-city nights  

That is **Travel Proposals**, not Quotation Management quote creation. There is no convert-to-quotation of that city list as a first-class Quotation multi-city model in this audit’s primary path.

**Missing for Quotation module**

- Basic-details multi-city editor  
- Persistence of city/nights array on `Quotation` (no such JSON/relation found)  
- Downstream pricing/PDF driven by that structure  

---

### 10. Quote/booking type — Land only / Hotel / Hotel + Land + Flights

**Verdict: PARTIAL**

**Client expects:** Explicit booking/quote types for standalone hotel/land vs combined land+flights (named concepts).

**What the system does (exactly)**

1. **`Quotation.service` string** documented as: `Flight | Hotel | Holiday | International | Activity | Transfer`.
2. **Primary wizard** defaults `service` to `"Holiday"` (or `"International"` if checkbox). There is **no** Basic Details control labeled Land only / Hotel / Hotel+Land+Flights. Trip is built by optionally filling Hotels, Flights, Transfers, Activities, Meals steps — a **generic package** model.
3. **Quick line-item quote** lets user pick service (e.g. Flight, Hotel) + arbitrary priced rows — not the client’s land-package typology.
4. **Product catalog quote** builds from approved hotels/activities.
5. **International dialog** always `service: "International"` with includes text defaulting to “Flight, Hotel, Transfers, Activities”.

**Not equivalent**

- Optional empty flights ≠ a declared **“Land only”** type with business rules.  
- No enum/UI for **“Hotel + Land + Flights”** as a booking type that constrains wizard steps or inventory.

---

### 11. Estimated booking date (≠ travel date) — sales follow-up / reminder

**Verdict: NOT IMPLEMENTED** *(on Quotation Management)*

**Client expects**

- Field: estimated booking/closure date (e.g. travel Oct 1, estimated book by Sep 26)  
- Persist + display on quotation  
- Reminder/notification to sales if still unbooked after that date  

**What exists (related but different)**

| Feature | Entity | Purpose |
|---------|--------|---------|
| `Lead.expectedClose` | CRM Lead | Lead pipeline close date; CRM UI/dashboard |
| `Quotation.validTill` + `QuotationExpiryReminder` | Quotation | **Quote validity / pre-expiry** customer email (`quotation-expiry-reminder.ts`, scheduler) — not “customer hasn’t booked by estimated booking date” |
| Supplier payout reminders | Finance | Unrelated |

**Missing**

- `estimatedBookingDate` (or equivalent) on `Quotation`  
- Wizard/detail UI field  
- Scheduler/job notifying sales after that date while status ≠ Accepted/Converted  

**Do not confuse** expiry reminders with estimated booking follow-up.

---

### 12. Automatic sales expert assignment

**Verdict: PARTIAL**

**Client expects:** After create, system **automatically assigns** a sales expert (routing/assignment logic).

**What exists**

| Behavior | Detail |
|----------|--------|
| Prefill | `salesExecutiveName` defaults to **logged-in user** name/email (`quotation-wizard.tsx`). |
| UI | Editable free-text **Sales executive** (not employee picker from roster). |
| Persist | `salesExecutiveName` / `Phone` / `Email`; create falls back to `req.auth?.email`. |
| Display | Shown in wizard; available on quotation records. |
| Auto-routing | **No** algorithm (round-robin, destination-based, workload-based) found. |
| FK | `Quotation` has **no** `salesExecutiveId`; `Booking` does have `salesExecutiveId`. |

**Conclusion:** Creator is stamped as sales contact by default (manual override). Not automatic assignment of a dedicated sales expert from a team.

---

### 13. Initial quotation can show zero pricing before hotels/services selected

**Verdict: PASS**

**Evidence**

- `POST /api/quotations/wizard` creates with `amount: 0`, `gst: 0`, `total: 0` (`quotations.ts` ~691–693).
- Empty package starts with empty hotels/flights; costing stays at zero until lines/prices added.
- Status `Draft`; packages optional until priced lines exist.

---

## Summary counts

| Classification | Count |
|----------------|-------|
| **PASS** | 5 |
| **PARTIAL** | 5 |
| **FAIL** | 2 |
| **NOT IMPLEMENTED** | 1 |
| **ENVIRONMENT BLOCKED** | 0 |
| **DATA LIMITATION** | 0 *(noted under destination as conditional data, not a separate requirement verdict)* |

| # | Requirement | Verdict |
|---|-------------|---------|
| 1 | Create Quote CTA | PASS |
| 2 | Customer name + email | PASS |
| 3 | Departure city dropdown | FAIL |
| 4 | Travel start date | PASS |
| 5 | Adults / rooms / children / infants | PARTIAL |
| 6 | Hotel star preference → inventory | PARTIAL |
| 7 | Destination (domestic/intl) | PASS |
| 8 | Nights persist + downstream | PARTIAL |
| 9 | Multi-city add/remove + per-city nights | FAIL |
| 10 | Land / Hotel / Hotel+Land+Flights types | PARTIAL |
| 11 | Estimated booking date + sales reminder | NOT IMPLEMENTED |
| 12 | Automatic sales expert assignment | PARTIAL |
| 13 | Zero initial pricing | PASS |

---

## Critical gaps

1. **No Quotation multi-city `{city, nights}` planner** matching the client demo (that UX lives under **Travel Proposals**).  
2. **No estimated booking/closure date + sales follow-up** on quotations (only quote-expiry and CRM lead close).  
3. **No departure-city dropdown** on the primary quotation wizard (DB column unused by main UI).  
4. **No quote-level Rooms** on Basic Details.  
5. **No client-named booking types** (Land only / Hotel+Land+Flights) as first-class constraints — only generic `service` + optional package components.  
6. **Sales “assignment”** is creator prefill, not automatic expert routing.

---

## Already correctly implemented (relative to this module)

- Create quotation entry → multi-step wizard.  
- Customer name + email/phone/contact fields persisted.  
- Travel start/end dates; adults/children/infants.  
- Destination search from destination master + free text + international flag.  
- Trip-level nights derived from dates, stored, used in costing/PDF/booking paths.  
- Draft quotes with **₹0** until services priced.  
- Optional destination sample plans (not mandatory).  
- Hotel catalog can be filtered by star **when picking hotels**.

---

## Require implementation / fixes (to match client demo)

| Priority | Item |
|----------|------|
| High | Multi-city city+nights editor on Quotation create (or explicit product decision to use Travel Proposals + conversion). |
| High | Estimated booking date on Quotation + sales reminder job. |
| High | Departure city selectable from master/dropdown on Basic Details. |
| Medium | Quote-level rooms on Basic Details; wire into hotel defaults/costing. |
| Medium | Hotel star preference on Basic Details; persist and default catalog filter. |
| Medium | Explicit quote/booking type (Land / Hotel / Hotel+Land+Flights) with clear wizard behavior. |
| Medium | Real sales-expert assignment (employee pick or auto-assign) with durable identity. |
| Low | Independent nights input without requiring end date first (if client UX requires it). |

---

## Existing tests covering these requirements

| Area | Tests | Coverage vs Module 01 |
|------|-------|------------------------|
| Quotation PDF / model | `quotation-pdf.test.ts` | Nights/pricing on PDF model — not create UI |
| Pricing / rooms×nights | `pricing.test.ts` | Hotel line rooms/nights math |
| Expiry reminders | `quotation-expiry-reminder.test.ts` | Quote **validity** reminders — **not** estimated booking |
| Versions / conversion / delivery | various `quotation-*.test.ts` | Downstream, not basic-details create |
| Wizard create E2E for Basic Details fields | **Not found** | No test asserting departureCity, multi-city, estimatedBookingDate, rooms on create |

---

## Needs manual demo verification

1. Live destination master contains Goa / Phuket / Bengaluru (or equivalent) for dropdown demos.  
2. Client recording flow path: Quotation wizard vs Travel Proposals vs International dialog — confirm which screen they showed for multi-city.  
3. After hotels added with rooms/stars, list/detail/PDF still match client expectations.  
4. Confirm whether “automatic sales expert” means “logged-in user” (current) or a named sales desk employee (not implemented).  
5. CRM `expectedClose` is **not** a substitute for estimated booking date unless product owners redefine scope.

---

## Classification legend (as applied)

- **PASS** — Implemented end-to-end for the Quotation Management primary path with code evidence.  
- **PARTIAL** — Some UI/API/DB pieces exist; client behavior incomplete or only on alternate paths.  
- **FAIL** — Client behavior missing or only present in a non-quotation module while DB/UI gaps remain on the quote path.  
- **NOT IMPLEMENTED** — No quotation field/logic/reminder for the requirement.  
- **ENVIRONMENT BLOCKED** — Could not verify due to env (none for this static audit).  
- **DATA LIMITATION** — Code present; runtime depends on seeded data (noted under destination only).

---

*End of audit. No application code was modified to produce this document.*
