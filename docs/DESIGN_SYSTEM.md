# Design System

**Source of truth:** `frontend/src/app/globals.css`  
**Components:** shadcn/ui + `ui-helpers` + `enterprise/*`  
**Last updated:** July 22, 2026 (enterprise redesign + pixel polish)

---

## Brand

| Token | Meaning |
|-------|---------|
| `--brand-blue` | Primary brand ≈ `#2A7BBD` |
| `--brand-teal` | Accent ≈ `#00A79D` |
| `--primary` | Maps to brand blue |
| Gradients | `.bg-brand-gradient`, `.text-gradient-brand` |

Light theme is default; dark mode via `.dark` / next-themes.

---

## Color roles

| Role | Token |
|------|-------|
| Background / foreground | `--background`, `--foreground` |
| Card / popover | `--card`, `--popover` |
| Secondary / muted | `--secondary`, `--muted` |
| Accent | teal-tinted `--accent` |
| Destructive | `--destructive` |
| Success / warning / info | `--success`, `--warning`, `--info` |
| Border / input / ring | `--border`, `--input`, `--ring` |
| Charts | `--chart-1` … `--chart-5` |
| Sidebar | `--sidebar*` set |

---

## Typography

| Utility / role | Size | Weight |
|----------------|------|--------|
| Page title | `--text-page-title` (24px) | 600 |
| Section title | 15px | 600 |
| Card title | 14px | 600 |
| Body | 14px | 400 |
| Caption | 12px | 400 |
| Label | 12px | 500 |
| Helper | 11px | 400 |

**Fonts:** Geist Sans / Geist Mono (Next font → CSS vars).

Utilities: `.text-page-title`, `.text-section-title`, `.text-card-title`, `.text-body`, `.text-caption`, `.text-label`, `.text-helper`.

---

## Spacing (8px system)

| Token | Value |
|-------|-------|
| `--space-2` | 8px |
| `--space-4` | 16px |
| `--space-6` | 24px (card gap / inset) |
| `--space-8` | 32px (page / section) |
| `--space-page` | 32px |
| `--space-section` | 32px |
| `--space-card` / `--space-grid` / `--space-inset` | 24px |

`.page-shell` uses section spacing. Main content padding: `px-4` → `sm:px-6` → `lg:px-8`.

---

## Grid & layout

| Rule | Value |
|------|-------|
| Max content width | 1600px |
| Desktop optimization | ~1440px |
| KPI grids | 2 → 4 columns, `gap-6` |
| Dashboard charts | 12-column (`lg:col-span-8/4/6`) |
| Forms | Max 2 columns |

Breakpoints (project convention):

| Name | Range |
|------|-------|
| Mobile | 0–767 |
| Tablet | 768–1023 |
| Laptop | 1024–1439 |
| Desktop | 1440+ |
| Ultra | 1600+ |

---

## Radius & elevation

| Token | Use |
|-------|-----|
| `--radius` | 0.75rem base |
| `--shadow-card` | Default card edge |
| `--shadow-xs` / `--shadow-sm` | Subtle elevation |

Cards: `rounded-xl`, border, `shadow-[var(--shadow-card)]`.

---

## Buttons

| Variant | Use |
|---------|-----|
| `default` | Primary actions |
| `secondary` | Neutral filled |
| `outline` | Secondary |
| `ghost` | Tertiary / icon |
| `destructive` | Dangerous |
| `link` | Inline |

Sizes: `sm` (32px), `default` (36px), `lg` (44px), `icon` (36×36).

---

## Forms

- Input / Select height: **36px** (`h-9`), `rounded-lg`
- Label: `.text-label`, spacing `space-y-1.5` above control
- Focus: `ring-ring/40` + border
- Reference sticky footer: Branding view

---

## Tables

- Header: uppercase helper text, `h-11`, sticky in catalogs
- Cells: `px-4 py-3`
- Row hover: muted wash + `transition-enterprise`

---

## Status badges

`StatusBadge` maps domain statuses (booking, proposal, package, CRM, tiers, priorities) to soft colored chips.

---

## Motion

| Token | Duration |
|-------|----------|
| `--duration-fast` | 150ms |
| `--duration-base` | 200ms |
| `--duration-slow` | 250ms |
| `--ease-standard` | cubic-bezier(0.2, 0, 0, 1) |

Class: `.transition-enterprise`. Prefer skeletons over spinners.

---

## Icons

Lucide React. Prefer 16–18px in nav/actions; decorative icons `aria-hidden`.

---

## Accessibility baselines

- Skip to main content link in AppShell  
- Focus-visible rings on interactive controls  
- Sidebar `aria-current="page"`  
- Icon buttons should carry `aria-label`  
- Empty states use `role="status"`
