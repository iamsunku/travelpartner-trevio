# Workflow Documentation

**Last updated:** July 22, 2026  
Business workflows as implemented — no code changes in this document.

---

## 1. End-to-end sales journey

```
Lead (CRM)
   ↓  (optional convert / link)
Customer
   ↓
Trip Requirement (Trip Planner)
   ↓  match packages → select package → price
Travel Proposal (from requirement)
   ↓  edit snapshot → internal review → approve → send
Proposal PDF generate / download
   ↓  (optional)
Booking / Quotation / Payment
```

### Details

| Step | Module | Notes |
|------|--------|-------|
| Lead | CRM | Stages: New → … → Won/Lost |
| Customer | Customers | Profile, tier, documents |
| Requirement | Trip Planner | Destination, dates, pax, budget, preferences |
| Matching | Trip Planner | `recommendations` API + match score |
| Proposal | Travel Proposals | Frozen snapshot of package/itinerary/pricing/template/branding |
| Status | Proposal detail | Draft → Internal Review → Approved → Sent → Viewed → Accepted/Rejected → Booked |
| PDF | Proposal PDF | `POST …/generate-pdf` → store `ProposalPdf` |

Creating a proposal from a requirement can move the requirement status toward **Quoted**.

---

## 2. Package creation

```
Destination (must exist)
   ↓
Create Travel Package (wizard)
   ↓
Attach hotels / activities / transfers
   ↓
Build itinerary (days + timeline items)
   ↓
Configure product option groups
   ↓
Save versions → Publish
```

**Statuses (typical):** Draft → Published/Active → Unpublished → Archived  
**UI:** `packages` → catalog → wizard / detail / itinerary / options builders  
**API:** `/api/packages/*`

---

## 3. Destination management

```
Create Destination (Draft)
   ↓
Enrich content (SEO, gallery, visa, attractions)
   ↓
Activate
   ↓
Link products (hotels/activities/transfers) & packages
```

Supports duplicate, archive, bulk status, import.

---

## 4. Product rate approval

```
Create Hotel / Activity / Transfer (Draft)
   ↓
Submit for approval
   ↓
Admin Approve → live rates
   or Reject → back to Draft (+ optional email)
```

**UI:** Product catalogs + `product-approvals`  
**Email:** SendGrid optional via `backend/src/lib/email.ts`

---

## 5. Branding & quote templates

```
Settings → Branding
   ↓  colors, logo, watermark, fonts
Quote Templates
   ↓  sections (DnD builder) → preview → set default
Travel Proposal / PDF
   ↓  apply branding + template snapshot
```

---

## 6. Booking & payment (operational)

```
Search Flights / Hotels / Holiday (often mock inventory)
   ↓
Create Booking
   ↓
Collect Payment (manual / Razorpay order+verify)
   ↓
Update booking paymentStatus / wallet ledger
```

---

## 7. Agency onboarding (super admin)

```
Create Agency (+ owner user)
   ↓
Create Branches
   ↓
Create Employees (login users)
   ↓
Configure Settings / role permissions
   ↓
Fund Wallet / allocate APIs
```

---

## 8. HR workflow

```
Employee check-in / check-out (Attendance)
Leave request → Manager approve/reject
Tasks assigned → status updates
```

---

## 9. Support workflow

```
Create Support Ticket
   ↓
Thread messages (TicketMessage)
   ↓
Resolve / close
```

---

## Workflow ownership map

| Workflow | Primary permission modules |
|----------|----------------------------|
| Trip → Proposal → PDF | `trip-planner`, `travel-proposals`, `quote-templates` |
| Packages | `packages`, `destinations` |
| Products | `hotels`, `activities`, `transfers`, `suppliers` |
| CRM | `crm`, `customers` |
| Finance | `payments`, `wallet`, `commission`, `finance` |
| Platform | `agencies`, `branches`, `settings`, `monitoring` |
