# Demo login credentials

After `npm run db:seed` in `backend/`, use these accounts.

**Shared password for all role users:** `Passw0rd@123`

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `superadmin@travelpartner.pro` | `Passw0rd@123` |
| Agency Admin | `admin@wanderlusttravels.in` | `Passw0rd@123` |
| Branch Manager | `manager.mumbai@wanderlusttravels.in` | `Passw0rd@123` |
| Employee / Agent | `sneha@wanderlusttravels.in` | `Passw0rd@123` |
| Accountant | `accounts@wanderlusttravels.in` | `Passw0rd@123` |
| Sales Executive | `sales@wanderlusttravels.in` | `Passw0rd@123` |
| Product Executive | `products@wanderlusttravels.in` | `Passw0rd@123` |
| Platform Super Admin (alt) | `admin@travelpartner.pro` | `TravioAdmin@2024!` |

On the login screen (demo mode), click a role chip to autofill email + password.

## Razorpay (test)

Set on the **server** only (Render env or local `backend/.env` — never commit secrets):

- `RAZORPAY_KEY_ID` = your `rzp_test_…` key
- `RAZORPAY_KEY_SECRET` = your test secret
- `ALLOW_DEMO_PAYMENTS=true` for demos without keys (optional if test keys are set)

Test mode does **not** charge real money. Use Razorpay test cards from their docs.
