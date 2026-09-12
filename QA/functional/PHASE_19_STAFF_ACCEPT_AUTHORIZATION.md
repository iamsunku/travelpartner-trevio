# Phase 19 — Staff Accept Authorization Guard

**Date:** 12 September 2026  
**Scope:** Targeted P1 fix from `QA/functional/PHASE_18_PRODUCTION_READINESS.md` only.  
**Non-goals honored:** No pricing, customer-token acceptance, booking conversion, expiry, agent registration, or unrelated endpoint changes.

---

## Verdict

**PASS** — Staff `POST /api/quotations/:id/accept` now enforces the same `canTransition` status machine used by `POST /api/quotations/:id/status`. Draft / ineligible statuses can no longer be accepted merely because the caller has quotations permission.

---

## 1. Root cause

`POST /api/quotations/:id/accept` loaded the quote (auth + agency/branch/agent scope), checked expiry and pricing finalization, then **unconditionally** wrote `status: "Accepted"`.

It never called `canTransition(existing.status, "Accepted")`.

By contrast, `POST /api/quotations/:id/status` already rejected invalid transitions via:

```ts
if (!canTransition(existing.status, to, override)
  && !canTransition(normalizeStatus(existing.status), to, override)) {
  // 400 Invalid transition
}
```

So any authenticated user with `quotations` permission who could open the quote could accept from **Draft**, **In Progress**, **Pending Approval**, **Rejected**, etc., bypassing the workflow matrix.

Customer token acceptance (`quotation-customer-access.ts`) already used `canTransition` and was **not** the bug.

---

## 2. Exact fix

| Piece | Change |
| --- | --- |
| `quoteStaffAcceptTransitionBlockReason` | New helper in `backend/src/lib/quotations.ts` wrapping `canTransition` + `normalizeStatus` (legacy `Sent`) |
| `POST /api/quotations/:id/accept` | Call helper **before** expiry/pricing updates; return **400** with `Invalid transition {from} → Accepted` when blocked |

**No admin override** on accept (status endpoint override is intentionally not copied — Phase 18 required staff not to bypass the machine by virtue of role).

Legitimate accept sources unchanged by the matrix:

- `Sent to Agent` → `Accepted`
- `Sent` (legacy) → `Accepted`
- `Customer Reviewing` → `Accepted`
- `Accepted` → `Accepted` (same-status allowed by `canTransition` `from === to`)

Existing expiry (`Expired` / past `validTill`) and pricing finalization checks remain. Auth (`requireAuth`, `requirePermission("quotations")`, `loadQuoteForActor`) unchanged.

---

## 3. Affected endpoint

| Endpoint | Change |
| --- | --- |
| `POST /api/quotations/:id/accept` | Transition guard added |
| Customer `POST /api/customer/quotations/:token/accept` | **Unchanged** |
| `POST /api/quotations/:id/status` | **Unchanged** |
| Booking conversion | **Unchanged** |
| Reject / request-revision | **Unchanged** (out of Phase 19 scope) |

---

## 4. Authorization behavior before / after

| Scenario | Before | After |
| --- | --- | --- |
| Staff accept from `Sent to Agent` / `Customer Reviewing` / legacy `Sent` | Allowed (if expiry + tax ok) | **Allowed** (same) |
| Staff accept from already `Accepted` | Allowed | **Allowed** (`from === to`) |
| Staff accept from `Draft` / `In Progress` / `Pending Approval` / `Revision Requested` | **Incorrectly allowed** | **400 Invalid transition** |
| Staff accept from `Rejected` / `Converted to Booking` / `Archived` | **Incorrectly allowed** | **400 Invalid transition** |
| Staff accept from `Expired` | Blocked by expiry check | Blocked by **transition** then expiry (defense in depth) |
| Past `validTill` on still-sent quote | Blocked by expiry check | **Unchanged** |
| Missing quotations permission / wrong agency / other agent | 401/403/404 | **Unchanged** |
| Customer token accept | Own gates + `canTransition` | **Unchanged** |

---

## 5. Tests

`backend/src/__tests__/staff-accept-authorization.test.ts`

| Case | Result |
| --- | --- |
| Valid statuses may accept | **PASS** |
| Draft / ineligible cannot accept | **PASS** |
| Rejected blocked | **PASS** |
| Expired blocked by transition (+ expiry helper) | **PASS** |
| No invent override on accept helper | **PASS** |
| Customer eligibility helpers unchanged | **PASS** |
| Legacy `Sent` alias | **PASS** |

---

## 6. Regression / typecheck / build

| Check | Result |
| --- | --- |
| Phase 19 tests | **7 PASS** |
| Relevant Phase 1–18 suites (16 files) | **179 PASS** |
| Backend `tsc --noEmit` | **PASS** |
| Frontend `tsc --noEmit` | **PASS** |
| Backend `npm run build` | **PASS** |
| Frontend `npm run build` (Next.js) | **PASS** |
| Unrelated smoke SEED / forgot-password | **Not fixed** (pre-existing; not treated as Phase 19 failures) |

---

## 7. Remaining limitations

- Authenticated **reject** / **request-revision** routes still do not call `canTransition` (out of Phase 19 scope; same class of issue if product wants symmetry).
- Staff accept still does not require the full customer send/approval gate beyond what was already present (expiry + tax). Status machine alone is what Phase 18 called out.
- `POST .../status` still allows admin `override` — intentionally not applied to accept.

---

## 8. Files touched

| File | Role |
| --- | --- |
| `backend/src/lib/quotations.ts` | `quoteStaffAcceptTransitionBlockReason` |
| `backend/src/routes/quotations.ts` | Guard on accept |
| `backend/src/__tests__/staff-accept-authorization.test.ts` | Regression |
| `QA/functional/PHASE_19_STAFF_ACCEPT_AUTHORIZATION.md` | This report |

---

## 9. Explicit stop

Phase 20 **not started**. No further workflow rewrites.
