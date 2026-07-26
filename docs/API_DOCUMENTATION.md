# API Documentation

**Base URL (local):** `http://localhost:4000`  
**Auth header:** `Authorization: Bearer <jwt>`  
**Content-Type:** `application/json` (unless noted)

This document summarizes endpoints implemented in `backend/src/app.ts` and `backend/src/routes/*`.  
For exact Zod schemas, see `backend/src/lib/validation.ts`.

---

## Conventions

| Topic | Behavior |
|-------|----------|
| Success | Typically `{ … }` with entity keys (`items`, `booking`, etc.) |
| Errors | `{ error: string }` with HTTP 4xx/5xx |
| Auth | Most routes require JWT; some searches use `optionalAuth` |
| Scoping | Non–`super_admin` users are agency-scoped via middleware helpers |
| Permissions | `requirePermission(module)` or `requireCrudPermission(module, view\|add\|edit\|delete)` |

---

## Health & Meta

| Method | Route | Auth | Description | Used by |
|--------|-------|------|-------------|---------|
| GET | `/api/health` | none | DB connectivity | Frontend health sync |
| GET | `/api` | none | API metadata | Ops |

---

## Authentication

| Method | Route | Auth | Body | Response | Used by |
|--------|-------|------|------|----------|---------|
| POST | `/api/auth/login` | none (rate-limited) | `{ email, password }` | `{ user, token }` | Login screen |
| GET | `/api/auth/me` | Bearer | — | `{ user }` | Session refresh |
| POST | `/api/auth/forgot-password` | none (rate-limited) | `{ email }` | `{ ok, tempPassword? }` | Login forgot flow |
| POST | `/api/auth/logout` | Bearer | — | ok | Activity snapshot |

---

## Bookings

| Method | Route | Auth | Description | Used by |
|--------|-------|------|-------------|---------|
| GET | `/api/bookings` | Auth + any of flights/hotels/holiday/bookings | List | Bookings, dashboard |
| POST | `/api/bookings` | same | Create | Booking flows |
| PATCH | `/api/bookings/:id` | Auth | Update status/payment | Bookings |
| DELETE | `/api/bookings/:id` | Auth | Soft cancel | Bookings |

**Create body (typical):** customerName, service, route, travelDate, amount, paymentMethod, …

---

## Customers & CRM

| Method | Route | Permission | Description |
|--------|-------|------------|-------------|
| GET/POST | `/api/customers` | `customers` | List / create |
| PATCH/DELETE | `/api/customers/:id` | Auth | Update / delete |
| GET/POST | `/api/customers/:id/documents` | `customers` | Documents |
| GET/POST | `/api/leads` | `crm` | List / create |
| PATCH | `/api/leads/:id` | Auth | Update stage |

---

## Quotations & Payments

| Method | Route | Permission | Description |
|--------|-------|------------|-------------|
| GET/POST | `/api/quotations` | `quotations` | List / create |
| PATCH | `/api/quotations/:id` | Auth | Update |
| GET/POST | `/api/payments` | `payments` | List / create |
| POST | `/api/payments/razorpay/order` | Auth | Create order `{ amount }` |
| POST | `/api/payments/razorpay/verify` | Auth | Verify signature |

---

## Agencies, Branches, Employees

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET/POST/PATCH | `/api/agencies[/:id]` | `super_admin` | Agency CRUD |
| GET | `/api/branches` | Auth | List |
| POST/PATCH | `/api/branches[/:id]` | admin roles | Create/update |
| GET | `/api/employees` | `employees` | List |
| POST/PATCH | `/api/employees[/:id]` | admin/manager roles | Create/update (+ login user) |

---

## Tasks, Attendance, Leaves

| Method | Route | Permission | Description |
|--------|-------|------------|-------------|
| GET/POST | `/api/tasks` | `tasks` | List / create |
| PATCH/DELETE | `/api/tasks/:id` | Auth | Update / delete |
| POST | `/api/attendance/check-in` | `attendance` | Check in |
| POST | `/api/attendance/check-out` | `attendance` | Check out |
| GET | `/api/attendance` | `attendance` | List |
| GET/POST | `/api/leaves` | `leaves` | List / request |
| PATCH | `/api/leaves/:id` | manager roles | Approve/reject |

---

## Finance & Insights

| Method | Route | Permission | Description |
|--------|-------|------------|-------------|
| GET | `/api/wallet` | `wallet` | Balance + txns |
| POST | `/api/wallet` | `wallet` | Credit/debit |
| GET | `/api/commission` | `commission` | Commission report |
| GET | `/api/finance` | `finance` | P&L / invoices |
| GET | `/api/reports` | `reports` | Summary reports |
| GET | `/api/dashboard` | Auth | Dashboard aggregates |
| GET | `/api/analytics/platform` | `super_admin` | Platform analytics |
| GET | `/api/analytics/employees` | admin/manager | Employee analytics |

---

## Search (mock)

| Method | Route | Auth | Description | Used by |
|--------|-------|------|-------------|---------|
| GET | `/api/flights/search?origin&destination&count` | optional | Mock flights | Flights view |
| GET | `/api/hotels/search?city&count` | optional | Mock hotels | Hotels view |

---

## Notifications, Support, Settings

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/notifications` | Auth | List |
| PATCH | `/api/notifications/:id/read` | Auth | Mark read |
| PATCH | `/api/notifications/read-all` | Auth | Mark all |
| GET/POST | `/api/support/tickets` | optional / Auth | Tickets |
| GET | `/api/settings` | Auth | Get settings |
| PUT | `/api/settings` | admin | Upsert |
| GET/PUT | `/api/settings/role-permissions` | admin | RBAC matrix |
| GET/PATCH | `/api/settings/branding` | quote-templates CRUD | Branding |

---

## Marketing, CMS, Keys, Monitoring, Audit

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET/POST | `/api/marketing/campaigns` | optional / admin | Campaigns |
| GET/POST | `/api/cms/pages` | optional / admin | CMS pages |
| GET/POST | `/api/management/keys` | optional / admin | API keys |
| GET | `/api/monitoring/metrics` | `super_admin` | Process metrics |
| GET | `/api/audit-logs` | admin roles | Audit trail |

---

## Products (`/api/products`)

### Hotels — permission module `hotels`
`GET/POST /hotels`, `PATCH /hotels/:id`, `DELETE`, `duplicate`, `archive`, `import`

### Activities — module `activities`
Same CRUD pattern + `submit-for-approval`, `approve`, `reject`

### Transfers — module `transfers`
Same CRUD pattern + approval endpoints (note: approve/reject currently gated with `activities` permission in code)

### Suppliers — module `suppliers`
`GET/POST /api/suppliers`

---

## Destinations — `/api/destinations`

All require Auth + CRUD on `destinations`.

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | List (filters/pagination) |
| GET | `/filters` | Filter metadata |
| GET | `/:id` | Detail |
| GET | `/:id/products` | Linked products |
| POST | `/` | Create |
| PATCH | `/:id` | Update |
| PATCH | `/:id/archive` | Archive |
| POST | `/:id/duplicate` | Duplicate |
| DELETE | `/:id` | Delete |
| POST | `/bulk-delete` | Bulk delete |
| PATCH | `/bulk-status` | Bulk status |
| POST | `/import` | Import |

---

## Packages — `/api/packages`

CRUD module `packages`.

| Area | Routes |
|------|--------|
| Core | `GET/POST /`, `GET/PATCH/DELETE /:id`, publish/unpublish/archive, duplicate, bulk-status, versions |
| Itinerary | `GET/PUT /:id/itinerary`, day CRUD/reorder/duplicate, timeline item CRUD |
| Options | `GET/PUT /:id/product-options`, item POST/PATCH/DELETE |

---

## Trip Planner — `/api/trip-requirements`

Module `trip-planner`.

| Method | Route | Description |
|--------|-------|-------------|
| GET/POST | `/` | List / create |
| GET/PATCH/DELETE | `/:id` | CRUD |
| POST | `/recommendations` | Match packages (body) |
| POST | `/:id/recommendations` | Match for requirement |
| POST | `/calculate-price` | Price calc |
| POST | `/:id/calculate-price` | Price for requirement |
| POST | `/:id/select-package` | Select package |
| GET | `/:id/history` | History |

---

## Quote Templates — `/api/quote-templates`

Module `quote-templates`.

| Method | Route | Description |
|--------|-------|-------------|
| GET/POST | `/` | List / create |
| GET/PATCH/DELETE | `/:id` | CRUD |
| POST | `/:id/duplicate` | Duplicate |
| PATCH | `/:id/default\|archive\|activate` | Lifecycle |
| GET | `/:id/preview` | Preview data |

---

## Travel Proposals — `/api/travel-proposals`

Module `travel-proposals`.

| Method | Route | Description |
|--------|-------|-------------|
| GET/POST | `/` | List / create |
| POST | `/from-requirement/:requirementId` | Create from trip |
| GET/PATCH/DELETE | `/:id` | CRUD |
| POST | `/:id/duplicate\|clone` | Copy |
| PATCH | `/:id/status` | Status transition |
| GET | `/:id/snapshot\|versions\|preview\|history` | Versioning |
| GET | `/:id/versions/compare` | Diff versions |

### Proposal PDF

| Method | Route | CRUD | Description |
|--------|-------|------|-------------|
| POST | `/:id/generate-pdf` | edit | Generate PDF |
| GET | `/:id/pdf` | view | Latest PDF |
| GET | `/:id/pdf/:version` | view | Versioned PDF |
| DELETE | `/:id/pdf` | delete | Remove PDFs |

---

## Analytics Router — `/api/analytics` (super_admin)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api-metrics` | Raw metrics |
| GET | `/summary` | 24h summary |
| GET | `/endpoints` | Per-endpoint stats |
| GET | `/errors` | Errors |
| GET | `/user-activity` | Activity |
| GET | `/health-check` | Health |
| POST | `/cleanup` | Purge old metrics |

---

## Frontend Client

Primary client: `frontend/src/lib/api.ts` (`apiFetch`, `api.*` helpers).  
Errors surface as `ApiError` with friendly messages for 401/403/5xx/network.
