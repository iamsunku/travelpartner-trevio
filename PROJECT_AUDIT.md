# Trevio Global — Complete Architectural Audit Report

**Audit Date:** July 21, 2026  
**Repository:** `travelpartner-trevio`  
**Auditor Scope:** Full-stack codebase analysis (no code modifications)  
**Version Audited:** `0.2.0` (monorepo root)

---

# 1. Project Overview

## Project Name
**Trevio Global** (package name: `travelpro`)

## Purpose
Multi-agency travel SaaS platform for Indian travel agencies. Enables flight/hotel/holiday booking, CRM, quotations, payments, commission, product catalog management (hotels, activities, transfers), employee/attendance management, and platform administration for super admins.

## Current Completion Percentage
**~78% overall** (see Section 17 for breakdown)

## Overall Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                          │
│  Next.js 16 SPA Shell — single route, client-side view router    │
│  Zustand (auth + local-first demo store) + API sync on login     │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS / REST (JWT Bearer)
┌────────────────────────────▼────────────────────────────────────┐
│                   BACKEND (Express 4 Monolith)                   │
│  app.ts (~70 routes) + routes/products.ts + routes/analytics.ts │
│  Middleware: helmet, cors, rate-limit, JWT auth, RBAC, Zod      │
└────────────────────────────┬────────────────────────────────────┘
                             │ Prisma ORM
┌────────────────────────────▼────────────────────────────────────┐
│                   PostgreSQL (Railway / Prisma Dev)              │
│  30 models, 10 migrations, multi-tenant via agencyId/branchId  │
└─────────────────────────────────────────────────────────────────┘
```

**Pattern:** Local-first optimistic UI on frontend; backend is sync target, not always single source of truth in the browser.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend Runtime** | Next.js 16, React 19, TypeScript 5 |
| **Frontend Styling** | Tailwind CSS 4, shadcn/ui (Radix primitives) |
| **Frontend State** | Zustand (persist) |
| **Backend Runtime** | Node.js 20+, Express 4, TypeScript 5 |
| **ORM / DB** | Prisma 6, PostgreSQL 14+ |
| **Auth** | JWT (jsonwebtoken), bcryptjs |
| **Validation** | Zod 4 |
| **Email** | SendGrid (optional) |
| **Payments** | Razorpay (optional, demo fallback) |
| **Logging** | Pino + pino-http |
| **Testing** | Vitest + Supertest (backend smoke tests) |
| **Deployment** | Railway (backend), frontend TBD (Vercel-ready) |

## Frameworks
- **Next.js App Router** — minimal usage (`layout.tsx`, `page.tsx` only)
- **Express.js** — full REST API
- **Prisma** — schema, migrations, client generation

## Key Libraries

### Frontend
`zustand`, `framer-motion`, `recharts`, `@tanstack/react-table`, `@dnd-kit/*`, `react-hook-form`, `zod`, `cmdk`, `lucide-react`, `date-fns`, `react-day-picker`, `sonner`

### Backend
`express`, `@prisma/client`, `jsonwebtoken`, `bcryptjs`, `zod`, `helmet`, `cors`, `express-rate-limit`, `@sendgrid/mail`, `pino`, `supertest`, `vitest`

## Folder Structure

```
travelpartner-trevio/
├── backend/                    # Express API + Prisma
│   ├── prisma/
│   │   ├── schema.prisma       # 30 models
│   │   ├── seed.ts             # Demo users + sample products
│   │   └── migrations/         # 10 SQL migrations
│   ├── src/
│   │   ├── app.ts              # Main route monolith (~1400+ lines)
│   │   ├── server.ts           # Entry point
│   │   ├── routes/
│   │   │   ├── products.ts     # Product catalog CRUD + approvals
│   │   │   └── analytics.ts    # API metrics dashboard
│   │   ├── middleware/
│   │   │   ├── auth.ts         # JWT + RBAC middleware
│   │   │   └── analytics.ts    # Request metrics capture
│   │   ├── lib/
│   │   │   ├── permissions.ts  # Roles, modules, CRUD matrix
│   │   │   ├── validation.ts   # Zod schemas
│   │   │   ├── email.ts        # SendGrid templates
│   │   │   ├── env.ts          # Startup env validation
│   │   │   ├── jwt.ts, db.ts, logger.ts, mock-data.ts
│   │   └── __tests__/smoke.test.ts
│   └── railway.toml            # Railway deploy config
├── frontend/                   # Next.js admin SPA
│   ├── src/
│   │   ├── app/                # layout.tsx, page.tsx, globals.css
│   │   ├── components/
│   │   │   ├── auth/           # login-screen.tsx
│   │   │   ├── layout/         # sidebar, topbar, app-shell, global-search
│   │   │   ├── shared/         # product-catalog, ui-helpers, payment-modal
│   │   │   ├── ui/             # 48 shadcn components
│   │   │   └── views/          # 35 view files (31 routed)
│   │   ├── store/              # app-store.ts, demo-data-store.ts
│   │   ├── lib/                # api.ts, permissions, nav-config, mock-data, quotation-pdf
│   │   ├── hooks/              # use-api-sync, use-toast
│   │   └── types/index.ts      # Shared TypeScript types
│   └── public/                 # trevio-logo.png, logo.svg
├── README.md
├── LOGIN_CREDENTIALS.md
├── PRODUCTION_DEPLOYMENT_GUIDE.md
├── SENDGRID_SETUP.md
└── package.json                # npm workspaces root
```

---

# 2. Feature Inventory

| Feature | Status | Description | Key Files | API Endpoints | DB Tables | Missing Functionality |
|---------|--------|-------------|-----------|---------------|-----------|----------------------|
| **Authentication** | ✅ Completed | JWT login, forgot-password (demo temp password), logout audit | `app.ts`, `login-screen.tsx`, `auth.ts` | `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/forgot-password`, `POST /api/auth/logout` | `User`, `AuditLog`, `EmployeeActivitySnapshot` | Email-based password reset; OTP login is demo-only |
| **Admin Dashboard** | 🟡 Partial | Role-aware KPIs, charts, tasks, activity feed | `dashboard.tsx` | `GET /api/dashboard` | Aggregates from Booking, Customer, Lead, Payment | Some metrics use mock data (`TOP_DESTINATIONS`, `RECENT_ACTIVITIES`) |
| **Quote Builder (Standard)** | 🟡 Partial | Create/list quotations, status workflow | `quotations.tsx` | `GET/POST/PATCH /api/quotations` | `Quotation` | No real PDF export (toast only); no email send |
| **International Quotation** | 🟡 Partial | Extended fields, dialog UI, print-to-PDF | `international-quotation.tsx`, `quotation-pdf.ts` | Same as quotations (`isInternational` fields) | `Quotation` (extended fields) | Hardcoded brand name; not standalone route; no server-side PDF |
| **Destination Management** | ❌ Not Started | No dedicated destination CRUD | — | — | — | Destinations only as text fields on products/quotes |
| **Package Management (Holiday)** | 🟡 Partial | Holiday package catalog UI | `holiday.tsx` | — | — | Mock data only (`HOLIDAY_PACKAGES`); no backend model/API |
| **Hotel Management (Booking)** | 🟡 Partial | Search, book, pay flow | `hotels.tsx` | `GET /api/hotels/search` | — | Mock search results; no real OTA/GDS |
| **Hotel Products (Catalog)** | ✅ Completed | Full CRUD, CSV import/export, duplicate, archive | `hotel-products.tsx`, `product-catalog.tsx`, `product-form-dialog.tsx` | `/api/products/hotels/*` | `HotelProduct`, `Supplier` | Approval workflow routes missing for hotels |
| **Flight Management** | 🟡 Partial | Search, filter, book, seat map, payment | `flights.tsx` | `GET /api/flights/search`, bookings API | — | Mock flight data; no real GDS |
| **Activity Management** | ✅ Completed | CRUD via product catalog | `activity-packages.tsx` | `/api/products/activities/*` | `ActivityProduct` | Bundling UI is informational only |
| **Transfer Management** | ✅ Completed | CRUD via product catalog | `activity-packages.tsx` | `/api/products/transfers/*` | `TransferProduct` | Same as activities |
| **Rate Approvals** | 🟡 Partial | Approve/reject pending product rates | `product-approvals.tsx` | `POST .../approve`, `POST .../reject` | `approvalStatus` on products | **`admin-approval` permission bug** — likely 403; hotel products lack approval routes |
| **Image Library** | ❌ Not Started | — | — | — | `images` JSON on products | No upload, storage, or gallery UI |
| **PDF Generation** | 🟡 Partial | International quotation print-to-PDF | `quotation-pdf.ts` | — | — | Standard quotes, invoices, tickets are toast-only |
| **Customer Management** | ✅ Completed | CRUD, tiers, passport/visa, travel history UI | `customers.tsx` | `/api/customers/*` | `Customer`, `CustomerDocument` | Document upload stores metadata only (no file storage) |
| **CRM / Leads** | ✅ Completed | Kanban pipeline, lead CRUD, stage updates | `crm.tsx` | `/api/leads/*` | `Lead` | Chart data partially mocked |
| **Booking Management** | ✅ Completed | List, filter, detail, status updates | `bookings.tsx` | `/api/bookings/*` | `Booking` | Ticket download is toast-only |
| **Payments** | ✅ Completed | Record payments, Razorpay integration | `payments.tsx` | `/api/payments/*`, Razorpay endpoints | `Payment` | Demo mode when Razorpay keys absent |
| **Wallet** | ✅ Completed | Balance, credit/debit, transactions | `wallet.tsx` | `/api/wallet` | `WalletTransaction` | Hardcoded `agencyId: "ag-1"` in some calls |
| **Commission** | 🟡 Partial | Rules display, settlement history | `commission.tsx` | `GET /api/commission` | Derived from Booking | Rules UI uses mock data |
| **Finance / GST** | 🟡 Partial | Invoices, expenses, GST filing status | `finance.tsx` | `GET /api/finance` | — | Expenses/invoices partially mocked |
| **Reports & Analytics** | 🟡 Partial | Sales, commission, agent reports | `reports.tsx` | `GET /api/reports` | — | Many chart tables use mock fallbacks |
| **Platform Analytics** | 🟡 Partial | API performance monitoring | `analytics-dashboard.tsx` | `/api/analytics/*` | `ApiMetric`, `PerformanceMetric` | **Broken wiring** — wrong URL/token in frontend |
| **Employee Management** | ✅ Completed | CRUD, permissions, performance | `employees.tsx` | `/api/employees/*` | `Employee`, `User` | Attendance calendar mock; dual User/Employee records |
| **Attendance & Leave** | ✅ Completed | Check-in/out, leave requests, approvals | `attendance-leave.tsx` | `/api/attendance/*`, `/api/leaves/*` | `Attendance`, `Leave` | — |
| **Task Management** | ✅ Completed | Kanban board, CRUD | `tasks.tsx` | `/api/tasks/*` | `Task` | Comments/attachments are mock |
| **Notifications** | 🟡 Partial | Inbox, mark read | `notifications.tsx` | `/api/notifications/*` | `Notification` | Badge count hardcoded in nav |
| **Settings** | 🟡 Partial | Company profile, users, permissions matrix | `settings.tsx` | `/api/settings/*` | `Settings` | Logo upload client-only; not persisted to API |
| **Agency Management** | ✅ Completed | Super-admin agency CRUD | `agencies.tsx` | `/api/agencies/*` | `Agency` | — |
| **Branch Management** | ✅ Completed | Branch CRUD, manager assignment | `branches.tsx` | `/api/branches/*` | `Branch` | — |
| **Audit Logs** | ✅ Completed | Activity timeline with filters | `audit-logs.tsx` | `GET /api/audit-logs` | `AuditLog` | — |
| **API Marketplace** | 🟡 Partial | Vendor connection UI | `api-marketplace.tsx` | — | — | Mock-only static vendors |
| **API Management** | 🟡 Partial | API keys, logs, webhooks UI | `api-management.tsx` | `/api/management/keys` (backend exists) | `ApiKey` | Frontend uses mock data; API unused |
| **Monitoring** | 🟡 Partial | Server health, error logs | `monitoring.tsx` | `/api/monitoring/metrics` | — | Frontend mock-only; backend has basic in-process metrics |
| **Marketing** | 🟡 Partial | Campaigns, coupons UI | `marketing.tsx` | `/api/marketing/campaigns` (backend exists) | `MarketingCampaign` | Frontend mock-only |
| **CMS** | 🟡 Partial | Banners, blogs, testimonials, FAQ, SEO | `cms.tsx` | `/api/cms/pages` (backend exists) | `ContentPage`, `ContentPost` | Frontend mock-only; `ContentPost` has no API |
| **Support** | 🟡 Partial | Tickets, live chat, FAQ | `support.tsx` | `/api/support/tickets` (backend exists) | `SupportTicket`, `TicketMessage` | Frontend mock-only |
| **Supplier Management** | 🟡 Partial | Supplier list/create via products API | `product-form-dialog.tsx` | `GET/POST /api/suppliers` | `Supplier` | No dedicated supplier admin UI |
| **CSV Import/Export** | ✅ Completed | Bulk product import/export | `product-catalog.tsx` | `POST .../import` | Product tables | Products only |
| **Global Search** | ✅ Completed | ⌘K command palette across modules | `global-search.tsx`, `search-config.ts` | — | — | — |
| **Role-Based Access Control** | 🟡 Partial | 7 roles, 31 modules, CRUD matrix | `permissions.ts` (FE+BE), `settings.tsx` | `/api/settings/role-permissions` | `Settings.rolePermissions`, `User.permissions` | Frontend CRUD gating not enforced in views; `admin-approval` bug |

---

# 3. Screens

All screens use **client-side routing** via `?view=<key>`. There is only one Next.js page: `/`.

| Screen | Route | Purpose | Main Components | Connected APIs | Status |
|--------|-------|---------|-----------------|----------------|--------|
| Login | `/` (unauthenticated) | Auth gate | `login-screen.tsx` | `POST /api/auth/login`, `POST /api/auth/forgot-password` | ✅ Completed |
| Dashboard | `/?view=dashboard` | KPI overview | `dashboard.tsx` | `GET /api/dashboard` + demo store | 🟡 Partial |
| Flights | `/?view=flights` | Flight search & booking | `flights.tsx`, `city-search-field.tsx`, `payment-modal.tsx` | `GET /api/flights/search`, bookings API | 🟡 Partial |
| Hotels (Booking) | `/?view=hotels` | Hotel search & booking | `hotels.tsx`, `city-search-field.tsx` | `GET /api/hotels/search`, bookings API | 🟡 Partial |
| Holiday Packages | `/?view=holiday` | Package catalog | `holiday.tsx` | — (mock) | 🟡 Partial |
| Booking Management | `/?view=bookings` | Booking list & detail | `bookings.tsx` | `/api/bookings/*` | ✅ Completed |
| Hotel Products | `/?view=hotel-products` | Product catalog admin | `hotel-products.tsx`, `product-catalog.tsx` | `/api/products/hotels/*` | ✅ Completed |
| Activities & Transfers | `/?view=activity-packages` | Tabbed product admin | `activity-packages.tsx`, `product-catalog.tsx` | `/api/products/activities/*`, `/api/products/transfers/*` | ✅ Completed |
| Rate Approvals | `/?view=product-approvals` | Pending rate review | `product-approvals.tsx` | Product approve/reject endpoints | 🟡 Partial |
| CRM / Leads | `/?view=crm` | Lead pipeline | `crm.tsx` | `/api/leads/*` | ✅ Completed |
| Customers | `/?view=customers` | Customer CRM | `customers.tsx` | `/api/customers/*` | ✅ Completed |
| Quotations | `/?view=quotations` | Quote list & create | `quotations.tsx`, `international-quotation.tsx` | `/api/quotations/*` | 🟡 Partial |
| Payments | `/?view=payments` | Payment records | `payments.tsx`, `payment-modal.tsx` | `/api/payments/*`, Razorpay | ✅ Completed |
| Wallet | `/?view=wallet` | Agency wallet | `wallet.tsx` | `/api/wallet` | ✅ Completed |
| Commission | `/?view=commission` | Commission tracking | `commission.tsx` | `GET /api/commission` | 🟡 Partial |
| Finance / GST | `/?view=finance` | Financial management | `finance.tsx` | `GET /api/finance` | 🟡 Partial |
| Reports | `/?view=reports` | Business reports | `reports.tsx` | `GET /api/reports` | 🟡 Partial |
| Platform Analytics | `/?view=analytics` | API performance | `analytics-dashboard.tsx` | `/api/analytics/*` (miswired) | ❌ Broken |
| Employees | `/?view=employees` | HR management | `employees.tsx` | `/api/employees/*` | ✅ Completed |
| Attendance & Leave | `/?view=attendance` | Time tracking | `attendance-leave.tsx` | `/api/attendance/*`, `/api/leaves/*` | ✅ Completed |
| Tasks | `/?view=tasks` | Kanban tasks | `tasks.tsx` | `/api/tasks/*` | ✅ Completed |
| Support | `/?view=support` | Help desk | `support.tsx` | — (mock; API exists) | 🟡 Partial |
| Notifications | `/?view=notifications` | Alert inbox | `notifications.tsx` | `/api/notifications/*` | 🟡 Partial |
| Agencies | `/?view=agencies` | Super-admin agencies | `agencies.tsx` | `/api/agencies/*` | ✅ Completed |
| Branches | `/?view=branches` | Branch admin | `branches.tsx` | `/api/branches/*` | ✅ Completed |
| API Marketplace | `/?view=api-marketplace` | Vendor integrations | `api-marketplace.tsx` | — (mock) | 🟡 Partial |
| API Management | `/?view=api-management` | API keys & logs | `api-management.tsx` | — (mock; API exists) | 🟡 Partial |
| Monitoring | `/?view=monitoring` | System health | `monitoring.tsx` | — (mock; API exists) | 🟡 Partial |
| Marketing | `/?view=marketing` | Campaigns | `marketing.tsx` | — (mock; API exists) | 🟡 Partial |
| CMS | `/?view=cms` | Content management | `cms.tsx` | — (mock; API exists) | 🟡 Partial |
| Audit Logs | `/?view=audit-logs` | Compliance trail | `audit-logs.tsx` | `GET /api/audit-logs` | ✅ Completed |
| Settings | `/?view=settings` | App configuration | `settings.tsx` | `/api/settings/*` (partially wired) | 🟡 Partial |

**Orphan views (not routed):** `activities.tsx`, `transfers.tsx` — superseded by `activity-packages.tsx`.

---

# 4. Admin Panel

## Modules by Sidebar Section

| Section | Modules | CRUD | Filters | Search | Pagination | Export | Permissions |
|---------|---------|------|---------|--------|------------|--------|-------------|
| Overview | Dashboard | — | — | Global ⌘K | — | — | All roles |
| Bookings | Flights, Hotels, Holiday, Bookings | Create bookings | ✅ Filters on flights/hotels/bookings | ✅ | ✅ Bookings paginated (API) | 🟡 Toast export | Module-gated |
| Products | Hotel Products, Activities & Transfers, Rate Approvals | ✅ Full CRUD + CSV | ✅ Search/filter/sort | ✅ | ✅ Client-side | ✅ CSV export | CRUD via backend; FE not enforced |
| Sales & CRM | CRM, Customers, Quotations | ✅ | ✅ Pipeline filters | ✅ | 🟡 Client-side | ❌ | Module-gated |
| Finance | Payments, Wallet, Commission, Finance | ✅ Payments/wallet | ✅ Status filters | ✅ | 🟡 Client-side | 🟡 Toast PDF | Module-gated |
| Insights | Reports, Analytics | Read-only | ✅ Date range | — | — | 🟡 UI buttons | Module-gated |
| Team & Ops | Employees, Attendance, Tasks, Support, Notifications | ✅ | ✅ Dept/branch/status | ✅ | 🟡 Client-side | ❌ | Module-gated |
| Platform | Agencies, Branches, API Marketplace, API Management, Monitoring, Marketing, CMS, Audit Logs, Settings | ✅ Agencies/branches | ✅ Audit log filters | ✅ | 🟡 Client-side | 🟡 Audit export button | Role + module gated |

## Permission System
- **7 roles:** `super_admin`, `agency_admin`, `branch_manager`, `employee`, `accountant`, `sales_executive`, `product_executive`
- **31 modules** with role defaults + per-user overrides
- **CRUD matrix** stored in `Settings.rolePermissions` (agency-configurable)
- **Enforcement:** Backend middleware (`requireAuth`, `requireRole`, `requirePermission`, `requireCrudPermission`); frontend sidebar filtering only

---

# 5. Database Analysis

**Provider:** PostgreSQL  
**ORM:** Prisma 6  
**Models:** 30  
**Migrations:** 10

## All Models

| Model | Key Fields | Relationships | Status |
|-------|-----------|---------------|--------|
| **User** | id, email, password, role, agencyId, branchId, permissions (Json), status | → Agency, Branch; has Bookings, Leads, Tasks, Quotations, Payments, Attendance, Leaves | ✅ Active |
| **Agency** | id, name, owner, plan, status, walletBalance, commissionEarned, monthlyRevenue, apiAllocation (Json) | → Users, Branches, Bookings | ✅ Active |
| **Branch** | id, agencyId, name, manager, city, revenue | → Agency, Users | ✅ Active |
| **Customer** | id, name, email, phone, type, tier, totalBookings, totalSpent, loyaltyPoints, passportNo, visaStatus, agencyId | → Bookings, Leads | ✅ Active |
| **Booking** | id, bookingRef, customerName, service, route, travelDate, amount, commission, status, paymentStatus, agentId, agencyId, branchId | → Customer, Agency, Agent (User), Payments | ✅ Active |
| **Payment** | id, txnId, amount, method, status, type, gateway, bookingId, agencyId, branchId, collectedById | → Booking, User | ✅ Active |
| **Lead** | id, customerName, source, service, value, stage, assignedToId, agencyId, branchId, customerId | → User, Customer | ✅ Active |
| **Quotation** | id, quoteNo, customerName, service, amount, gst, total, status, isInternational, destination, travelDates, adults/children/infants, packageIncludes/Excludes (Json), lineItems (Json), approvalStatus | → User (createdBy) | ✅ Active |
| **Task** | id, title, description, assignedToId, priority, status, dueDate, agencyId, branchId | → User | ✅ Active |
| **WalletTransaction** | id, agencyId, type, source, amount, balance, description, date | — | ✅ Active |
| **Employee** | id, agencyId, branchId, name, email, designation, department, role, status, salary, permissions (Json) | — (parallel to User) | ✅ Active |
| **Attendance** | id, userId, agencyId, branchId, date, checkIn, checkOut, status | → User; unique [userId, date] | ✅ Active |
| **Leave** | id, userId, type, fromDate, toDate, reason, status, approvedById | → User | ✅ Active |
| **AuditLog** | id, userId, agencyId, action, module, ip, details | → User | ✅ Active |
| **Notification** | id, type, title, message, priority, read, userId, agencyId | — | ✅ Active |
| **Settings** | id, agencyId, theme, currency, timezone, notifications, rolePermissions (Json) | — | ✅ Active |
| **Supplier** | id, agencyId, name, contactPerson, email, phone, type, status | → HotelProducts, ActivityProducts, TransferProducts | ✅ Active |
| **HotelProduct** | id, agencyId, supplierId, name, starCategory, city, amenities (Json), roomCategories (Json), images (Json), approvalStatus, status | → Supplier | ✅ Active |
| **ActivityProduct** | Same pattern + duration, location, adultPrice, childPrice, inclusions, exclusions | → Supplier | ✅ Active |
| **TransferProduct** | Same pattern + transferType, vehicleType, pickup/drop, privatePrice, sharedPrice | → Supplier | ✅ Active |
| **CustomerDocument** | id, customerId, agencyId, name, type, url, uploadedBy | — | 🟡 Metadata only (no file storage) |
| **EmployeeActivitySnapshot** | id, userId, agencyId, date, loginAt, logoutAt, workingMinutes, revenueGenerated | unique [userId, date] | ✅ Active |
| **ApiMetric** | id, endpoint, method, statusCode, responseTime, userId, agencyId, errorMessage | — | 🟡 userId rarely populated (middleware bug) |
| **PerformanceMetric** | id, metric, value, unit, date, hour | unique [metric, date, hour] | ❌ Unused (aggregation never scheduled) |
| **MarketingCampaign** | id, name, type, status, audience, sentCount, openRate, clickRate | — | 🟡 Backend stub; FE mock |
| **ContentPage** | id, title, slug, content, status, author | — | 🟡 Backend stub; FE mock |
| **ContentPost** | id, title, slug, excerpt, content, category, image | — | ❌ No API routes |
| **ApiKey** | id, name, key, environment, status, calls, limit, expiresAt | — | 🟡 Backend stub; FE mock |
| **SupportTicket** | id, ticketId, subject, status, priority, customerName | → TicketMessages | 🟡 Backend stub; FE mock |
| **TicketMessage** | id, ticketId, sender, message, isInternal | → SupportTicket | 🟡 Backend stub; FE mock |

## Missing Columns / Gaps
- No dedicated `Destination` or `HolidayPackage` tables
- No file storage references (S3/Cloudinary URLs are plain strings)
- `Employee` duplicates `User` without enforced FK sync
- Hotel products lack approval workflow routes despite schema fields

## Unused / Underused Tables
- `ContentPost` — zero API routes
- `PerformanceMetric` — write function exists but never called
- `MarketingCampaign`, `ContentPage`, `ApiKey`, `SupportTicket` — minimal backend, no real frontend integration

---

# 6. APIs

**Total:** ~100+ endpoints  
**Base URL:** `http://localhost:4000` (dev) / Railway (prod)  
**Auth:** JWT Bearer token in `Authorization` header

## Authentication

| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| POST | `/api/auth/login` | Login, return JWT + user | Public (rate-limited) |
| GET | `/api/auth/me` | Current user profile | JWT |
| POST | `/api/auth/forgot-password` | Reset password (returns temp password in demo) | Public (rate-limited) |
| POST | `/api/auth/logout` | Logout audit + activity snapshot | JWT |

## Core Business

| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| GET | `/api/health` | Health check | Public |
| GET | `/api/dashboard` | Aggregate stats | JWT |
| GET/POST/PATCH/DELETE | `/api/bookings` | Booking CRUD | JWT + module perm |
| GET/POST/PATCH/DELETE | `/api/customers` | Customer CRUD | JWT + `customers` |
| GET/POST/PATCH | `/api/leads` | Lead CRUD | JWT + `crm` |
| GET/POST/PATCH | `/api/quotations` | Quotation CRUD | JWT + `quotations` |
| GET/POST | `/api/payments` | Payment records | JWT + `payments` |
| POST | `/api/payments/razorpay/order` | Create Razorpay order | JWT |
| POST | `/api/payments/razorpay/verify` | Verify payment signature | JWT |
| GET/POST | `/api/wallet` | Wallet balance & transactions | JWT + `wallet` |
| GET | `/api/commission` | Commission breakdown | JWT + `commission` |
| GET | `/api/finance` | P&L, invoices | JWT + `finance` |
| GET | `/api/reports` | Report aggregates | JWT + `reports` |

## Organization & HR

| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| GET/POST/PATCH | `/api/agencies` | Agency management | JWT + `super_admin` |
| GET/POST/PATCH | `/api/branches` | Branch management | JWT + role |
| GET/POST/PATCH | `/api/employees` | Employee CRUD | JWT + role/module |
| GET | `/api/employees/activity` | Activity snapshots | JWT + `employees` |
| GET/POST/PATCH/DELETE | `/api/tasks` | Task management | JWT + `tasks` |
| POST | `/api/attendance/check-in` | Check in | JWT + `attendance` |
| POST | `/api/attendance/check-out` | Check out | JWT + `attendance` |
| GET | `/api/attendance` | List attendance | JWT + `attendance` |
| GET/POST/PATCH | `/api/leaves` | Leave management | JWT + `leaves` / manager role |

## Products

| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| GET/POST/PATCH/DELETE | `/api/products/hotels` | Hotel product CRUD | JWT + CRUD(`hotels`) |
| POST | `/api/products/hotels/import` | CSV bulk import | JWT + CRUD add |
| POST | `/api/products/hotels/:id/duplicate` | Duplicate product | JWT |
| PATCH | `/api/products/hotels/:id/archive` | Archive product | JWT |
| GET/POST/PATCH/DELETE | `/api/products/activities` | Activity CRUD + approval | JWT + CRUD |
| GET/POST/PATCH/DELETE | `/api/products/transfers` | Transfer CRUD + approval | JWT + CRUD |
| GET/POST | `/api/suppliers` | Supplier list/create | JWT + `suppliers` |

## Search (Mock)

| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| GET | `/api/flights/search` | Mock flight results | Optional |
| GET | `/api/hotels/search` | Mock hotel results | Optional |

## Analytics & Monitoring

| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| GET | `/api/analytics/platform` | Platform revenue analytics | JWT + `super_admin` |
| GET | `/api/analytics/employees` | Employee performance | JWT + manager roles |
| GET | `/api/analytics/summary` | 24h API performance | JWT + `super_admin` |
| GET | `/api/analytics/endpoints` | Per-endpoint stats | JWT + `super_admin` |
| GET | `/api/analytics/errors` | Error logs | JWT + `super_admin` |
| GET | `/api/monitoring/metrics` | In-process server metrics | JWT + `super_admin` |
| GET | `/api/audit-logs` | Audit trail | JWT + admin roles |

## Settings & Phase 2 Stubs

| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| GET/PUT | `/api/settings` | Agency settings | JWT / admin |
| GET/PUT | `/api/settings/role-permissions` | RBAC overrides | JWT + admin |
| GET/POST | `/api/marketing/campaigns` | Marketing campaigns | Optional GET / Auth POST |
| GET/POST | `/api/cms/pages` | CMS pages | Optional GET / Auth POST |
| GET/POST | `/api/management/keys` | API keys | Optional GET / Auth POST |
| GET/POST | `/api/support/tickets` | Support tickets | Optional GET / Auth POST |
| GET/PATCH | `/api/notifications` | Notifications | JWT |

---

# 7. UI Components

## Layout Components
| Component | File | Purpose |
|-----------|------|---------|
| App Shell | `layout/app-shell.tsx` | View router, auth gate |
| Sidebar | `layout/sidebar.tsx` | Navigation with role filtering |
| Topbar | `layout/topbar.tsx` | Search, notifications, theme, user menu |
| Footer | `layout/footer.tsx` | App footer |
| Global Search | `layout/global-search.tsx` | ⌘K command palette |

## Shared Business Components
| Component | File | Purpose |
|-----------|------|---------|
| PageShell, PageHeader, MetricCard, BrandHero | `shared/ui-helpers.tsx` | Page layout primitives |
| StatusBadge, formatINR | `shared/ui-helpers.tsx` | Status chips, currency |
| ProductCatalog | `shared/product-catalog.tsx` | Generic product table + CSV |
| ProductFormDialog | `shared/product-form-dialog.tsx` | Create/edit product forms |
| CitySearchField | `shared/city-search-field.tsx` | Airport/city autocomplete |
| PaymentModal | `shared/payment-modal.tsx` | Razorpay + wallet checkout |
| ShareTicket | `shared/share-ticket.tsx` | WhatsApp/email share |
| ThemeProvider | `shared/theme-provider.tsx` | Light/dark theme wrapper |

## shadcn/ui Primitives (48 files)
`accordion`, `alert`, `alert-dialog`, `avatar`, `badge`, `breadcrumb`, `button`, `calendar`, `card`, `carousel`, `chart`, `checkbox`, `collapsible`, `command`, `context-menu`, `dialog`, `drawer`, `dropdown-menu`, `form`, `hover-card`, `input`, `input-otp`, `label`, `menubar`, `navigation-menu`, `pagination`, `popover`, `progress`, `radio-group`, `resizable`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `sonner`, `switch`, `table`, `tabs`, `textarea`, `toast`, `toaster`, `toggle`, `toggle-group`, `tooltip`

## Component Availability Matrix

| Type | Available | Notes |
|------|-----------|-------|
| Cards | ✅ | `card.tsx`, `MetricCard`, `BrandHero` |
| Tables | ✅ | `table.tsx`, `@tanstack/react-table` in views |
| Forms | ✅ | `form.tsx` + react-hook-form + zod |
| Dialogs | ✅ | `dialog.tsx`, `alert-dialog.tsx`, `sheet.tsx` |
| Sidebar | ✅ | App sidebar + shadcn `sidebar.tsx` |
| Navbar | ✅ | Topbar |
| Buttons | ✅ | `button.tsx` with variants |
| Inputs | ✅ | `input.tsx`, `textarea.tsx`, `select.tsx` |
| Image Upload | 🟡 | File input in settings only (client-side, not persisted) |
| Rich Text Editor | ❌ | Not implemented |
| Date Picker | ✅ | `calendar.tsx` + `react-day-picker` |
| Charts | ✅ | `chart.tsx` (Recharts wrapper) |
| Kanban | ✅ | `@dnd-kit` in CRM and Tasks |
| Command Palette | ✅ | `cmdk` in global search |
| Pagination | ✅ | `pagination.tsx` (partial usage) |
| OTP Input | ✅ | `input-otp.tsx` (demo login flow) |

---

# 8. PDF System

## How It Works
PDF generation exists **only for international quotations**. There is no server-side PDF library.

## Library Used
**None.** Uses browser-native **print-to-PDF** via `window.open()` + `window.print()`.

## Implementation
**File:** `frontend/src/lib/quotation-pdf.ts`

### Flow
1. `downloadInternationalQuotationPdf(data)` builds an HTML string
2. Opens a new browser popup window
3. Writes HTML with embedded CSS
4. Triggers `window.print()` for Save as PDF

## Templates
Single inline HTML template with:
- Brand header ("Wanderlust Travels" — hardcoded)
- Customer details table
- Travel details (destination, dates, pax)
- Package includes/excludes lists
- Pricing table (amount, GST 18%, total)
- Payment terms & cancellation policy
- Footer with validity date

## Dynamic Fields
`quoteNo`, `customerName`, `contactPerson`, `contactEmail`, `contactPhone`, `destination`, `travelDates`, `adults`, `children`, `infants`, `hotelStarPreference`, `location`, `currency`, `includes[]`, `excludes[]`, `paymentTerms`, `cancellationPolicy`, `amount`, `gst`, `total`, `createdBy`

## Image Loading
**Not supported** in PDF template — text and CSS only.

## Header/Footer
- Header: brand name + quote number + date + prepared by
- Footer: validity statement + terms reminder (CSS `@page { margin: 24mm }`)

## Other "PDF" References (Not Real)
| Location | Behavior |
|----------|----------|
| `quotations.tsx` | Toast: "PDF generated" — no file |
| `bookings.tsx` | Toast: ticket downloaded — no file |
| `finance.tsx` | Toast: invoice PDF — no file |
| `tasks.tsx` | Mock attachment filename only |

## Limitations
- No jspdf, html2canvas, Puppeteer, or @react-pdf
- Brand name hardcoded, not from agency settings
- Standard quotations have no PDF
- No email attachment generation
- Print layout depends on browser/OS
- No multi-page handling for long itineraries

---

# 9. Image Management

## How Images Are Stored
**Not implemented.** Product `images` fields are JSON string arrays in the database with no upload pipeline.

## Upload Flow
| Location | Behavior |
|----------|----------|
| `settings.tsx` | Logo upload via `<input type="file">` → `FileReader.readAsDataURL()` → local React state only — **not saved to API** |
| `product-catalog.tsx` | "Import" reads **CSV files**, not images |
| `cms.tsx`, `marketing.tsx` | `ImageIcon` placeholders — no file upload |

## Storage
- **Cloudinary:** Documented in `backend/.env.example` as reserved/future — **zero code references**
- **S3/Azure:** Not configured
- **Local filesystem:** Not used
- **Static assets:** `frontend/public/trevio-logo.png`, `logo.svg` only

## Optimization
- `sharp` is in frontend dependencies (Next.js image optimization) but no `next/image` upload pipeline exists

## Thumbnail Generation
**Not implemented.**

## Can Product Team Change Images?
**No.** Product forms may accept image URL strings in JSON, but there is no UI for image upload, gallery, or CDN management. Product executives cannot change images through the admin panel.

---

# 10. Security

## Authentication
| Control | Status | Details |
|---------|--------|---------|
| JWT tokens | ✅ | Issued on login; stored in Zustand persist (`tpp-auth`) |
| Password hashing | ✅ | bcryptjs |
| Token expiry | ✅ | Configurable via `JWT_EXPIRES_IN` (default 1d) |
| DB-fresh permission check | ✅ | Middleware re-reads User from DB on each request |
| Forgot password | 🟡 | Returns temp password in API response (demo behavior) |

## Authorization
| Control | Status | Details |
|---------|--------|---------|
| Role-based access | ✅ | 7 roles with module defaults |
| Module permissions | ✅ | Per-user override via `User.permissions` JSON |
| CRUD permissions | 🟡 | Backend enforced for products; Settings overrides; many PATCH/DELETE routes only require Auth |
| Multi-tenant scoping | ✅ | `agencyId`/`branchId` filters on most queries |
| Row-level security | 🟡 | Employee sees own bookings; managers see branch; gaps on some update-by-ID routes |

## Role Based Access
- Backend: `requireRole`, `requirePermission`, `requireCrudPermission`, `requireAnyPermission`
- Frontend: Sidebar filtering + view access gate only
- **Bug:** `admin-approval` permission used but not in MODULES list

## Validation
| Layer | Status |
|-------|--------|
| Zod schemas (backend) | ✅ Core routes validated |
| Product routes | ❌ Raw `req.body` accepted |
| Phase 2 routes | ❌ No validation |
| Frontend forms | 🟡 react-hook-form + zod in some dialogs only |

## Rate Limiting
| Limiter | Limit | Scope |
|---------|-------|-------|
| `apiLimiter` | 300 req / 15 min | All `/api/*` |
| `authLimiter` | 10 req / 15 min | Login, forgot-password |

## Input Sanitization
| Control | Status |
|---------|--------|
| Helmet (CSP, HSTS, XSS) | ✅ |
| CORS whitelist | ✅ (strict in production) |
| Body size limit | ✅ 10MB |
| HTML escape in PDF | ✅ `escapeHtml()` in quotation-pdf.ts |
| SQL injection | ✅ Prisma parameterized queries |
| XSS in React | ✅ Default React escaping |

---

# 11. Performance

## Lazy Loading
| Feature | Status |
|---------|--------|
| Next.js dynamic imports | ❌ All views statically imported in `app-shell.tsx` |
| Route-based code splitting | ❌ Single SPA bundle |
| Image lazy loading | 🟡 `next/image` not used in views |

## Caching
| Feature | Status |
|---------|--------|
| React Query | ❌ Installed but unused |
| API response caching | ❌ |
| Zustand persist | ✅ Local storage cache for demo data |
| Static assets | ✅ Next.js default |

## Pagination
| Feature | Status |
|---------|--------|
| Bookings API | ✅ Server-side (`page`, `pageSize`, `total`) |
| Product catalog | 🟡 Client-side pagination |
| Most other lists | 🟡 Client-side or no pagination |

## Database Optimization
| Feature | Status |
|---------|--------|
| Indexes on agencyId/branchId | ✅ Added in migrations |
| Unique constraints | ✅ bookingRef, quoteNo, email, etc. |
| Connection pooling | 🟡 `pgbouncer=true` in dev DATABASE_URL |
| Query optimization | 🟡 No explicit query analysis |

## Image Optimization
| Feature | Status |
|---------|--------|
| sharp (Next.js) | ✅ Available |
| CDN | ❌ |
| Responsive images | ❌ |
| WebP conversion | ❌ |

---

# 12. Missing Features

## Must Have
- [ ] Real flight/hotel search integration (GDS/OTA APIs)
- [ ] Server-side or reliable PDF generation for all quotations, invoices, tickets
- [ ] Image upload and storage (Cloudinary/S3) for products and agency branding
- [ ] Fix `admin-approval` permission bug for product rate approvals
- [ ] Wire Phase 2 modules (Marketing, CMS, Support, Settings) to real APIs in frontend
- [ ] Fix analytics dashboard API wiring (`analytics-dashboard.tsx`)
- [ ] Email-based password reset (remove cleartext temp password in API response)
- [ ] Frontend CRUD permission enforcement (hide/disable actions by role)
- [ ] Holiday package backend model and API
- [ ] Hotel product approval workflow routes (parity with activities/transfers)

## Should Have
- [ ] Destination management module
- [ ] Rich text editor for CMS content
- [ ] Standard quotation PDF export
- [ ] Booking ticket PDF/voucher generation
- [ ] Invoice PDF for finance module
- [ ] Employee/User record unification (single source of truth)
- [ ] Scheduled PerformanceMetric aggregation
- [ ] Fix analytics middleware userId capture bug
- [ ] Row-level authorization on all PATCH/DELETE routes
- [ ] ContentPost API routes
- [ ] Supplier dedicated admin UI
- [ ] Real-time notifications (WebSocket/SSE)

## Nice To Have
- [ ] Next.js route-based code splitting per view
- [ ] React Query for server state management
- [ ] Dark mode polish across all views
- [ ] Multi-language support (i18n)
- [ ] Activity bundling builder (combine activities + transfers into packages)
- [ ] Customer portal (self-service booking)
- [ ] WhatsApp Business API integration for quotations
- [ ] Advanced reporting with date-range export to Excel
- [ ] Mobile-responsive booking flows

## Future Features
- [ ] AI-powered itinerary builder
- [ ] Dynamic pricing engine
- [ ] Channel manager integration (OTAs)
- [ ] Visa processing module (removed from v1)
- [ ] Insurance products (removed from v1)
- [ ] Bus/train booking (removed from v1)
- [ ] White-label multi-domain support
- [ ] Franchise management
- [ ] Customer mobile app

---

# 13. Known Issues

## Broken Pages / Modules
| Issue | Severity | Location |
|-------|----------|----------|
| Analytics dashboard fetches wrong URL (`/api/analytics/*` on Next.js host instead of backend) | High | `analytics-dashboard.tsx` |
| Analytics uses `localStorage.getItem("token")` instead of Zustand `tpp-auth` | High | `analytics-dashboard.tsx` |
| Product approve/reject returns 403 due to missing `admin-approval` module | High | `routes/products.ts`, `permissions.ts` |

## TODOs in Code
No explicit `TODO`/`FIXME`/`HACK` comments found in source. Placeholder patterns exist (e.g., `BK-XXXX` in task forms).

## Unused Files
| File | Reason |
|------|--------|
| `frontend/src/components/views/activities.tsx` | Superseded by `activity-packages.tsx`; not in nav |
| `frontend/src/components/views/transfers.tsx` | Superseded by `activity-packages.tsx`; not in nav |
| `backend/src/lib/types.ts` | Only imported by mock-data |
| `backend/db/custom.db` | SQLite artifact; schema uses PostgreSQL |
| `internationalQuotationSchema` in validation.ts | Defined but unused |
| `employeeCreateWithPasswordSchema` | Defined but unused |

## Dead Code
| Item | Location |
|------|----------|
| `ComingSoon` component | `app-shell.tsx` — exported but never used |
| `hasCrudPermission` (frontend) | `permissions.ts` — defined but never called in views |
| `getMe` API method | `api.ts` — defined but unused |
| `@tanstack/react-query` | `package.json` — installed but unused |
| Most `mock-data.ts` exports | Only `ROLE_USERS`, `generateFlights`, `generateHotels` used by backend |
| Phase 3 API client methods | marketing, cms, support, settings, monitoring — defined but views use mock |

## Console Errors / Build Warnings
| Issue | Notes |
|-------|-------|
| ESLint | 13 errors, 2 warnings (pre-existing, mostly react-hooks) |
| Backend smoke tests | Fail when DB unreachable in test runner (environment issue) |
| npm `devdir` warning | Cosmetic npm config warning |

## Incomplete Modules
| Module | Completion |
|--------|------------|
| Marketing | Backend stub + frontend mock |
| CMS | Backend stub + frontend mock |
| Support | Backend stub + frontend mock |
| API Management | Backend stub + frontend mock |
| Monitoring | Backend basic + frontend mock |
| Settings | UI mock + partial API wiring |
| Holiday Packages | Frontend mock only |
| Image Management | Not started |
| PDF (standard) | Toast placeholders only |

---

# 14. Folder Tree

```
travelpartner-trevio/
├── .gitignore
├── package.json                          # npm workspaces root
├── package-lock.json
├── README.md
├── LOGIN_CREDENTIALS.md
├── PRODUCTION_DEPLOYMENT_GUIDE.md
├── SENDGRID_SETUP.md
├── PROJECT_AUDIT.md                      # This report
│
├── backend/
│   ├── .env                              # Local secrets (gitignored)
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   ├── railway.toml
│   ├── vitest.config.ts
│   ├── vitest.setup.ts
│   ├── db/
│   │   └── custom.db                     # ⚠️ Unused SQLite artifact
│   ├── prisma/
│   │   ├── schema.prisma                 # 30 models
│   │   ├── seed.ts
│   │   └── migrations/
│   │       ├── migration_lock.toml
│   │       ├── 20260708053955_init/
│   │       ├── 20260711044251_multi_tenant_scoping/
│   │       ├── 20260711165131_rbac_permissions_branch_attendance_leave/
│   │       ├── 20260711200001_employee_branch_id/
│   │       ├── 20260711203624_employee_permissions/
│   │       ├── 20260711204238_payment_collected_by/
│   │       ├── 20260712110000_product_catalog_international_quotations/
│   │       ├── 20260715161718_add_rate_approval_workflow/
│   │       ├── 20260715161817_update_product_approval_workflow/
│   │       └── 20260715164637_add_analytics_tables/
│   └── src/
│       ├── server.ts
│       ├── app.ts                        # ~1400 lines, main API
│       ├── routes/
│       │   ├── products.ts
│       │   └── analytics.ts
│       ├── middleware/
│       │   ├── auth.ts
│       │   └── analytics.ts
│       ├── lib/
│       │   ├── db.ts
│       │   ├── jwt.ts
│       │   ├── logger.ts
│       │   ├── env.ts
│       │   ├── email.ts
│       │   ├── permissions.ts
│       │   ├── validation.ts
│       │   ├── mock-data.ts
│       │   └── types.ts
│       └── __tests__/
│           └── smoke.test.ts
│
└── frontend/
    ├── .env.local                        # gitignored
    ├── .env.local.example
    ├── package.json
    ├── tsconfig.json
    ├── next.config.ts
    ├── next-env.d.ts
    ├── tailwind.config.ts
    ├── postcss.config.mjs
    ├── eslint.config.mjs
    ├── components.json                   # shadcn config
    ├── public/
    │   ├── trevio-logo.png
    │   ├── logo.svg
    │   └── robots.txt
    └── src/
        ├── app/
        │   ├── layout.tsx
        │   ├── page.tsx
        │   └── globals.css
        ├── components/
        │   ├── auth/
        │   │   └── login-screen.tsx
        │   ├── layout/
        │   │   ├── app-shell.tsx
        │   │   ├── sidebar.tsx
        │   │   ├── topbar.tsx
        │   │   ├── footer.tsx
        │   │   └── global-search.tsx
        │   ├── shared/
        │   │   ├── ui-helpers.tsx
        │   │   ├── product-catalog.tsx
        │   │   ├── product-form-dialog.tsx
        │   │   ├── city-search-field.tsx
        │   │   ├── payment-modal.tsx
        │   │   ├── share-ticket.tsx
        │   │   └── theme-provider.tsx
        │   ├── ui/                       # 48 shadcn components
        │   └── views/                    # 35 view files
        │       ├── dashboard.tsx
        │       ├── flights.tsx
        │       ├── hotels.tsx
        │       ├── holiday.tsx
        │       ├── bookings.tsx
        │       ├── hotel-products.tsx
        │       ├── activity-packages.tsx
        │       ├── product-approvals.tsx
        │       ├── activities.tsx          # ⚠️ Orphan
        │       ├── transfers.tsx           # ⚠️ Orphan
        │       ├── crm.tsx
        │       ├── customers.tsx
        │       ├── quotations.tsx
        │       ├── international-quotation.tsx
        │       ├── payments.tsx
        │       ├── wallet.tsx
        │       ├── commission.tsx
        │       ├── finance.tsx
        │       ├── reports.tsx
        │       ├── analytics.tsx
        │       ├── analytics-dashboard.tsx
        │       ├── employees.tsx
        │       ├── attendance-leave.tsx
        │       ├── tasks.tsx
        │       ├── support.tsx
        │       ├── notifications.tsx
        │       ├── agencies.tsx
        │       ├── branches.tsx
        │       ├── api-marketplace.tsx
        │       ├── api-management.tsx
        │       ├── monitoring.tsx
        │       ├── marketing.tsx
        │       ├── cms.tsx
        │       ├── audit-logs.tsx
        │       └── settings.tsx
        ├── store/
        │   ├── app-store.ts
        │   └── demo-data-store.ts
        ├── lib/
        │   ├── api.ts
        │   ├── api-mappers.ts
        │   ├── mock-data.ts
        │   ├── nav-config.tsx
        │   ├── permissions.ts
        │   ├── search-config.ts
        │   ├── quotation-pdf.ts
        │   ├── razorpay.ts
        │   └── utils.ts
        ├── hooks/
        │   ├── use-api-sync.ts
        │   ├── use-mobile.ts
        │   └── use-toast.ts
        └── types/
            └── index.ts
```

---

# 15. Dependencies

## Root (`package.json`)
| Package | Purpose |
|---------|---------|
| npm workspaces | Monorepo management for frontend + backend |

## Backend Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^4.21 | HTTP server framework |
| `@prisma/client` | ^6.11 | Database ORM client |
| `prisma` | ^6.11 (dev) | Schema management, migrations, generate |
| `typescript` | ^5 (dev) | Type safety |
| `tsx` | ^4.19 (dev) | TypeScript execution for dev/scripts |
| `jsonwebtoken` | ^9.0 | JWT authentication |
| `bcryptjs` | ^3.0 | Password hashing |
| `zod` | ^4.4 | Request validation schemas |
| `helmet` | ^8.2 | Security HTTP headers |
| `cors` | ^2.8 | Cross-origin resource sharing |
| `express-rate-limit` | ^8.5 | API rate limiting |
| `@sendgrid/mail` | ^8.1 | Email notifications (product approvals) |
| `pino` | ^10.3 | Structured logging |
| `pino-http` | ^10.3 | HTTP request logging middleware |
| `pino-pretty` | ^13.1 (dev) | Dev-friendly log formatting |
| `dotenv` | ^16.6 (dev) | Environment variable loading |
| `vitest` | ^4.1 (dev) | Test runner |
| `supertest` | ^7.2 (dev) | HTTP integration testing |

## Frontend Dependencies

| Package | Purpose |
|---------|---------|
| `next` | React framework, App Router shell, build tooling |
| `react`, `react-dom` | UI library |
| `typescript` | Type safety |
| `tailwindcss`, `@tailwindcss/postcss` | Utility-first CSS |
| `tw-animate-css`, `tailwindcss-animate` | Animation utilities |
| `@radix-ui/react-*` (20 packages) | Headless accessible UI primitives for shadcn |
| `class-variance-authority` | Component variant management |
| `clsx`, `tailwind-merge` | Conditional className utilities |
| `lucide-react` | Icon library |
| `zustand` | State management (auth + demo data) |
| `framer-motion` | UI animations |
| `recharts` | Charts (dashboard, reports, finance) |
| `@tanstack/react-table` | Data table rendering |
| `@tanstack/react-query` | ⚠️ Installed but **unused** |
| `@hookform/resolvers`, `react-hook-form` | Form handling |
| `zod` | Client-side validation |
| `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` | Drag-and-drop (CRM kanban, tasks) |
| `date-fns`, `react-day-picker` | Date formatting and calendar UI |
| `cmdk` | Command palette (global search) |
| `embla-carousel-react` | Carousel component |
| `react-resizable-panels` | Resizable panel layouts |
| `vaul` | Drawer component |
| `input-otp` | OTP input for demo login |
| `react-markdown`, `react-syntax-highlighter` | Markdown rendering (CMS/support) |
| `next-themes` | Theme switching |
| `sonner`, `@radix-ui/react-toast` | Toast notifications |
| `uuid` | Client-side ID generation |
| `sharp` | Next.js image optimization |
| `@reactuses/core` | React utility hooks |
| `eslint`, `eslint-config-next` | Linting |

---

# 16. Deployment

## Environment Variables

### Backend (`backend/.env.example`)
| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | JWT signing key (32+ chars in prod) |
| `JWT_EXPIRES_IN` | No | Token TTL (default `1d`) |
| `PORT` | No | Server port (default 4000) |
| `NODE_ENV` | No | `development` / `production` / `test` |
| `CORS_ORIGIN` | Prod ✅ | Comma-separated allowed origins |
| `SENDGRID_API_KEY` | No | Email notifications |
| `SENDGRID_FROM_EMAIL` | No | Sender email address |
| `RAZORPAY_KEY_ID` | No | Payment gateway (demo without) |
| `RAZORPAY_KEY_SECRET` | No | Payment verification |
| `CLOUDINARY_URL` | No | Reserved — not implemented |
| `LOG_LEVEL` | No | Pino log level |

### Frontend (`frontend/.env.local.example`)
| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_API_URL` | No | Backend API URL (default `http://localhost:4000`) |

## Build Process

### Backend
```bash
npm install                    # triggers postinstall: prisma generate + migrate deploy
npx prisma generate            # Generate Prisma client
npm run build                  # tsc → dist/
npm run start                  # node dist/server.js
```

### Frontend
```bash
npm install
npm run build                  # next build (Turbopack)
npm run start                  # next start -p 3000
```

### Root (Monorepo)
```bash
npm run dev:frontend           # Next.js dev on :3000
npm run dev:backend            # tsx watch on :4000
npm run build:frontend
npm run build:backend
npm run test:backend
npm run db:migrate
npm run db:seed
```

## Deployment Target

| Component | Target | Config |
|-----------|--------|--------|
| **Backend** | Railway | `backend/railway.toml` |
| **Database** | Railway PostgreSQL / Prisma Dev (local) | `DATABASE_URL` |
| **Frontend** | Not deployed (Vercel-ready) | `NEXT_PUBLIC_API_URL` points to Railway backend |

### Railway Backend Config
- **Build:** `npm install && npx prisma generate && npm run build`
- **Start:** `npx prisma migrate deploy && npm run start`
- **Healthcheck:** `GET /api/health` (30s timeout)
- **Restart policy:** ON_FAILURE, max 3 retries

## Storage
| Type | Solution | Status |
|------|----------|--------|
| Database | PostgreSQL (Railway) | ✅ Production-ready |
| File uploads | None | ❌ Not configured |
| Static assets | Next.js `public/` | ✅ Logo files only |
| Session/token | Client localStorage (Zustand persist) | ✅ |

---

# 17. Final Summary

## Completion Checklist

### ✅ Completed
- [x] JWT authentication with role-based login
- [x] Multi-agency / multi-branch tenant isolation
- [x] User & employee management with permissions
- [x] Customer CRUD with tiers and documents (metadata)
- [x] CRM / lead pipeline with kanban
- [x] Booking management with status workflow
- [x] Quotation creation (standard + international fields)
- [x] Payment recording + Razorpay integration (optional)
- [x] Wallet system (credit/debit/transactions)
- [x] Commission & finance reporting APIs
- [x] Hotel / activity / transfer product catalog (full CRUD)
- [x] CSV import/export for products
- [x] Product duplicate, archive, delete
- [x] Attendance check-in/out + leave management
- [x] Task kanban board
- [x] Audit logging
- [x] Agency & branch management (super admin)
- [x] Settings with role permissions matrix (backend)
- [x] API rate limiting + Helmet security headers
- [x] Zod validation on core routes
- [x] Prisma migrations (10) with seed data
- [x] Backend smoke tests (11 cases)
- [x] Professional UI redesign across all sidebar views
- [x] Global search (⌘K)
- [x] SendGrid email for product approvals (when configured)
- [x] Employee activity snapshots (login/logout tracking)
- [x] International quotation PDF (browser print)
- [x] Railway deployment configuration

### 🟡 Partially Completed
- [ ] Dashboard (mix of API + mock data)
- [ ] Flight/hotel booking (mock search, real booking storage)
- [ ] Holiday packages (UI only, no backend)
- [ ] Standard quotation PDF (toast only)
- [ ] Rate approval workflow (bug in permissions)
- [ ] Commission rules UI (mock data)
- [ ] Finance/invoices (partial mock)
- [ ] Reports (API + mock charts)
- [ ] Platform analytics dashboard (broken wiring)
- [ ] Notifications (API works, badge hardcoded)
- [ ] Settings (UI not fully wired to API)
- [ ] Marketing, CMS, Support, API Management, Monitoring (backend stubs, frontend mock)
- [ ] API Marketplace (static mock vendors)
- [ ] Supplier management (API only, no dedicated UI)
- [ ] Image management (logo upload client-only)
- [ ] Frontend CRUD permission enforcement
- [ ] Forgot password (returns temp password, no email)
- [ ] Customer document upload (metadata only)

### ❌ Missing
- [ ] Real GDS/OTA flight integration
- [ ] Real hotel inventory integration
- [ ] Destination management module
- [ ] Holiday package backend model/API
- [ ] Image upload/storage/CDN (Cloudinary/S3)
- [ ] Server-side PDF generation (jspdf/Puppeteer)
- [ ] Standard quotation / invoice / ticket PDF
- [ ] Rich text editor
- [ ] Image library / gallery for product team
- [ ] ContentPost API
- [ ] PerformanceMetric scheduled aggregation
- [ ] WebSocket real-time notifications
- [ ] Customer self-service portal
- [ ] Mobile app
- [ ] Visa / insurance / bus / train modules (removed)

---

## Completion Estimates

| Area | Completion % | Notes |
|------|-------------|-------|
| **Overall Project** | **78%** | Core booking/CRM/finance loop works; integrations and polish remain |
| **Frontend** | **75%** | All views exist; ~40% use mock data; analytics broken |
| **Backend** | **85%** | ~100 endpoints; solid RBAC; Phase 2 stubs; some auth gaps |
| **Database** | **92%** | 30 models, well-indexed; 3 tables unused/minimal |
| **Admin Panel** | **80%** | 31 routed views; sidebar RBAC works; in-view CRUD gating missing |
| **PDF Engine** | **25%** | International quote print-only; everything else is placeholder |
| **Image Management** | **5%** | Logo file input (not persisted); no CDN/upload pipeline |
| **Quote Builder** | **65%** | Standard + international create/save works; PDF/email/approval incomplete |

---

*End of audit report. Generated from static codebase analysis on July 21, 2026.*
