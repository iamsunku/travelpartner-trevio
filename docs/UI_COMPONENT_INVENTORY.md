# UI Component Inventory

**Last updated:** July 22, 2026

---

## 1. Design-system / shared helpers

**Path:** `frontend/src/components/shared/ui-helpers.tsx`

| Component | Purpose |
|-----------|---------|
| `PageShell` | Page vertical rhythm (32px section gap) |
| `PageHeader` | Title, subtitle, eyebrow, actions |
| `SectionHeader` | Card/section titles |
| `MetricCard` | KPI tile with icon, trend, hover accent |
| `BrandHero` | Gradient welcome/hero banner |
| `StatusBadge` | Unified status / tier / priority chip |
| `formatINR` / `formatFullINR` | Currency display |
| `initials` / `avatarGradient` | Avatar helpers |

---

## 2. Enterprise catalog primitives

**Path:** `frontend/src/components/shared/enterprise/`

| Component | Purpose |
|-----------|---------|
| `EnterprisePageHeader` | Breadcrumbs + PageHeader + help/favorite hooks |
| `CatalogToolbar` | Search + filters + actions surface |
| `CatalogTable` / `CatalogTableHead` | Scrollable table shell + sticky header |
| `CatalogPagination` | Prev/next + “Showing x–y of z” |
| `EmptyState` / `TableEmptyRow` | Empty list UX (+ optional secondary CTA) |
| `PageLoadingSkeleton` / `TableLoadingRows` / `CardGridLoadingSkeleton` | Skeleton loaders |
| `DetailBackButton` | Contextual back control |
| `ActivityTimeline` | History timeline |
| `QuickActionsBar` / `WorkflowLinks` | Detail quick actions |

---

## 3. Domain shared components

| Component | Domain |
|-----------|--------|
| `destination-catalog/detail/form-dialog/select` | Destinations |
| `product-catalog` / `product-form-dialog` | Hotels / activities / transfers |
| `package-catalog/detail/wizard` | Packages |
| `package-itinerary-builder/preview` | Itinerary |
| `package-product-options-builder` | Option groups |
| `package-match-card` | Trip matching |
| `trip-planner-catalog/workspace` | Trip planner |
| `trip-requirement-detail` | Requirement detail |
| `trip-customize-panel` / `trip-price-panel` | Customize + pricing |
| `travel-proposal-catalog/workspace/detail` | Proposals |
| `proposal-pdf-progress-dialog` | PDF generation UX |
| `quote-template-*` (catalog, builder, preview, workspace, detail) | Templates |
| `payment-modal` | Payment capture |
| `share-ticket` | Share booking |
| `city-search-field` | City autocomplete |
| `theme-provider` | Light/dark |

---

## 4. Layout chrome

| Component | Path | Purpose |
|-----------|------|---------|
| `AppShell` | `layout/app-shell.tsx` | Auth shell, lazy views, skip link |
| `Sidebar` | `layout/sidebar.tsx` | Collapsible nav, groups, active state |
| `Topbar` | `layout/topbar.tsx` | Search, notifications, theme, profile |
| `Footer` | `layout/footer.tsx` | Legal / support links |
| `GlobalSearch` | `layout/global-search.tsx` | ⌘K command palette |

---

## 5. shadcn/ui primitives

**Path:** `frontend/src/components/ui/` (**48** components)

Buttons · Cards · Tables · Forms · Dialog · Alert Dialog · Sheet · Drawer · Tabs · Accordion · Badge · Avatar · Breadcrumb · Checkbox · Switch · Select · Input · Textarea · Label · Popover · Dropdown Menu · Context Menu · Menubar · Navigation Menu · Command · Tooltip · Toast / Toaster · Sonner · Skeleton · Progress · Slider · Radio Group · Toggle / Toggle Group · Calendar · Carousel · Chart · Scroll Area · Separator · Resizable · Pagination · Hover Card · Aspect Ratio · Alert · Sidebar (primitive) · Input OTP · Collapsible

**Button variants:** `default` | `destructive` | `outline` | `secondary` | `ghost` | `link`  
**Sizes:** `sm` | `default` | `lg` | `icon`

---

## 6. Auth

| Component | Purpose |
|-----------|---------|
| `login-screen.tsx` | Email/password + forgot password |

---

## 7. Patterns (not separate packages)

| Pattern | Where |
|---------|--------|
| Metric grids | `grid-cols-2 md:grid-cols-4 gap-6` |
| Sticky form footer | Branding view (reference) |
| Catalog page | Header → Toolbar → Table → Pagination / Empty |
| Detail page | Back → Header → Tabs → Timeline / actions |

---

## 8. Icons

Lucide React throughout (`lucide-react`). Nav icons configured in `nav-config.tsx`.
