# Phase 11 — Booking management / operational handoff

## 1. Scope

Harden the **post-conversion booking** into a complete, secure, operationally usable record for authorized internal teams. Preserve Phases 1–10. No customer portal, payment gateway, supplier portal, or new BMS platform. **Stop after Phase 11.**

## 2. Existing booking functionality discovered

| Area | Finding |
| --- | --- |
| Model | `Booking` with passengers, services, add-ons, documents, invoices, payouts, itinerary JSON, terms, pricing snapshot, assignees |
| Conversion | Phase 10 `convertQuotationToBooking` → initial status `Awaiting Passenger Details`, unique `quotationId`, `quotationVersionNumber`, locked pricing |
| Detail API | `GET /api/bookings/:id/full` (+ list/PATCH/cancel in `app.ts`, BMS routes in `bms.ts`) |
| UI | `frontend/.../bookings.tsx` overview / passengers / travel / ops / finance tabs |
| Ops tasks | Seeded on conversion; Task model linked by `bookingId` |
| Documents | Phase 4 private storage; booking document routes with visibility |
| Roles | Real ops slug is **`operations`** (not `operations_executive`) |

## 3. Booking status machine

Existing BMS terminology (not invented New/In Progress-only set):

```
Draft → Awaiting Passenger Details | Pending Initial Payment | Cancelled
Awaiting Passenger Details → Pending Initial Payment | Partially Paid | Payment Received | In Progress | Cancelled
Pending Initial Payment → Partially Paid | Payment Received | Awaiting Passenger Details | Cancelled
Partially Paid → Payment Received | In Progress | Cancelled
Payment Received → In Progress | Partially Confirmed | Confirmed | Cancelled
In Progress → Partially Confirmed | Confirmed | Travel Documents Ready | Completed | Cancelled
Partially Confirmed → Confirmed | In Progress | Travel Documents Ready | Cancelled
Confirmed → Travel Documents Ready | In Progress | Completed | Cancelled
Travel Documents Ready → Completed | Cancelled
Completed → ∅ (terminal)
Cancelled → ∅ (terminal)
```

Legacy aliases retained: `Pending`, `Ticketed`, `Refunded`, `Failed`.

Enforcement: `canTransitionBooking` on PATCH, soft-cancel DELETE, mark-documents-ready, complete. Admin override only for `super_admin` / `agency_admin` with `override: true`.

**Initial conversion status:** `Awaiting Passenger Details` — **PASS**

## 4. Access / role matrix

| Role | View bookings | Edit / status | Assign | Ops queue / tasks | Supplier / cost | Customer-safe fields |
| --- | --- | --- | --- | --- | --- | --- |
| Super Admin | Agency-wide | Yes (+ override) | Yes | Yes | Yes | N/A |
| Agency Admin | Agency-wide | Yes (+ override) | Yes | Yes | Yes | N/A |
| Branch Manager | Branch scope | Yes | Yes | Yes | Yes | N/A |
| Team Lead | Agency (perms) | Yes (bookings CRUD) | No* | If tasks perm | Yes | N/A |
| Sales Executive | Agency/branch | Limited assign | Yes | No queue | Yes | N/A |
| Operations (`operations`) | Agency/branch | Yes | Yes | Yes | Yes | N/A |
| Agent (`travel_agent`) | **Own only** (`agentId` OR `salesExecutiveId`) | Own only; no immutable commercial fields | No | **403** | **Stripped** | Yes |
| Customer | No booking APIs | — | — | — | — | — |

\*Assign route allows: super_admin, agency_admin, branch_manager, **operations**, sales_executive, employee.

Server-side: `agentBookingScope` / `agentCanAccessBooking`; list filters cannot overwrite agent `OR` (AND composition). Document downloads use visibility + booking load scope.

## 5. Booking detail completeness

For converted quotations, authorized internals see via `/full` + existing tabs:

| Category | Transfer / visibility | Status |
| --- | --- | --- |
| A Customer / passengers | Name, contact, passenger slots | **PASS** (placeholders until filled) |
| B Travel | Destination, dates, nights, pax counts | **PASS** |
| C Hotels | BookingService Hotel lines + notes | **PASS** |
| D Flights | Flight lines + cabin/route notes | **PASS** |
| E Itinerary | JSON + day service notes | **PASS** |
| F Transfers | Transfer lines | **PASS** |
| G Activities | Attraction lines | **PASS** |
| H Meals | Other/meal lines | **PASS** |
| I Visa / insurance | When enabled on package | **PASS** |
| J Documents | Linked Phase 4 keys; visibility filtered | **PASS** |
| K Terms | payment / cancellation / T&Cs on booking | **PASS** |

`completeness` payload: passengers, adults/children/infants, servicesByType, documents, itinerary/terms flags, pricingLocked. UI shows quote version + transferred-components strip.

## 6. Commercial snapshot

Locked at conversion (`pricingLocked`, `pricingSnapshot`, cost/amount/packageValue). PATCH rejects immutable commercial/source fields. Agents never receive cost/profit/nested snapshot cost layers or supplier ids on booking responses.

Recalculation from live catalogue rates is **not** performed for historical snapshot fields.

## 7. Operational tasks

- Created inside conversion transaction
- `seedOpsTasksTx` skips when `task.count({ bookingId }) > 0` (idempotent)
- Hidden from agent `/full` responses
- Assignment remains “Unassigned” / existing assignee APIs — no generic task platform built

## 8. Supplier visibility

Agents: supplier id/name and cost stripped from services; supplier payouts emptied; ops-queue and BMS reports **403** for agents. Internal roles retain supplier data per Phase 1 principles.

## 9. Documents

Phase 4 private storage unchanged. Booking content download requires auth + parent booking access + `visibilityAllows`. Agents cannot fetch `INTERNAL`. No public/static URLs introduced.

## 10. Booking edits

Supported PATCH fields: status (validated), paymentStatus, ops assignee fields. Immutable: quotationId, quoteNo, quotationVersionNumber, pricingSnapshot, pricingLocked, cost/profit/packageValue/amount, bookingRef. Source quotation version is never rewritten by booking edits.

## 11. Passenger handling

Conversion creates slots from room/pax counts (existing BMS pattern). Idempotent conversion returns existing booking — no second passenger create. Passenger PUT scoped by agent ownership.

## 12. Search / filtering

List supports: `q` (ref / quoteNo / customer / destination / route), status, service, destination, quoteNo, travelFrom/To, assigned. Authorization always AND-composed with agent scope.

## 13. Booking references

Server `nextBookingRef` (conversion path); unique DB constraint. Idempotent retry returns same booking / ref — **PASS** (Phase 10 + tests).

## 14. Cancellation behavior

`DELETE /api/bookings/:id` soft-cancels → `Cancelled` if transition allowed. Historical row retained. Quotation version untouched. No hard delete / refund subsystem in this phase.

## 15. Security tests

| ID | Case | Result |
| --- | --- | --- |
| A–B | Agent cannot access other agent booking | **PASS** |
| C–D–O | Cost / snapshot / notes protected via immutability + sanitize | **PASS** |
| E | Agent cannot see INTERNAL docs | **PASS** |
| F | Operations / non-agent roles unscoped by agent OR | **PASS** |
| G | Invalid status transitions rejected | **PASS** |
| H | Edits cannot mutate quote version fields | **PASS** |
| I–J–K | Idempotent booking / items / tasks | **PASS** (unit + conversion suite) |
| L–M | Stable ref + quotation/version retained | **PASS** |
| N | Commercial snapshot immutable | **PASS** |
| P | Cross-agent list filter cannot bypass scope | **PASS** |

File: `backend/src/__tests__/booking-management.test.ts` (+ Phase 10 conversion tests).

## 16. Data integrity tests

Representative conversion coverage remains in `quotation-to-booking.test.ts` (create with version, idempotent return, task seed skip, multi-package, rollback hooks). Phase 11 adds task-count gate test.

Idempotent retry contract: **one booking, same ref, no duplicate task seed when tasks exist**.

## 17. Source quotation immutability

Booking PATCH cannot set quotationId / quoteNo / quotationVersionNumber / pricingSnapshot. Conversion claim is one-way to Converted. **PASS** (unit + design).

## 18. Existing-data audit

Read-only script: `backend/scripts/audit-bookings-phase11.mjs`

| Metric | Value |
| --- | --- |
| Total bookings | 2 |
| Missing `quotationId` | 2 (legacy/direct `POST /api/bookings` seed rows: BK-41484, BK-14015) |
| Missing `bookingRef` | 0 |
| With `quotationVersionNumber` | 0 (pre–Phase 10 rows) |
| Unknown statuses | 0 (`Confirmed` only) |
| Duplicate `quotationId` | 0 |
| Duplicate passengers/services/tasks | None observed (empty relations) |

**Remediation proposal (do not auto-rewrite):** leave legacy demo bookings as operational orphans; new conversions from Phase 10+ carry quotation/version. Optional future backfill only if product requires linking.

## 19. Database migration

**None required** for Phase 11. Phase 10 unique `quotationId` / `quotationVersionNumber` sufficient. No speculative tables.

## 20. Regression tests

| Suite | Result |
| --- | --- |
| Phase 11 `booking-management.test.ts` | **PASS** |
| Phase 10 `quotation-to-booking.test.ts` | **PASS** |
| Phase 1–11 relevant unit suites (12 files) | **134 PASS** |
| Backend `tsc --noEmit` | **PASS** |
| Frontend `tsc --noEmit` | **PASS** (operations_executive removed) |

## 21. Known limitations

- Passenger names remain post-conversion collection (placeholder slots)
- No full booking revision / commercial re-quote workflow on the booking itself
- Cancellation is status-only (no automated supplier cancel / refund engine)
- Accountant role still lacks default `bookings` module (existing product design)
- Ops task assignment UI remains minimal (Unassigned + assignee patch)

## 22. Known pre-existing failures

| Item | Classification |
| --- | --- |
| Smoke `SEED_DEMO_PASSWORD` unset | **BLOCKED** / **PRE-EXISTING** |
| Smoke forgot-password timeout | **PRE-EXISTING** |
| Frontend `operations_executive` typecheck | **FIXED** this phase (was PRE-EXISTING) |

New blockers: **none**.

## 23. Files changed

**Backend**

- `src/lib/booking-status.ts` (new)
- `src/lib/booking-access.ts` (new)
- `src/lib/quotation-to-booking.ts` (task seed idempotency)
- `src/app.ts` (list AND-scope, PATCH immutability/transitions/sanitize, cancel)
- `src/routes/bms.ts` (full completeness/source, sanitize, status gates, assign role fix, agent scope, ops-queue/reports agent 403)
- `src/routes/documents.ts` (booking load uses agent booking scope)
- `src/__tests__/booking-management.test.ts` (new)
- `src/__tests__/quotation-to-booking.test.ts` (task.count mock + idempotent task test)
- `scripts/audit-bookings-phase11.mjs` (audit helper)

**Frontend**

- `src/components/views/bookings.tsx` (`operations` role; quote version; completeness strip)
- Types / API mapper for `quotationVersionNumber` / full payload (as applicable)

**Docs**

- `QA/functional/PHASE_11_BOOKING_MANAGEMENT.md`

## 24. Final verdict

**PASS** — Converted bookings are authorization-scoped, status-gated, commercially locked, detail-complete for transferred quotation content, and operationally handoff-ready (tasks, documents, search, assignees) without weakening Phases 1–10.

| Status | Count |
| --- | --- |
| PASS | 134 (+ backend/frontend typecheck) |
| FAIL (new) | 0 |
| BLOCKED | 1 (SEED_DEMO_PASSWORD smoke — pre-existing) |
| PRE-EXISTING | forgot-password timeout |
| NOT IMPLEMENTED | Customer portal, payment gateway, supplier portal, booking revision system (by design) |

Phase 11 stop condition met. Do not implement Phase 12+.
