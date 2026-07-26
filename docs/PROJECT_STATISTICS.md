# Project Statistics

**Measured:** July 22, 2026 (approximate; from repository analysis)

---

## Counts

| Metric | Count |
|--------|------:|
| **In-app pages (ViewKeys)** | 37 |
| **View files** (`components/views`) | 41 |
| **Shared components** (domain + enterprise) | ~42 |
| **shadcn UI primitives** | 48 |
| **Layout components** | 5 (shell, sidebar, topbar, footer, global-search) |
| **Hooks** | 5 |
| **Zustand stores / slices** | 2 files (`useAuthStore`, `useAppStore`, `useDemoDataStore`) |
| **React Context providers** | ~1 primary (`ThemeProvider`) |
| **Backend Prisma models** | 50 |
| **Backend route modules** | 8 mounted + large `app.ts` surface |
| **Permission modules** | 36 |
| **Approx. API endpoints** | **~150+** (CRUD expansions included) |
| **Frontend LOC (`src/`)** | ~34,000 |
| **Backend LOC (`src/`)** | ~10,500 |
| **Combined app LOC (est.)** | **~45,000+** (excl. lockfiles/node_modules) |

---

## Pages by nav section

| Section | Pages |
|---------|------:|
| Overview | 1 |
| Bookings | 4 |
| Products | 5 |
| Sales & CRM | 5 (+ branding/templates under Settings) |
| Finance | 4 |
| Insights | 2 |
| Team & Ops | 5 |
| Settings | 2 |
| Platform | 9 |

---

## Largest frontend modules (by file size / complexity)

| Module | Why large |
|--------|-----------|
| `flights.tsx` / `hotels.tsx` | Full booking UX in one view |
| `dashboard.tsx` | Three role dashboards |
| `package-wizard` + itinerary builders | Multi-step product composition |
| `crm.tsx` | Kanban + table |
| `travel-proposal-detail` | Snapshot editor + PDF + status |
| `quote-template-builder` | DnD section builder |

---

## Largest backend surfaces

| Area | Location |
|------|----------|
| Core REST | `src/app.ts` |
| Products | `routes/products.ts` |
| Packages | `routes/packages.ts` |
| Destinations | `routes/destinations.ts` |
| Proposals + PDF | `travel-proposals.ts`, `proposal-pdf.ts`, `lib/proposal-pdf/*` |

---

## Database

| Item | Count |
|------|------:|
| Models | 50 |
| Migration folders (feature era 2026-07) | 9+ including PDF |

---

## Shared enterprise primitives

EnterprisePageHeader · CatalogToolbar · CatalogTable · CatalogPagination · EmptyState · Loading skeletons · DetailBackButton · ActivityTimeline · QuickActions

---

## Test footprint

| Area | Notes |
|------|-------|
| Backend | Vitest configured (`npm run test:backend`) |
| Frontend | ESLint; limited automated UI tests |
| E2E | Not a first-class suite in-repo |

---

## Dependency highlights

Frontend: Next 16, React 19, Radix/shadcn, Zustand, Recharts, Framer Motion, dnd-kit  
Backend: Express, Prisma, JWT, Zod, pdfkit, SendGrid (optional), Pino
