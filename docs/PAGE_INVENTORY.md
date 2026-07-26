# Page Inventory

**Routing model:** Single Next.js route `/` · in-app pages via `?view=<ViewKey>`  
**Registry:** `frontend/src/components/layout/app-shell.tsx`  
**Access:** `canAccessView(user, view)` from `nav-config.tsx`

**Responsive:** Shell supports mobile drawer sidebar; pages use responsive CSS grids. Dense booking UIs (flights/hotels) are laptop-first.

**Status:** Complete = API + polished UI · Partial = works with demo/mock gaps · Legacy = file exists, not in nav registry

---

## Overview

| Route (view) | Purpose | Key components | Responsive | Status |
|--------------|---------|----------------|------------|--------|
| `dashboard` | Role home KPIs & charts | BrandHero, MetricCard, Recharts | Yes | Partial |

---

## Bookings

| view | Purpose | Key components | Status |
|------|---------|----------------|--------|
| `flights` | Flight search & book | View-local, payment-modal | Partial |
| `hotels` | Hotel search & book | View-local | Partial |
| `holiday` | Holiday browse/book | View-local | Partial |
| `bookings` | Booking management | Tables, StatusBadge | Partial |

---

## Products

| view | Purpose | Key components | Status |
|------|---------|----------------|--------|
| `destinations` | Destination master | destination-catalog/detail | Complete |
| `hotel-products` | Hotel products | product-catalog | Complete |
| `activity-packages` | Activities & transfers | product-catalog | Complete |
| `packages` | Package builder | package-catalog/wizard/detail | Complete |
| `product-approvals` | Rate approvals | Approvals table | Complete |

---

## Sales & CRM

| view | Purpose | Key components | Status |
|------|---------|----------------|--------|
| `crm` | Leads pipeline | Kanban + table | Partial |
| `customers` | Customer directory | Enterprise catalog + sheet | Partial |
| `trip-planner` | Requirements & matching | trip-planner-* | Complete |
| `travel-proposals` | Proposals + PDF | travel-proposal-*, PDF dialog | Complete |
| `quotations` | Quotations | Tables / dialogs | Partial |
| `quote-templates` | Template engine | quote-template-* | Complete |
| `branding` | Agency branding | Form + preview + sticky footer | Complete |

---

## Finance

| view | Purpose | Status |
|------|---------|--------|
| `payments` | Payments ledger | Partial |
| `wallet` | Agency wallet | Partial |
| `commission` | Commission reports | Partial |
| `finance` | Finance / GST | Partial |

---

## Insights

| view | Purpose | Status |
|------|---------|--------|
| `reports` | Reports & charts | Partial |
| `analytics` | Platform analytics (`analytics-dashboard`) | Partial |

---

## Team & Ops

| view | Purpose | Status |
|------|---------|--------|
| `employees` | Employee HR | Complete |
| `attendance` | Attendance & leave | Complete |
| `tasks` | Task management | Complete |
| `support` | Support tickets | Partial |
| `notifications` | Notifications center | Partial |

---

## Platform

| view | Purpose | Status |
|------|---------|--------|
| `agencies` | Agency management | Complete |
| `branches` | Branches | Complete |
| `api-marketplace` | Marketplace | Partial |
| `api-management` | API keys | Partial |
| `monitoring` | System monitoring | Partial |
| `marketing` | Campaigns | Partial |
| `cms` | CMS pages | Partial |
| `audit-logs` | Audit trail | Complete |
| `settings` | Agency settings / roles | Complete |

---

## Non-nav / helper screens

| File | Notes |
|------|-------|
| `activities.tsx` / `transfers.tsx` | Legacy ProductCatalog wrappers — **not** in VIEW_REGISTRY |
| `international-quotation.tsx` | Dialog helper, not a ViewKey |
| `analytics-dashboard.tsx` | Used by `analytics` view |
| Login | `components/auth/login-screen.tsx` at `/` when logged out |

---

## Deep-link examples

```
http://localhost:3000/?view=dashboard
http://localhost:3000/?view=trip-planner
http://localhost:3000/?view=travel-proposals
http://localhost:3000/?view=packages
```
