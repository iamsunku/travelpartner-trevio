# Phase 15 — Agent registration & admin approval

## 1. Requirements implemented

| Requirement | Result |
| --- | --- |
| Registration → Submitted → Admin Review → Approved → Activated → Login | **PASS** |
| No JWT / session on registration | **PASS** |
| Submitted / Rejected cannot login | **PASS** |
| Approved / Active can login | **PASS** |
| Admin list / detail / approve / reject | **PASS** |
| GST proof via Phase 4 private storage | **PASS** |
| Existing Active agents unchanged | **PASS** |
| Agents cannot self-approve | **PASS** |

Did **not** implement Phase 14 leftovers (EXP-02, customer portal, Amadeus/email credentials, TaxRule seeding, GST invent cleanup).

## 2. Database / schema changes

Migration: `20260912250000_agent_registration_approval` — **applied**

`Agency` added:

- `registrationStatus` (`Submitted` \| `Approved` \| `Rejected`), default **`Approved`** for existing rows
- `registrationReviewComment`
- `registrationRejectionReason`
- `registrationReviewedAt`
- `registrationReviewedById`
- `registrationReviewedByName`
- index on `registrationStatus`

`User.status` reuse:

- Public register → `Submitted`
- Admin approve → `Active` (auth-eligible; matches existing middleware)
- Admin reject → `Rejected`
- Existing users remain `Active`

## 3. API changes

| Endpoint | Behavior |
| --- | --- |
| `POST /api/auth/register` | Creates agency (`registrationStatus=Submitted`) + user (`status=Submitted`); **no token** |
| `POST /api/auth/login` | Blocks non-`Active`/`Approved` with explicit message |
| `GET /api/agent-registrations` | `super_admin` only |
| `GET /api/agent-registrations/:id` | `super_admin` only |
| `POST /api/agent-registrations/:id/approve` | `super_admin` only |
| `POST /api/agent-registrations/:id/reject` | `super_admin` only; reason required |
| `GET /api/agencies/:id/gst-proof` | Existing Phase 4 private download (unchanged storage) |
| `POST /api/agencies` (admin onboard) | Sets `registrationStatus=Approved`, user `Active` |

Phone duplicate check no longer uses slow `endsWith` (exact/normalized variants only) — required for reliable registration against large user tables.

## 4. UI changes

- Registration form: submits for review; **does not** auto-login; returns to login with pending message
- Agencies view: **Pending agent registrations** panel (list, detail, approve, reject, view GST proof)

## 5. Authorization model

- Review mutations: **`super_admin` only** (platform admin). Travel agents and agency admins cannot approve/reject (including their own pending application — they cannot log in while Submitted).
- Middleware `requireRole` / `requirePermission` / `requireCrudPermission` / `requireAnyPermission` use `isAuthenticatableUserStatus` (`Active` \| `Approved`).

## 6. Authentication behavior

| User status | Login |
| --- | --- |
| Active | Allowed |
| Approved | Allowed (compat) |
| Submitted | **403** pending message |
| Rejected | **403** rejected message |
| Suspended / other | **403** |

## 7. Document privacy

GST/VAT proof remains Phase 4 private object storage. Download only through authorized `GET /api/agencies/:id/gst-proof` with `Cache-Control: private, no-store`. Agents of other agencies receive 403/404.

## 8. Tests and results

`backend/src/__tests__/agent-registration.test.ts` — cases A–K:

| ID | Case | Result |
| --- | --- | --- |
| A | Register → Submitted, no JWT | **PASS** |
| B | Submitted cannot login | **PASS** |
| C | Rejected cannot login | **PASS** |
| D | Approved can login | **PASS** |
| E | Agent cannot approve | **PASS** |
| F | Unauthorized cannot approve/reject | **PASS** |
| G | Super admin can approve | **PASS** |
| H | Super admin can reject | **PASS** |
| I | GST proof private | **PASS** |
| J | Existing approved login | **PASS** |
| K | Registration list not exposed | **PASS** |

Regression (Phases 1–15 relevant, 15 files): **166 PASS**

| Check | Result |
| --- | --- |
| Backend `tsc --noEmit` | **PASS** |
| Frontend `tsc --noEmit` | **PASS** |
| Phase 15 tests | **11 PASS** |
| FAIL (new) | **0** |

## 9. Migration details

- Prefer additive columns with safe defaults
- Existing agencies → `registrationStatus=Approved`
- No mass rewrite of user passwords or roles

## 10. Existing data compatibility

- Seeded / admin-created `Active` users continue to authenticate
- Admin `POST /api/agencies` still creates login-ready accounts
- Quotation Phases 1–14 paths untouched aside from shared auth status helper

## 11. Known limitations

| Item | Class |
| --- | --- |
| Only `super_admin` reviews (no management queue UI role) | By design for this phase |
| Rejected → re-open to Approved not offered in UI | Limitation; reject is terminal in queue |
| Confirmation email is fire-and-forget; live SMTP still env-dependent | **ENVIRONMENT** / not Phase 15 scope |
| Smoke `SEED_DEMO_PASSWORD` | **PRE-EXISTING** / **BLOCKED** |
| Forgot-password timeout | **PRE-EXISTING** |
| Remote DB latency makes registration transactions slow | Mitigated with 30s tx timeout |

## 12. Files changed

**Backend:** `prisma/schema.prisma`, migration `20260912250000_agent_registration_approval`, `lib/agent-registration.ts`, `routes/agent-registrations.ts`, `app.ts` (register/login/mount), `middleware/auth.ts`, `__tests__/agent-registration.test.ts`

**Frontend:** `agent-registration-form.tsx`, `agencies.tsx`, `lib/api.ts`

**Docs:** `QA/functional/PHASE_15_AGENT_REGISTRATION_APPROVAL.md`

## 13. Final verdict

| Item | Result |
| --- | --- |
| Phase 15 goal | **PASS** |
| Migration | **Applied** |
| Tests | **11 / 11 PASS**; regression **166 PASS** |
| Backend / frontend tsc | **PASS / PASS** |
| New blockers | **None** |

**STOP** after Phase 15. Do not start Phase 16.
