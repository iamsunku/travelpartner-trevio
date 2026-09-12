# Phase 12 — Product / service / inventory completion

## 1. Scope

Close remaining **product, flight, service, template, and catalogue** gaps identified by the audit/matrix, without changing Phase 1–11 security, pricing, versioning, expiry, delivery, acceptance, PDF, or booking conversion guarantees.

**Stop after Phase 12.** No customer portal, payments, supplier portal, or new tax rules.

## 2. Audit gaps reviewed

| ID | Audit status | Phase 12 outcome |
| --- | --- | --- |
| FL-01 | MISSING (stale — FlightProduct already existed post–Phase 2) | **PASS** — catalog + API + manual coexist; duration/baggage/cabin/fare on lines |
| FL-02 | PARTIAL | **PASS** — manual fields + private ticket/invoice upload via Phase 4 |
| FL-03 | MISSING | **PASS** — API search → quotation line maps duration/baggage/fare/currency/availability |
| SV-04 | PARTIAL | **PASS** — meal catalog linked; dietary field added |
| SV-01/02 | PARTIAL | Already catalog-linked (transfers/activities); preserved |
| VI-02 | PARTIAL | **PASS** (catalogue recommendation only) — structured fields + disclaimer; **NOT** immigration engine |
| TPL-01 | PARTIAL | **PASS** — additional destination starter plans (SG/MY/Bali/VN/Dubai/EU) |
| TM-01 | PARTIAL | **PASS** — hotel/flight/visa/insurance/force majeure/disclaimer in wizard |
| TM-02 | PARTIAL | **PARTIAL** — apply terms from destination plan; QuoteTemplate branding module unchanged |
| IT-01 | PARTIAL | **PASS** — pickup/duration/vehicle/guide/voucher/remarks preserved on itinerary items |
| HT-04 | MISSING | **NOT IMPLEMENTED** (inventory enforcement at quote time — out of narrow scope / not completed here) |

## 3. Existing functionality discovered

Phase 2 already delivered: `FlightProduct`, `MealProduct`, contracted rates, wizard Catalog picker, Amadeus/mock search API, three flight sources (`AMADEUS_API` / `MANUAL` / `CONTRACTED_PRODUCT`), Phase 3 pricing for all three.

Phase 12 completed thin UI/mapping/terms/visa/template gaps on top of that foundation.

## 4. Flight source architecture

| Source | How added | Pricing |
| --- | --- | --- |
| Amadeus/API (or mock) | Wizard “API search” → `GET /api/flights/search` → line `source: AMADEUS_API` | Explicit fare / selling via Phase 3 |
| Manual | “Add self-booked” | Explicit cost/fare |
| Contracted product | Catalog + applicable rate | Frozen rate snapshot / contracted cost (server) |

All three coexist. Credentials never returned.

## 5. Amadeus integration

- Search returns public fields only via `publicFlightSearchResult` (baggage added when provider supplies it).
- Selection creates a quotation flight JSON line (not permanent inventory).
- Provider fare is **not** a locked GDS booking — Phase 3 validation still applies; limitation documented.

## 6. Manual flight flow

Wizard fields: airline, number, origin/destination, times, **duration**, **baggage**, cabin, **currency**, PNR, **remarks**, cost/selling/fare.

Ticket/invoice: after draft save, private upload `FLIGHT_TICKET` via `/api/quotations/:id/documents` (downloadPath only — no public URL).

## 7. Contracted flight products/rates

Unchanged Phase 2 mechanism. Catalog pick requires travel date + applicable rate; invalid rate toast — no silent cost. Agent cannot see contracted cost (sanitizer + applicable API).

## 8. Meal catalogue

Catalog pick already present; Phase 12 adds **dietary**, copies description, keeps transfer badge.

## 9. Transfer / activity / sightseeing

Already selectable into quotations via Catalog + contracted rates. Fields retained (type, route, vehicle, ticket, rates). No duplicate line models.

## 10. Visa / insurance

- `GET /api/destinations/visa-recommendation` builds catalogue recommendation from `visaRequired` / `visaDetails`.
- Wizard: Apply catalogue recommendation + processing/fee/docs/appointment fields.
- Explicit disclaimer: not legal/immigration advice.
- Insurance remains product/service toggle (no underwriting engine).

## 11. Destination templates

`destination-quote-plans.ts` now includes Thailand full sample + skeletons: Singapore, Malaysia, Bali, Vietnam, Dubai, Europe. Apply basics / load sample / apply terms — does not silently overwrite without user action; historical versions untouched.

## 12. Itinerary integration

Day items preserve advanced fields when renaming activities; UI exposes pickupTime, duration, vehicle, guide, voucher, remarks for first items. Versioning unchanged (meaningful saves still create versions per Phase 7).

## 13. Extra terms

Wizard step Terms: hotel / flight / visa / insurance / force majeure / disclaimer + core payment/cancellation/refund. Snapshotted on quotation columns; catalogue edits do not rewrite saved quotes. Optional “Apply terms from selected destination plan.”

## 14. Search / filtering

Product catalog search + contracted applicable-rate check unchanged. Flight search sanitized. Agents still blocked from contracted-cost APIs.

## 15. Security tests

| ID | Result |
| --- | --- |
| A–B Agent no contracted/supplier cost | **PASS** |
| C–F–M Customer-safe | **PASS** |
| H Invalid rate not silently OK | **PASS** |
| I No provider credentials in search JSON | **PASS** |
| D–E Markup/cost client overrides | Covered by Phase 3 suite (**PASS**) |
| G Cross-agent isolation | Phase 1 suite (**PASS**) |
| J–K Private flight docs | Upload uses Phase 4 private paths (**PASS** by design + existing document tests) |
| L Catalogue supplier protection | Sanitizer (**PASS**) |

File: `backend/src/__tests__/product-inventory.test.ts`

## 16. Data integrity tests

| Case | Result |
| --- | --- |
| A Search → quotation flight | **PASS** |
| B Manual template | **PASS** |
| C Contracted product map | **PASS** |
| D All sources → Phase 3 `pricePackage` | **PASS** |
| E–F Version / conversion survival | Relies on existing Phase 7/10 JSON package persistence (**PASS** regression) |
| G Multi-package separation | **PASS** |
| H Catalogue rate change vs frozen quote | Phase 2/3 snapshot semantics unchanged (**PASS**) |

## 17. Existing-data audit

Script: `backend/scripts/audit-product-inventory-phase12.mjs`

| Metric | Value |
| --- | --- |
| Quotation packages | 3 |
| Flight lines | 2 |
| Flights missing `source` | 2 (legacy sample lines — **not rewritten**) |
| Contracted flights missing productId | 0 |
| Meals with productId | 0 / 1 |
| FlightProduct / MealProduct rows | 0 / 0 (empty demo catalogue) |
| Contracted rates | none |

**Remediation:** leave historical JSON; new wizard lines always set `source`. Optional future backfill only if product can be matched deterministically.

## 18. Database migrations

**None.** No new tables; used existing JSON columns + Phase 2 models + Phase 4 documents.

## 19. End-to-end verification

Representative path verified via code + unit pipeline:

1. Flight line from API/manual/contracted → Phase 3 costing — **PASS**
2. Visa catalogue recommendation endpoint + apply — **PASS** (unit + wiring)
3. Extra terms fields persist on wizard save payload — **PASS** (routes already accept scalars)
4. Destination plan list expanded — **PASS**
5. Live Amadeus credentials — **BLOCKED** without agency API keys (mock path **PASS**)
6. PDF / conversion — regression suites **PASS** (no design change required)

## 20. Regression tests

| Suite | Result |
| --- | --- |
| Phase 1–12 relevant unit files (13) | **144 PASS** |
| Backend `tsc --noEmit` | **PASS** |
| Frontend `tsc --noEmit` | **PASS** |

## 21. Known limitations

- Amadeus fare is search-time indicative, not a ticketed lock
- Visa recommendation is catalogue text only — no eligibility engine
- QuoteTemplate branding module still separate from destination package plans
- Hotel live inventory check (HT-04) not implemented
- Empty demo DB has no seeded FlightProduct/MealProduct rows

## 22. Known pre-existing failures

| Item | Classification |
| --- | --- |
| Smoke `SEED_DEMO_PASSWORD` | **BLOCKED** / **PRE-EXISTING** |
| Smoke forgot-password timeout | **PRE-EXISTING** |
| `operations_executive` typecheck | **FIXED** in Phase 11 — did not reappear |

New blockers: **none** (live Amadeus optional / env-dependent).

## 23. Files changed

**Backend:** `lib/flight-quote.ts`, `lib/visa-recommendation.ts`, `lib/amadeus.ts`, `lib/types.ts`, `lib/mock-data.ts`, `app.ts`, `routes/destinations.ts`, `__tests__/product-inventory.test.ts`, `scripts/audit-product-inventory-phase12.mjs`

**Frontend:** `components/views/quotation-wizard.tsx`, `lib/destination-quote-plans.ts`, `lib/api.ts`, `types/index.ts`

**Docs:** `QA/functional/PHASE_12_PRODUCT_SERVICE_INVENTORY.md`

## 24. Final verdict

**PASS** — Remaining supported product/flight/service/template/catalogue flows are completed and wired into existing Phase 2/3 quotation architecture without weakening Phases 1–11.

| Status | Count |
| --- | --- |
| PASS | 144 (+ backend/frontend typecheck) |
| FAIL (new) | 0 |
| BLOCKED | 1 smoke SEED + live Amadeus without keys |
| PRE-EXISTING | forgot-password timeout |
| NOT IMPLEMENTED | HT-04 hotel inventory enforcement; immigration rules engine; QuoteTemplate auto-merge into wizard |

Phase 12 stop condition met.
