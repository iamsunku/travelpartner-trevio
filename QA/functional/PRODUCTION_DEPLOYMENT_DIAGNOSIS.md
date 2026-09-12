# Production Deployment Diagnosis

**Date:** 12 September 2026  
**Scope:** Read-only diagnosis. **No code changes, no Blueprint create, no deploy, no deletes, no secrets exposed.**

**Inputs used:**

- Repository: `render.yaml`, `frontend/vercel.json`, package manifests, README, `.env*.example`, UAT scripts under `scripts/`
- Operator report: current Render workspace shows *“You haven't created any Blueprint instances yet.”*
- Live probes (HTTP only): Vercel frontend; two Render hostnames

---

## Executive summary

| Finding | Conclusion |
| --- | --- |
| This Render workspace | **No Blueprint instance** → `render.yaml` is **repo config only** here, not an applied Blueprint |
| `https://travelpartner-api.onrender.com` | Responds **“This service has been suspended.”** — not a usable API |
| Repo UAT scripts | Point to a **different** host: `https://travelpartner-api-v7nt.onrender.com` |
| That `…-v7nt…` host | Exists on Render (cold-start / waking-up pages observed) — **not** the suspended hostname |
| Vercel frontend | `https://trevioglobal-frontend.vercel.app` is live |
| Repo → Vercel API URL | `vercel.json` does **not** set `NEXT_PUBLIC_API_URL`; actual Vercel dashboard value is **unknown** from repo alone |
| CI/CD | **No** `.github/workflows` (or other CI) deploying Render |

**Primary diagnosis letter:** **B** (API Blueprint never deployed from *this* workspace), with strong evidence of **C** and/or **D** for related hostnames (see §8).

---

## 1. Is `travelpartner-api` deployed anywhere according to the repository?

**According to repository configuration alone: not proven as a live, owned service of this workspace.**

What the repo *does* contain:

| Artifact | What it says |
| --- | --- |
| `render.yaml` | Intended Render **Blueprint** web service named `travelpartner-api` |
| Comments in `render.yaml` | After create: set DB/JWT/CORS; point Vercel `NEXT_PUBLIC_API_URL` at the service URL |
| `scripts/uat-*.ps1` | Hard-coded API base `https://travelpartner-api-v7nt.onrender.com` (implies a **prior** Render service with Render’s random suffix `-v7nt`) |
| `TREVIO_PROJECT_AUDIT.md` | Notes deploy intent: Render API + Vercel frontend |
| README | Mostly **Railway**-oriented deploy narrative; links to missing `PRODUCTION_DEPLOYMENT_GUIDE.md` |

What the repo *does not* contain:

- No commit/log proving Blueprint was applied in the operator’s current Render workspace  
- No CI that creates or updates Render services  
- No checked-in production URL for `travelpartner-api.onrender.com` (that hostname was an **assumption** from the service `name:` field, not a literal string in `render.yaml`)

**Operator fact:** current Render workspace has **zero Blueprint instances** → this workspace has **not** applied `render.yaml`.

---

## 2. Configuration inventory

### `render.yaml`

- Blueprint for **one** Node web service (details in §4)
- **No** Render Postgres/`databases:` block — DB expected elsewhere (comments: Supabase)

### Root `package.json`

- npm workspaces: `frontend`, `backend`
- Scripts: local `dev` / `build:*` / `db:*` — **no** deploy scripts

### `backend/package.json`

- `build`: `tsc`
- `start`: `node dist/server.js`
- `db:deploy`: `prisma migrate deploy`
- Aligns with Render `buildCommand` / `startCommand` in `render.yaml`

### `frontend/package.json`

- Next.js `build` / `start` — no Render deploy hooks

### Deployment documentation

| Doc | Status |
| --- | --- |
| README § Deployment | Describes **Railway** auto-deploy; placeholder URLs `your-app.railway.app` |
| `PRODUCTION_DEPLOYMENT_GUIDE.md` | **Referenced but missing** from repo |
| `render.yaml` header comments | Primary **Render + Vercel** instructions for this monorepo |
| Phase 18 readiness report | Config checklist; not a deploy runbook |

### Environment examples

| File | Notes |
| --- | --- |
| `backend/.env.example` | Placeholders for DB, JWT, CORS, SMTP, etc. Production CORS example is generic Vercel host |
| `frontend/.env.local.example` | Local `NEXT_PUBLIC_API_URL=http://localhost:4000`; comment example `https://your-api.onrender.com` (placeholder, not a concrete host) |

### Vercel configuration (repository only)

`frontend/vercel.json` sets:

- `NEXT_PUBLIC_APP_MODE=live`
- mock/stub/demo-login/public-register flags `false`

**Does not define** `NEXT_PUBLIC_API_URL`.

### CI/CD

- **No** `.github/` workflows found  
- No other pipeline files found that deploy to Render/Vercel

### Remotes (context only)

- `origin` → `iamsunku/travelpartner-trevio`
- `trevioglobal` → `trevioglobal/Trevioglobal`  
History mentions production/UAT deploy commits; that does **not** bind them to the operator’s current Render workspace.

---

## 3. Was Render actually deployed?

| Hypothesis | Evidence |
| --- | --- |
| Render configured in repo but never Blueprint-deployed **in this workspace** | **Strong** — operator: no Blueprint instances; `render.yaml` present |
| API deployed under **another** Render account/workspace / non-Blueprint web service | **Plausible–strong** — UAT scripts use `travelpartner-api-v7nt.onrender.com`; live probe shows Render cold-start (“Service waking up”), i.e. service object still exists somewhere |
| API deployed then **suspended** | **True for** `travelpartner-api.onrender.com` (explicit suspended message). **Not** what the `…-v7nt…` host returned (wake-up, not suspended) |
| `travelpartner-api.onrender.com` is only an **intended/example** hostname | **Partially** — Render often serves `https://<service-name>.onrender.com` **or** `https://<service-name>-<random>.onrender.com`. Repo never hard-codes the unsuffixed host; UAT scripts use the **suffixed** host |

---

## 4. What `render.yaml` would create (if applied)

| Field | Value |
| --- | --- |
| Service type | `web` |
| Service name | `travelpartner-api` |
| Runtime | `node` |
| Plan | `free` |
| Root directory | `backend` |
| Build command | `npm install --include=dev && npx prisma generate && npm run build` |
| Start command | `(npx prisma migrate deploy \|\| npx prisma db push --skip-generate) && npm run start` |
| Health check | `/api/health` |
| Database dependency in Blueprint | **None** — no `databases:` section; expects external `DATABASE_URL` / `DIRECT_URL` |
| Env baked in Blueprint | `NODE_ENV=production`, `NPM_CONFIG_PRODUCTION=false`, `JWT_EXPIRES_IN=1d`, `CORS_ORIGIN=https://trevioglobal-frontend.vercel.app`, payment/demo flags false, SMTP port/secure defaults |
| Env expected (dashboard / sync:false) | `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` (or generateValue), Razorpay keys, SMTP/SendGrid secrets |

**Applying this Blueprint would create a new service instance** in the workspace where it is applied. It would **not** automatically own or unsuspend an existing `…-v7nt…` or suspended hostname elsewhere.

---

## 5. Does Vercel production point at `https://travelpartner-api.onrender.com`?

**Cannot confirm from the repository.**

| Source | `NEXT_PUBLIC_API_URL` |
| --- | --- |
| `frontend/vercel.json` | **Not set** |
| `frontend/.env.local.example` | Localhost; placeholder comment only |
| Local developer machine (prior check) | Pointed at **localhost**, not Render |
| **Vercel project dashboard** | **Not accessible** in this diagnosis — do not claim dashboard value |

Frontend code (`frontend/src/lib/api.ts`) uses `NEXT_PUBLIC_API_URL` or falls back to `http://localhost:4000`. Whatever Vercel has at build time is what production browsers use.

---

## 6. Deployment commands / docs you could run later

**Do not run these as part of this diagnosis.** Listed for awareness only:

| Source | Guidance |
| --- | --- |
| `render.yaml` comments | Create Blueprint in Render; set secrets; point Vercel API URL |
| README | Railway-oriented `git push` + health/login curls (placeholders) |
| Backend | `npm run build`, `npm run start`, `npx prisma migrate deploy` (also embedded in Render start) |
| Scripts | `scripts/uat-smoke.ps1`, `uat-phase2.ps1`, `uat-phase3.ps1` target **`travelpartner-api-v7nt.onrender.com`** |

Missing doc: `PRODUCTION_DEPLOYMENT_GUIDE.md` (broken README link).

---

## 7. Does the suspended URL belong to this project?

| Hostname | Probe result | Link to this repo |
| --- | --- | --- |
| `travelpartner-api.onrender.com` | **Suspended** | **Weak / inconclusive** — matches Blueprint *service name* pattern only; **not** referenced in UAT scripts; **not** present as a literal in `render.yaml`; current workspace has **no** Blueprint |
| `travelpartner-api-v7nt.onrender.com` | **Exists** (Render free-tier wake-up / loading) | **Stronger** — hard-coded in **this** repo’s UAT scripts; name prefix matches `travelpartner-api` |

**Do not assume** the suspended host is “our” current API merely because the name matches. Prefer the UAT hostname as the historical candidate until dashboard ownership is verified.

---

## 8. Final diagnosis (pick one letter)

### Chosen: **B** (primary), with **C** + **D** as supporting facts

| Letter | Meaning | Fit |
| --- | --- | --- |
| **A** | Genuinely deployed but suspended | Applies to **`travelpartner-api.onrender.com` only** — not proven as *this* workspace’s Blueprint service |
| **B** | Never deployed from **this** workspace | **YES** — no Blueprint instances |
| **C** | Deployed in another Render workspace/account | **Likely** for `travelpartner-api-v7nt` (alive/cold-start; not in this Blueprint list) |
| **D** | API URL stale/incorrect | **YES** if the working assumption was `travelpartner-api.onrender.com` — UAT scripts disagree |
| **E** | Cannot determine from repository | Partial unknowns remain (exact Vercel env; which Render login owns `v7nt`) |

**One-line verdict:**  
In *this* Render workspace the API Blueprint was **never applied**. A separate Render service hostname used by repo UAT scripts (`…-v7nt…`) still appears to exist elsewhere; the unsuffixed `travelpartner-api.onrender.com` host is **suspended** and should not be treated as the current API without ownership proof.

---

## 9. Safest NEXT ACTION ONLY

**Do not create a new Blueprint or new service yet.**

1. In the **Vercel** project for `trevioglobal-frontend`, open **Environment Variables** and note the value of `NEXT_PUBLIC_API_URL` (do not paste secrets elsewhere — you only need the hostname).  
2. In **Render**, search **all teams/accounts** you can access for a service whose URL contains `travelpartner-api-v7nt` (or name `travelpartner-api`).  
3. If you find `…-v7nt…` and it is yours: confirm it is the URL Vercel already uses (or should use) — **resume/unsuspend/fix that service** if needed, rather than applying a second Blueprint.  
4. If you find **neither** that service nor any matching web service under your accounts: only then treat “API needs a new deploy” as established.

Until step 2–3 are done, creating a new Blueprint risks a **duplicate** API and split databases/env.

---

## 10. Explicit non-actions (honored)

- No application code changes  
- No Blueprint create  
- No `render.yaml` edits  
- No deploy / delete  
- No secret values recorded  

**STOP** after this diagnosis.
