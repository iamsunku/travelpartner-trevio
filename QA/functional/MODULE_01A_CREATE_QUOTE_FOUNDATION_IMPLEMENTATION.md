# MODULE 01A — Create Quote Basic Details + Trip Plan Foundation

**Status:** Implemented (code + unit tests + typechecks).  
**Date:** 2026-09-16  
**Scope:** QuotationWizardDialog Basic Details foundation only. No reminder scheduler, hotel redesign, PDF/email redesign, or booking conversion redesign.

---

## 1. Files changed

### Backend
| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Added `rooms`, `nationality`, `landOnly`, `estimatedBookingDate`, `tripCities` on `Quotation` |
| `backend/prisma/migrations/20260916120000_quote_create_basics_foundation/migration.sql` | Additive migration |
| `backend/src/lib/quote-trip-cities.ts` | **New** — normalize / nights / destination label helpers |
| `backend/src/lib/validation.ts` | Zod fields for new basics + `tripCities` |
| `backend/src/lib/quotation-versions.ts` | Material fingerprint keys include new fields |
| `backend/src/routes/quotations.ts` | Wizard POST/PUT, duplicate, version restore; `resolveTripBasicsFromBody` |
| `backend/src/__tests__/quote-create-basics.test.ts` | **New** focused Module 01A tests |

### Frontend
| File | Change |
|------|--------|
| `frontend/src/components/views/quotation-wizard.tsx` | Basic Details UI + payload + hotel/flight defaults + catalogue star init |
| `frontend/src/types/index.ts` | Quotation / draft types |
| `frontend/src/lib/api.ts` | API quotation type |
| `frontend/src/lib/api-mappers.ts` | Map GET → UI model |

### Unchanged by design
Quotation status machine, approval, PDF, email/WhatsApp, pricing engine internals, Travel Proposals, InternationalQuotationDialog free-text departure, booking conversion (beyond restore/duplicate carrying new fields).

---

## 2. Schema changes

On `Quotation`:

| Field | Type | Notes |
|-------|------|--------|
| `departureCity` | `String?` | **Already existed** — reused |
| `hotelStarPreference` | `String?` | **Already existed** — reused |
| `rooms` | `Int?` `@default(1)` | Quote-level room count (new) |
| `nationality` | `String?` | Guest nationality (new) |
| `landOnly` | `Boolean` `@default(false)` | Explicit flag; ≠ `isInternational` |
| `estimatedBookingDate` | `String?` | YYYY-MM-DD; field only |
| `tripCities` | `Json` `@default("[]")` | Trip Plan City Wise array |

Hotel-line `rooms` inside package JSON is unchanged.

---

## 3. Migration

**Path:** `backend/prisma/migrations/20260916120000_quote_create_basics_foundation/migration.sql`

```sql
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "rooms" INTEGER DEFAULT 1;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "nationality" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "landOnly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "estimatedBookingDate" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "tripCities" JSONB NOT NULL DEFAULT '[]';
```

**Deploy attempt (2026-09-16):** `npx prisma migrate deploy` failed with `P1001: Can't reach database server` (Supabase pooler unreachable from this environment). Migration file is ready; apply when DB is reachable.

**Prisma generate:** Failed with `EPERM` renaming `query_engine-windows.dll.node` (engine file locked by running Node processes). Existing generated client already includes the new fields; re-run `prisma generate` after stopping local API/dev servers if needed.

---

## 4. API changes

### End-to-end path
Frontend form → `POST/PUT /api/quotations/wizard` → validation / route normalization → Prisma → `GET` full quotation (with packages) → `mapApiQuotation` → wizard reload.

### Persisted on create (`POST /api/quotations/wizard`)
- `departureCity`, `rooms` (min 1), `hotelStarPreference`, `nationality`, `landOnly`, `estimatedBookingDate` (validated YYYY-MM-DD or null), `tripCities` (normalized JSON)

### Persisted on update (`PUT /api/quotations/wizard/:id`)
- Same scalars + `tripCities` when present in body
- When `tripCities.length > 0`, `destination` label syncs to `"City · City"` via helper (does **not** invent cities for legacy `[]`)

### Returned on GET / full
All new scalars + `tripCities` are Quotation columns; included in standard quotation responses / wizard save responses.

### Duplicate / version restore
Copy and restore paths include the new fields so history and clones stay consistent.

---

## 5. Frontend changes

### QuotationWizardDialog — Basic Details
Compact layout within existing wizard (wizard not replaced) adds:

- Customer / contact (existing)
- Departure City (`DestinationSelect` + display value → `departureCity`)
- Travel start/end (existing)
- Adults / Children / Infants (existing)
- **Rooms** (quote-level, min 1)
- **Hotel Star Rating**
- **Nationality** (`COUNTRIES_MASTER` country names)
- **Land Only** Yes/No
- **Estimated Booking Date**
- **Trip Plan City Wise** (add / remove / edit city + independent nights)

### Hotel catalogue / defaults
- Catalogue star filter **initializes** from `hotelStarPreference` when opened; user can change filter.
- New hotel lines default `rooms` from quote-level rooms.
- Self-booked hotel template uses quote rooms / preferred star.

### Flight default origin
- Flight template / API search / catalog row can prefill `from` from `departureCity`.
- User can still change flight origin later (not forced on later edits).

---

## 6. Multi-city data structure

Persisted as JSON on `Quotation.tripCities`:

```json
[
  { "city": "Phuket", "nights": 3, "order": 1, "destinationId": null },
  { "city": "Krabi", "nights": 2, "order": 2, "destinationId": "..." }
]
```

- Normalization: drop empty/invalid rows; nights ≥ 1; renumber `order`.
- Optional `destinationId` links destination master without a new city table.
- Display `city` string is snapshotted for historical versions.
- Total nights from cities drives quote `nights`/`days` when trip plan is present.
- Exposed on quotation API for the future Hotel module (city → nights stays). **Hotel module not redesigned in 01A.**

**Why JSON (not relational table):** smallest change aligned with existing package line JSON patterns; included wholesale in version snapshots; no redundant city-master tables.

---

## 7. Versioning integration

`QUOTE_MATERIAL_KEYS` now includes:

`rooms`, `nationality`, `landOnly`, `estimatedBookingDate`, `tripCities` (plus existing `departureCity`, `hotelStarPreference`).

Meaningful edits to these fields create version fingerprints / snapshots. Restoring a version restores the corresponding city/night structure and basics. Old snapshots are not mutated in place.

---

## 8. Legacy compatibility

| Case | Behavior |
|------|----------|
| Quotes with only `destination` | `tripCities = []`; load/edit unchanged; destination not silently rewritten |
| Missing `rooms` | Defaults to 1 |
| Missing `landOnly` | Defaults to `false` |
| Missing nationality / estimatedBookingDate / star | Nullable / empty; UI supplies sensible defaults on create |
| Hotel-line rooms | Unchanged; pricing still uses hotel-line rooms × nights |

---

## 9. Tests added

`backend/src/__tests__/quote-create-basics.test.ts`:

- **A** Departure city / star / nationality / landOnly / estimatedBookingDate via Zod + fingerprint
- **B** Rooms min validation; quote rooms ≠ hotel pricing
- **C** Hotel star in material change detection
- **D** Critical multi-city: Phuket 3 / Krabi 2 / Bangkok 2 → Phuket 4 → remove Bangkok; normalize + fingerprint
- **E–G** Nationality / Land Only / Estimated Booking Date in validation + versioning
- Agent sanitize keeps 01A fields; strips internal notes / cost / profit
- Version snapshot retains `tripCities` and basics
- Hotel-line pricing still `rooms × nights × unit`

---

## 10. Tests executed

```text
npx vitest run src/__tests__/quote-create-basics.test.ts \
  src/__tests__/quotation-versions.test.ts \
  src/__tests__/quotations.test.ts \
  src/__tests__/pricing.test.ts
```

**Result:** 4 files, **36 passed**, 0 failed.

No existing tests were weakened.

---

## 11. Typecheck

| Package | Command | Result |
|---------|---------|--------|
| Backend | `npx tsc -p tsconfig.json --noEmit` | **Pass** |
| Frontend | `npx tsc -p tsconfig.json --noEmit` | **Pass** |

---

## 12. Build result

| Package | Command | Result |
|---------|---------|--------|
| Frontend | `npx next build` | **Pass** (Next.js 16.2.10 Turbopack; compiled + TypeScript) |
| Backend | `npx tsc -p tsconfig.json --noEmit` | **Pass** |

**Note:** `prisma generate` / `migrate deploy` could not complete in this environment (DLL lock / DB unreachable). Code and migration SQL are in repo.

---

## 13. Remaining limitations

1. **Estimated Booking Date reminders** — not implemented (field foundation only).
2. **Sales expert auto-routing / notifications** — not implemented.
3. **Hotel module** — catalogue still destination-oriented; city-wise stay mapping for hotels is data-ready only.
4. **Land Only** — persisted flag only; does not clear flights or change PDF/booking conversion.
5. **Nationality** — stored as country name from `COUNTRIES_MASTER` (e.g. `India`), not demonym `Indian`.
6. **Departure city** — persisted as city name string (`departureCity`); destination master used for search UX, not a separate FK column.
7. **DB migration not applied** in this environment (connectivity). Deploy before exercising live create/reload against remote DB.
8. **No full HTTP integration test** against live wizard POST/GET (unit coverage of normalize / validation / versioning / pricing).

---

## 14. Business confirmation needed

1. Nationality label: country name (`India`) vs demonym (`Indian`) — confirm preferred stored value for visa/PDF later.
2. When Trip Plan City Wise is set, destination summary becomes `"Phuket · Krabi"` — confirm acceptable for lists/PDF until PDF redesign.
3. Should quote-level nights from cities **override** calendar start/end nights when both exist? Current: city nights win when trip plan present.
4. Land Only = Yes: confirm downstream Flight module should hide/block flights (not done here).
5. Estimated Booking Date: confirm independence rules vs travel start (currently independent; format YYYY-MM-DD only).

---

## Trace checklist (every new field)

| Field | UI | Payload | Validate | Prisma | GET | Mapper | Reload | Versions |
|-------|----|---------|----------|--------|-----|--------|--------|----------|
| Departure city | ✓ | ✓ | ✓ | existing | ✓ | ✓ | ✓ | ✓ |
| Rooms | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Hotel star | ✓ | ✓ | ✓ | existing | ✓ | ✓ | ✓ | ✓ + catalogue init |
| Trip cities | ✓ | ✓ | ✓ | ✓ JSON | ✓ | ✓ | ✓ | ✓ |
| Nationality | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Land Only | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Estimated booking date | ✓ | ✓ | date format | ✓ | ✓ | ✓ | ✓ | ✓ |

**Module 01A complete at foundation level.** Downstream modules (hotel city stays, flight land-only behavior, booking-date reminders) remain out of scope.
