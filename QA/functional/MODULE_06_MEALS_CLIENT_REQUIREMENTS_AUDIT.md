# MODULE 06 — Meals Client Requirements Audit (Audit Only)

**Purpose:** Compare the **existing Quotation Wizard “Meals” step** (`step === 5`) and related backend (products, contracted rates, pricing, Module 04A itinerary sync, PDF, booking) against client meal requirements.

**Mode:** AUDIT ONLY — no application code, schema, UI, PDF, or booking logic was modified for this report.

**Primary surface:**  
`quotation-wizard.tsx` step 5 → `ServiceEditor` (Meals) → Catalog / Add self-booked → `packages[].meals[]` → freeze + pricing → `syncPackageItinerary` → PDF / booking.

**Audit date:** 2026-09-16  
**Method:** Static UI → API → backend → DB/schema code tracing. Live browser E2E, seeded catalogue data, and multi-role sessions were **not** executed. Runtime-only claims are `BLOCKED` / `DATA LIMITATION`.

**Verdict scale:** `PASS` | `PARTIAL` | `FAIL` | `NOT IMPLEMENTED` | `BLOCKED` | `DATA LIMITATION`

---

## 1. Executive summary

Meals exist as a catalogue + self-booked editor with contracted-rate gating on catalogue picks and Module 04A itinerary sync when a **date** is set. They are **not** client-ready for multi-city meal planning or hotel meal-plan coordination.

| Theme | Verdict | One-line finding |
|-------|---------|------------------|
| Meal catalog | **PARTIAL** | Internal `MealProduct` + applicable rate — not live API |
| Meal self-booked | **FAIL** | Invents ₹900 / ₹1,200 cost/sell and adult/child rates 1200/800 |
| Meal fields | **PARTIAL** | No city / time / currency / voucher / remarks / location |
| Multi-city date/city | **FAIL** | Date defaults to trip **start**; no city field |
| Hotel meal plan vs Meals module | **Independent** | No link; `includedInPlan` exists in pricing but wizard never sets it |
| Meal → itinerary | **PARTIAL** | Works if date set; city often empty |
| Pricing / cost security (API) | **PARTIAL** / **PASS** | `PER_PASSENGER` default; agent strips cost/supplier |
| Save/reload / version E2E | **BLOCKED** | Not browser-executed |
| Live meal API | **NOT IMPLEMENTED** | |

**Overall:** Not ready for sign-off. Strongest: catalogue rate gate + 04A meal sync hooks + `includedInPlan` pricing skip. Weakest: invented self-book prices, trip-start date hardcoding, missing city, hotel breakfast duplication awareness absent.

---

## 2. Existing UI

**Step label:** “Meals” (`STEPS[5]`, hint “Food”).

| Control | Behavior |
|---------|----------|
| Catalog | Opens `CatalogPicker` `kind="meals"` → `GET /api/products/meals?liveOnly=true` |
| Add self-booked | Appends `template` row via `ServiceEditor.addSelfBooked` |
| Editor fields | `restaurant`, `cuisine`, `mealType`, `dietary`, `date`, `adults`, `children`, `adultRate`, `childRate`, `costPrice`, `sellingPrice` |
| Empty state | Shared ServiceEditor dashed empty message |
| Delete | Per-row trash control |

Unlike Transfers/Activities (Module 05A), Meals **do not** receive `tripCities`, `stayWindows`, or a “suggest” helper. Agent roles hide `costPrice` in the editor (`hideInternalCost`).

No API Search for meals (unlike Flights).

---

## 3. Meal sources

### A. Catalog

```
CatalogPicker kind=meals
  → GET /api/products/meals?liveOnly=true[&destinationId][&city][&q]
  → GET /api/contracted-rates/applicable?productType=MEAL&…
  → packages.meals[] source=CONTRACTED_PRODUCT
  → freezePackageLines → rateSnapshot
```

| Check | Verdict |
|-------|---------|
| UI exists | **PASS** |
| Backend product API | **PASS** (`MealProduct`) |
| Contracted rate required to pick | **PASS** (shared CatalogPicker gate) |
| Live third-party meal API | **NOT IMPLEMENTED** |

**Catalog: PARTIAL** (internal products only)

### B. Self-booked

| Check | Verdict |
|-------|---------|
| Add self-booked UI | **PASS** |
| `source: MANUAL` | **PASS** (in template) |
| `selfBooked: true` | **FAIL** — not set (unlike hotels/flights/transfers/activities after 03A–05A) |
| Commercial defaults | **FAIL** — invented values (see §13) |

**Self-booked: FAIL** (commercially)

---

## 4. Meal types

| Type | Supported? | Notes |
|------|------------|-------|
| Breakfast | **PASS** | In `MEAL_TYPES` select |
| Lunch | **PASS** | In select |
| Dinner | **PASS** | Default on self-booked template |
| Snacks | **NOT IMPLEMENTED** | Not in UI select |
| Other / custom | **PARTIAL** | DB `MealProduct.mealType` default `"Other"`; wizard select is only B/L/D |

**Implementation:** Structured select on quote lines (`FIELD_SELECT_OPTIONS.mealType`), not free text and **not** derived from hotel `mealPlan`.

Hotel room/hotel lines store a separate free-text / room-category `mealPlan` (e.g. `"Breakfast"`). That is **not** the Meals module.

**Meal types overall: PARTIAL**

---

## 5. Meal fields

| Field | In editor? | Notes |
|-------|------------|-------|
| Meal type | Yes | B/L/D select |
| Date | Yes | Defaults to `travelStartDate` |
| City | **No** | Not in `fields[]`; itinerary looks for `city` / `tripCity` |
| Location | **No** | |
| Restaurant / hotel | Yes | `restaurant` |
| Description | **PARTIAL** | Catalog copies `description`; not in editor field list |
| Cuisine | Yes | |
| Dietary | Yes | Used as itinerary “remarks” proxy |
| Adults / children | Yes | From Basic Details on create |
| Total pax | **No** | No combined pax field |
| Infants | **No** | |
| Cost / selling | Yes | |
| Adult / child rate | Yes | |
| Currency | **No** | Product has currency; line editor does not |
| Supplier / source | **PARTIAL** | `source` set; supplier not in meal fields; agents hide supplier globally where present |
| Voucher / reference | **No** | |
| Remarks | **No** | dietary used instead in itinerary |
| Time | **No** | itinerary reads `row.time` (never set by editor) |
| Duration | **No** | |

**Missing (client-relevant):** city, location, currency, voucher, remarks (dedicated), time, duration, infants, total pax, selfBooked flag.

**Meal fields: PARTIAL**

---

## 6. Basic Details integration

| Check | Verdict |
|-------|---------|
| Adults default from form | **PASS** — template + `catalogToRow` use `form.adults` |
| Children default from form | **PASS** — `form.children` |
| Infants | **FAIL** / **NOT IMPLEMENTED** on meal lines |
| Hardcoded pax | **PASS** — not hardcoded to 1; uses form counts |
| Auto-update when Basic Details pax changes later | **FAIL** — existing meal rows are not re-synced |

**Basic Details integration: PARTIAL**

---

## 7. Multi-city behavior

Example: Phuket 3n / Krabi 2n / Bangkok 2n.

| Check | Verdict |
|-------|---------|
| Associate meal with city | **FAIL** — no city field |
| Associate meal with segment date | **PARTIAL** — date editable, but defaults to trip **start** for every new row |
| Catalog / self-book date default | **FAIL** — `date: form.travelStartDate` always |
| Stay-window aware defaults | **NOT IMPLEMENTED** |

Staff can manually set dates to 19 / 22 / 24 Oct, but nothing prevents or guides city alignment.

**Multi-city: FAIL**

---

## 8. Date behavior

| Check | Verdict |
|-------|---------|
| Date field exists | **PASS** |
| Persisted in `packages.meals[]` JSON | **PASS** (code path; E2E **BLOCKED**) |
| Editable | **PASS** |
| Defaults correctly for multi-city | **FAIL** — trip start |
| Independent of other services | **PASS** — line-level date |
| Must fall inside city stay window | **NOT IMPLEMENTED** — no validation |

Changing travel start / city nights updates hotels + itinerary skeleton via stay windows; **meals dates are not auto-updated** → stale risk (§22).

**Date behavior: PARTIAL**

---

## 9. City behavior

| Check | Verdict |
|-------|---------|
| Explicit meal.city in editor | **FAIL** |
| Catalog copies product city onto line | **FAIL** — `catalogToRow` maps product city into `cuisine` (`cuisine: item.city`), not `city` |
| Itinerary city resolution | Uses `m.city \|\| m.tripCity`; if empty, `ensureDay` only fills city when the day has none (hotel/flight may already set it) |
| Multi-city assignment | **FAIL** without manual JSON-level city |

**City behavior: FAIL**

---

## 10. Hotel meal-plan integration

| Aspect | Finding |
|--------|---------|
| Hotel `mealPlan` | Room/hotel line field (e.g. Breakfast included in stay) |
| Meals module | Separate commercial `packages.meals[]` lines |
| Connection | **B. Independent** |
| Partial bridge | Pricing / itinerary / PDF skip lines with `includedInPlan === true` or `included === true` |
| Wizard sets `includedInPlan` | **No** — never set from hotel meal plan |
| Warning / prevention of duplicate breakfast | **None** |

Hotel meal plan text is **not** treated as a Meals-module service. Adding a Meals “Breakfast” while hotel meal plan is “Breakfast” is allowed with **no awareness**.

**Hotel meal-plan integration: Independent (no duplication control)**

---

## 11. Catalog

| Capability | Verdict |
|------------|---------|
| Product search (`q`) | **PASS** |
| Destination / city filter | **PARTIAL** — destinationId or destination label city; no trip-city multi filter like hotels |
| Meal type filter (API) | **PASS** — `?mealType=` supported; CatalogPicker UI may not expose type chips |
| Product details | **PARTIAL** — list shows name, transfer badge, city |
| Pricing on product | **PASS** — `adultPrice` / `childPrice` / `currency` on `MealProduct` |
| Contracted rates | **PASS** — required to pick |
| Rate validity | **PASS** — applicable endpoint + freeze |
| Supplier | **PASS** on product; stripped for agents on catalog strip / quote sanitize |
| Availability / blackouts | **NOT IMPLEMENTED** for meals — `MealProduct` has no `blackoutDates`; `freezeLine` inventory check is **hotel-only** |
| Internal vs live | **Internal** `MealProduct` table |

**Catalog: PARTIAL**

---

## 12. Contracted rates

Trace:

```
MealProduct
  → GET /api/contracted-rates/applicable?productType=MEAL&productId&travelDate
  → quote line source=CONTRACTED_PRODUCT + rateId/validity
  → freezePackageLines / freezeLine → rateSnapshot (frozen)
  → pricePackage / priceLine
```

| Check | Verdict |
|-------|---------|
| Applicable rate selection | **PASS** (code) |
| Validity by date | **PASS** |
| Expired / missing → unresolved | **PASS** |
| Snapshot + freeze | **PASS** |
| Versioning of frozen packages | **PASS** (architecture: `meals` in version payload keys) — E2E **BLOCKED** |
| Supplier cost protection | **PASS** (sanitize strips cost/supplier) — live role **BLOCKED** |
| Meal-specific inventory blackout | **NOT IMPLEMENTED** |

**Contracted meal rate: PARTIAL** (solid rate path; no meal inventory)

---

## 13. Self-booked meals

Exact template defaults (wizard):

```ts
{
  mealType: "Dinner",
  restaurant: "",
  cuisine: "Local",
  dietary: "",
  date: form.travelStartDate || "",
  adults: form.adults,
  children: form.children,
  adultRate: 1200,
  childRate: 800,
  costPrice: 900,
  sellingPrice: 1200,
  source: "MANUAL",
}
```

| Check | Verdict |
|-------|---------|
| Invented commercial values | **FAIL** — 1200/800/900/1200 |
| `selfBooked` flag | **FAIL** — absent |
| Manual price still editable | **PASS** |
| Date / type / restaurant | **PASS** (present; date default weak) |
| City / currency / voucher / remarks | **FAIL** — missing |

Unlike Module 05A transfers/activities, `addSelfBooked` has **no** meals branch that deletes invented prices.

**Self-booked: FAIL**

---

## 14. Pricing

### Unit

| Mechanism | Actual |
|-----------|--------|
| Default rate unit for `MEAL` | **`PER_PASSENGER`** (`defaultRateUnit`) |
| Also supported in engine | `PER_MEAL` (shared qty × unit; not the default) |
| UI display costing | If `adultRate`/`childRate` set → `adultRate×adults + childRate×children` |
| Server contracted path | Snapshot unit cost × passengers (adults + childCost metadata) × quantity |

Not `PER_GROUP` by default. Do **not** describe meals as live API pricing.

### Layers

Contracted Cost → Trevio markup → Agent markup → Customer price: shared `pricePackage` pipeline — **PASS** at architecture level.

| Check | Verdict |
|-------|---------|
| Pax multiplier | **PASS** (`PER_PASSENGER`) |
| Adult/child | **PARTIAL** — child via snapshot metadata `childCost` or line adultRate/childRate |
| Tax / currency | Quote-level tax; line currency weak in editor |
| `includedInPlan` → cost 0 | **PASS** (if flag set; wizard never sets it) |
| Snapshot / versioning | **PASS** architecture / **BLOCKED** E2E |

**Pricing: PARTIAL**

---

## 15. Security

| Surface | Verdict |
|---------|---------|
| API `sanitizeQuotationForRole` | **PASS** (code) — strips `costPrice`, `contractedCost`, `supplier*`, markup/profit keys |
| UI | **PASS** (code) — agents/customers hide `costPrice` in ServiceEditor |
| PDF | **PASS** (code) — meals map has no cost fields |
| Live multi-role session | **BLOCKED** |

Supplier names: sanitized off agent/customer quote payloads; catalog list uses `stripCatalogForRole`.

**Security: PARTIAL** (code PASS + runtime BLOCKED)

---

## 16. Itinerary integration

Module 04A `syncPackageItinerary` meal path:

- Skips `includedInPlan` / `included`
- Requires `date`
- Builds item: meal type as `activityName`; description from restaurant/cuisine/description/pax; `remarks` ← dietary; `pickupTime` ← `time` (usually empty); `sourceKey: meal:{id}`
- Dedupes on `sourceKey`; regenerate strips auto items then re-adds

| Expected | Verdict |
|----------|---------|
| Meal type | **PASS** |
| Date | **PASS** (if set) |
| City | **FAIL** / **PARTIAL** — often empty on line |
| Description | **PARTIAL** |
| Pax | **PASS** (in description) |
| Time | **FAIL** — no editor field |
| Remarks | **PARTIAL** — dietary only |
| Dedup / no duplicate on regenerate | **PASS** (unit-tested pattern in 04A) |

**Meal → itinerary: PARTIAL**

---

## 17. Same-day services

Sync pushes MEAL items alongside HOTEL / FLIGHT / TRANSFER / ACTIVITY by `sourceKey` without overwriting other types. Same-day coexistence is supported at the sync layer (**PASS** at unit/architecture; browser **BLOCKED**).

---

## 18. PDF

`mapMeals` → customer PDF “Meal arrangements”:

| Field | Survives? |
|-------|-----------|
| Meal type | **PASS** |
| Restaurant | **PASS** |
| Date | **PASS** |
| Description | **PASS** |
| City | **FAIL** — not mapped |
| Pax | **FAIL** |
| Time | **FAIL** |
| Location | **FAIL** |
| Selling price | **FAIL** — not mapped |
| Cost | Correctly omitted |

Included-plan meals filtered out of PDF list.

**Meal → PDF: PARTIAL**

---

## 19. Booking

Conversion creates service type **`Other`** (not a dedicated Meal type):

```ts
svc("Other", `${mealType} ${restaurant}`, m, lineNote(m, [cuisine, date]))
```

| Field | Preserved? |
|-------|------------|
| Meal type / restaurant (title) | **PARTIAL** |
| Date / cuisine (notes) | **PARTIAL** |
| City / pax / time / location / voucher / source | **FAIL** — not in notes |
| Price | **PARTIAL** — via service line cost/sell columns from line object |
| Remarks / dietary | **PARTIAL** — `lineNote` appends `remarks` only if present (editor has dietary, not remarks) |

**Meal → booking: PARTIAL** / weak operational fidelity

---

## 20. Save / reload

Persistence path: quotation packages JSON includes `meals` on create/update.  
**Browser E2E not executed → BLOCKED.**  
Do not claim PASS from static inspection.

---

## 21. Versioning

`quotation-versions` includes `meals` in package snapshot keys; freeze snapshots rates on contracted lines.  
**Architecture: PARTIAL / PASS.**  
**Frozen Version 1 immutability E2E: BLOCKED.**

---

## 22. Date / city changes

| Change | Meal behavior |
|--------|----------------|
| Travel start changes | Hotels/itinerary sync; **meal dates unchanged** → stale |
| City nights / order change | Same — meals not remapped |
| Meal date edited | Independent; itinerary updates on onChange |
| Hotel changes | No meal auto-adjust; hotel mealPlan still independent |

**Stale meal risk: FAIL** (no remediation)

---

## 23. Regeneration

Regenerate itinerary refreshes AUTO meal items from `packages.meals` by `sourceKey`; preserves manual itinerary items; does not reprice packages.

| Check | Verdict |
|-------|---------|
| No meal duplicate | **PASS** (code / 04A pattern) |
| Manual content survives | **PASS** (code) |
| Other service autos survive | **PASS** (code) |
| Pricing unchanged by regenerate | **PASS** (sync only) |

Browser confirmation: **BLOCKED**.

---

## 24. Hotel breakfast duplication

Scenario: hotel `mealPlan = "Breakfast"` + Meals line `mealType = "Breakfast"`.

| Behavior | Actual |
|----------|--------|
| Prevents duplication | **No** |
| Warns | **No** |
| Allows intentionally with linkage | **No** — no linkage |
| Awareness | **None** in UI |

Pricing can zero `includedInPlan` meals, but the wizard never marks hotel-included breakfast that way.

**Verdict: FAIL** (no awareness) — not an intentional product rule, just absent integration.

---

## 25. UI quality

| Aspect | Notes |
|--------|-------|
| Catalog vs self-book | Clear shared pattern |
| Meal type / date / pax / pricing | Visible |
| City | Missing |
| Multiple lines / delete | Supported |
| Empty state | Present |
| Loading (catalog) | Present |
| Error (no rate) | Toast on pick without applicable rate |
| Self-book clarity | Weak — looks commercial due to invented prices |
| Long restaurant names | Standard inputs; no special truncation audit |

**UI quality: PARTIAL** — do not redesign.

---

## 26. Test matrix

| ID | Scenario | Verdict |
|----|----------|---------|
| A | Breakfast | **PASS** (type option) |
| B | Lunch | **PASS** |
| C | Dinner | **PASS** |
| D | Custom meal | **PARTIAL** (DB Other; UI B/L/D only) |
| E | Catalog meal | **PARTIAL** |
| F | Self-booked meal | **FAIL** (fake prices) |
| G | Meal date | **PARTIAL** |
| H | Meal city | **FAIL** |
| I | Multi-city | **FAIL** |
| J | Pax | **PARTIAL** (adults/children; no infants/sync) |
| K | Pricing | **PARTIAL** |
| L | Contracted rate | **PARTIAL** / **PASS** path |
| M | Agent security | **PARTIAL** (code PASS; live **BLOCKED**) |
| N | Meal → itinerary | **PARTIAL** |
| O | Same-day multiple services | **PASS** (architecture) |
| P | Hotel breakfast interaction | **FAIL** |
| Q | Meal → PDF | **PARTIAL** |
| R | Meal → booking | **PARTIAL** |
| S | Save/reload | **BLOCKED** |
| T | Versioning | **BLOCKED** |

---

## 27. Missing features

1. Live third-party meal API  
2. Explicit meal city + stay-window defaults/validation  
3. Currency / voucher / remarks / time on editor  
4. `selfBooked` + no invented commercial defaults  
5. Hotel meal-plan ↔ Meals module link or warning  
6. Snacks / Other in wizard type list  
7. Meal inventory / blackout enforcement  
8. Auto-remap meals when trip cities/dates change  
9. Dedicated booking service type for meals  

---

## 28. Defects

1. **Invented self-book prices:** `adultRate: 1200`, `childRate: 800`, `costPrice: 900`, `sellingPrice: 1200`  
2. **No `selfBooked: true`** on meal self-book rows  
3. **Date always defaults to trip start** (catalog + self-book)  
4. **No city field**; catalog city incorrectly dumped into `cuisine`  
5. **Hotel breakfast duplication** with zero awareness  
6. **Stale meals** after Basic Details city/date changes  
7. **PDF / booking** lose city, pax, time, selling price (PDF), rich operational notes (booking)  

---

## 29. Environment blockers

| Blocker | Impact |
|---------|--------|
| No browser E2E this audit | Save/reload, versioning, UI flows → **BLOCKED** |
| No live multi-role session | Agent/customer security runtime → **BLOCKED** |
| Catalogue seed unknown | Rate applicability in real DB → **DATA LIMITATION** |

---

## 30. Final scorecard

| Area | Score |
|------|-------|
| Catalog (internal + rates) | **PARTIAL** |
| Live meal API | **NOT IMPLEMENTED** |
| Self-booked | **FAIL** |
| Meal types | **PARTIAL** |
| Fields | **PARTIAL** |
| Multi-city / city | **FAIL** |
| Date defaults | **FAIL** / **PARTIAL** |
| Hotel meal-plan integration | **Independent / FAIL** (duplication) |
| Pricing engine path | **PARTIAL** |
| Agent security (code) | **PASS** / runtime **BLOCKED** |
| Itinerary sync | **PARTIAL** |
| PDF | **PARTIAL** |
| Booking | **PARTIAL** |
| Save/reload | **BLOCKED** |
| Versioning E2E | **BLOCKED** |

**Sign-off recommendation:** **Do not sign off.** Meals are structurally present but commercially unsafe for self-book (invented prices), operationally weak for multi-city (no city; trip-start dates), and unaware of hotel-included breakfast.

---

*End of MODULE 06 audit. No application code was modified.*
