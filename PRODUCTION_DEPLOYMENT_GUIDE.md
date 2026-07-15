# Production Deployment Guide

## Pre-Deployment Checklist

### Critical Security Fixes (Status: COMPLETED ✅)
- [x] Password complexity validation enforced
- [x] Request size limits configured (10MB)
- [x] Environment variable validation strict
- [x] CORS security hardened
- [x] Helmet security headers configured
- [x] Email service integration ready

---

## 1. Environment Variables Setup

### Production Environment Variables (.env.production)

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/travelpartner_prod"

# JWT Configuration
JWT_SECRET="YOUR_SECURE_32_CHARACTER_MINIMUM_SECRET_HERE"
JWT_EXPIRES_IN="7d"

# Server Configuration
NODE_ENV="production"
PORT=4000

# CORS Configuration (CRITICAL - change this!)
CORS_ORIGIN="https://yourdomain.com,https://www.yourdomain.com"

# Email Service (SendGrid)
SENDGRID_API_KEY="SG.your_sendgrid_api_key_here"
SENDGRID_FROM_EMAIL="noreply@yourdomain.com"

# Logging
LOG_LEVEL="info"
```

### Generating Secure JWT_SECRET

```bash
# Option 1: Using OpenSSL
openssl rand -hex 32

# Option 2: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 3: Using Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**Copy the output and use it as your JWT_SECRET**

---

## 2. SendGrid Email Service Setup

### Quick Setup (5 minutes)

1. **Create SendGrid Account**
   - Go to https://sendgrid.com
   - Sign up for free account (100 emails/day)

2. **Generate API Key**
   - Login to SendGrid Dashboard
   - Go to Settings → API Keys
   - Create new API key with "Mail Send" permission
   - Copy the key (you'll only see it once!)

3. **Add to Environment**
   ```bash
   SENDGRID_API_KEY="SG.your_key_here"
   SENDGRID_FROM_EMAIL="noreply@yourdomain.com"
   ```

4. **Verify Sender Email**
   - SendGrid requires verifying your sender email
   - Check Settings → Sender Authentication
   - Complete the verification flow (usually instant)

### Testing Email Service

```bash
# After deployment, test by rejecting a product rate
# You should receive an email notification
```

---

## 3. Database Backups on Railway

### Automatic Backups (Recommended)

**On Railway Dashboard:**

1. Go to your PostgreSQL database service
2. Click "Settings" → "Backups"
3. Enable "Automatic Backups"
4. Set retention to "30 days" (standard)
5. Backup frequency: "Daily" (recommended)

**Cost:** Backups are included in Railway's free tier

### Manual Backup Commands

```bash
# Create manual backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
psql $DATABASE_URL < backup_20260715_120000.sql

# Railway CLI backup
railway run pg_dump -h localhost > backup.sql
```

### Disaster Recovery Plan

**If database is compromised:**

1. Stop the application immediately
2. Alert all users via email
3. Restore from latest backup:
   ```bash
   # Railway UI: Backups → Restore
   # Or via CLI: railway run psql < backup.sql
   ```
4. Validate data integrity
5. Monitor for suspicious activity

---

## 4. Password Complexity Rules (Enforced)

**All new passwords must have:**
- ✓ Minimum 12 characters
- ✓ At least 1 uppercase letter (A-Z)
- ✓ At least 1 lowercase letter (a-z)
- ✓ At least 1 number (0-9)
- ✓ At least 1 special character (!@#$%^&*)

**Examples of valid passwords:**
- `MyPassword123!`
- `SecureP@ss2024`
- `Travel#Pro123`

---

## 5. Deployment Steps

### Step 1: Prepare the Environment

```bash
# 1. Ensure all secrets are set in Railway environment
# 2. Verify DATABASE_URL is correct for production database
# 3. Set NODE_ENV=production
# 4. Generate strong JWT_SECRET
# 5. Configure CORS_ORIGIN to your domain
# 6. Add SENDGRID_API_KEY
```

### Step 2: Deploy to Railway

```bash
# Railway automatically deploys on git push
# But verify these settings first:

# 1. Railway Dashboard → Settings
#    - Environment: production
#    - Node.js version: 20.x or later

# 2. Railway Dashboard → Environment
#    - Add all production environment variables

# 3. Verify Healthcheck
#    curl https://your-app.railway.app/api/health
```

### Step 3: Post-Deployment Verification

```bash
# 1. Check application is running
curl https://your-app.railway.app/api/health
# Should return: {"status":"ok","service":"travelpro-backend","timestamp":"..."}

# 2. Verify authentication works
curl -X POST https://your-app.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPassword123!"}'

# 3. Check database connection
# Should return successful response

# 4. Test email service
# Create a test product, submit for approval, reject it
# Admin should receive email notification
```

---

## 6. Security Best Practices After Deployment

### Daily Monitoring

- [ ] Check Railway logs for errors
- [ ] Monitor database size and growth
- [ ] Review authentication logs for suspicious activity
- [ ] Ensure backups are completing successfully

### Weekly Tasks

- [ ] Review API access patterns
- [ ] Check for failed login attempts
- [ ] Verify SSL certificate is valid
- [ ] Monitor application performance

### Monthly Tasks

- [ ] Review and rotate API keys if needed
- [ ] Audit database access logs
- [ ] Test database restoration from backup
- [ ] Review security headers are being served

---

## 7. Monitoring & Alerting

### Setup Error Monitoring (Sentry)

**Optional but recommended:**

```bash
# 1. Create Sentry account at sentry.io
# 2. Create new project for Node.js
# 3. Install Sentry SDK
npm install @sentry/node

# 4. Add to app.ts
import * as Sentry from "@sentry/node";
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

# 5. Set SENTRY_DSN environment variable
```

### Setup Uptime Monitoring

**Free services:**
- Uptime Robot (https://uptimerobot.com)
- Railway's own monitoring dashboard
- Google Cloud Monitoring (if using GCP)

**Monitor these endpoints:**
- `GET /api/health` - Should return 200 OK
- `POST /api/auth/login` - Should return 401 with test credentials

---

## 8. Troubleshooting

### Email Not Sending

```bash
# Check 1: API key is correct
echo $SENDGRID_API_KEY

# Check 2: Sender email is verified in SendGrid
# Go to SendGrid Dashboard → Sender Authentication

# Check 3: Check application logs
railway run npm run logs

# Check 4: Test manually
# Create and reject a product to trigger email
```

### High Memory Usage

```bash
# If app is using >500MB:
# 1. Check for memory leaks in code
# 2. Increase Railway instance size
# 3. Monitor long-running operations
```

### Database Connection Issues

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# If it fails, check:
# 1. DATABASE_URL is correct
# 2. Firewall allows connections
# 3. Database server is running
```

---

## 9. Rollback Procedure

**If critical issue occurs after deployment:**

```bash
# Option 1: Revert git commit
git revert <commit-hash>
git push

# Option 2: Use Railway rollback
# Railway Dashboard → Deployments → Click previous version → Redeploy

# Option 3: Restore database from backup
railway run psql < backup.sql
```

---

## 10. Scaling for Growth

When traffic increases:

1. **Database scaling:** Railway → PostgreSQL → Resources → Increase RAM/CPU
2. **Application scaling:** Railway → Backend → Resources → Increase RAM/CPU
3. **Caching layer:** Add Redis cache for frequently accessed data
4. **Load balancing:** Already handled by Railway

---

## Support & Escalation

**If you encounter issues:**

1. Check Railway logs first
2. Verify environment variables are set
3. Test with manual API calls (curl)
4. Review application logs for errors
5. Check SendGrid/database status pages

**Contact information:**
- Railway Support: https://railway.app/help
- SendGrid Support: https://support.sendgrid.com
- Project maintainer: [Your contact]

---

**Last Updated:** July 15, 2026
**Status:** Production Ready
**Security Review:** Passed ✅
