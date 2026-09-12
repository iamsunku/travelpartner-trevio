# Phase 7 — Quotation version control and revision history

## 1. Scope

Immutable, traceable quotation versioning integrated with Phase 1 approval, Phase 5 PDF, and Phase 6 email/WhatsApp. Phases 1–6 behavior preserved. Stop after Phase 7.

## 2. Existing version/revision behavior discovered

Partial versioning already existed:

- `QuotationVersion` table with JSON `snapshot`, unique `(quotationId, versionNumber)`
- `snapshotVersion()` created versions only on **manual** create, revision request, or restore
- Wizard saves **did not** version (VER-02 missing)
- First auto-snapshot used `currentVersion + 1`, so Version 1 often never existed as a row
- Agents were forbidden from listing versions
- Restore replaced live packages and did not consistently invalidate approval
- PDFs/deliveries were not linked to a version number

## 3. Version data model

Extended existing `QuotationVersion` (unchanged core shape) plus linkage fields:

| Table | New fields |
| --- | --- |
| `QuotationDocument` | `versionNumber`, `quotationVersionId` |
| `QuotationShare` | `versionNumber` |

Live quotation remains editable via `currentVersion`. Historical rows are append-only.

## 4. Snapshot strategy

`buildVersionSnapshot()` stores structured quote + packages (hotels, flights, transfers, activities, meals, itinerary, inclusions/exclusions, pricing JSON, tax fields, terms). It drops volatile `versions` / `shares` / `documents` / `revisions` and strips approval **comments** from embedded approval summaries.

Historical pricing is the stored Phase 3 `pricing` JSON — not recalculated from today’s catalogue.

Agent/customer reads go through `sanitizeVersionSnapshot()` (same sanitizer family as Phase 1).

## 5. Immutability

- No PATCH/PUT on version rows
- Updates create a **new** version number
- Restore creates checkpoint + new current version; historical row untouched
- Tests assert snapshot builders freeze package content and strip mutable relation bags

## 6. Revision boundary

Server-side `hasMeaningfulQuotationChange()` / `materialFingerprint()` ignore wizard step, status-only flips, and internal notes.

Meaningful changes include travel dates, destination, travellers, package contents, markups, tax/totals, terms, inclusions/exclusions, etc.

Hooks:

- Quote create → `ensureInitialQuotationVersion` (Version 1)
- Wizard PUT → `recordQuotationRevisionIfNeeded`
- Agent PATCH → same
- Agent create paths → initial Version 1
- Manual POST `/versions` still available for staff

No-op saves do not create uncontrolled versions (aside from ensuring Version 1 exists once).

## 7. Approval interaction

On material change when status/approval was released or pending/approved:

- Delete approval rows
- Set `status = In Progress`, `approvalStatus = Draft`
- New version recorded
- `quoteSendBlockReason` then blocks customer delivery until re-approval

Does **not** auto-approve. Does **not** bypass Team Lead/Finance.

## 8. PDF interaction

Customer/preview PDFs store `versionNumber` + `quotationVersionId`. Filename includes `v{N}`. Append-only storage preserved: Version 2 does not overwrite Version 1 files. Delivery reuses PDF only when `versionNumber` matches `currentVersion`.

## 9. Email/WhatsApp interaction

`QuotationShare.versionNumber` records which version/document was delivered. Historical deliveries remain. No automatic resend.

## 10. API security

| Endpoint | Access |
| --- | --- |
| `GET /api/quotations/:id/versions` | Auth + quote access; agents allowed with sanitized list metadata |
| `GET /api/quotations/:id/versions/:versionNumber` | Auth + quote access; sanitized snapshot for agents |
| `POST /api/quotations/:id/versions` | Staff only |
| `POST /api/quotations/:id/versions/:vid/restore` | Staff only; creates new revision, invalidates approval |

Unauthorized quotes → 404. No customer unrestricted history API.

## 11. Frontend changes

Quotation detail “Validity & versions”:

- Lists version number, status context, summary, creator, timestamp
- **View** opens read-only historical summary
- **Restore** (staff) creates a new current revision and refreshes list
- Agents can view authorized history (sanitized)

## 12. Migration / backfill

Migration `20260912200000_quotation_versioning`:

1. Adds document/share version columns
2. Inserts **Version 1** for quotes with zero version rows, using current live scalars only (`legacyBackfill: true`) — does **not** invent earlier unknown revisions
3. Syncs `currentVersion` to `max(versionNumber)`

Applied successfully (`finished_at` 2026-09-12).

## 13. Tests

`backend/src/__tests__/quotation-versions.test.ts` — 8 PASS covering D/E/F/C/L/N/G-H/M.

Regression (Phase 1–7 relevant): **70 PASS**.

| Suite | Result |
| --- | --- |
| quotation-versions | PASS |
| quotation-delivery | PASS |
| quotation-pdf | PASS |
| documents | PASS |
| pricing | PASS |
| contracted-rates | PASS |
| quote-access | PASS |
| Backend `tsc --noEmit` | PASS |

## 14. Known limitations

- Legacy Version 1 backfill is a reduced JSON of current state, not a full package tree reconstruction for ancient quotes
- Full package tree for brand-new versions comes from live `QUOTE_INCLUDE` at save time
- No dedicated customer portal version browser
- Concurrent double-saves could race on version numbers (unique constraint protects integrity)

## 15. Known pre-existing failures

| Issue | Classification |
| --- | --- |
| Smoke `SEED_DEMO_PASSWORD` unset | BLOCKED / PRE-EXISTING |
| Smoke forgot-password timeout | PRE-EXISTING |
| Frontend `bookings.tsx` `operations_executive` | PRE-EXISTING |

## 16. Files changed

- `backend/src/lib/quotation-versions.ts` (new)
- `backend/src/lib/quotations.ts` (removed old snapshotVersion)
- `backend/src/lib/quotation-pdf/index.ts`
- `backend/src/lib/quotation-delivery/index.ts`
- `backend/src/routes/quotations.ts`
- `backend/src/__tests__/quotation-versions.test.ts`
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260912200000_quotation_versioning/migration.sql`
- `frontend/src/lib/api.ts`
- `frontend/src/components/views/quotations.tsx`
- `QA/functional/PHASE_07_VERSIONING.md`

## 17. Database migrations

`20260912200000_quotation_versioning` — **applied**.

## 18. Final verdict

**PASS** for Phase 7: deterministic immutable versions, meaningful save boundary, approval invalidation, PDF/delivery version linkage, secured history APIs, minimal UI.

Counts:

| Status | Count |
| --- | --- |
| PASS | 70 (Phase 1–7 relevant) |
| FAIL | 0 new |
| BLOCKED | live smoke login (pre-existing) |
| PRE-EXISTING | 2 smoke + 1 frontend typecheck |
| NOT IMPLEMENTED | Phase 8+ (expiry automation, portal, etc.) |

---

**STOP.** Phase 7 complete.
