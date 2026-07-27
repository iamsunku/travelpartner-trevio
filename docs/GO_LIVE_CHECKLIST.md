# Go-Live & Demo Readiness Checklist

**Last updated:** July 27, 2026  
Use this to run either a **Demo** (pitch / training) or **Live** (real customers) deployment without mixing the two.

---

## 1. Choose mode

| Mode | Purpose | Frontend | Backend |
|------|---------|----------|---------|
| **Demo** | Sales demos, training, UAT | `NEXT_PUBLIC_APP_MODE=demo` | `NODE_ENV=development` **or** `ALLOW_DEMO_PAYMENTS=true` |
| **Live** | Real agencies & payments | `NEXT_PUBLIC_APP_MODE=live` | `NODE_ENV=production` + real keys |

### Frontend env (`frontend/.env.local` or Vercel)

| Variable | Demo | Live |
|----------|------|------|
| `NEXT_PUBLIC_API_URL` | Backend URL | Backend URL |
| `NEXT_PUBLIC_APP_MODE` | `demo` | `live` |
| `NEXT_PUBLIC_ENABLE_MOCK_INVENTORY` | `true` (default in demo) | `false` (hides Flights/Hotels search) |
| `NEXT_PUBLIC_SHOW_DEMO_LOGIN` | `true` (role chips + seed password) | `false` |

### Backend env (Render / `.env`)

| Variable | Demo | Live |
|----------|------|------|
| `DATABASE_URL` / `DIRECT_URL` | Postgres (Supabase) | Postgres (Supabase) |
| `JWT_SECRET` | any long secret | **unique 32+ char secret** |
| `CORS_ORIGIN` | localhost + Vercel | production frontend URL |
| `NODE_ENV` | `development` | `production` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | optional (test keys OK) | **required live keys** |
| `ALLOW_DEMO_PAYMENTS` | `true` or omit in non-prod | **`false`** |
| `SENDGRID_API_KEY` / `SENDGRID_FROM_EMAIL` | optional | **required** (forgot-password / invites) |
| `ALLOW_INSECURE_TEMP_PASSWORD_RESPONSE` | ok in dev | **`false`** |

---

## 2. Razorpay — account create & documents

Official flow: [Set up a Razorpay Account](https://razorpay.com/docs/payments/set-up/?preferred-country=IN)

### A. Sign up (both Test & Live)

1. Go to [dashboard.razorpay.com](https://dashboard.razorpay.com) → Sign Up  
2. Email or mobile + OTP + password  
3. Select business type (Registered / Unregistered)  
4. Add business name, brand, website (can add later)  
5. **Test mode keys** work immediately for integration (no real money)

### B. Activate Live mode — documents by business type

Names on PAN, bank account, and GST must **match exactly**.

#### Sole Proprietor / Individual

| Document | Required |
|----------|----------|
| Personal PAN | Yes |
| Aadhaar / Passport / Voter ID (or DigiLocker) | Yes |
| Business proof (any 1): GST **or** Udyam/MSME **or** Shop & Establishment | Yes (registered path needs 1 required + 1 additional) |
| Cancelled cheque / bank statement (settlement account) | Yes |
| Business address proof (utility ≤ 3 months if asked) | If CKYC fails |
| Video KYC (with physical PAN + Aadhaar) | If CKYC fails |

#### Private Limited / Public Limited

| Document | Required |
|----------|----------|
| Company PAN | Yes |
| Certificate of Incorporation | Yes |
| MOA + AOA | Often required (Master KYC 2026) |
| GST certificate | Yes if GSTIN exists |
| Board Resolution / PoA for authorised signatory | Yes |
| Authorised signatory PAN + Aadhaar | Yes |
| Cancelled cheque (company current account) | Yes |
| UBO declaration (shareholders >10%) | Often required (2026) |

#### Partnership / LLP

| Document | Required |
|----------|----------|
| Firm / LLP PAN | Yes |
| Partnership deed or LLP agreement | Yes |
| LLP incorporation certificate (LLP) | Yes |
| GST (if applicable) | Yes |
| Partner KYC (PAN + Aadhaar) | Yes |
| Cancelled cheque in firm name | Yes |

#### Trust / Society / NGO

| Document | Required |
|----------|----------|
| Entity PAN | Yes |
| Trust deed / Society registration / Sec 8 cert | Yes |
| 12A / 80G (if applicable) | Recommended |
| Signatory KYC + resolution | Yes |
| Bank proof in entity name | Yes |

### C. After KYC approval — plug into Trevio

1. Dashboard → **Account & Settings → API Keys**  
2. Generate **Live** Key ID + Key Secret (and keep Test keys for staging)  
3. Set on Render:
   - `RAZORPAY_KEY_ID=rzp_live_...`
   - `RAZORPAY_KEY_SECRET=...`
   - `ALLOW_DEMO_PAYMENTS=false`
4. Settlement bank must be verified (₹1 penny drop)

**Test vs Live:** Test keys (`rzp_test_…`) = no real charge. Live keys = real money after KYC.

---

## 3. Other accounts to create

| Service | Why | What you need |
|---------|-----|----------------|
| **Supabase / Postgres** | App database | Project + connection strings (pooler 6543 + direct 5432) |
| **Render** | Host API | GitHub repo, env vars above |
| **Vercel** | Host frontend | `NEXT_PUBLIC_API_URL`, mode flags |
| **SendGrid** | Password reset / invite emails | Verified sender domain or single sender |
| **Domain + DNS** | Brand URLs | A/CNAME to Vercel/Render |
| **GST / agency legal** | Agent registration fields | GSTIN, PAN, address (for your agencies) |

---

## 4. Demo = 100% ready when…

- [ ] Postgres migrated + seeded  
- [ ] Frontend `APP_MODE=demo`, mock inventory **on**  
- [ ] Backend allows demo payments (`NODE_ENV≠production` or `ALLOW_DEMO_PAYMENTS=true`)  
- [ ] Login shows demo role chips (optional)  
- [ ] Flights/Hotels show **Demo inventory** banner  
- [ ] Package → Trip planner → Proposal PDF path works  
- [ ] Quotation PDF download + WhatsApp/email share works  
- [ ] Wallet top-up / checkout can succeed in **demo** path  

**Honest demo scope:** Catalog products, proposals, quotes, HR, CRM UI. Do **not** claim live GDS or real card charges unless Razorpay Test/Live is configured.

---

## 5. Live = 100% ready when…

### Must have

- [ ] `NEXT_PUBLIC_APP_MODE=live`  
- [ ] `NEXT_PUBLIC_ENABLE_MOCK_INVENTORY=false` (Flights/Hotels search hidden)  
- [ ] `NEXT_PUBLIC_SHOW_DEMO_LOGIN=false`  
- [ ] `NODE_ENV=production`  
- [ ] `ALLOW_DEMO_PAYMENTS=false`  
- [ ] `ALLOW_INSECURE_TEMP_PASSWORD_RESPONSE=false`  
- [ ] Razorpay **Live** keys set & KYC approved  
- [ ] SendGrid set & test forgot-password email  
- [ ] Strong `JWT_SECRET`, correct `CORS_ORIGIN`  
- [ ] Seed passwords **rotated** (no `Passw0rd@123` in production)  
- [ ] Agency admin can open **Settings**  
- [ ] Sell via: Destinations / Products / Packages / Trip Planner / Travel Proposals / Quotations  

### Still partial (label honestly — next sprints)

- Quote → Pay → Book closed loop  
- Server-side quotation PDF + email attachment (proposals already have server PDF)  
- CRM/quotes ID sync fully API-first  
- Real flight/hotel GDS (hidden in live until integrated)  
- Auto notifications from every business event  
- GST e-invoice  

---

## 6. Smoke test (both modes)

1. Register or login as agency_admin  
2. Create destination + hotel/activity product → approve rates  
3. Build package → trip requirement → travel proposal → download PDF  
4. Create quotation → Download PDF → WhatsApp share  
5. **Demo:** pay without keys → demo success toast  
6. **Live:** pay with Test/Live keys → Razorpay checkout opens; without keys → clear error (no fake paid)  
7. Forgot password → email received (live) or temp password only in non-prod  

---

## 7. Sprint progress

| Sprint | Status |
|--------|--------|
| **1** Settings permission, mock inventory gated, API permission hardening, demo/live mode flags, Razorpay checklist | Done (this change set) |
| **2** API-first CRM/quotes/bookings | Pending |
| **3** Quote → pay → book + server quote PDF | Pending |
