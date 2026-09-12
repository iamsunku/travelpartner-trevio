# Phase 13 — Hotel inventory enforcement + QuoteTemplate merge

## 1. Scope

Close the two Phase 12 leftovers:

1. **HT-04** — Hotel catalogue inventory enforcement at quote time  
2. **TM-02** — QuoteTemplate content merge into quotations  

Preserve Phases 1–12. No live supplier GDS fabrication. No customer portal / payments. **Stop after Phase 13.**

## 2. HT-04 existing behavior

| Finding | Detail |
| --- | --- |
| Model | `HotelProduct.inventory` JSON: `{ roomName, date, available, soldOut, closed }` |
| Blackouts | `HotelProduct.blackoutDates` |
| Pre–Phase 13 | Inventory unused by wizard / freeze path |
| Live GDS | Amadeus hotel search exists separately — **not** catalogue inventory |

## 3. Hotel inventory model

**Catalogue availability** (implemented): product inventory + blackout metadata.

**Real-time supplier availability**: **NOT IMPLEMENTED** / not claimed. APIs return `liveSupplier: false`.

No reservation hold / stock decrement — catalogue rows are advisory metadata.

## 4. Travel-date enforcement

- Contracted hotels still require Phase 2 applicable rate for travel date.
- Catalogue inventory checks every night in `[checkIn, checkOut)`.
- Wizard requires start **and** end date before catalog hotel pick.
- `freezePackageLines` accepts `travelEndDate` for server-side check-out.

Invalid date/rate → unresolved line / toast — no silent valid cost.

## 5. Room inventory behavior

Rooms requested (`rooms`) compared to catalogue `available` for matching `roomType`. Sold-out / closed / blackout / insufficient → `CATALOGUE_INVENTORY_UNAVAILABLE`. Empty inventory ⇒ **untracked** nights (no catalogue block).

Phase 3 costing unchanged.

## 6. Self-booked hotel behavior

`source: MANUAL` / API hotels skip catalogue inventory. Manual flow preserved. Documents remain Phase 4 private.

## 7. Hotel security

| Test | Result |
| --- | --- |
| A–C Agent/customer no supplier/cost | **PASS** |
| D–E Arbitrary rate/cost rejected via freeze / Phase 2–3 | **PASS** |
| F–G Invalid inventory / rate date | **PASS** |
| H Private hotel docs | Phase 4 regression **PASS** |
| I Cross-agent isolation | Phase 1 regression **PASS** |

## 8. TM-02 existing template behavior

`QuoteTemplate` + sections were branding/layout. Section `settings` could hold placeholders; wizard did not merge reusable package content.

## 9. Template merge semantics

`POST /api/quotations/:id/apply-template`

| Mode | Behavior |
| --- | --- |
| `fill-empty` (default) | Only empty quote/package fields receive template content |
| `merge-append` | Appends arrays (itinerary/hotels/…) without wiping existing rows |

Targets **one package** via `packageIndex` (default 0). Does not mix package A into B.

Strips supplier/contracted cost from template service lines.

## 10. Template snapshot / version

Quotation stores `templateSnapshot` + `appliedTemplateId`. Later template edits do not rewrite the snapshot. Material apply triggers Phase 7 `recordQuotationRevisionIfNeeded` (approval invalidation when required).

## 11. Approval interaction

Converted/Expired/Cancelled/Archived blocked. Material change → existing revision/approval rules. Does not auto-send.

## 12. Costing interaction

Merged lines pass `freezePackageLines` → Phase 3. Contracted product lines without valid rates remain unresolved. Templates cannot invent rates.

## 13. Multi-package behavior

Apply targets a single package index. **PASS** for intended package only. Package-level template entities: **NOT IMPLEMENTED** (documented).

## 14. Template security

| Case | Result |
| --- | --- |
| Active template in agency scope only | **PASS** |
| Cost injection stripped | **PASS** |
| Historical version immutability (snapshot copy) | **PASS** |
| Customer-safe sanitize after apply | **PASS** (sanitizer) |

## 15. UI changes

- Wizard: hotel catalog checks catalogue availability; sets check-in/out from travel dates  
- Wizard: Apply Active Quote Template (fill empty) after draft save  
- Quote template builder: section content editors (text / items / itinerary JSON / service JSON)

## 16. Database migration

`20260912240000_quote_template_snapshot` — **applied**

- `Quotation.templateSnapshot` JSON  
- `Quotation.appliedTemplateId` TEXT  

## 17. Existing-data audit

Script: `backend/scripts/audit-phase13-hotel-templates.mjs` (read-only)

| Metric | Count |
| --- | ---: |
| Hotel products | 6 |
| Hotels with inventory rows | 1 |
| Sold-out inventory rows | 0 |
| Invalid inventory dates | 0 |
| Hotel contracted rates | 0 |
| Invalid hotel rate ranges | 0 |
| Quote templates | 0 |
| Templates with section content | 0 |
| Quotations with applied template | 0 |

No silent rewrite of historical records. Empty template catalogue and zero hotel contracted rates in this demo DB are **ENVIRONMENT** / seed limitations, not Phase 13 regressions.

## 18. End-to-end result

Deterministic unit path:

1. Inventory sold-out / blackout rejects — **PASS**  
2. Template extract → fill-empty merge → snapshot — **PASS**  
3. Freeze + Phase 3 / version / PDF / conversion — **PASS** via regression suites  

Live Amadeus hotel E2E — **ENVIRONMENT BLOCKED** (credentials).

## 19. Tests

| Suite | Result |
| --- | --- |
| Phase 13 `hotel-inventory-templates.test.ts` | **PASS** |
| Phase 1–13 relevant (14 files) | **155 PASS** |
| Backend `tsc --noEmit` | **PASS** |
| Frontend `tsc --noEmit` | **PASS** |

## 20. Known limitations

- Catalogue inventory ≠ live supplier confirmation; no hold/race reservation  
- Untracked nights when inventory empty  
- QuoteTemplate package-level templates not a separate model  
- Section content is editor-authored JSON/text (not auto-synced from destination plans)

## 21. Known pre-existing / environment issues

| Item | Class |
| --- | --- |
| Smoke `SEED_DEMO_PASSWORD` | **BLOCKED** / **PRE-EXISTING** |
| Smoke forgot-password timeout | **PRE-EXISTING** |
| Live Amadeus without keys | **ENVIRONMENT BLOCKED** |
| Legacy flight lines missing `source` | **PRE-EXISTING** data |
| Empty demo FlightProduct/MealProduct | **ENVIRONMENT** |
| `operations_executive` typecheck | Did **not** regress |

New blockers: **none**.

## 22. Files changed

**Backend:** `lib/hotel-inventory.ts`, `lib/quote-template-merge.ts`, `lib/contracted-rates.ts`, `routes/products.ts`, `routes/quotations.ts`, `prisma/schema.prisma`, migration `20260912240000_quote_template_snapshot`, `__tests__/hotel-inventory-templates.test.ts`, `scripts/audit-phase13-hotel-templates.mjs`

**Frontend:** `quotation-wizard.tsx`, `quote-template-builder.tsx`, `lib/api.ts`

**Docs:** `QA/functional/PHASE_13_HOTEL_INVENTORY_TEMPLATES.md`

## 23. Final verdict

| Gap | Verdict |
| --- | --- |
| HT-04 | **PASS** (catalogue enforcement; live supplier **NOT IMPLEMENTED** by design) |
| TM-02 | **PASS** (merge + snapshot; package-level template entities **NOT IMPLEMENTED**) |

| Status | Count |
| --- | --- |
| PASS | 155 (+ typechecks) |
| FAIL (new) | 0 |
| BLOCKED / ENVIRONMENT | smoke SEED; live Amadeus |
| PRE-EXISTING | forgot-password; legacy flight source |
| NOT IMPLEMENTED | Live hotel GDS inventory; reservation holds; package-entity templates |

Phase 13 stop condition met.
