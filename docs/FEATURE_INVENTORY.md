# Feature Inventory

**Last updated:** July 22, 2026  
**Status legend:** Complete · Partial · Planned

---

## Overview Modules

### Dashboard
| Field | Detail |
|-------|--------|
| **Purpose** | Role-aware home: KPIs, revenue charts, quick actions, destinations/packages insights |
| **Status** | Partial (API insights + demo store mix) |
| **Main screens** | `dashboard` (Agency / Super Admin / Employee layouts) |
| **APIs** | `GET /api/dashboard`, agencies/finance stats |
| **DB** | Aggregates over Booking, Agency, Destination, TravelPackage, etc. |
| **Components** | `BrandHero`, `MetricCard`, Recharts, `PageShell` |

---

## Bookings

### Flights
| Field | Detail |
|-------|--------|
| **Purpose** | Search and book flights |
| **Status** | Partial (mock search API) |
| **Screens** | `flights` |
| **APIs** | `GET /api/flights/search` |
| **DB** | Creates `Booking` records |
| **Components** | Large view-local UI, `payment-modal` |

### Hotels (consumer booking)
| Field | Detail |
|-------|--------|
| **Purpose** | Search/book hotels for travelers |
| **Status** | Partial (mock search) |
| **Screens** | `hotels` |
| **APIs** | `GET /api/hotels/search` |
| **DB** | `Booking` |
| **Components** | View-local cards, payment modal |

### Holiday Packages (booking)
| Field | Detail |
|-------|--------|
| **Purpose** | Browse/book holiday offers |
| **Status** | Partial |
| **Screens** | `holiday` |
| **APIs** | Bookings + packages (partial) |
| **DB** | `Booking`, packages |

### Booking Management
| Field | Detail |
|-------|--------|
| **Purpose** | List/update booking status & payment |
| **Status** | Complete (API) / Partial UI demo hydrate |
| **Screens** | `bookings` |
| **APIs** | `GET/POST/PATCH/DELETE /api/bookings` |
| **DB** | `Booking` |
| **Components** | Tables, `StatusBadge`, filters |

---

## Products

### Destinations
| Field | Detail |
|-------|--------|
| **Purpose** | Destination master (SEO, media, visa, attractions) |
| **Status** | Complete |
| **Screens** | `destinations` (+ catalog/detail/form) |
| **APIs** | Full CRUD `/api/destinations/*` |
| **DB** | `Destination` |
| **Components** | `destination-catalog`, `destination-detail`, `destination-form-dialog`, enterprise header/toolbar |

### Hotel Products
| Field | Detail |
|-------|--------|
| **Purpose** | Supplier hotel inventory & rates |
| **Status** | Complete |
| **Screens** | `hotel-products` |
| **APIs** | `/api/products/hotels/*` |
| **DB** | `HotelProduct`, `Supplier` |
| **Components** | `product-catalog`, `product-form-dialog` |

### Activities & Transfers
| Field | Detail |
|-------|--------|
| **Purpose** | Activity/transfer catalog + rate approval |
| **Status** | Complete |
| **Screens** | `activity-packages`, `product-approvals` |
| **APIs** | `/api/products/activities/*`, `/api/products/transfers/*`, approve/reject |
| **DB** | `ActivityProduct`, `TransferProduct` |
| **Components** | `product-catalog`, approval view |

### Packages
| Field | Detail |
|-------|--------|
| **Purpose** | Build/publish holiday packages with itinerary & options |
| **Status** | Complete |
| **Screens** | `packages` |
| **APIs** | `/api/packages/*` (CRUD, publish, itinerary, product-options, versions) |
| **DB** | `TravelPackage`, `PackageHotel/Activity/Transfer`, `PackageDay`, `PackageTimelineItem`, `PackageProductOption`, `PackageVersion` |
| **Components** | `package-catalog`, `package-wizard`, `package-detail`, itinerary builders |

---

## Sales & CRM

### CRM / Leads
| Field | Detail |
|-------|--------|
| **Purpose** | Lead pipeline (kanban + table) |
| **Status** | Partial (demo store–heavy UI; API exists) |
| **Screens** | `crm` |
| **APIs** | `GET/POST/PATCH /api/leads` |
| **DB** | `Lead` |
| **Components** | View-local kanban, `StatusBadge` |

### Customers
| Field | Detail |
|-------|--------|
| **Purpose** | Customer directory, loyalty tiers, profiles |
| **Status** | Partial (enterprise UI; demo data common) |
| **Screens** | `customers` |
| **APIs** | `GET/POST/PATCH/DELETE /api/customers`, documents |
| **DB** | `Customer`, `CustomerDocument` |
| **Components** | Enterprise header/toolbar/table, sheet profile |

### Trip Planner
| Field | Detail |
|-------|--------|
| **Purpose** | Capture requirements, match packages, price, select |
| **Status** | Complete |
| **Screens** | `trip-planner` |
| **APIs** | `/api/trip-requirements/*` |
| **DB** | `TravelRequirement`, `TravelRequirementSelection`, `TravelRequirementHistory` |
| **Components** | catalog, workspace, detail, match card, price/customize panels |

### Travel Proposals
| Field | Detail |
|-------|--------|
| **Purpose** | Snapshot-based proposals + status workflow + PDF |
| **Status** | Complete |
| **Screens** | `travel-proposals` |
| **APIs** | `/api/travel-proposals/*`, PDF generate/download |
| **DB** | `TravelProposal`, `ProposalSnapshot`, `ProposalHistory`, `ProposalPdf` |
| **Components** | catalog, workspace, detail, PDF progress dialog |

### Quotations
| Field | Detail |
|-------|--------|
| **Purpose** | Classic quotation records |
| **Status** | Partial |
| **Screens** | `quotations` (+ intl quotation dialog helper) |
| **APIs** | `GET/POST/PATCH /api/quotations` |
| **DB** | `Quotation` |

### Quote Templates
| Field | Detail |
|-------|--------|
| **Purpose** | Reusable proposal/quote section templates |
| **Status** | Complete |
| **Screens** | `quote-templates` |
| **APIs** | `/api/quote-templates/*` |
| **DB** | `QuoteTemplate`, `QuoteTemplateSection`, `QuoteTemplateHistory` |
| **Components** | catalog, builder, preview, workspace, detail |

---

## Finance

| Module | Status | Screens | APIs | DB |
|--------|--------|---------|------|-----|
| Payments | Partial | `payments` | `/api/payments`, Razorpay order/verify | `Payment` |
| Wallet | Partial | `wallet` | `/api/wallet` | `WalletTransaction`, Agency.walletBalance |
| Commission | Partial | `commission` | `/api/commission` | Aggregates over bookings |
| Finance / GST | Partial | `finance` | `/api/finance` | Aggregates |

---

## Insights

| Module | Status | Screens | APIs |
|--------|--------|---------|------|
| Reports | Partial | `reports` | `/api/reports` |
| Platform Analytics | Partial | `analytics` | `/api/analytics/*` (super_admin), `/api/analytics/platform` |

---

## Team & Ops

| Module | Status | Screens | APIs | DB |
|--------|--------|---------|------|-----|
| Employees | Complete | `employees` | `/api/employees` | `Employee`, `User` |
| Attendance & Leave | Complete | `attendance` | `/api/attendance`, `/api/leaves` | `Attendance`, `Leave` |
| Tasks | Complete | `tasks` | `/api/tasks` | `Task` |
| Support | Partial | `support` | `/api/support/tickets` | `SupportTicket`, `TicketMessage` |
| Notifications | Partial | `notifications` | `/api/notifications` | `Notification` |

---

## Settings

| Module | Status | Screens | APIs | DB |
|--------|--------|---------|------|-----|
| Branding | Complete | `branding` | `GET/PATCH /api/settings/branding` | `AgencyBranding` |
| Settings / Roles | Complete | `settings` | `/api/settings`, role-permissions | `Settings` |
| Quote Templates | Complete | (above) | | |

---

## Platform (Super Admin)

| Module | Status | Screens | APIs | DB |
|--------|--------|---------|------|-----|
| Agencies | Complete | `agencies` | `/api/agencies` | `Agency` |
| Branches | Complete | `branches` | `/api/branches` | `Branch` |
| API Marketplace | Partial | `api-marketplace` | — / keys | — |
| API Management | Partial | `api-management` | `/api/management/keys` | `ApiKey` |
| Monitoring | Partial | `monitoring` | `/api/monitoring/metrics` | process metrics |
| Marketing | Partial | `marketing` | `/api/marketing/campaigns` | `MarketingCampaign` |
| CMS | Partial | `cms` | `/api/cms/pages` | `ContentPage` (`ContentPost` model unused by routes) |
| Audit Logs | Complete | `audit-logs` | `/api/audit-logs` | `AuditLog` |

---

## Cross-cutting

| Feature | Status | Notes |
|---------|--------|-------|
| Auth (login / me / forgot password) | Complete | JWT |
| RBAC (36 modules + CRUD) | Complete | DB-backed checks |
| Command palette (⌘K) | Complete | Search + quick create |
| Enterprise design system | Complete | Tokens + shared enterprise components |
| Proposal PDF | Complete | pdfkit renderer + storage |
| Email (SendGrid) | Partial | Optional; falls back to logs |
