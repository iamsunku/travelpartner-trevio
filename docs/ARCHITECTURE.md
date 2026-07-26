# Architecture

**Last updated:** July 22, 2026

---

## 1. High-level system

```
┌─────────────────────┐     HTTPS/JSON      ┌──────────────────────┐
│  Next.js Frontend   │ ←─────────────────→ │  Express API         │
│  (SPA shell)        │   Bearer JWT        │  + Prisma Client     │
└─────────────────────┘                     └──────────┬───────────┘
                                                       │
                                                       ▼
                                               PostgreSQL
```

Monorepo workspaces: `frontend/` (`travelpro-frontend`), `backend/` (`travelpro-backend`).

---

## 2. Frontend architecture

### Entry

- `src/app/layout.tsx` — root layout, fonts, globals.css  
- `src/app/page.tsx` — auth gate → `LoginScreen` or `AppShell`

### Navigation

- Not Next App Router multi-page; **one route** `/`
- `useAppStore.activeView` + URL `?view=`
- Lazy view registry via `next/dynamic` in `AppShell`

### State management

| Store | Persistence | Responsibility |
|-------|-------------|----------------|
| `useAuthStore` | `localStorage` `tpp-auth` | User, token, login/logout |
| `useAppStore` | `tpp-app` | Active view, sidebar, theme sync |
| `useDemoDataStore` | memory (+ hydrate) | Domain lists for demo/hybrid UI |

### Data fetching

- `apiFetch` / `api` object in `lib/api.ts`
- `useApiSync` hydrates demo store when API healthy
- Newer modules (destinations, packages, trip, proposals, templates) call APIs directly in components

### Authorization (client)

- `lib/permissions.ts` mirrors backend modules
- `nav-config.tsx` filters sidebar + `canAccessView`
- Server remains source of truth for mutations

### Shared UI layers

1. **shadcn/ui** — primitives  
2. **ui-helpers** — page/metric/status primitives  
3. **enterprise/** — catalog/detail patterns  
4. **domain shared/** — feature-specific builders  

---

## 3. Backend architecture

### Entry

- `src/server.ts` → creates HTTP server from `src/app.ts`
- `app.ts` mounts middleware (helmet, cors, rate limit, logging) and routes

### Route organization

| Style | Location |
|-------|----------|
| Inline REST | Large surface in `app.ts` (auth, bookings, CRM, finance, …) |
| Mounted routers | `routes/products`, `destinations`, `packages`, `trip-planner`, `quote-templates`, `travel-proposals`, `proposal-pdf`, `analytics` |

### Cross-cutting libs

| Lib | Role |
|-----|------|
| `middleware/auth.ts` | JWT + permission/CRUD checks |
| `lib/permissions.ts` | Modules, role defaults, CRUD matrix |
| `lib/validation.ts` | Zod schemas |
| `lib/db.ts` | Prisma client |
| `lib/jwt.ts` | Sign/verify |
| `lib/logger.ts` | Pino |
| `lib/proposal-snapshot.ts` / `proposal-pdf/*` | Proposal domain |
| `lib/package-matching.ts` | Trip matching |
| `lib/email.ts` | Optional SendGrid |

### Multi-tenancy

- `agencyScope(req)` / `branchScope(req)` applied on list/write endpoints
- `super_admin` bypasses agency filter

---

## 4. Folder structure (abbreviated)

```
travelpartner-trevio/
├── frontend/
│   ├── src/app/                 # Next layout + page + globals.css
│   ├── src/components/
│   │   ├── layout/              # Shell chrome
│   │   ├── views/               # One file per ViewKey (+ helpers)
│   │   ├── shared/              # Domain + enterprise + ui-helpers
│   │   ├── ui/                  # shadcn
│   │   └── auth/
│   ├── src/hooks/
│   ├── src/lib/
│   ├── src/store/
│   └── src/types/
├── backend/
│   ├── prisma/schema.prisma
│   ├── prisma/migrations/
│   └── src/
│       ├── app.ts / server.ts
│       ├── routes/
│       ├── middleware/
│       └── lib/
├── docs/                        # This documentation set
└── package.json                 # Workspaces root
```

---

## 5. Authentication & authorization

1. Login → bcrypt verify → JWT (`userId`, `role`, `agencyId`, …)  
2. Client stores token in Zustand persist  
3. `apiFetch` attaches `Authorization: Bearer`  
4. Middleware reloads user from DB for permission checks (not JWT-only)  
5. Optional agency `Settings.rolePermissions` overrides CRUD

**Roles:** `super_admin`, `agency_admin`, `branch_manager`, `employee`, `accountant`, `sales_executive`, `product_executive` (+ customer in schema comments)

**Modules:** 36 keys (see `permissions.ts`)

---

## 6. Reusable hooks

| Hook | Purpose |
|------|---------|
| `useApiSync` | Health + hydrate on login |
| `useDebouncedValue` | Debounced search inputs |
| `useSubmitLock` | Prevent double submits |
| `useToast` | Toast API |
| `useIsMobile` | Breakpoint helper |

**Context providers:** Theme (`ThemeProvider` / next-themes). No broad React Context domain providers — Zustand preferred.

---

## 7. Design / UX architecture

- Tokens in `globals.css` (`:root` / `.dark`)
- Enterprise catalog pattern for new modules
- Command palette for power users
- Lazy-loaded views for bundle performance

See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md).
