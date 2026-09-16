# MODULE 02 — Hotel Client Requirements Audit (Audit Only)

**Purpose:** Compare the **current Quotation Wizard Hotels step** and related backend (products, contracted rates, pricing, PDF, booking conversion) against:

1. Original Trevio Global customer requirements  
2. Client screen-recording hotel workflow  
3. Client Create Quote reference screen  
4. Existing Module 01 / 01A Create Quote audits  
5. Claims about the current hotel implementation  

**Mode:** AUDIT ONLY — no code, schema, API, UI, PDF, or conversion logic was changed for this report.

**Primary surface:**  
`quotation-wizard.tsx` Hotels step (`step === 1`) → inline `CatalogPicker` → `GET /api/products/hotels` → `GET /api/contracted-rates/applicable` → package `hotels[]` → `POST/PUT /api/quotations/wizard` (`freezePackageLines` + pricing) → PDF / booking conversion.

**Audit date:** 2026-09-16  
**Method:** Static UI → API → backend → DB/schema code tracing. Live browser E2E against a seeded multi-city inventory was **not** executed in this pass; environment-dependent items are marked accordingly.

**Verdict scale:** `PASS` | `PARTIAL` | `FAIL` | `NOT IMPLEMENTED` | `ENVIRONMENT BLOCKED` | `DATA LIMITATION`

---

## Claimed implementation vs evidence (summary)

| Claim | Evidence verdict |
|-------|------------------|
| Full-page Quotation Wizard | **PASS** — wizard view / shell registration |
| Inline Hotel Selection UI (Recommended / All / Self Booked) | **PASS** (tabs exist) |
| Recommended = contracted/featured | **FAIL** — Recommended ≠ contracted (stars≥4 or `isFeatured`) |
| All Hotels = API/mapped inventory | **PARTIAL** — approved catalogue products (`liveOnly`), not live hotel API |
| Self Booked with no invented hotel price | **FAIL** — default cost ₹8000 / sell ₹10000 |
| Multi-city filtering via trip cities | **PARTIAL** — list filter/chips exist; stay windows are whole-trip |
| Travel end date from trip-city nights | **PASS** for quote-level end date; **FAIL** for per-city hotel stays |
| Star preference seeds catalogue filter | **PASS** (client-side init) |
| Rooms from Basic Details feed hotel flow | **PARTIAL** — line default yes; availability check hardcodes `rooms: "1"` |

---

# 1. Recommended vs All Hotels

**Client expectation:** Recommended = Trevio **contracted** inventory; All Hotels = mapped/API inventory; distinction must be real, not cosmetic.

### How Recommended is determined

Frontend only (`quotation-wizard.tsx`):

```ts
function isRecommendedHotel(item, tripCities) {
  const starOk = hotelStarNumber(item) >= 4 || Boolean(item.isFeatured);
  // + optional trip-city string match
  return inTrip && starOk;
}
```

`hotelList` then filters `hotelTab === "recommended"` with that predicate. There is **no** server query param, DB flag, or join to `ContractedRate` that defines Recommended.

### Contracted restriction?

**No.** A 4★ or `isFeatured` hotel with **no** applicable contracted rate can still appear under Recommended. Selection later requires `/api/contracted-rates/applicable`, so Recommended list membership ≠ contracted eligibility.

### Can API-only / non-contracted hotels appear in Recommended?

**Yes**, if they are Active+Approved catalogue hotels with stars≥4 or `isFeatured` and match city text. They show until Select fails rate/availability checks.

### Is `isFeatured` treated as contracted?

**Yes, incorrectly for client meaning.** Featured is a product marketing flag, not contracted-rate membership.

### Server-side enforcement?

**None** for Recommended. All Hotels and Recommended share the same `GET /api/products/hotels?liveOnly=true` result; Recommended is a client filter.

`liveOnly` means `approvalStatus=Approved` + `status=Active` — catalogue gate, not “has contracted rate”.

### Agent request manipulation

- Agents can call the hotels list API and receive catalogue rows (supplier stripped via `stripCatalogForRole`).
- Contracted **cost** is withheld by `canViewContractedCost` / `presentApplicableRate` (`contractedCost` omitted for agent-like roles).
- Agents **cannot** get Recommended as a privileged contracted feed — because Recommended is not server-defined.
- Forged `CONTRACTED_PRODUCT` lines are re-resolved on save by `freezePackageLines` → `getApplicableContractedRate` (server snapshot). Agents cannot invent a contracted rate id into a frozen snapshot without a real DB rate.
- **UI bug/gap:** Select Hotel requires `rate.contractedCost == null` to fail — agents never receive `contractedCost`, so **agent Select Hotel always fails** the frontend gate even when `applicable: true`.

| Check | Verdict |
|-------|---------|
| Recommended = contracted only | **FAIL** |
| Featured ≠ contracted | **FAIL** (treated as recommended) |
| Server-side Recommended rule | **NOT IMPLEMENTED** |
| Cost leakage via Recommended | **PASS** (cost gated); selection broken for agents → see Security |

**AUDIT 1 OVERALL: FAIL**

---

# 2. All Hotels / API inventory

**Client expectation:** Mapped/API hotels searchable by destination, hotel name, star, supplier, price, availability; multi-city aware; honest about live vs catalogue.

### What All Hotels actually loads

`GET /api/products/hotels?liveOnly=true&pageSize=80` (+ `city` / `cities` / optional `supplierId` / `q`).

Backend filters Active+Approved `HotelProduct` rows; optional city OR across `city`, `address`, `location`, destination name; optional `starCategory`, `supplierId` (frontend star filter does **not** pass `starCategory` — see Audit 7).

This is **internal catalogue inventory**, not a live Amadeus (or other) hotel search. Empty-state copy says “No live hotels found,” which overstates liveness.

### Search / filter matrix

| Capability | Implemented? | Where |
|------------|--------------|--------|
| Destination / city | **PARTIAL** | API `city`/`cities` + client re-filter `hotelMatchesTripCity` |
| Hotel name search | **PASS** | `q` → name/city contains |
| Star | **PARTIAL** | Client-only on fetched page; API supports `starCategory` but CatalogPicker does not send it |
| Supplier | **PARTIAL** | Filter UI + API; agents get supplier stripped from rows |
| Price sort / min-max | **PARTIAL** | Client sort/filter on `hotelDisplayPrice` (roomCategories pricing), not contracted rate |
| Availability | **PARTIAL** | Catalogue inventory check for **whole-trip** `travelDate→travelEndDate`, `rooms: "1"` |
| Multi-city chips | **PASS** (list scoping) | Defaults to first trip city on open |
| Live API hotels | **NOT IMPLEMENTED** in this Hotels tab | Flight API search exists elsewhere; hotel Amadeus path not wired here |

### Hotel details completeness for selection

Cards show: name, stars, city/country, address (or supplier for staff), “From” display price. **Not** on card: meal plan, room type variants, cancellation conditions, rate validity window (those appear after selection on the editable line, or only after contracted-rate resolve).

**AUDIT 2 OVERALL: PARTIAL**  
(Catalogue All Hotels works with city chips; not live API; availability/price are catalogue approximations.)

---

# 3. Self-booked hotel (CRITICAL)

**Client expectation:** Independently booked stay; **no** normal hotel selling/contracted pricing; **address/location required** for land pickup/drop; voucher/docs as required by original customer need.

| # | Check | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | Self Book option exists | **PASS** | Tab + “Add self-booked” / `addSelfBooked` |
| 2 | User can select it | **PASS** | Appends MANUAL template row |
| 3 | Name/address can be entered | **PARTIAL** | Fields exist (`hotelName`, `address`); address **not required** |
| 4 | Pickup/drop operational location available | **FAIL** | Address stored on hotel line only; transfers do not consume it (Audit 11) |
| 5 | Hotel cost NOT invented | **FAIL** | Template `costPrice: 8000` |
| 6 | Selling price NOT incorrectly calculated | **FAIL** | Template `sellingPrice: 10000`, `markup: 2000`; enters costing |
| 7 | No accidental contracted rate | **PASS** | `source: "MANUAL"`; `freezeLine` skips contracted resolve for MANUAL |
| 8 | Does not appear as contracted | **PASS** | Source remains MANUAL; Recommended filter does not apply to self-book rows |
| 9 | Quotation/PDF representation | **PARTIAL** | PDF shows name/city/room/meal/dates/address if filled; **no** “Self booked” label; invented sell may inflate package totals shown elsewhere |
| 10 | Save/reload/edit | **PASS** (structure) | Hotels JSON in packages; wizard reload maps packages |
| 11 | Version snapshot | **PASS** | `PACKAGE_MATERIAL_KEYS` includes `hotels` |
| 12 | Booking conversion | **PARTIAL** | Creates Hotel `bookingService` with prices from line; notes omit address/city/source; voucherUrl only if present on line |
| — | Voucher/document upload | **PASS** (capability) | `HotelDocumentsAttach` on hotel rows |

### Backend costing (do not assume UI zero)

`priceLine` for `source === "MANUAL"`: uses explicit `costPrice` as a **lump sum** (`splitShared`), not room×night. Default **8000** therefore **is** included in `contractedCost` / net cost aggregates. Frontend preview similarly treats MANUAL `costPrice` as unit total (`quote-costing.ts`).

**AUDIT 3 OVERALL: FAIL**

---

# 4. Multi-city hotel mapping

**Scenario A:** Phuket 3n + Krabi 2n → Hotel A (Phuket), Hotel B (Krabi)  
**Scenario B:** + Bangkok 2n → one hotel per city  

**Client demo:** Agent **manually** selects hotels per city. Automation of “one hotel per city” is **not** required.

### What the code does

1. **List filtering:** City chips / `cities` query scopes catalogue.  
2. **On Select Hotel:**  
   - `checkIn = travelStartDate`  
   - `checkOut = travelEndDate` (start + **sum of all trip-city nights**)  
   - `city = product.city || destination` where `destination` prop defaults to **first** trip city / form destination  
3. **No per-city stay window** is computed (no Phuket 18→21 then Krabi 21→23).  
4. Multiple hotel rows **can** coexist with different `city` strings if products differ — association is string field only.

| Check | Verdict | Notes |
|-------|---------|-------|
| A. Hotel A ↔ Phuket | **PARTIAL** | If product.city is Phuket; else may fall back to first trip city |
| B. Hotel B ↔ Krabi | **PARTIAL** | Same |
| C–F. Correct stay dates / no cross-coverage | **FAIL** | Both hotels get full-trip check-in/out unless manually edited |
| G–I. Save/reload/edit/version | **PASS** | Multiple hotel objects persist in packages JSON |
| J. Pricing uses correct nights per hotel | **FAIL** | Each selected contracted hotel priced for **whole-trip** nights (`isoNights(checkIn,checkOut)` or ctx nights) → double-counting risk |

**AUDIT 4 OVERALL: FAIL**

---

# 5. Hotel dates

**Example:** Travel start **18 October**; Phuket **3** nights; Krabi **2** nights.

### Exact calculation currently used

1. Quote-level nights = sum of `tripCities[].nights` (or travelStart→travelEnd span).  
2. Effect syncs `travelEndDate = addDaysYmd(travelStartDate, cityNightsSum)`.  
   - Example: start `2026-10-18`, nights `5` → end **`2026-10-23`**.  
3. `addDaysYmd`: parse YYYY-MM-DD at local noon, `setDate(+days)`, format — avoids UTC off-by-one for date-only strings.  
4. Hotel catalogue availability + pick use **quote** start/end, not city segments.  
5. Line `nights` = `stayNights(checkIn, checkOut)` = calendar day difference (check-out exclusive in night count).

### Expected client per-city stays (for audit clarity)

| City | Check-in | Check-out | Nights |
|------|----------|-----------|--------|
| Phuket | 18 Oct | 21 Oct | 3 |
| Krabi | 21 Oct | 23 Oct | 2 |

### Actual on Select Hotel (both hotels)

| Field | Value |
|-------|--------|
| checkIn | 18 Oct |
| checkOut | 23 Oct |
| nights | 5 |

| Check | Verdict |
|-------|---------|
| Quote end date from city nights | **PASS** |
| Per-city hotel dates | **FAIL** |
| Off-by-one on `addDaysYmd` / `stayNights` | **PASS** (internally consistent) |
| Changing Phuket nights updates subsequent city hotel dates | **FAIL** — only quote `travelEndDate` updates; existing hotel rows not recalculated per city |
| Manual line dates can be edited | **PASS** — fields editable after add |
| Save/reload preserves dates | **PASS** if stored on lines |

**AUDIT 5 OVERALL: FAIL** (quote-level OK; city-wise hotel stays missing)

---

# 6. Rooms

**Client:** Basic Details rooms → hotel selection → hotel line → costing (`rate × rooms × nights` for contracted room-night).

| Path | Behavior | Verdict |
|------|----------|---------|
| Basic Details `rooms` | Persisted (Module 01A); wizard has field | **PASS** |
| New catalog / self-book line `rooms` | `Math.max(1, form.rooms \|\| 1)` / `defaultRooms` | **PASS** |
| Catalogue availability on list/select | Hardcoded `rooms: "1"` | **FAIL** vs quote rooms |
| Backend contracted `PER_ROOM_NIGHT` | `unitCost * rooms * nights` (`pricing.ts`) | **PASS** formula |
| Frontend preview contracted | `unit * rooms * stay` when snapshot/HOTEL | **PASS** |
| MANUAL self-book | Lump-sum `costPrice`, **not** × rooms × nights | Expected for “no hotel sell”; defaults still invent amounts |

**Test narrative (2 adults, 2 rooms, Phuket):** Line should default `rooms: 2`. Availability may still check 1 room. Pricing for contracted uses line rooms × line/quote nights.

**AUDIT 6 OVERALL: PARTIAL**

---

# 7. Hotel star rating

**Client:** Create Quote 3-star → Hotels catalogue initializes to 3-star; user may change.

| Check | Verdict | Evidence |
|-------|---------|----------|
| Basic Details `hotelStarPreference` | **PASS** (post-01A) | Form + wizard payload |
| Catalog open seeds `star` from `initialStar` | **PASS** | `useEffect` on open: `setStar(pref \|\| "all")` |
| User can change filter | **PASS** | Star chips/select in CatalogPicker |
| Backend enforces preference | **NOT IMPLEMENTED** | Preference not applied server-side on list; API `starCategory` unused by picker |
| Filter is client-side on fetched page | **PARTIAL** | Only filters current result set (pageSize 80), not full DB |

**AUDIT 7 OVERALL: PARTIAL**

---

# 8. Contracted rate validity

| Check | Verdict | Evidence |
|-------|---------|----------|
| Applicable rate by travel date | **PASS** | `getApplicableContractedRate` + `dateInRange(validFrom, validTo)` |
| Select blocked when not applicable | **PASS** (staff UI) | Toast `NO_VALID_RATE` when `!applicable` |
| Expired / out-of-window | **PASS** | Status not OK → unresolved / toast |
| No fake fallback contracted cost | **PASS** | Unresolved path; no silent invented contracted unit |
| Rate snapshot on save | **PASS** | `freezePackageLines` → `rateSnapshot`; preserves prior snapshot when valid |
| Later catalogue rate edits rewrite old quote | **PASS** (design) | Snapshot preserved via `preservedSnapshotCost` / freeze index |
| Agent Select with valid rate | **FAIL** | Frontend requires `contractedCost != null`; agents never get cost field |
| Availability inventory | **PARTIAL** | Catalogue check; rooms hardcoded to 1; whole-trip dates |

**AUDIT 8 OVERALL: PARTIAL**

---

# 9. Hotel rate details (selection UI)

Client demo expected: price, star, room type, meal plan, breakfast/room only, cancellation, supplier (internal), availability/validity.

| Detail | On catalogue card | On hotel line after select | Notes |
|--------|-------------------|----------------------------|-------|
| Price | Display “From” catalogue price | cost/sell after rate | Not contracted validity window on card |
| Star | Yes | Editable | |
| Room type | **No** (uses first roomCategory on pick) | Yes | No room-type picker in catalogue |
| Meal plan | **No** on card | Yes (from first roomCategory) | |
| Cancellation | **No** on card | Quote-level policy exists; per-hotel field optional / not catalog-driven | |
| Supplier | Staff if no address | Line field | Stripped for agents in API |
| Rate validity | **No** on card | `rateValidFrom`/`To` stored on pick | |

**AUDIT 9 OVERALL: PARTIAL**

---

# 10. Security / visibility

| Role | Expectation | Verdict | Evidence |
|------|-------------|---------|----------|
| Internal | May see supplier / contracted cost where permitted | **PASS** | `canViewContractedCost`, catalog supplier kept |
| Agent | Must not see contracted cost / supplier | **PASS** (read path) | `stripCatalogForRole`, `presentApplicableRate`, `sanitizeQuotationForRole` |
| Agent | Can still select sellable hotels | **FAIL** | Select requires `contractedCost` |
| Customer | Selling-safe only | **PASS** (PDF/sanitize paths) | Customer strip lists; PDF model bans cost keys |
| Recommended privilege | Cannot exfiltrate contracted-only list | N/A — Recommended not contracted | |

**AUDIT 10 (Security) OVERALL: PARTIAL**

---

# 11. Hotel selection → quotation

| Field | After Select + save | Verdict |
|-------|---------------------|---------|
| Hotel identity | productId + hotelName | **PASS** |
| City | Product city or fallback | **PARTIAL** |
| Rooms | From Basic Details default | **PASS** |
| Nights / dates | Whole-trip | **FAIL** vs city stays |
| Meal / room type | First roomCategory | **PARTIAL** |
| Rate / snapshot | After freeze | **PASS** (staff contracted) |
| Source | CONTRACTED_PRODUCT | **PASS** |
| Pricing | rooms × nights × unit (contracted) | **PASS** formula; **FAIL** if nights = whole trip for each city hotel |
| Versioning | hotels in material fingerprint | **PASS** |

**AUDIT 11 (Selection→Quote) OVERALL: PARTIAL**  
*(Numbering in user brief: “AUDIT 10 — HOTEL SELECTION → QUOTATION”; counted here as selection→quote.)*

---

# 12. Self-booked → transfers

Transfers template: free-text `pickup` / `drop`. Catalog transfer maps `pickupLocation` / `dropLocation` from **transfer products**, not from selected hotels.

No code path reads `hotels[].address` into transfer pickup/drop UI or API.

Address may sit on the hotel JSON forever without operational use.

**AUDIT 12 (Transfer integration) OVERALL: FAIL**  
*(User brief AUDIT 11.)*

---

# 13. Hotel → PDF

### Customer quotation PDF (`quotation-pdf`)

Maps: hotelName, city, star, roomType, mealPlan, checkIn/out, nights, address, cancellationPolicy.  
Does **not** map rooms count or source/self-booked flag.  
Customer-safe (no contracted cost/supplier in model).

### Itinerary / proposal-style PDF

Package/proposal paths map hotels differently (product snapshot oriented). Quotation wizard packages use quotation-pdf path for customer quote PDFs.

| Check | Verdict |
|-------|---------|
| Name / city / room / meal / nights / dates | **PASS** if populated on lines |
| Customer-safe pricing | **PASS** (no line cost on accommodation block; package totals sanitized) |
| Self-booked representation | **PARTIAL** — looks like any hotel; no self-book label; address if filled |
| Rooms on PDF | **NOT IMPLEMENTED** in mapHotels |

**AUDIT 13 (PDF) OVERALL: PARTIAL**

---

# 14. Hotel → booking conversion

`copySelectedPackageToBookingTx` creates Hotel services with title, cost/sell, optional supplierName, confirmation, voucherUrl/ticketUrl, notes = star · room · meal · dates · rooms.

| Check | Verdict |
|-------|---------|
| Hotel name | **PASS** |
| City | **FAIL** / missing from notes |
| Dates / rooms / meal / room type | **PARTIAL** (in notes string) |
| Rate/source / self-booked | **NOT IMPLEMENTED** as first-class booking fields |
| Address for ops | **FAIL** (not copied) |
| Documents / voucher | **PARTIAL** — `voucherUrl` if on line; `hotelDocuments` not clearly promoted to booking docs |

**AUDIT 14 (Booking conversion) OVERALL: PARTIAL**

---

# 15. Frontend quality / client glitches

| Issue | Verdict | Evidence |
|-------|---------|----------|
| Hotel list clipping / empty space | **PASS** (code intent) | Inline panel `flex flex-col` + `flex-1 min-h-0 overflow-y-auto` on list |
| Wrong city filtering | **PARTIAL** | Works for catalogue text match; defaults to first city |
| Wrong dates on select | **FAIL** | Whole-trip dates (Audit 5) |
| Duplicate hotels | **PASS** | No forced duplicate; user can add same product twice |
| Incorrect selected/recommended badge | **FAIL** vs contracted meaning | Badge = stars/featured |
| Wrong price display | **PARTIAL** | Catalogue “From” ≠ necessarily applicable contracted unit |
| Activity-selection glitch (client demo) | **Out of scope** | Not fixed; not re-audited as hotel defect |

Live visual confirmation of clipping fix: **ENVIRONMENT BLOCKED** (no browser pass in this audit). Code-level layout fix is present → counted **PASS** for implementation intent with note.

**AUDIT 15 (UI) OVERALL: PARTIAL**

---

# 16. Regression

Hotel work touches wizard Hotels step, products city filter, store/shell navigation. No evidence in this pass of intentional breaks to approval, expiry, email, WhatsApp, or sanitization paths.

| Area | Verdict |
|------|---------|
| Create / edit / version / freeze pricing | **PARTIAL** — still function; multi-city hotel costing incorrect |
| Approval / acceptance / expiry | **ENVIRONMENT BLOCKED** — not re-run E2E |
| PDF / email / WhatsApp | **ENVIRONMENT BLOCKED** — delivery not re-tested; PDF mapping intact in code |
| Agent security strip | **PASS** (read); Select broken (**FAIL** UX) |
| Booking conversion | Unchanged path; hotel gaps remain (**PARTIAL**) |

**AUDIT 16 (Regression) OVERALL: PARTIAL / ENVIRONMENT BLOCKED** (split: code continuity PARTIAL; full E2E ENVIRONMENT BLOCKED)

---

# Requirement scorecard (for counts)

One primary verdict per numbered client audit area:

| # | Area | Verdict |
|---|------|---------|
| 1 | Recommended vs contracted | **FAIL** |
| 2 | All Hotels / API inventory | **PARTIAL** |
| 3 | Self-booked hotel | **FAIL** |
| 4 | Multi-city hotel mapping | **FAIL** |
| 5 | Hotel date calculation | **FAIL** |
| 6 | Rooms | **PARTIAL** |
| 7 | Star rating | **PARTIAL** |
| 8 | Contracted-rate validity | **PARTIAL** |
| 9 | Hotel rate information UI | **PARTIAL** |
| 10 | Security / visibility | **PARTIAL** |
| 11 | Selection → quotation | **PARTIAL** |
| 12 | Transfer integration (self-book address) | **FAIL** |
| 13 | PDF | **PARTIAL** |
| 14 | Booking conversion | **PARTIAL** |
| 15 | UI issues | **PARTIAL** |
| 16 | Regression | **ENVIRONMENT BLOCKED** |

Additional discrete findings counted below where they are distinct from the row above (e.g. Recommended server rule **NOT IMPLEMENTED**, live hotel API **NOT IMPLEMENTED**, PDF rooms **NOT IMPLEMENTED**, self-book source handling **PASS** items rolled into area verdicts only).

### Count of primary area verdicts (16 rows)

| Verdict | Count |
|---------|------:|
| PASS | 0 |
| PARTIAL | 10 |
| FAIL | 5 |
| NOT IMPLEMENTED | 0 |
| ENVIRONMENT BLOCKED | 1 |
| DATA LIMITATION | 0 |

### Expanded checklist counts (granular checks used in sections 1–14)

Including the detailed sub-checks tabulated in Audits 1–14 (and key matrix rows), approximate roll-up:

| Verdict | Count |
|---------|------:|
| PASS | 28 |
| PARTIAL | 24 |
| FAIL | 18 |
| NOT IMPLEMENTED | 5 |
| ENVIRONMENT BLOCKED | 3 |
| DATA LIMITATION | 1 |

**DATA LIMITATION (1):** Full multi-city Select Hotel pricing behavior not proven against a live seeded Phuket/Krabi contracted inventory in this session (logic traced only).

**NOT IMPLEMENTED (5):** Server-side Recommended=contracted; live hotel API in Hotels tab; per-city stay auto-windows; PDF rooms field; booking first-class self-booked/source/address.

**ENVIRONMENT BLOCKED (3):** Browser confirmation of list clipping; full approval/expiry/delivery E2E; live agent Select Hotel against running API.

---

# CRITICAL CLIENT GAPS

Only genuine gaps vs the client’s demonstrated hotel workflow:

1. **Recommended is not contracted inventory** — it is 4★ / `isFeatured` (+ city text). API-only catalogue hotels can appear as Recommended.  
2. **Self Book invents commercial prices** (₹8000 / ₹10000) and feeds quotation costing; client requires no normal hotel sell/cost for independently booked stays. Address is optional, not operationally required.  
3. **Self-book address is not usable by transfers** — land pickup/drop cannot consume hotel location.  
4. **Multi-city stays are wrong on Select Hotel** — every hotel gets quote start → quote end (sum of all city nights), so Phuket and Krabi stays cross-cover and pricing can double-count nights.  
5. **Per-city hotel date windows are missing** — changing city nights only updates quote `travelEndDate`, not city-segmented hotel check-in/out.  
6. **All Hotels is catalogue (`liveOnly`), not live API hotel search** — UI language (“live”) overstates capability.  
7. **Agents cannot Select contracted hotels in UI** because the picker requires `contractedCost`, which the API correctly withholds from agents.  
8. **Catalogue availability / select uses `rooms: "1"`** regardless of Basic Details rooms.  
9. **Hotel cards omit room type, meal plan, cancellation, and rate validity** the client demonstrated when choosing a contracted property.  
10. **Booking conversion drops city, address, and self-booked semantics** needed for ops after convert.

---

# Trace map (quick reference)

```
Basic Details (rooms, hotelStarPreference, tripCities, travelStartDate)
    → travelEndDate = start + Σ city nights
    → Hotels step CatalogPicker(inline)
         → GET /api/products/hotels?liveOnly&city|cities&supplierId&q
         → client: star / Recommended(isFeatured|stars≥4) / price / availability(rooms=1, whole trip)
         → Select → catalogue-availability → contracted-rates/applicable
         → package.hotels[] (CONTRACTED_PRODUCT | MANUAL)
    → wizard save → freezePackageLines → pricing PER_ROOM_NIGHT | MANUAL lump sum
    → PDF mapHotels | bookingService notes
Transfers: independent pickup/drop strings (no hotel.address link)
```

---

# Files traced (read-only)

- `frontend/src/components/views/quotation-wizard.tsx`  
- `frontend/src/lib/quote-costing.ts`  
- `backend/src/routes/products.ts`  
- `backend/src/lib/contracted-rates.ts`  
- `backend/src/lib/pricing.ts`  
- `backend/src/lib/quotations.ts` (sanitize)  
- `backend/src/lib/quote-access.ts` (stripCatalogForRole)  
- `backend/src/lib/quotation-pdf/model.ts`, `render.ts`  
- `backend/src/lib/quotation-to-booking.ts`  
- `backend/src/lib/quotation-versions.ts`  
- Prior: `QA/functional/MODULE_01_*.md`, `MODULE_01A_CREATE_QUOTE_FOUNDATION_IMPLEMENTATION.md`

---

**End of audit. No implementation changes were made.**
