# Project Summary — Travel Partner Pro (Trevio Global)

**Document type:** Onboarding overview  
**Last updated:** July 22, 2026  
**Monorepo version:** `0.2.0` (root) · Frontend `0.2.0` · Backend `0.1.0` · API banner **v0.3.0**

---

## 1. Project Overview

**Travel Partner Pro** (branded **Trevio Global**) is a multi-agency, B2B travel operations SaaS platform. It helps travel agencies manage destinations, hotels/activities/transfers, holiday packages, CRM, trip planning, customer proposals (with PDF), bookings, finance, and team operations — under role-based multi-tenant access.

| Layer | Stack |
|-------|--------|
| Frontend | Next.js 16, React 19, Tailwind CSS v4, shadcn/ui, Zustand, Recharts, Framer Motion |
| Backend | Express (Node ESM), Prisma 6, PostgreSQL, JWT, Zod, Pino |
| Auth | JWT Bearer + DB-backed permissions / CRUD overrides |
| Deploy | Designed for Railway (API + Postgres) + frontend hosting |

The UI is a **single-page application** at `/` with in-app navigation via `?view=<ViewKey>`.

---

## 2. Business Purpose

Enable travel agencies to:

1. Maintain a **product catalog** (destinations, hotels, activities, transfers)
2. Compose **holiday packages** with itineraries and product option groups
3. Capture **travel requirements**, match packages, and build **proposals**
4. Apply **branding + quote templates**, then generate **proposal PDFs**
5. Operate day-to-day **bookings, CRM, payments, wallet, commissions**
6. Manage **employees, attendance, tasks, support**, and platform ops (for super admins)

---

## 3. Target Users

| Role | Typical use |
|------|-------------|
| **Super Admin** | Platform agencies, monitoring, analytics, API marketplace |
| **Agency Admin** | Full agency operations, settings, branding, approvals |
| **Branch Manager** | Branch-scoped staff, bookings, CRM |
| **Employee / Sales Executive** | Bookings, leads, trip planner, proposals |
| **Product Executive** | Destinations, packages, product catalog |
| **Accountant** | Payments, finance, commission, wallet |

Permissions are module-based (36 modules) with optional per-agency CRUD overrides in Settings.

---

## 4. Major Features

| Domain | Capabilities |
|--------|----------------|
| **Bookings** | Flights / hotels / holiday search (mock or catalog), booking management |
| **Products** | Destinations, hotel products, activities, transfers, rate approvals |
| **Packages** | Package builder, itinerary, product options, publish lifecycle |
| **Sales** | CRM leads, customers, trip planner, travel proposals, quotations |
| **Documents** | Quote templates, agency branding, proposal PDF generation |
| **Finance** | Payments (incl. Razorpay hooks), wallet, commission, GST/finance |
| **Team** | Employees, attendance/leave, tasks, support, notifications |
| **Platform** | Agencies, branches, CMS, marketing, API keys, monitoring, audit logs |
| **UX** | Enterprise design system, command palette (⌘K), lazy-loaded views |

---

## 5. Current Version

| Artifact | Version |
|----------|---------|
| Recommended product label | **v0.3.0** (API) / monorepo **0.2.0** |
| Stabilization + UI redesign | July 2026 |
| Proposal PDF module | Included (migration `20260721260000_add_proposal_pdf`) |

---

## 6. Overall Completion Percentage

| Area | Estimate | Notes |
|------|----------|-------|
| Core sales stack (destinations → packages → trip → proposal → PDF) | **90%** | Production-oriented APIs + UI |
| Product catalog + approvals | **85%** | CRUD complete; some demo edges |
| CRM / customers / quotations | **70%** | Mix of API + demo store UI |
| Flight/hotel consumer booking UX | **65%** | Large UI; search often mock |
| Finance / wallet / commission | **75%** | API-backed aggregates |
| Platform admin (agencies, monitoring) | **80%** | Super-admin focused |
| Marketing / CMS | **55%** | Basic CRUD surfaces |
| Enterprise UI consistency | **85%** | Design system + polish pass |
| Tests / E2E | **30%** | Backend Vitest present; limited coverage |
| **Overall product** | **~78%** | Suitable for controlled enterprise pilot |

---

## 7. Related Documentation

All detailed docs live under [`/docs`](./):

1. [FEATURE_INVENTORY.md](./FEATURE_INVENTORY.md)  
2. [DATABASE_DOCUMENTATION.md](./DATABASE_DOCUMENTATION.md)  
3. [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)  
4. [UI_COMPONENT_INVENTORY.md](./UI_COMPONENT_INVENTORY.md)  
5. [PAGE_INVENTORY.md](./PAGE_INVENTORY.md)  
6. [WORKFLOW_DOCUMENTATION.md](./WORKFLOW_DOCUMENTATION.md)  
7. [ARCHITECTURE.md](./ARCHITECTURE.md)  
8. [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)  
9. [PROJECT_STATISTICS.md](./PROJECT_STATISTICS.md)  
10. [CODE_QUALITY_REPORT.md](./CODE_QUALITY_REPORT.md)  
11. [PRODUCTION_READINESS_FINAL.md](./PRODUCTION_READINESS_FINAL.md)  

Root also contains historical reports: `PRODUCTION_READINESS.md`, `UI_REDESIGN_REPORT.md`, `PIXEL_PERFECT_UI_AUDIT.md`, `UX_AUDIT.md`, `ENTERPRISE_REVIEW.md`.
