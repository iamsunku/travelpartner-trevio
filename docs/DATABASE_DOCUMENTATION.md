# Database Documentation

**ORM:** Prisma 6 · **DB:** PostgreSQL · **Schema:** `backend/prisma/schema.prisma`  
**Models:** 50 · **Migrations:** under `backend/prisma/migrations/`

---

## ERD Summary (logical)

```
Agency ─┬─ Branch ── User / Employee
        ├─ Settings / AgencyBranding
        ├─ Destination ─┬─ HotelProduct / ActivityProduct / TransferProduct
        │               └─ TravelPackage ─┬─ PackageHotel / PackageActivity / PackageTransfer
        │                                 ├─ PackageDay ── PackageTimelineItem
        │                                 ├─ PackageProductOption
        │                                 └─ PackageVersion
        ├─ Customer ─┬─ Booking ── Payment
        │            ├─ Lead
        │            └─ TravelRequirement ─┬─ TravelRequirementSelection ── TravelPackage
        │                                  └─ TravelProposal ─┬─ ProposalSnapshot
        │                                                     ├─ ProposalHistory
        │                                                     └─ ProposalPdf
        ├─ QuoteTemplate ── QuoteTemplateSection / QuoteTemplateHistory
        └─ WalletTransaction / MarketingCampaign / …

User ── Task / Attendance / Leave / AuditLog / Quotation / …
Supplier ── HotelProduct / ActivityProduct / TransferProduct
SupportTicket ── TicketMessage
```

---

## Core Identity & Tenancy

### User
- **Purpose:** Login identity and RBAC subject  
- **PK:** `id` (UUID)  
- **FK:** `agencyId` → Agency?, `branchId` → Branch?  
- **Key fields:** `email` (unique), `password`, `role`, `permissions` (JSON), `status`  
- **Relations:** Bookings (agent), tasks, leaves, quotations created, etc.

### Agency
- **Purpose:** Multi-tenant travel agency  
- **PK:** `id`  
- **Key fields:** `name`, `plan`, `walletBalance`, `status`, `apiAllocation`  
- **Relations:** Users, branches, bookings, destinations (scoped)

### Branch
- **Purpose:** Agency office location  
- **PK:** `id` · **FK:** `agencyId` → Agency

### Employee
- **Purpose:** HR roster (may pair with User login)  
- **PK:** `id` · fields: salary, targets, `permissions`  
- **Note:** No Prisma FK to User (parallel table)

### Settings
- **Purpose:** Per-agency preferences + `rolePermissions` CRUD overrides  
- **PK:** `id` · unique `agencyId`

### AgencyBranding
- **Purpose:** Colors, logo, watermark, fonts for quotes/PDFs  
- **PK:** `id` · unique `agencyId`

---

## CRM & Sales Records

| Model | Purpose | PK | Important FKs |
|-------|---------|-----|---------------|
| **Customer** | Client profile | `id` | agency scope fields |
| **Lead** | Pipeline lead | `id` | `customerId`?, `assignedToId`→User? |
| **Booking** | Reservation | `id` | `customerId`, `agencyId`, `agentId`→User; unique `bookingRef` |
| **Payment** | Payment/refund | `id` | `bookingId`?, `collectedById`→User?; unique `txnId` |
| **Quotation** | Classic quote | `id` | `createdById`→User; unique `quoteNo` |
| **Task** | Internal work item | `id` | `assignedToId`→User |
| **WalletTransaction** | Wallet ledger | `id` | agencyId |
| **CustomerDocument** | KYC/docs metadata | `id` | `customerId` (logical) |

---

## HR

| Model | Purpose | PK | FKs / constraints |
|-------|---------|-----|-------------------|
| **Attendance** | Daily check-in/out | `id` | `userId`→User; unique `[userId, date]` |
| **Leave** | Leave request | `id` | `userId`, `approvedById`? |
| **EmployeeActivitySnapshot** | Productivity counters | `id` | unique `[userId, date]` |

---

## Platform / Ops

| Model | Purpose |
|-------|---------|
| **AuditLog** | Security/activity trail (`userId`) |
| **Notification** | In-app alerts |
| **MarketingCampaign** | Campaign metrics |
| **ContentPage** | CMS page (`slug` unique) |
| **ContentPost** | CMS post (model present; limited/no routes) |
| **ApiKey** | API key registry |
| **SupportTicket** / **TicketMessage** | Support threads |
| **ApiMetric** / **PerformanceMetric** | Analytics time-series |

---

## Product Catalog

| Model | Purpose | FKs |
|-------|---------|-----|
| **Supplier** | Vendor | agency-scoped |
| **Destination** | Destination master | unique `[agencyId, slug]` |
| **HotelProduct** | Hotel inventory | `supplierId`, `destinationId`? |
| **ActivityProduct** | Activity inventory | same |
| **TransferProduct** | Transfer inventory | same |

---

## Packages

| Model | Purpose | FKs |
|-------|---------|-----|
| **TravelPackage** | Packaged holiday | `destinationId`; unique `[agencyId, packageCode]` |
| **PackageHotel** | M2M hotel link | `packageId`, `hotelProductId` |
| **PackageActivity** | M2M activity | `packageId`, `activityProductId` |
| **PackageTransfer** | M2M transfer | `packageId`, `transferProductId` |
| **PackageProductOption** | Option groups / alternates | `packageId` |
| **PackageVersion** | Version snapshots | `packageId` |
| **PackageDay** | Itinerary day | `packageId` |
| **PackageTimelineItem** | Day activities | `packageDayId` |

---

## Trip Planner & Proposals

| Model | Purpose | FKs |
|-------|---------|-----|
| **TravelRequirement** | Customer trip ask | `customerId`?, `leadId`?, `destinationId`? |
| **TravelRequirementSelection** | Chosen package match | `requirementId`, `packageId` |
| **TravelRequirementHistory** | Audit trail | `requirementId` |
| **QuoteTemplate** | Template definition | agency-scoped |
| **QuoteTemplateSection** | Ordered sections | `templateId` |
| **QuoteTemplateHistory** | Template history | `templateId` |
| **TravelProposal** | Customer proposal | `travelRequirementId`?, `customerId`?, `leadId`? |
| **ProposalSnapshot** | Frozen version JSON | `proposalId` |
| **ProposalHistory** | Status/history | `proposalId` |
| **ProposalPdf** | Generated PDF artifact | `proposalId` |

---

## Indexing & Conventions

- IDs are UUID strings (`@default(uuid())`)
- Soft lifecycle often via `status` string fields (`Draft`, `Active`, `Archived`, …)
- Multi-tenancy primarily via `agencyId` filters in routes (`agencyScope`)
- JSON columns used for flexible product attributes, snapshots, allocations

---

## Migration Notes for New Developers

```bash
cd backend
npx prisma generate
npx prisma migrate deploy   # production / local Prisma Postgres
npx prisma studio           # optional GUI
```

Local Prisma Postgres may use a dynamic port (e.g. `51214`) via `npx prisma dev`.
