# SendGrid Email Service Setup Guide

**Time Required:** 10-15 minutes  
**Difficulty:** Easy  
**Status:** Required for production email notifications

---

## Quick Start (5 Steps)

### Step 1: Create SendGrid Account
1. Go to **https://sendgrid.com**
2. Click **"Sign Up"**
3. Enter email and create account
4. Verify your email address
5. Choose **Free Plan** (100 emails/day) or **Paid Plan**

**Free Plan Limits:**
- 100 emails per day
- Perfect for testing & small deployments
- Upgrade anytime without losing data

---

### Step 2: Generate API Key

**In SendGrid Dashboard:**

1. Click **Settings** → **API Keys**
2. Click **"Create API Key"**
3. Set Name: `Trevio Backend`
4. Set Permissions: 
   - ✓ Mail Send
   - ✓ Mail Settings Read
5. Click **"Create & Verify"**
6. **Copy the API key immediately** (you'll only see it once!)

**Example API Key:** `SG.abc123def456...` (keep this secret!)

---

### Step 3: Verify Sender Email

SendGrid requires verifying the email address that sends emails.

**In SendGrid Dashboard:**

1. Click **Settings** → **Sender Authentication**
2. Click **"Verify a Single Sender"**
3. Enter sender email: `noreply@yourdomain.com`
4. Complete verification (usually instant via email confirmation)

**Or use Trevio default:**
```
SENDGRID_FROM_EMAIL="noreply@travelpartner.pro"
```

---

### Step 4: Add Environment Variables

**On Railway Dashboard or `.env` file:**

```bash
# SendGrid Configuration
SENDGRID_API_KEY="SG.your_api_key_here"
SENDGRID_FROM_EMAIL="noreply@yourdomain.com"
```

**Railway Setup:**
1. Go to Railway Dashboard
2. Select Trevio Backend service
3. Go to **Variables**
4. Add two new variables:
   - `SENDGRID_API_KEY` = (your API key)
   - `SENDGRID_FROM_EMAIL` = (your sender email)
5. Deploy

---

### Step 5: Test Email Delivery

**After deployment:**

1. Go to product approval dashboard
2. Create a test product
3. Submit for approval
4. **Reject** it with a reason
5. Check your email for notification

**Expected Email:**
```
From: noreply@yourdomain.com
Subject: Your product rate was rejected
Body: [Product name] has been rejected
Reason: [Your rejection reason]
```

---

## Email Templates

### Product Approval Email
Sent when: Product rate is **approved**

```
Subject: Your product rate has been approved!
To: Product creator email

Your [Product Type] has been approved and is now live.
Product: [Name]
Price: [Price] [Currency]
Valid From: [Date]
Valid To: [Date]

View Dashboard: [Link]
```

### Product Rejection Email
Sent when: Product rate is **rejected**

```
Subject: Your product rate was rejected

Your [Product Type] could not be approved.
Product: [Name]

Reason: [Admin reason]

Please review and resubmit with corrections.
Submission Guidelines: [Link]
```

---

## Troubleshooting

### Email Not Sending

**Check 1: API Key is Valid**
```bash
# On Railway, verify the env var is set:
echo $SENDGRID_API_KEY

# Should output: SG.xxx...
# If empty, add it to Variables
```

**Check 2: Sender Email is Verified**
- Go to SendGrid Dashboard → Settings → Sender Authentication
- Verify email shows as "Verified" (green checkmark)
- If not, complete verification (check spam folder for verification email)

**Check 3: Check Logs**
```bash
# On Railway dashboard, check Logs tab
# Search for "SendGrid" or "email"

# Should see: "Email sent successfully"
# Or error message if something failed
```

**Check 4: Check SendGrid Dashboard**
- Go to **Mail Send** → **Logs**
- Look for recent email attempts
- If showing "Dropped" or "Bounced":
  - Verify sender email
  - Check recipient email is valid
  - Check content isn't flagged as spam

---

## Common Issues & Solutions

### ❌ Issue: "API key is invalid"
**Solution:**
- Regenerate API key on SendGrid
- Copy full key (including "SG." prefix)
- Add to Railway Variables with exact spelling: `SENDGRID_API_KEY`

### ❌ Issue: "Sender email not verified"
**Solution:**
- Go to SendGrid → Settings → Sender Authentication
- Click "Verify a Single Sender"
- Complete verification flow
- Wait 5-10 minutes for propagation

### ❌ Issue: "Email shows as bounced"
**Solution:**
- Check recipient email is valid
- Check spam folder
- Verify sender email in SendGrid
- Check SendGrid logs for specific reason

### ❌ Issue: "Free plan limit exceeded"
**Solution:**
- Upgrade to paid plan: $19.95/month
- Or wait until next day (limit resets daily)
- Or delete test emails to free up quota

---

## Production Best Practices

### 1. Use Separate Email Address
```bash
# NOT recommended (personal email):
SENDGRID_FROM_EMAIL="john@gmail.com"

# RECOMMENDED (company email):
SENDGRID_FROM_EMAIL="noreply@travelpartner.pro"
SENDGRID_FROM_EMAIL="notifications@youragency.com"
```

### 2. Monitor Email Delivery
- Check SendGrid Dashboard regularly
- Set up alerts for bounces/drops
- Monitor bounce rate (target: < 2%)

### 3. Upgrade Plan When Needed
- Free: 100 emails/day
- Essentials: $19.95/month (5,000 emails/day)
- Pro: $89.95/month (unlimited)

### 4. Handle Bounces
- Remove bounced emails from send list
- SendGrid automatically unsubscribes invalid emails
- Check bounce logs weekly

---

## Verify Setup Checklist

Before going live:

- [ ] SendGrid account created at sendgrid.com
- [ ] API key generated (starts with "SG.")
- [ ] Sender email verified in SendGrid
- [ ] `SENDGRID_API_KEY` added to Railway Variables
- [ ] `SENDGRID_FROM_EMAIL` added to Railway Variables
- [ ] Application deployed to Railway
- [ ] Test email sent and received successfully
- [ ] Email appears in inbox (not spam folder)
- [ ] Logs show "Email sent successfully"
- [ ] SendGrid dashboard shows email in logs

---

## After Go-Live

### Monitor Daily
- Check SendGrid dashboard for delivery status
- Monitor bounce rate
- Review email logs for errors

### Monthly Tasks
- Review SendGrid metrics
- Check email engagement rates
- Verify no delivery issues

### When Issues Occur
1. Check SendGrid logs first
2. Verify API key and sender email
3. Check Railway environment variables
4. Review application logs
5. Contact SendGrid support if needed

---

## Support

**SendGrid Docs:** https://docs.sendgrid.com  
**SendGrid Support:** https://support.sendgrid.com  
**Status Page:** https://status.sendgrid.com

---

## Summary

**You're all set!** Email notifications will work automatically once:

1. ✅ SendGrid account created
2. ✅ API key generated
3. ✅ Sender email verified
4. ✅ Environment variables added to Railway
5. ✅ Application deployed

Admins will automatically receive notifications when:
- Products are submitted for approval
- Products are approved/rejected
- Other important events occur

**Questions?** Check the troubleshooting section above or contact SendGrid support.

---

**Last Updated:** July 15, 2026  
**Status:** Ready for production deployment
