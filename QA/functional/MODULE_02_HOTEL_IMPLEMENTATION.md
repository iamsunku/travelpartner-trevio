# MODULE 02A — Hotel Flow Corrections (Implementation)

**Status:** Implemented (code + unit tests + typechecks + frontend production build)  
**Date:** 2026-09-16  
**Scope:** Critical hotel-flow corrections from `MODULE_02_HOTEL_CLIENT_REQUIREMENTS_AUDIT.md` only.  
No Activities / Meals / Transfer redesign / Insurance / Visa / Add-ons / full costing redesign / PDF redesign / email-WhatsApp / booking architecture rewrite.

---

## 1. Files changed

### Backend
| File | Change |
|------|--------|
| `backend/src/lib/quote-trip-cities.ts` | Stay windows, hotel date sync, self-booked transfer location helper |
| `backend/src/lib/pricing.ts` | Self-booked (`selfBooked: true`) with no cost → ₹0 resolved (not unresolved, not invented) |
| `backend/src/lib/contracted-rates.ts` | Export `toWindow` for batch Recommended annotation |
| `backend/src/routes/products.ts` | Annotate `hasApplicableContractedRate`; `recommendedOnly`; `cityStayDates` / `travelDate`; rooms parsing |
| `backend/src/lib/quotation-to-booking.ts` | Hotel notes: city, address, nights, Self-booked marker |
| `backend/src/lib/quotation-pdf/model.ts` | Prefer `tripCity`; map `selfBooked` |
| `backend/src/lib/quotation-pdf/render.ts` | Self-booked label on accommodation block |
| `backend/src/__tests__/module-02a-hotel-flow.test.ts` | **New** Module 02A tests |
| `backend/src/__tests__/hotel-inventory-templates.test.ts` | Rooms=2 insufficient inventory case |

### Frontend
| File | Change |
|------|--------|
| `frontend/src/lib/quote-trip-stays.ts` | **New** stay windows + sync + transfer locations (mirror) |
| `frontend/src/lib/quote-costing.ts` | Prefer hotel-line nights over quote total; self-booked preview = 0 |
| `frontend/src/components/views/quotation-wizard.tsx` | Recommended=contracted; city stays on pick; self-book no prices; rooms in availability; agent pick; transfer hotel address options; rate info |

### Unchanged by design
- Prisma schema / migrations (no new columns — hotel fields live in package JSON)
- Approval / acceptance / expiry / email / WhatsApp pipelines
- Contracted-rate validity engine (reused)
- Markup / tax architecture

---

## 2. Schema changes

**None.** City association uses existing package hotel JSON (`tripCity`, `checkIn`, `checkOut`, `nights`, `selfBooked`, `stayDatesLocked`, `lineId`, `address`).

## 3. Migration

**None.**

---

## 4. API changes

### `GET /api/products/hotels`
New optional query params:
- `travelDate` (YYYY-MM-DD) — fallback date for contracted applicability
- `cityStayDates` — `Phuket:2026-10-18,Krabi:2026-10-21` (city → check-in)
- `recommendedOnly=true` — return only hotels with `hasApplicableContractedRate`

Each item includes **`hasApplicableContractedRate: boolean`** (server-side).  
**Does not** expose `contractedCost`. Stars / `isFeatured` are **not** used.

### `GET /api/products/hotels/:id/catalogue-availability`
- `rooms` continues to be honored; callers now pass quote rooms (no frontend hardcode of `1`).

### `GET /api/contracted-rates/applicable`
- Unchanged security: agents get `applicable` + `rateId` without `contractedCost`.

---

## 5. Frontend changes

- Hotels step stays inline catalogue UI (teal).
- City chips drive stay window used for availability + Select Hotel.
- Self-booked template: no `costPrice` / `sellingPrice` defaults; `selfBooked: true`.
- Transfer pickup/drop: selectable options from self-booked hotel addresses (plus custom text).
- Manual hotel date edits set `stayDatesLocked: true`.

---

## 6. Recommended logic

**Recommended = has an applicable contracted rate for the relevant stay check-in date.**

1. Server loads Active contracted rates for returned hotel IDs.  
2. Matches rate with `findApplicableContractedRate` for city stay check-in (or `travelDate`).  
3. Sets `hasApplicableContractedRate` only when status === `OK`.  
4. Frontend Recommended tab filters on that flag (and may request `recommendedOnly=true`).  

**Not used:** star ≥ 4, `isFeatured`.

---

## 7. Self-booked pricing behavior

| Field | Behavior |
|-------|----------|
| Template defaults | **Removed** ₹8000 / ₹10000 / markup 2000 |
| Flags | `source: "MANUAL"`, `selfBooked: true` |
| Pricing | No `costPrice` → `priceLine` returns **0 cost, resolved** (operational line) |
| Explicit amount | If user enters `costPrice`, it is priced normally |
| Contracted path | Not applied (`freezeLine` keeps MANUAL) |

---

## 8. Self-booked transfer integration

`selfBookedHotelTransferLocations(hotels)` builds labels from hotel lines with address.  
Transfer editor: pickup/drop Select includes those addresses + “Custom location…”.  
Optional `pickupHotelLineId` / `dropHotelLineId` store the hotel `lineId` reference.  
Address text remains the operational pickup/drop value (save/reload/edit safe).

---

## 9. Multi-city date algorithm

Given travel start `S` and Trip Plan City Wise in order:

```
cursor = S
for each city:
  checkIn = cursor
  checkOut = checkIn + nights
  cursor = checkOut
```

Example: start **2026-10-18**, Phuket 3 + Krabi 2 →  
Phuket **18→21 (3)**, Krabi **21→23 (2)**.

Hotel Select associates `tripCity` + city-specific `checkIn`/`checkOut`/`nights` (not whole-trip dates).  
Does **not** fall back to first trip city when a specific city chip / product city is known.

### Changing city nights (chosen behavior)

**Auto-recalculate** hotel rows tied to a city via `tripCity` (else `city`), **unless** `stayDatesLocked === true`.  
Manual edits to check-in/out set `stayDatesLocked`.  
Documented so stale dates are not left silently.

---

## 10. Hotel pricing behavior

Backend `priceLine` already preferred `isoNights(checkIn, checkOut)` then line `nights`.  
With city windows, Phuket uses 3n and Krabi 2n independently.

Frontend preview now **prefers line stay nights** over quote-level total nights (fixes double-count preview).

Example: ₹1000×2×3 + ₹1500×2×2 = ₹12,000 (not ×5 for both).

---

## 11. Agent selection behavior

Frontend Select Hotel now requires:

- `applicable === true`
- `rateId` present  

**Not** `contractedCost != null`.

Agents still never receive `contractedCost`. Backend `freezePackageLines` remains authoritative for snapshot/cost on save.

---

## 12. Tests added

- `backend/src/__tests__/module-02a-hotel-flow.test.ts` — A–K, N, O, I (rooms contract), stay sync, pricing, PDF, versioning, agent payload  
- Extra rooms insufficient case in `hotel-inventory-templates.test.ts`

---

## 13. Tests executed

| Suite | Result |
|-------|--------|
| `module-02a-hotel-flow.test.ts` | PASS |
| `quote-create-basics.test.ts` | PASS |
| `contracted-rates.test.ts` | PASS |
| `pricing.test.ts` | PASS |
| `quotation-to-booking.test.ts` | PASS |
| `quotation-pdf.test.ts` | PASS |
| `hotel-inventory-templates.test.ts` | PASS |

**Pre-existing failures:** None observed in the suites above.

---

## 14. Typecheck / build

| Check | Result |
|-------|--------|
| Backend `tsc --noEmit` | PASS |
| Frontend `tsc --noEmit` | PASS |
| Frontend `next build` | PASS |

---

## 15. Backward compatibility

- Legacy hotel lines without `tripCity` / `selfBooked` / `stayDatesLocked` still load.  
- Sync matches on `city` when `tripCity` absent.  
- Locked / unknown-city rows are left unchanged.  
- Historical quotation versions not rewritten.  
- Status / acceptance / versioning rules unchanged.  
- Existing contracted freeze + sanitize paths preserved.

---

## 16. Remaining limitations

1. **Live hotel API** (Amadeus etc.) still not wired into Hotels All tab — catalogue only.  
2. **Recommended** depends on seeded contracted rates + travel/stay dates; empty Recommended if none apply.  
3. **Room-type picker** still uses first `roomCategories` entry (no multi-variant UI redesign).  
4. **Cancellation** on cards shows catalogue value or “Unavailable in catalogue” — not invented.  
5. **Transfer integration** is selectable default/options only — not automatic forced pickup.  
6. **Address not required** at self-book create (ops still need it for useful transfer options).  
7. Full browser E2E multi-city Select Hotel against live DB not run in this pass (unit/logic covered).

---

## Critical client gaps closed

| Gap | Status |
|-----|--------|
| Recommended ≠ contracted | **Fixed** (server annotated) |
| Self-book invented ₹8000/₹10000 | **Fixed** |
| Self-book address → transfers | **Fixed** (selectable) |
| Whole-trip dates on every hotel | **Fixed** (city windows) |
| City nights change leaves stale hotel dates | **Fixed** (auto-sync unless locked) |
| Availability rooms hardcoded 1 | **Fixed** |
| Agent Select blocked on missing cost | **Fixed** |

---

**End of Module 02A implementation report.**
