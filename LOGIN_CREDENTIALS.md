# 🔐 Trevio — Complete Login Credentials Guide

**All dummy accounts are created when you run:** `npm run db:seed`

---

## 🆕 SUPER ADMIN (Main Account)

Created after running seed script:

```
Email:    admin@travelpartner.pro
Password: TravioAdmin@2024!
Role:     Super Admin (Platform Owner)
```

**Access:** Everything - manage all agencies, users, settings, analytics

---

## 👥 DEMO USERS (5 Roles)

All demo users use the **same password:**
```
Password: Passw0rd@123
```

### 1. SUPER ADMIN
```
Email: superadmin@travelpartner.pro
Name: Rajesh Mehta
Password: Passw0rd@123
Role: Super Admin
```
**Access:** Full platform access, all agencies

---

### 2. AGENCY ADMIN
```
Email: admin@wanderlusttravels.in
Name: Priya Sharma
Password: Passw0rd@123
Role: Agency Admin
Agency: Wanderlust Travels
```
**Access:** Everything for your agency (users, products, bookings, payments)

---

### 3. BRANCH MANAGER
```
Email: manager.mumbai@wanderlusttravels.in
Name: Arjun Nair
Password: Passw0rd@123
Role: Branch Manager
Agency: Wanderlust Travels
Branch: Mumbai - Andheri
```
**Access:** Branch staff management, approvals, reports for your branch

---

### 4. EMPLOYEE / TRAVEL CONSULTANT
```
Email: sneha@wanderlusttravels.in
Name: Sneha Reddy
Password: Passw0rd@123
Role: Employee
Agency: Wanderlust Travels
Branch: Mumbai - Andheri
```
**Access:** Create bookings, manage customers, submit products (needs approval)

---

### 5. ACCOUNTANT / FINANCE
```
Email: accounts@wanderlusttravels.in
Name: Vikram Iyer
Password: Passw0rd@123
Role: Accountant
Agency: Wanderlust Travels
```
**Access:** Payments, commissions, wallet, financial reports

---

## 📋 Quick Reference Table

| Role | Email | Password | Access Level |
|------|-------|----------|--------------|
| Super Admin | `superadmin@travelpartner.pro` | `Passw0rd@123` | Everything |
| Super Admin (New) | `admin@travelpartner.pro` | `TravioAdmin@2024!` | Everything |
| Agency Admin | `admin@wanderlusttravels.in` | `Passw0rd@123` | Agency + Staff |
| Branch Manager | `manager.mumbai@wanderlusttravels.in` | `Passw0rd@123` | Branch + Staff |
| Employee | `sneha@wanderlusttravels.in` | `Passw0rd@123` | Bookings + CRM |
| Accountant | `accounts@wanderlusttravels.in` | `Passw0rd@123` | Payments + Finance |

---

## ⚙️ How to Create These Accounts

### Option 1: Run Seed Script (Recommended)
```bash
cd backend
npm run db:seed
```

**Output:**
```
✅ Database seeding completed!

🔐 LOGIN CREDENTIALS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPER ADMIN (Platform Owner):
  Email: admin@travelpartner.pro
  Password: TravioAdmin@2024!

DEMO USERS (All use same password):
  Password: Passw0rd@123

Roles:
  • superadmin@travelpartner.pro (Super Admin)
  • admin@wanderlusttravels.in (Agency Admin)
  • manager.mumbai@wanderlusttravels.in (Branch Manager)
  • sneha@wanderlusttravels.in (Employee)
  • accounts@wanderlusttravels.in (Accountant)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Option 2: Manual Database Insert
```sql
-- Hash password first using bcryptjs
-- Passw0rd@123 = $2a$10$...

INSERT INTO "User" (id, name, email, password, phone, role, designation, status)
VALUES (
  'u-test-1',
  'Test User',
  'test@travelpartner.pro',
  '$2a$10$...',  -- bcrypt hash
  '+91-9999999999',
  'super_admin',
  'Test Admin',
  'Active'
);
```

---

## 🧪 Testing All Roles

After running seed, test each role:

```bash
# 1. Test Super Admin
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@travelpartner.pro",
    "password": "TravioAdmin@2024!"
  }'

# 2. Test Agency Admin
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@wanderlusttravels.in",
    "password": "Passw0rd@123"
  }'

# 3. Test Branch Manager
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager.mumbai@wanderlusttravels.in",
    "password": "Passw0rd@123"
  }'
```

**Expected Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "u-bm-1",
    "name": "Arjun Nair",
    "email": "manager.mumbai@wanderlusttravels.in",
    "role": "branch_manager"
  }
}
```

---

## 🔍 Troubleshooting Login Issues

### ❌ "Invalid credentials" Error

**Check 1: Database Seeded?**
```bash
# Make sure seed was run:
npm run db:seed

# Verify users exist:
psql $DATABASE_URL -c "SELECT email, role FROM \"User\" LIMIT 5;"
```

**Check 2: Correct Password?**
- ✓ All demo users: `Passw0rd@123`
- ✓ New super admin: `TravioAdmin@2024!`
- ✓ Case-sensitive!

**Check 3: Correct Email?**
- ✓ Copy-paste email from this guide
- ✓ No typos
- ✓ Case doesn't matter for email

**Check 4: Server Running?**
```bash
# Verify backend is running:
curl http://localhost:4000/api/health

# Should return: {"status":"ok","service":"travelpro-backend",...}
```

**Check 5: Clear Browser Cache**
```
Ctrl + Shift + Delete (Windows/Linux)
Cmd + Shift + Delete (Mac)
```

---

## 🚀 Recommended Testing Flow

**1. First Login:** Use Super Admin
```
admin@travelpartner.pro / TravioAdmin@2024!
```

**2. Then Test Each Role:**
- Agency Admin → see agency dashboard
- Branch Manager → see branch staff
- Employee → create products/bookings
- Accountant → view payments

**3. Test Features:**
- Create products
- Submit for approval
- Approve/reject products
- Create bookings
- Process payments
- View analytics

---

## 📝 Create Your Own Test Account

Via API (after logging in as super admin):

```bash
curl -X POST http://localhost:4000/api/users \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "mytest@example.com",
    "password": "MySecure@123!",
    "phone": "+91-9999999999",
    "role": "agency_admin",
    "designation": "Test Admin"
  }'
```

**Password Requirements:**
- ✓ Minimum 12 characters
- ✓ At least 1 uppercase (A-Z)
- ✓ At least 1 lowercase (a-z)
- ✓ At least 1 number (0-9)
- ✓ At least 1 special character (!@#$%^&*)

**Example:** `MySecure@2024!`

---

## 🔒 Change Password After First Login

**In Settings → Profile:**
1. Click Settings (gear icon)
2. Go to Profile tab
3. Click "Change Password"
4. Enter current + new password
5. New password must meet requirements above

---

## 📚 Account Permissions

### Super Admin Can:
- ✅ Manage all agencies
- ✅ Create/edit users
- ✅ View all data
- ✅ Approve products
- ✅ Access analytics
- ✅ Configure system

### Agency Admin Can:
- ✅ Manage branch users
- ✅ Approve products
- ✅ View agency reports
- ✅ Process payments
- ✅ Update agency settings
- ❌ Cannot see other agencies

### Branch Manager Can:
- ✅ Manage branch staff
- ✅ Approve products (for branch)
- ✅ View branch reports
- ✅ Assign tasks
- ❌ Cannot access other branches

### Employee Can:
- ✅ Create bookings
- ✅ Submit products
- ✅ Manage customers
- ✅ View own data
- ❌ Cannot approve

### Accountant Can:
- ✅ View payments
- ✅ Track commissions
- ✅ View financial reports
- ❌ Cannot modify bookings

---

## ✨ Demo Agency Data

Pre-loaded when you run seed:

**Agency:** Wanderlust Travels
- **Admin:** admin@wanderlusttravels.in
- **Branches:** 4 (Mumbai, Delhi, Bangalore, Chennai)
- **Staff:** 38 employees
- **Bookings:** 3,420+
- **Revenue:** ₹28.5L monthly

**Sample Products:**
- Hotel: Taj Lands End (5-star, Mumbai)
- Activity: Dubai Desert Safari
- Transfer: Mumbai Airport Transfer

---

## 🎯 Next Steps

1. **Run seed:** `npm run db:seed`
2. **Login with:** `admin@travelpartner.pro` / `TravioAdmin@2024!`
3. **Explore dashboard**
4. **Test different roles**
5. **Create your own account**
6. **Change default passwords**

---

## Support

**Still having issues?**
1. Check "Troubleshooting" section above
2. Verify backend is running: `npm run dev` (backend folder)
3. Check browser console for errors (F12)
4. Clear browser cache
5. Restart browser

---

**Last Updated:** July 15, 2026  
**Status:** All credentials tested and working
