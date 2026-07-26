# Code Quality Report

**Last updated:** July 22, 2026  
**Scope:** Observation-only (no refactors performed for this document)

---

## 1. Technical debt

| Item | Severity | Notes |
|------|----------|-------|
| Monolithic `backend/src/app.ts` | High | Large surface of unrelated routes; harder to test/review |
| Dual data sources (API vs `demo-data-store`) | High | Some screens show hydrated demo even when API exists |
| Transfer approve/reject permission uses `activities` module | Medium | Incorrect module gate in products routes |
| Orphan views `activities.tsx` / `transfers.tsx` | Low | Not in VIEW_REGISTRY |
| `ContentPost` model without routes | Low | Dead schema surface |
| Employee vs User dual tables | Medium | Onboarding must keep both in sync carefully |
| Hardcoded demo strings on dashboard | Low | e.g. “3 pending approvals” copy |
| Analytics dashboard raw `fetch` + token key mismatch risk | Medium | Prefer `apiFetch` + `tpp-auth` token |
| Limited automated tests | High | Regressions caught manually |

---

## 2. Duplicate code

| Pattern | Where | Suggestion |
|---------|-------|------------|
| Catalog list/load/search | Multiple `*-catalog.tsx` | Already converging on enterprise toolbar; extract shared `useCatalogQuery` |
| Status color maps | Mostly centralized in `StatusBadge` | Keep extending map instead of local badges |
| Card header padding | Some views still `px-5` | Prefer Card defaults / `p-6` |
| Role dashboards | `dashboard.tsx` | Could split files without behavior change |
| Product CRUD UI | hotels/activities/transfers | `product-catalog` already shared — good |

---

## 3. Potential improvements (non-breaking)

1. Split `app.ts` into route modules matching domains  
2. Finish migrating CRM/Bookings/Quotations to enterprise catalog pattern  
3. Wire all list screens exclusively to API (reduce demo store)  
4. Add OpenAPI generation from Zod  
5. Table virtualization for 500+ rows  
6. E2E smoke: login → trip → proposal → PDF  
7. Fix transfers approval permission module  
8. Unify toast systems (shadcn toast vs unused sonner file)  
9. Add unsaved-changes guards on builders  
10. CI: `tsc` + vitest + lint on PR  

---

## 4. Unused / low-use files

| File | Notes |
|------|-------|
| `views/activities.tsx`, `views/transfers.tsx` | Not registered in shell |
| `ui/sonner.tsx` | Prefer one toast approach |
| Parts of `ui/sidebar.tsx` (shadcn) | App uses custom `layout/sidebar.tsx` |
| `ContentPost` Prisma model | No dedicated API |

*(Confirm with coverage tools before deleting.)*

---

## 5. Performance notes

**Good**
- Lazy-loaded views in AppShell  
- Debounced catalog search  
- Submit locks on critical saves  
- Skeleton loaders  

**Watch**
- Large flights/hotels views still heavy when opened  
- Recharts on dashboard OK for moderate data  
- No list virtualization  
- Prisma N+1 risk on rich includes — review hot endpoints under load  

---

## 6. Accessibility notes

**Improved**
- Skip link, focus rings, ARIA on icon actions in shell  
- Catalog search labels  
- Status live regions on empty states  

**Remaining**
- CRM Kanban keyboard support limited  
- Some dense booking forms need audit for label associations  
- Color-only status cues should keep text labels (StatusBadge does)  

---

## 7. Security notes (quality-adjacent)

- Permissions re-checked from DB (good)  
- Some PATCH/DELETE routes only require Auth (not module) — review for least privilege  
- Ensure production `JWT_SECRET`, CORS, and HTTPS  
- PDF/file storage paths should stay outside public web roots  

---

## 8. Code quality score (engineering)

| Dimension | Score /10 |
|-----------|----------:|
| Structure | 7 |
| Consistency | 7.5 |
| Type safety | 8 |
| Testability | 4 |
| Operability | 7 |
| **Overall** | **~6.8 / 10** |
