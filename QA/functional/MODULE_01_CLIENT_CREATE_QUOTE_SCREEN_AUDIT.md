# MODULE 01 — Client Create Quote Screen Audit (Audit Only)

**Purpose:** Compare the **current Quotation Management Create Quote / Basic Details** implementation against the **client’s expected Create Quote screen** (reference UI + screen-recording workflow).

**Mode:** AUDIT ONLY — no code, schema, API, or UI changes were made for this report.

**Primary surface under test:**  
`quotations.tsx` → **Create quotation** → `QuotationWizardDialog` (`quotation-wizard.tsx`) step **0 – Basic Details** → `POST/PUT /api/quotations/wizard` → Prisma `Quotation`.

**Explicitly not treated as equivalent** unless production-integrated into Quotation Management:  
Travel Proposals multi-city dialog, International quotation free-text dialog, Quick line-item quote (noted only as contrast).

**Audit date:** 2026-09-16

---

## Client expected screen (reference)

| Control | Client expectation |
|---------|-------------------|
| Name | Text |
| Email | Text |
| Departure city | **Dropdown** (e.g. Bengaluru) |
| Travel date | Date |
| Rooms / Adults / Children | Traveller/room summary at create |
| Hotel Star Rating | Select at create (e.g. 3-star) |
| Trip Plan City Wise | City + Night rows, **+ Add new city**, remove/edit |
| Nationality | Field |
| Land Only | **Yes / No** |
| Estimated Booking Date | Date ≠ travel date; sales follow-up |
| Create | Create action |

Plus recording behaviours: customizable multi-city nights, auto sales expert, zero initial price.

---

## Screen shape comparison (high level)

| Client screen | Current Quotation wizard Basic Details |
|---------------|----------------------------------------|
| Compact Create Quote form | Multi-step wizard (11 steps); Basic Details is step 0 of many |
| Single **Create** CTA | **Save draft** / **Next** / Review finish (no single “Create” that only captures basic details) |
| Departure dropdown | **Absent** |
| Rooms on basic form | **Absent** (rooms only later on hotel lines / costing) |
| Hotel star on basic form | **Absent** (catalog filter later, defaults to “all”) |
| Trip Plan City Wise | **Absent** (single destination string + optional sample plans; itinerary is day-based later) |
| Nationality | **Absent** (`country` = destination country; booking pax nationality is post-booking) |
| Land Only Yes/No | **Absent** (`isInternational` checkbox ≠ Land Only) |
| Estimated Booking Date | **Absent** |

---

## End-to-end trace (primary path)

```
Create quotation (quotations.tsx)
  → QuotationWizardDialog open, step 0
  → form state (customerName, contactEmail, destination, travelStart/End, adults/children/infants, …)
  → persist() payload → api.createQuotationWizard / saveQuotationWizard
  → POST /api/quotations/wizard | PUT /api/quotations/:id/wizard
  → db.quotation.create / update (+ packages JSON layers)
  → GET /api/quotations/:id/full → wizard reload maps subset of fields into form
```

Key files:

- Frontend UI: `frontend/src/components/views/quotations.tsx`, `frontend/src/components/views/quotation-wizard.tsx`
- API client: `frontend/src/lib/api.ts` (`createQuotationWizard`, `saveQuotationWizard`, `getQuotationFull`)
- Mapper: `frontend/src/lib/api-mappers.ts` (`mapApiQuotation`)
- Backend: `backend/src/routes/quotations.ts`
- Schema: `backend/prisma/schema.prisma` → `model Quotation`

---

# A. BASIC DETAILS — field-by-field

### A1. Name

| Check | Result |
|-------|--------|
| UI present? | Yes — `Customer *` |
| Control type? | Text input |
| Required? | Yes (customer + destination required before save) |
| Frontend state? | `form.customerName` |
| API payload? | `customerName` |
| Backend? | Written on create/update |
| DB? | `Quotation.customerName` |
| Persisted / reload / editable? | Yes |
| Tests? | No dedicated Basic Details UI test |

**Verdict: PASS**

---

### A2. Email

| Check | Result |
|-------|--------|
| UI present? | Yes — `Email` |
| Control type? | Text |
| Required? | **Optional** (not in required validation) |
| Frontend state? | `form.contactEmail` |
| API / DB? | `contactEmail` |
| Persisted / reload / editable? | Yes |

**Verdict: PASS**

---

### A3. Departure city

| Check | Result |
|-------|--------|
| UI on main wizard Basic Details? | **No** |
| Dropdown from city/destination master? | **No** on main wizard |
| Frontend state? | Not in wizard `form` |
| API create accepts? | Yes — `body.departureCity` if sent |
| DB? | `Quotation.departureCity String?` |
| Wizard sends it? | **No** |
| `mapApiQuotation`? | **Does not map** `departureCity` |
| Wizard reload? | Does not load departure into form |
| Used for later flight selection? | **No** — flight catalog/search uses manual `from`/`to` / product origin; not quote `departureCity` |

**Contrast (not equivalent):** `InternationalQuotationDialog` has free-text Departure City, not a master dropdown, and is a separate “Other quote types” path.

**Verdict: FAIL**

---

### A4. Travel date

| Check | Result |
|-------|--------|
| UI? | **Start date** + **End date** |
| Control? | `type="date"` |
| State / API / DB? | `travelStartDate`, `travelEndDate` (+ derived `travelDates`, `nights`) |
| Persisted / reload / editable? | Yes |

**Verdict: PASS**  
*(Client showed a single travel date; system uses start+end. Functionally covers travel date.)*

---

### A5. Adults

| Check | Result |
|-------|--------|
| UI on Basic Details? | Yes |
| State / API / DB? | `adults`; create enforces min 1 |
| Persisted / reload / editable? | Yes |

**Verdict: PASS**

---

### A6. Rooms (quote-level on Basic Details)

| Check | Result |
|-------|--------|
| Quote-level Rooms on Basic Details? | **No** |
| Persisted as Quotation column? | **No** `rooms` on `Quotation` |
| Hotel-line `rooms`? | Yes (package hotel JSON); default 1 when adding hotel |
| Costing? | Uses hotel-line rooms × nights |
| Costing UI `onChangeRooms`? | Updates **first hotel row**, or creates a stub hotel — not a Basic Details quote field |
| Reload of quote-level rooms? | N/A — field does not exist |

**Verdict: FAIL**  
Do **not** treat hotel-line rooms as PASS for this client screen.

---

### A7. Children

| Check | Result |
|-------|--------|
| UI / state / API / DB / reload? | Yes (`children`; infants also present) |

**Verdict: PASS**

---

### A8. Hotel Star Rating (Basic Details)

| Check | Result |
|-------|--------|
| Basic Details control? | **No** |
| DB `hotelStarPreference`? | Exists |
| Wizard form / payload? | **Not** in form; not sent on persist |
| Create handler writes preference? | **No** on POST create |
| PUT wizard can write? | Yes if body includes it |
| CatalogPicker filter? | Local `star` state defaults to **`"all"`**; user can filter when opening hotel catalog — **not** initialized from a saved Basic Details preference |
| Effect of selecting 3★ on create then opening hotels? | **None** — no preference stored; catalog opens unfiltered |

**Verdict: FAIL**

---

### A9. Nationality

| Check | Result |
|-------|--------|
| Quotation Basic Details? | **No** |
| Closest fields? | `country` (destination country), `isInternational` |
| Booking passenger `nationality`? | Exists on `BookingPassenger` after booking — **not** quote create |

**Verdict: NOT IMPLEMENTED**

---

### A10. Land Only — Yes / No

| Check | Result |
|-------|--------|
| UI Yes/No Land Only? | **No** |
| DB / API field? | **None** found (`landOnly` / equivalent absent on `Quotation`) |
| Closest UI? | `International booking` checkbox → `isInternational` / may set `service` to International — **different meaning** |

**Behaviour:** Package may omit flights by leaving Flights step empty; that is **not** an explicit Land Only flag and does not enforce hiding flights or altering PDF/conversion by a Yes/No.

**Verdict: NOT IMPLEMENTED**

---

### A11. Estimated Booking Date

| Check | Result |
|-------|--------|
| Quotation UI field? | **No** |
| Quotation DB field? | **No** |
| Reminder for pending book-by date? | **No** |
| Must not confuse with | `validTill`, `QuotationExpiryReminder` (quote expiry), `Lead.expectedClose` (CRM) |

**Verdict: NOT IMPLEMENTED**

---

# B. TRIP PLAN CITY WISE (critical)

### Client structure

```json
[
  { "city": "Phuket", "nights": 3 },
  { "city": "Krabi", "nights": 2 },
  { "city": "Bangkok", "nights": 2 }
]
```

### Quotation Management support matrix

| Capability | Quotation Management |
|------------|----------------------|
| First-class `cities[{city,nights}]` on Quotation | **No** |
| Add City / Remove City on Basic Details | **No** |
| Change city / nights independently | **No** |
| Save / reload / edit / save again of that structure | **No** |
| Scenario: Phuket 3→4, remove Bangkok, reload | **Cannot execute** on Quotation Basic Details |

### What exists instead

| Mechanism | Role |
|-----------|------|
| Single `destination` string | One trip destination label |
| Optional destination **plans** (e.g. Thailand Phuket+Krabi sample) | Optional preload of hotels/itinerary — **not** freeform city+nights editor; not required |
| Itinerary step | Add/remove **days**, free-text city per day — **not** nights-per-city planner |
| Hotel rows with `city` / `nights` | Service build, not Trip Plan City Wise |

### Travel Proposals (explicitly not equivalent)

- `CreateItineraryProposalDialog` + `POST /api/travel-proposals/from-itinerary` **does** support add/remove city and per-city nights.
- **No** production conversion path from that cities array into Quotation Management was found in quotation wizard create/update routes for this audit.

**Required scenario (Phuket/Krabi/Bangkok nights edit/remove/reload): FAIL — cannot be performed on Quotation Create Quote.**

**Overall B verdict: FAIL**

---

# C. DEPARTURE CITY (deep)

| Client need | Current |
|-------------|---------|
| Main quotation wizard | Missing |
| Real city/destination master dropdown | Missing on wizard (DestinationSelect is for **destination**, not departure) |
| Persist selected value | Column exists; wizard never writes it |
| Returned on reload into Basic Details | Not loaded into form; mapper omits field |
| Editable after creation (wizard) | No UI |
| Available to later flight selection | Flights step does **not** read `departureCity` |

**Verdict: FAIL**

---

# D. HOTEL STAR RATING → hotel selection

**Client:** Select 3-star on Create → hotel catalogue initializes/filters to 3-star.

**Trace:**

1. Basic Details: no star field → nothing in payload.  
2. Create: `hotelStarPreference` not set.  
3. Hotels step → `CatalogPicker`: `useState("all")` for star.  
4. Filter applies only if user changes star in the picker; not pre-seeded from quote.

**Verdict: FAIL**

---

# E. ROOMS (deep)

| Client need | Current |
|-------------|---------|
| Quote-level room count on Basic Details | Missing |
| Entered during Basic Details | No |
| Persisted at quote header | No |
| Survives reload as quote rooms | No |
| Used when hotels subsequently added | New hotel template defaults `rooms: 1`; costing can later change hotel[0].rooms — **not** from Basic Details rooms |
| Compatible hotel-line rooms | Yes, separately |

**Verdict: FAIL**

---

# F. LAND ONLY

| Question | Answer |
|----------|--------|
| Saves a Land Only value? | **No such field** |
| Affects flight selection? | No dedicated gate |
| Hotel / land / costing / PDF / conversion? | No Land Only branching found |

Empty flights = optional omission only.

**Verdict: NOT IMPLEMENTED**

---

# G. ESTIMATED BOOKING DATE + sales follow-up

| Layer | Status |
|-------|--------|
| Quotation field | Missing |
| Persist / detail / edit | Missing |
| Scheduler after estimated date if still pending | Missing |
| Quote expiry emails | **Different feature** — do not count |

**Verdict: NOT IMPLEMENTED**

---

# H. AUTOMATIC SALES EXPERT ASSIGNMENT

| Question | Evidence |
|----------|----------|
| Auto-assign from team/routing? | **No** |
| What happens? | Prefill `salesExecutiveName` = **logged-in user** name/email; backend fallback `req.auth?.email` |
| Employee ID on Quotation? | **No** `salesExecutiveId` (Booking has assignee IDs; Quotation does not) |
| Persisted? | Name/phone/email strings |
| Displayed / manually editable? | Yes — free text “Sales executive” |
| Algorithm? | None |

**Verdict: FAIL** *(creator-prefill is not automatic assignment/routing)*

---

# I. INITIAL PRICE = 0

| Check | Evidence |
|-------|----------|
| Create with zero money | `amount: 0`, `gst: 0`, `total: 0` on wizard create |
| Empty package before services | Allowed |
| Live costing | Remains 0 until priced lines |

**Verdict: PASS**

---

# J. EXISTING FUNCTIONALITY / REGRESSION RISK (compatibility note only)

Current wizard/quotes already integrate with versioning, approval, acceptance, expiry, PDF, email, WhatsApp, pricing, conversion, agent sanitization.

**Audit observation (no changes):** Adding client Basic Details fields (multi-city, rooms, landOnly, estimatedBookingDate, departure, star preference, nationality, real sales assignment) would need careful design so they:

- Snapshot into **versions**
- Appear correctly (or safely omit) on **customer PDF / agent views**
- Feed **costing** and **hotel/flight filters** consistently
- Do not break **approval / expiry / conversion** contracts

**Verdict for compatibility of current system with itself: PASS** (existing modules work without those client fields).  
Gaps above are **missing client features**, not regressions of current features.

---

## Recording checklist (items 1–11)

| # | Client demonstration | Verdict |
|---|----------------------|---------|
| 1 | Departure city selectable (e.g. Bengaluru) | FAIL |
| 2 | Travel date selectable | PASS |
| 3 | Adults and rooms at creation | PARTIAL (adults PASS; rooms FAIL) |
| 4 | Hotel star at creation (e.g. 3-star) | FAIL |
| 5–6 | Trip Plan City Wise customizable; add/remove/change nights; no fixed mandatory plan | FAIL for editor; PASS that plans are optional/not mandatory |
| 7 | Land Only Yes/No | NOT IMPLEMENTED |
| 8–9 | Estimated Booking Date + sales reminder | NOT IMPLEMENTED |
| 10 | Automatic sales expert assignment | FAIL |
| 11 | Zero initial price | PASS |

---

## Summary table

| Requirement | Verdict | Evidence | Gap |
|-------------|---------|----------|-----|
| Name | PASS | Wizard `Customer *` → `customerName` → DB | — |
| Email | PASS | `contactEmail` end-to-end | Not required |
| Departure city dropdown | FAIL | No wizard UI; DB column unused by wizard; not wired to flights | Full Basic Details departure UX + persist + flight seed |
| Travel date | PASS | Start/end dates persisted | — |
| Adults | PASS | Form + DB | — |
| Rooms (Basic Details) | FAIL | Only hotel-line rooms | Quote-level rooms on create |
| Children | PASS | Form + DB | — |
| Hotel Star Rating (create → filter) | FAIL | No Basic Details field; catalog defaults `all` | Persist preference + init catalog |
| Trip Plan City Wise | FAIL | No `{city,nights}[]` on Quotation | First-class multi-city on quote |
| Nationality | NOT IMPLEMENTED | Only booking pax later | Quote nationality field |
| Land Only Yes/No | NOT IMPLEMENTED | No field/behaviour | Flag + optional flight gating |
| Estimated Booking Date + sales reminder | NOT IMPLEMENTED | No quote field/job | Field + follow-up scheduler |
| Auto sales expert assignment | FAIL | Creator name prefill only | Real assignment identity/rules |
| Zero initial price | PASS | Create totals 0 | — |
| Create button (single create screen) | PARTIAL | Multi-step Save/Next vs single Create | UX shape differs; draft create exists |
| No fixed mandatory itinerary | PASS | Destination plans optional; not forced | City-wise editor still missing (separate FAIL) |
| Compatible existing quote modules | PASS | Versioning/PDF/approval etc. present | Future fields need integration design |

---

## Counts

| Code | Count |
|------|------:|
| **A. PASS** | 8 |
| **B. PARTIAL** | 1 |
| **C. FAIL** | 5 |
| **D. NOT IMPLEMENTED** | 3 |
| **E. ENVIRONMENT BLOCKED** | 0 |
| **F. DATA LIMITATION** | 0 |

Counted from the summary table (17 rows):  
PASS 8 · PARTIAL 1 · FAIL 5 · NOT IMPLEMENTED 3 · ENVIRONMENT BLOCKED 0 · DATA LIMITATION 0.

---

## CRITICAL GAPS

Genuine gaps required to match the client’s demonstrated Create Quote screen/flow:

1. **Trip Plan City Wise** — first-class `cities[{ city, nights }]` on Quotation with add/remove/edit, save, reload, re-edit.  
2. **Departure city dropdown** on main Create Quote Basic Details, persisted, reloaded, usable for later flights.  
3. **Quote-level Rooms** on Basic Details (not only hotel-line rooms).  
4. **Hotel Star Rating** on Basic Details that initializes hotel catalogue filtering.  
5. **Land Only Yes/No** as an explicit quotation field with defined behaviour.  
6. **Estimated Booking Date** on the quotation + sales follow-up reminder when still pending after that date.  
7. **Nationality** on quote create (distinct from destination country).  
8. **Automatic sales expert assignment** (identity/routing), not creator free-text prefill.  
9. **Create Quote screen shape** — client expects a compact create form; current product is a long multi-step wizard (PARTIAL UX mismatch).

---

## IMPLEMENTATION DEPENDENCIES

| Gap | Likely later impact |
|-----|---------------------|
| Trip Plan City Wise | Hotels (per-city stay), Transfers, Activities, Meals date/city scoping, Costing nights, PDF destination/nights label, Booking conversion duration |
| Departure city | Flights origin default/search, PDF route text |
| Rooms (quote-level) | Hotel add defaults, costing rooms×nights, PDF occupancy |
| Hotel star preference | Hotel catalog filter, inventory matching |
| Land Only | Flights step visibility, costing (exclude air), PDF inclusions, conversion |
| Estimated Booking Date | Notifications, sales CRM follow-up, dashboards |
| Nationality | Visa suggestions, PDF, booking pax prefill |
| Sales expert assignment | Reporting, ops queue, notifications |

Existing quotation versioning, approval, PDF, email/WhatsApp, expiry, acceptance, and conversion remain operational today; new Basic Details fields must be designed into those pipelines when implementation starts.

---

## Existing tests

| Area | File | Relevance to client Create Quote screen |
|------|------|----------------------------------------|
| Pricing rooms×nights | `backend/src/__tests__/pricing.test.ts` | Hotel-line math only |
| PDF model | `quotation-pdf.test.ts` | Not create UI |
| Expiry reminders | `quotation-expiry-reminder.test.ts` | Quote validity ≠ estimated booking |
| Wizard Basic Details E2E for client fields | **None found** | — |

---

## Manual demo verification still needed

1. Confirm the client recording used Quotation Management (not Travel Proposals) for city-wise nights.  
2. Confirm destination master contains cities shown in demos (Goa, Phuket, Bengaluru).  
3. Confirm whether “sales expert auto-assign” means a named sales desk employee vs current user.

---

*End of audit. No application code was modified to produce this document.*
