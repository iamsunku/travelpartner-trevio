# Phase 16 — GST / Tax Consistency Audit and Remediation

## A. Initial audit findings

Phase 14 identified **hardcoded GST @ 18%** on alternate quote paths while the staff wizard used configurable `TaxRule` (Phase 3).

Pricing chain (unchanged):

`Contracted Cost → Trevio Markup → Trevio Selling Price → Agent Markup → Customer Price → Configured Tax`

## B. Every tax calculation path found

| Path | Location | Pre-Phase 16 | Classification |
| --- | --- | --- | --- |
| Wizard / freeze + `pricePackage` | `pricing.ts`, `quotations` routes | TaxRule via `loadActiveTaxRule` | **PASS** |
| Agent trip composer | `POST .../agent/trip` | TaxRule via `priceFrozenPackage` | **PASS** |
| Missing TaxRule gate | submit/share/accept/convert | Blocks with `TAX_CONFIGURATION_REQUIRED` | **PASS** |
| Customer PDF server | `quotation-pdf/*` | Uses stored `taxRate` / pricing layers | **PASS** |
| Booking conversion | `quotation-to-booking.ts` | Copies quote tax snapshot | **PASS** |
| Versioning / restore | `quotation-versions.ts` | Snapshots `taxRate`/`taxRuleId` | **PASS** |
| Template merge | `quote-template-merge.ts` | Feeds Phase 3 freeze (no tax invent) | **PASS** |
| Agent from-package | `quotations.ts` + `package-to-quotation.ts` | `taxRate: 18` + `0.18/1.18` invent | **FAIL** → fixed |
| Legacy `calcPackageCosting` | `quotations.ts` | `taxRate ?? 18` | **FAIL** → fixed |
| Quick create dialog | `quotations.tsx` | `* 0.18` | **FAIL** → fixed |
| Product quote builder | `product-quote-builder.tsx` | `* 0.18` | **FAIL** → fixed |
| International quote dialog | `international-quotation.tsx` | `* 0.18` | **FAIL** → fixed |
| Product PDF helper | `product-quotation-pdf.ts` | invent `0.18` | **FAIL** → fixed |
| Classic intl PDF label | `quotation-pdf.ts` | hardcoded “GST @ 18%” label | **FAIL** → fixed |
| Destination plan copy | `destination-quote-plans.ts` | “Includes GST 18%” text | Copy only → updated |
| Unit test fixture | `quotations.test.ts` `taxRate: 18` | Explicit test input | **NOT APPLICABLE** |
| CSS `0.18em` / rgba | hotels/flights/login | Not tax | **NOT APPLICABLE** |
| Mock demo quotes | `mock-data.ts` gst amounts | Static demo rows | **PRE-EXISTING** / display data |

## C. What was already correct

- Phase 3 `taxForRule` / `pricePackage` — no default rate; missing rule → unresolved + finalization blocked
- Agent trip composer already used TaxRule
- Server customer PDF / delivery / conversion use stored quotation tax layers
- Historical versions keep original commercial tax fields

## D. What was hardcoded (remediated)

1. `agent/from-package` wrote `taxRate: 18`
2. `package-to-quotation.ts` invented inclusive 18% when `pkg.tax` missing
3. `calcPackageCosting` defaulted `?? 18`
4. Frontend alternate builders/PDFs calculated or labeled 18%

## E. Changes made

**Backend**

- `calcPackageCosting`: no invent; missing rate → `gst = 0`
- `package-to-quotation`: no `0.18/1.18` invent
- `agent/from-package`: freeze + `priceFrozenPackage` + TaxRule; stores `taxRate`/`taxRuleId`/`pricing`
- Agent trip also persists `taxRuleId`
- `stripAgentPricingOverrides`: strips `taxRate`, `taxRuleId`, `taxAmount`, `gst`

**Frontend**

- `lib/tax-config.ts`: `pickActiveTaxRule` / `taxFromConfiguredRule` (no invent)
- `api.getTaxRules`
- Quick create / product builder / international dialog load TaxRule; show “configuration required” when absent
- PDF helpers use configured tax only; dynamic label
- Destination plan terms copy no longer claims GST 18%

**Not changed**

- Pricing chain / TaxRule model
- Historical quotation/version/booking rows (no rewrite)
- Demo TaxRule seeding (still ops/data responsibility)

## F. Tests

`backend/src/__tests__/gst-tax-consistency.test.ts`

| # | Case | Result |
| --- | ---: | --- |
| 1 | TaxRule rate used | **PASS** |
| 2 | Changing TaxRule changes tax | **PASS** |
| 3–4 | No rule → no 18%/5% fallback | **PASS** |
| 5 | Totals correct | **PASS** |
| 6 | Customer-safe tax fields | **PASS** |
| 7 | Conversion tax shape | **PASS** |
| 8 | Agent cannot set tax overrides | **PASS** |
| 9–10 | Internal/customer visibility | **PASS** |
| 11 | Legacy costing no invent | **PASS** |

| Suite | Result |
| --- | --- |
| Phase 16 + pricing + quotations unit | **25 PASS** |
| Phase 1–16 relevant regression (16 files) | **175 PASS** |
| Backend `tsc` | **PASS** |
| Frontend `tsc` | **PASS** |

## G. Repository-wide verification (post-fix)

Executable invent of 18% in `backend/src` and `frontend/src` tax paths: **none remaining**.

Remaining mentions (not executable tax invent):

| Item | Class |
| --- | --- |
| Comment in `package-to-quotation.ts` (“Never invent GST @ 18%”) | Documentation |
| `quotations.test.ts` explicit `taxRate: 18` fixture | **NOT APPLICABLE** |
| CSS `tracking-[0.18em]` / `rgba(...,0.18)` | **NOT APPLICABLE** |
| `mock-data.ts` static gst demo figures | **PRE-EXISTING** demo data |

## H. Remaining tax-related limitations

| Item | Class |
| --- | --- |
| Demo DB may still have **0 TaxRules** | **DATA LIMITATION** — drafts OK; finalize blocked until finance configures rules |
| Alternate UI builders still demo-store saves (not full wizard pipeline) | **PARTIAL** UX; tax display now TaxRule-based |
| Live Email/WhatsApp / Amadeus | Out of scope (**ENVIRONMENT**) |
| Smoke `SEED_DEMO_PASSWORD` / forgot-password | **PRE-EXISTING** |

## I. Final verdict

| Item | Result |
| --- | --- |
| Hardcoded GST invent removed from calculation paths | **PASS** |
| TaxRule remains authoritative | **PASS** |
| Pricing chain preserved | **PASS** |
| Historical commercial data not rewritten | **PASS** |
| New FAIL | **0** |

**STOP** after Phase 16. Do not start Phase 17.

Report path: `QA/functional/PHASE_16_GST_TAX_CONSISTENCY.md`
