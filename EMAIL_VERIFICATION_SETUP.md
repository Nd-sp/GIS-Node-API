# Email Verification System - Setup Guide

## Overview

The OptiConnect GIS application now includes a complete email verification system that automatically sends verification emails when users register. This implements best practices for email verification with click-to-verify functionality.

## Features Implemented

✅ **Automatic Email Sending** - Verification emails sent automatically on user registration
✅ **Secure Token Generation** - JWT-based tokens with 24-hour expiration
✅ **Click-to-Verify** - Users click link in email to verify their account
✅ **is_email_verified Auto-Update** - Database field automatically set to TRUE on verification
✅ **Resend Verification** - Users can request new verification links
✅ **Console Mode** - If email not configured, links are logged to console for testing
✅ **Beautiful Email Templates** - Professional HTML email templates with branding

---

## Setup Instructions

### Step 1: Configure Email Settings

Edit your `.env` file and update the email configuration:

```env
# Email Configuration (SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM="OptiConnect GIS <noreply@opticonnect.com>"

# Application URL (for email verification links)
APP_URL=http://localhost:3001
```

### Step 2: Gmail App Password Setup (If Using Gmail)

If using Gmail for SMTP, you need to create an App Password:

1. Go to your Google Account: https://myaccount.google.com/
2. Select **Security** from the left menu
3. Enable **2-Step Verification** (if not already enabled)
4. Under "2-Step Verification", scroll down and click **App passwords**
5. Select app: **Mail**
6. Select device: **Windows Computer** (or your device)
7. Click **Generate**
8. Copy the 16-character password
9. Paste it into your `.env` file as `EMAIL_PASSWORD`

**Example:**
```env
EMAIL_USER=opticonnect.system@gmail.com
EMAIL_PASSWORD=abcd efgh ijkl mnop
```

### Step 3: Update for Production

When deploying to production, update these values:

```env
# Production SMTP (example with SendGrid)
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=your-sendgrid-api-key
EMAIL_FROM="OptiConnect GIS <noreply@opticonnect.com>"

# Production URL
APP_URL=https://yourdomain.com
```

---

## How It Works

### Registration Flow

```
1. User fills registration form
   ↓
2. Backend creates user with is_email_verified = false
   ↓
3. Backend generates verification token (JWT, expires in 24h)
   ↓
4. Backend sends email with verification link
   ↓
5. User receives email and clicks verification link
   ↓
6. Frontend opens /verify-email?token=xxxxx
   ↓
7. Backend validates token and sets is_email_verified = true
   ↓
8. User redirected to login page
```

### API Endpoints

#### 1. Register (Modified)
```
POST /api/auth/register
Body: { username, email, password, full_name, role }
Response: { success, token, message, user }
```

Now automatically sends verification email after successful registration.

#### 2. Verify Email
```
GET /api/auth/verify-email/:token
Response: { success, message, alreadyVerified }
```

Validates the token and updates `is_email_verified` to TRUE.

#### 3. Resend Verification
```
POST /api/auth/resend-verification
Body: { email }
Response: { success, message }
```

Sends a new verification email to the user.

---

## Frontend Routes

### Email Verification Page
**Route:** `/verify-email?token=xxxxx`
**Component:** `EmailVerificationPage.tsx`
**Purpose:** Automatically verifies email when user clicks link

**Features:**
- Shows loading spinner while verifying
- Success message with auto-redirect to login (5 seconds)
- Error handling with option to request new link
- Already verified detection

### Resend Verification Page
**Route:** `/resend-verification`
**Component:** `ResendVerificationPage.tsx`
**Purpose:** Allows users to request a new verification email

**Features:**
- Email input form
- Success/error messaging
- Helpful tips about verification
- Back to login button

---

## Testing the System

### Method 1: Console Mode (No Email Configuration)

If you don't configure EMAIL_* environment variables, the system logs verification URLs to the console:

1. Register a new user
2. Check backend console for output:
```
📧 EMAIL VERIFICATION (Console Mode):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
To: test@example.com
Subject: Verify your OptiConnect GIS account
Verification URL: http://localhost:3001/verify-email?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
3. Copy the URL and paste it in your browser
4. Email will be verified

### Method 2: Real Email Testing

1. Configure email settings in `.env`
2. Register with your real email address
3. Check your inbox (and spam folder)
4. Click the verification link
5. You should be redirected to login with success message

### Method 3: API Testing with Thunder Client

#### Test Registration:
```http
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "username": "testuser123",
  "email": "test@example.com",
  "password": "Test@123",
  "full_name": "Test User",
  "role": "viewer"
}
```

Expected Response:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Registration successful! Please check your email to verify your account.",
  "user": {
    "id": 25,
    "username": "testuser123",
    "email": "test@example.com",
    "full_name": "Test User",
    "role": "viewer",
    "is_email_verified": false
  }
}
```

#### Test Email Verification:
```http
GET http://localhost:5000/api/auth/verify-email/YOUR_TOKEN_HERE
```

Expected Response:
```json
{
  "success": true,
  "message": "Email verified successfully! You can now login.",
  "alreadyVerified": false
}
```

#### Test Resend Verification:
```http
POST http://localhost:5000/api/auth/resend-verification
Content-Type: application/json

{
  "email": "test@example.com"
}
```

Expected Response:
```json
{
  "success": true,
  "message": "Verification email sent! Please check your inbox."
}
```

---

## Database Changes

The `users` table already has the `is_email_verified` column:

```sql
is_email_verified BOOLEAN DEFAULT false
```

This field is automatically set to:
- **FALSE** - When user registers
- **TRUE** - When user clicks verification link

You can check verification status:
```sql
SELECT id, username, email, is_email_verified, created_at
FROM users
WHERE email = 'test@example.com';
```

---

## Files Modified/Created

### Backend Files

**Created:**
- `src/services/emailService.js` - Email sending service with templates
- `EMAIL_VERIFICATION_SETUP.md` - This documentation

**Modified:**
- `src/utils/jwt.js` - Added email verification token functions
- `src/controllers/authController.js` - Added verification endpoints
- `src/routes/auth.routes.js` - Added verification routes
- `.env` - Added email configuration
- `.env.example` - Added email configuration template
- `package.json` - Added nodemailer dependency

### Frontend Files

**Created:**
- `src/pages/EmailVerificationPage.tsx` - Email verification page
- `src/pages/ResendVerificationPage.tsx` - Resend verification page

**Modified:**
- `src/App.tsx` - Added verification routes

---

## Troubleshooting

### Issue: Emails not sending

**Check:**
1. Email credentials in `.env` are correct
2. If using Gmail, ensure App Password is used (not regular password)
3. Check backend console for error messages
4. Verify SMTP settings (host, port)

**Solution:**
Use console mode for testing:
- Remove or comment out EMAIL_* variables
- Verification URLs will be logged to console

### Issue: "Invalid or expired verification link"

**Causes:**
- Token expired (> 24 hours old)
- Token was already used
- Invalid token format

**Solution:**
- Use "Resend Verification" feature
- Request a new link from `/resend-verification`

### Issue: Gmail "Less secure app access"

**Note:** Gmail no longer supports this. You MUST use App Passwords.

**Solution:**
1. Enable 2-Step Verification
2. Generate App Password
3. Use App Password in `.env`

---

## Email Template Customization

The email templates are in `src/services/emailService.js`:

### Customize Company Name:
```javascript
<h1>🗺️ OptiConnect GIS</h1>  // Change this
```

### Customize Colors:
```javascript
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);  // Header gradient
background: #667eea;  // Button color
```

### Customize Message:
```javascript
<p>Thank you for registering with OptiConnect GIS! Please verify your email address to activate your account.</p>
```

---

## Production Checklist

Before deploying to production:

- [ ] Update `EMAIL_USER` and `EMAIL_PASSWORD` with production SMTP
- [ ] Update `EMAIL_FROM` with your domain email
- [ ] Update `APP_URL` to production domain (https://yourdomain.com)
- [ ] Test verification flow on production
- [ ] Set up email monitoring/logging
- [ ] Configure email rate limiting if needed
- [ ] Add SPF, DKIM, DMARC records for your domain
- [ ] Test emails in spam filters

---

## Additional Features You Can Add

### 1. Email Verification Reminder
Send reminder emails to users who haven't verified after 24 hours.

### 2. Require Verification for Login
Prevent unverified users from logging in:
```javascript
if (!user.is_email_verified) {
  return res.status(401).json({
    error: 'Please verify your email before logging in'
  });
}
```

### 3. Re-verification on Email Change
When user changes email, send verification to new email.

### 4. Email Templates Library
Create multiple templates for different purposes:
- Welcome email
- Password reset
- Security alerts
- Account updates

---

## Support

For issues or questions:
1. Check backend console logs
2. Verify `.env` configuration
3. Test with console mode first
4. Review this documentation

---

## Summary

✅ **Email verification is fully implemented and working**
✅ **Automatic email sending on registration**
✅ **Click-to-verify functionality**
✅ **is_email_verified auto-updates to TRUE**
✅ **Works in console mode for testing (no SMTP needed)**
✅ **Beautiful email templates included**
✅ **Resend verification feature available**

The system is production-ready. Just configure your SMTP credentials and deploy!
