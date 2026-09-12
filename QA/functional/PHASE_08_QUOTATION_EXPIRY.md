# Phase 8 — Quotation expiry and expiry automation

## 1. Scope

Reliable **server-side** quotation expiry for Trevio Global, integrated with Phases 1–7 (access isolation, approval, contracted rates, costing, documents, PDF, email/WhatsApp, versioning). No Phase 9+ features. Quotation data model not redesigned; `validTill` preserved.

## 2. Existing expiry behavior discovered

| Area | Finding |
| --- | --- |
| Field | `Quotation.validTill` is a **string** `YYYY-MM-DD` (not DateTime) |
| Logic | `expireDueQuotations` expired when `validTill < today` (UTC ISO date) |
| Trigger | Opportunistic on quotation **list** load + admin `POST /api/quotations/expire-due` |
| Scheduler | **None** (no cron/queue) |
| Eligible statuses (pre-Phase 8) | `Sent to Agent`, `Sent`, `Customer Reviewing` only |
| Matrix | LC-09 / EXP-01 PARTIAL; EXP-02 MISSING (no reminder email) |
| Extend | `POST /:id/extend` could revive Expired → `Sent to Agent` (**approval bypass**) |
| Gates | Send/PDF/delivery already blocked `Expired`; accept/convert blocked `Expired` |
| Versions | Restore did not refresh stale `validTill` |

## 3. Expiry semantics

**Rule (unchanged convention):** a quotation is past validity when:

```text
validTill (YYYY-MM-DD) < calendarDateUtc(now)
```

- `validTill === today` remains **valid** through the end of that UTC calendar day.
- Equality uses string comparison of ISO dates (same as pre-Phase 8).
- Deterministic; no tenant timezone field exists in the product — UTC calendar dates are the project convention (same as `toISOString().slice(0, 10)` elsewhere).

New optional audit field: `expiredAt` set when the job (or admin expire-due) successfully transitions status to `Expired`.

## 4. Eligible status transition matrix

| Current status | Auto → Expired when past validTill? | Notes |
| --- | --- | --- |
| Draft | No | EXP-01: Draft not expired |
| In Progress | No | Not in state-machine → Expired |
| Pending Approval | No | Not eligible |
| Sent to Agent | **Yes** | Existing |
| Sent (legacy) | **Yes** | Alias of Sent to Agent |
| Customer Reviewing | **Yes** | Existing |
| Revision Requested | No | Must return to In Progress / Pending Approval |
| Accepted | **Yes** | Allowed by `STATUS_TRANSITIONS`; blocks conversion after expiry |
| Rejected | No | Never silently mutated |
| Expired | No | Idempotent; stays Expired |
| Converted to Booking | **Never** | State machine forbids; query excludes |
| Archived | No | Terminal archive |

Manual status → Expired still requires `canTransition` (agents cannot choose Expired).

## 5. Scheduler / job implementation

| Piece | Path |
| --- | --- |
| Expiry service | `backend/src/lib/quotation-expiry.ts` |
| In-process poller | `backend/src/lib/quotation-expiry-scheduler.ts` |
| Boot | `backend/src/server.ts` calls `startQuotationExpiryScheduler()` after listen |

Config (`.env.example`):

- `QUOTE_EXPIRY_SCHEDULER` — set `false` to disable
- `QUOTE_EXPIRY_POLL_MS` — default `60000` (min 10000)
- `QUOTE_EXPIRY_STARTUP_DELAY_MS` — default `5000`
- Disabled automatically when `NODE_ENV=test`

Opportunistic list-load + admin `expire-due` retained as secondary triggers.

## 6. Idempotency / concurrency handling

- Selection filters: `deletedAt: null`, eligible statuses, `validTill < today`
- Each row updated via `updateMany` re-checking the same predicates
- If another worker already expired the row → `count === 0` → skip notify (`skipped++`)
- Per-row try/catch so one failure does not abort the batch
- In-process mutex prevents overlapping ticks in one process
- Re-runs are safe: already Expired rows are not selected

## 7. Versioning interaction

- Expiry updates **live** quotation status only; historical `QuotationVersion` snapshots are never rewritten
- Restore creates a new current revision at `In Progress` / `Draft` approval
- If restored snapshot `validTill` is past, restore assigns `freshValidTill()` (+7 UTC days) and clears `expiredAt`
- Does not inherit Expired status or prior approval

## 8. Approval interaction

- Expiry does not grant send/convert privileges
- Renew (`extend`) from Expired now returns to **In Progress** + **Draft** approval and clears approval rows (no more silent `Sent to Agent`)
- New revisions after expiry follow the existing approval workflow

## 9. PDF / email / WhatsApp interaction

- Customer-mode PDF / email / WhatsApp use `quoteSendBlockReason`, which now also blocks **past `validTill`** on eligible statuses (defense in depth before the job runs)
- Historical PDFs, shares, and delivery records are retained (append-only; not deleted on expiry)
- Preview/internal PDF remains available under existing auth rules

## 10. Notification behavior

| Kind | Status |
| --- | --- |
| Automatic status → Expired | Implemented (server job) |
| In-app `notifyQuote` on transition | Implemented (existing) |
| Pre-expiry reminder email | **NOT IMPLEMENTED** — EXP-02 specifies no configured reminder period; policy not invented |
| Customer-facing expiry email | **NOT IMPLEMENTED** |

## 11. Timezone / date handling

- Convention: **UTC calendar date** strings
- Tests cover just-before, exactly-on, just-after, and UTC midnight boundary
- No tenant/branch timezone field in schema — not invented here

## 12. Manual expiry behavior

- `POST /api/quotations/expire-due` — `super_admin` / `agency_admin` only; agency-scoped; returns `{ expired, scanned, skipped, errors, today }`
- Agents cannot call expire-due (role gate)
- Agents cannot status-transition to Expired (agent allow-list)
- Idempotent via same service as the scheduler

## 13. Security tests

| ID | Case | Result |
| --- | --- | --- |
| A/B | Unauthorized/agent cannot use admin expire / agent cannot target Expired | **PASS** (role + transition allow-list assertions) |
| C/D/E | Expired / past validTill blocked for send (email/WA/customer PDF gate) | **PASS** |
| F | Accept blocked when expired / past validity | **PASS** (helper + route) |
| G | Convert blocked when expired / past validity | **PASS** |
| H | Converted never → Expired | **PASS** |
| I | Expiry does not bypass approval | **PASS** |
| J/M | Historical snapshots sanitized; no internal leak | **PASS** |
| K/L | Historical PDF/delivery retention | **PASS** by design (no delete paths added) |
| N | Job re-run idempotent | **PASS** |
| O | Concurrent lost race skips notify | **PASS** |

Phase 8 file: **20 PASS** (`quotation-expiry.test.ts`).

## 14. Regression tests

| Suite | Result |
| --- | --- |
| quote-access, contracted-rates, pricing, documents, quotation-pdf, quotation-delivery, quotation-versions, quotations, quotation-expiry | **PASS** (96 tests in combined run excluding smoke failures) |
| Phase 8 only | **20 PASS** |
| Backend `tsc --noEmit` | **PASS** |
| Frontend `tsc --noEmit` | **PRE-EXISTING FAIL** — `bookings.tsx` `operations_executive` |
| Smoke SEED_DEMO_PASSWORD | **BLOCKED** (pre-existing) |
| Smoke forgot-password | **PRE-EXISTING** timeout |

Counts for this phase run:

| Status | Count |
| --- | --- |
| PASS | 96 (+ backend typecheck) |
| FAIL (new) | 0 |
| BLOCKED | 1 (SEED_DEMO_PASSWORD) |
| PRE-EXISTING FAIL | 2 (forgot-password timeout; frontend bookings.tsx) |
| NOT IMPLEMENTED | Pre-expiry reminder email (EXP-02) |

## 15. Database migration / indexes

Migration: `backend/prisma/migrations/20260912210000_quotation_expiry/migration.sql`

- `Quotation.expiredAt` TIMESTAMP (nullable) — no invented historical backfill
- Index `(status, validTill)` for job queries
- Index `(expiredAt)`
- Applied successfully via `prisma migrate deploy`

## 16. Frontend changes

Minimal updates in `frontend/src/components/views/quotations.tsx`:

- Valid Till shows Expired emphasis
- Email / WhatsApp disabled when status is Expired (share dialog + detail)
- Banner: renew + re-approve before send/convert
- Convert already gated to Accepted only (Expired never offered)

Backend remains authoritative.

## 17. Known limitations

- Pre-expiry reminder emails not implemented (no specified lead time)
- Scheduler is in-process interval (not Redis/Bull); multi-instance safety via conditional `updateMany`
- UTC date convention only (no per-tenant TZ)
- List load still runs opportunistic expiry (harmless duplicate of scheduler)

## 18. Known pre-existing failures

- Smoke: `SEED_DEMO_PASSWORD` unset → **BLOCKED**
- Smoke: forgot-password ~5s timeout → **PRE-EXISTING**
- Frontend: `bookings.tsx` role comparison `operations_executive` → **PRE-EXISTING**

## 19. Files changed

**Backend**

- `src/lib/quotation-expiry.ts` (new)
- `src/lib/quotation-expiry-scheduler.ts` (new)
- `src/lib/quotations.ts` (re-export; removed inline expire loop)
- `src/lib/quote-access.ts` (validTill on send/convert gates)
- `src/lib/quotation-expiry` wired from `routes/quotations.ts`, `routes/bms.ts`, `server.ts`
- `prisma/schema.prisma`, migration `20260912210000_quotation_expiry`
- `.env.example`
- `__tests__/quotation-expiry.test.ts` (new)

**Frontend**

- `src/components/views/quotations.tsx`

**Docs**

- `QA/functional/PHASE_08_QUOTATION_EXPIRY.md` (this file)

## 20. Final verdict

**PASS** — Phase 8 delivers deterministic, idempotent, server-side quotation expiry with safe integration into approval, versioning, PDF, email, WhatsApp, accept, and convert rules. Stop condition met; Phase 9+ not implemented.
