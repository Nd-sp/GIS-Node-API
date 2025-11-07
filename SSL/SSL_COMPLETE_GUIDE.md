# OptiConnect Backend - Complete SSL/HTTPS Setup Guide

**Everything you need to set up SSL/HTTPS in ONE document.**

---

## 📋 Table of Contents

1. [Quick Overview](#quick-overview)
2. [SSL vs TLS - What You're Getting](#ssl-vs-tls)
3. [IP vs Domain - Which Works?](#ip-vs-domain)
4. [Option 1: Self-Signed Certificate (For IP)](#option-1-self-signed)
5. [Option 2: Let's Encrypt Certificate (For Domain)](#option-2-lets-encrypt)
6. [Activate HTTPS](#activate-https)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 Quick Overview {#quick-overview}

### What is SSL/HTTPS?

**SSL/HTTPS** encrypts data between browser and server, making it secure.

- **HTTP** = `http://172.16.20.6:82` (unencrypted ❌)
- **HTTPS** = `https://172.16.20.6` (encrypted ✅)

### Do You Need It?

| Scenario | SSL Needed? |
|----------|------------|
| Internal network testing | Optional |
| Production / External access | ✅ Recommended |
| Handling sensitive data | ✅ Required |
| Modern browser requirements | ✅ Recommended |

### Which Option to Choose?

| Current Setup | Use This |
|--------------|----------|
| IP address only (172.16.20.6) | **Option 1: Self-Signed** |
| Have a domain name | **Option 2: Let's Encrypt** |

---

## 🔐 SSL vs TLS - What You're Getting {#ssl-vs-tls}

**Question:** Is it SSL or TLS?

**Answer:** It's **TLS** (Transport Layer Security)

- **SSL** = Old name (everyone still uses it)
- **TLS** = Current technology (what you actually get)
- **TLS 1.2/1.3** = Modern, secure encryption

**TL;DR:** It's TLS, but called "SSL certificate" 😊

---

## 🌐 IP vs Domain - Which Works? {#ip-vs-domain}

### Self-Signed Certificate

| Access Method | Works? | Notes |
|--------------|--------|-------|
| IP (172.16.20.6) | ✅ Yes | Perfect for you! |
| Domain (opticonnect.com) | ✅ Yes | Works too |
| Both simultaneously | ✅ Yes | One cert for both |

**Browser Warning:** ⚠️ Yes (users must click "Proceed")

### Let's Encrypt Certificate

| Access Method | Works? | Notes |
|--------------|--------|-------|
| IP only | ❌ No | Requires domain |
| Domain | ✅ Yes | Must be public |
| Local/internal domain | ❌ No | Internet access required |

**Browser Warning:** ✅ No (fully trusted)

---

## 🚀 Option 1: Self-Signed Certificate (For IP) {#option-1-self-signed}

**Use this NOW** - Works with IP address 172.16.20.6

### ⚡ Automated Way (Recommended)

**On Server VM, run PowerShell as Administrator:**

```powershell
# 1. Navigate to backend folder
cd C:\inetpub\wwwroot\opticonnect-backend

# 2. Allow script execution (if needed)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# 3. Run the script
.\Install-SelfSignedSSL.ps1
```

**What it does automatically:**
1. ✅ Creates SSL certificate (valid 5 years)
2. ✅ Adds HTTPS binding to IIS (port 443)
3. ✅ Opens firewall port 443
4. ✅ Exports certificate to `C:\OptiConnect-SSL-Certificate.cer`
5. ✅ Tests configuration

**Time:** 5 minutes ⏱️

**Expected Output:**
```
========================================
OptiConnect Backend - SSL Setup
Self-Signed Certificate Installation
========================================

[1/5] Checking prerequisites...
✓ Running as Administrator
✓ IIS is installed

[2/5] Creating self-signed SSL certificate...
✓ Certificate created successfully!
  Thumbprint: ABC123...
  Valid until: 2030-01-01

[3/5] Configuring IIS HTTPS binding...
✓ HTTPS binding added to IIS site 'OptiConnect Backend'

[4/5] Configuring Windows Firewall...
✓ Firewall rule created (Port 443 allowed)

[5/5] Exporting certificate...
✓ Certificate exported to: C:\OptiConnect-SSL-Certificate.cer

========================================
Installation Complete!
========================================
```

### 📋 Manual Way (Alternative)

If you prefer manual setup or script doesn't work:

**Step 1: Create Certificate**

```powershell
# Run in PowerShell as Administrator
$cert = New-SelfSignedCertificate `
    -DnsName "172.16.20.6", "opticonnect-backend" `
    -CertStoreLocation "Cert:\LocalMachine\My" `
    -FriendlyName "OptiConnect Backend SSL" `
    -NotAfter (Get-Date).AddYears(5) `
    -KeyExportPolicy Exportable `
    -KeySpec Signature `
    -KeyLength 2048 `
    -KeyAlgorithm RSA `
    -HashAlgorithm SHA256

# Note the thumbprint
$cert.Thumbprint
```

**Step 2: Add HTTPS Binding in IIS**

```powershell
Import-Module WebAdministration

# Add HTTPS binding
New-WebBinding -Name "OptiConnect Backend" -IPAddress "172.16.20.6" -Port 443 -Protocol https

# Bind certificate (replace THUMBPRINT with your certificate thumbprint)
$cert = Get-ChildItem -Path Cert:\LocalMachine\My | Where-Object {$_.Thumbprint -eq "YOUR_THUMBPRINT_HERE"}
$binding = Get-WebBinding -Name "OptiConnect Backend" -Protocol https
$binding.AddSslCertificate($cert.Thumbprint, "my")
```

**Step 3: Open Firewall**

```powershell
New-NetFirewallRule `
    -DisplayName "OptiConnect HTTPS" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 443 `
    -Action Allow
```

**Step 4: Test**

```powershell
Invoke-WebRequest -Uri "https://172.16.20.6/api/health" -SkipCertificateCheck
```

### 🔧 Remove Browser Warnings (Optional)

Browser shows warning because self-signed certificate isn't trusted.

**To remove warnings:**

1. **Export Certificate** (already done by script)
   - Location: `C:\OptiConnect-SSL-Certificate.cer`

2. **Install on Client Machines**
   - Copy `.cer` file to client computer
   - Double-click the file
   - Click "Install Certificate"
   - Select "Local Machine"
   - Choose "Trusted Root Certification Authorities"
   - Click Next → Finish

**Result:** No more browser warnings on that computer! ✅

---

## 🌍 Option 2: Let's Encrypt Certificate (For Domain) {#option-2-lets-encrypt}

**Use this LATER** - After you purchase a domain

### ⚠️ Prerequisites

Before starting, you MUST have:

- ✅ Domain name registered (e.g., `opticonnect.yourdomain.com`)
- ✅ DNS A record pointing to server's **PUBLIC IP**
- ✅ Ports 80 and 443 accessible from **internet**
- ✅ Valid email address for notifications

**Test Domain First:**
```powershell
# Test DNS is working
nslookup opticonnect.yourdomain.com

# Test from external network
http://opticonnect.yourdomain.com
```

### ⚡ Automated Way (Recommended)

**On Server VM, run PowerShell as Administrator:**

```powershell
# 1. Navigate to backend folder
cd C:\inetpub\wwwroot\opticonnect-backend

# 2. Run the script
.\Install-LetsEncryptSSL.ps1
```

**Script will ask:**
- Do you have a domain configured? **yes**
- Enter domain name: **opticonnect.yourdomain.com**
- Enter email: **your-email@domain.com**

**Then Win-ACME will launch:**
1. Press **N** (Create certificate with default settings)
2. Choose **1** (Single binding of an IIS site)
3. Select your site from list
4. Confirm email
5. Accept Terms: **yes**

**What happens automatically:**
1. ✅ Downloads Win-ACME (Let's Encrypt client)
2. ✅ Validates domain ownership
3. ✅ Requests certificate from Let's Encrypt
4. ✅ Installs certificate in IIS
5. ✅ Sets up auto-renewal (every 60 days)
6. ✅ Tests configuration

**Time:** 15 minutes ⏱️

### 📋 Manual Way (Alternative)

**Step 1: Download Win-ACME**

Download from: https://github.com/win-acme/win-acme/releases

Extract to: `C:\Tools\win-acme\`

**Step 2: Add IIS Binding**

```powershell
# Add HTTP binding with hostname
New-WebBinding -Name "OptiConnect Backend" -Protocol "http" -Port 80 -HostHeader "opticonnect.yourdomain.com"
```

**Step 3: Run Win-ACME**

```powershell
cd C:\Tools\win-acme
.\wacs.exe
```

Follow prompts:
- Select **N** (Create certificate)
- Choose **1** (IIS binding)
- Select your site
- Enter email
- Accept Terms

**Step 4: Verify Auto-Renewal**

Win-ACME creates a scheduled task that runs daily.

Check in Task Scheduler: `win-acme renew`

### 🔄 Certificate Renewal

**Self-Signed:** Manual (valid 5 years)
- Check expiry: `certlm.msc` → Personal → Certificates
- Re-run script before expiration

**Let's Encrypt:** Automatic (every 60 days)
- Win-ACME handles it automatically
- Check Task Scheduler: `win-acme renew`
- No action needed! ✅

---

## 🔐 Activate HTTPS {#activate-https}

After certificate is installed, activate HTTPS:

### Step 1: Update .env File

**Option A: Use pre-configured SSL file**

```powershell
# Replace .env with .env.ssl
Copy-Item "C:\inetpub\wwwroot\opticonnect-backend\.env.ssl" "C:\inetpub\wwwroot\opticonnect-backend\.env" -Force
```

**Option B: Manually edit .env**

Open `.env` and change:

```env
# For Self-Signed (IP):
FRONTEND_URL=https://172.16.20.6:81
APP_URL=https://172.16.20.6:81

# For Let's Encrypt (Domain):
FRONTEND_URL=https://opticonnect.yourdomain.com
APP_URL=https://opticonnect.yourdomain.com
```

### Step 2: Enable HTTPS Redirect in web.config

Open `web.config` and find this section (around line 19):

**Uncomment this block:**

```xml
<!-- HTTPS Redirect Rule (Uncomment when SSL is configured) -->
<rule name="HTTP to HTTPS Redirect" stopProcessing="true">
  <match url="(.*)" />
  <conditions>
    <add input="{HTTPS}" pattern="off" ignoreCase="true" />
  </conditions>
  <action type="Redirect" url="https://{HTTP_HOST}/{R:1}" redirectType="Permanent" />
</rule>
```

**Remove the comment markers** `<!--` and `-->`

### Step 3: Enable HSTS Security Header (Optional but Recommended)

In `web.config`, find this section (around line 95):

**Uncomment this line:**

```xml
<!-- HSTS - HTTP Strict Transport Security (Uncomment when HTTPS is enabled) -->
<add name="Strict-Transport-Security" value="max-age=31536000; includeSubDomains" />
```

### Step 4: Restart IIS

```powershell
iisreset
```

### Step 5: Test HTTPS

**Self-Signed (IP):**
```
https://172.16.20.6/api/health
```

**Let's Encrypt (Domain):**
```
https://opticonnect.yourdomain.com/api/health
```

**Test redirect:**
```
http://172.16.20.6:82/api/health
```
Should automatically redirect to HTTPS ✅

### Step 6: Update Frontend

Update frontend API URL to use HTTPS:

```javascript
// Change from:
const API_URL = 'http://172.16.20.6:82';

// To (Self-Signed):
const API_URL = 'https://172.16.20.6';

// Or (Let's Encrypt):
const API_URL = 'https://opticonnect.yourdomain.com';
```

---

## 🐛 Troubleshooting {#troubleshooting}

### Issue 1: "Script cannot be loaded because running scripts is disabled"

**Cause:** PowerShell execution policy blocks scripts

**Solution:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

### Issue 2: "IIS site not found"

**Cause:** Script can't find your IIS site

**Solution:**
1. Check available sites:
   ```powershell
   Get-Website
   ```
2. Enter exact site name when script prompts
3. Or create site in IIS Manager first

---

### Issue 3: "This site can't provide a secure connection"

**Cause:** SSL certificate not properly bound

**Solution:**
1. Open Certificate Manager: `certlm.msc`
2. Verify certificate exists: Personal → Certificates
3. Check IIS bindings: IIS Manager → Site → Bindings
4. Verify HTTPS binding exists with certificate
5. Restart IIS: `iisreset`

---

### Issue 4: "Let's Encrypt validation failed"

**Causes:**
- Domain not pointing to server
- Ports 80/443 blocked by firewall
- Site not accessible from internet

**Solution:**
1. Test DNS:
   ```powershell
   nslookup opticonnect.yourdomain.com
   ```
2. Test from external network:
   ```
   http://opticonnect.yourdomain.com
   ```
3. Check firewall allows ports 80 and 443
4. Check IIS has HTTP binding on port 80
5. Verify domain is publicly accessible

---

### Issue 5: Browser shows "Not Secure" or certificate warning

**For Self-Signed:** This is normal!
- Click "Advanced" → "Proceed to site"
- Or install certificate on client machines (see [Remove Browser Warnings](#remove-browser-warnings-optional))

**For Let's Encrypt:** Should not show warnings
- If it does, certificate may not be installed correctly
- Re-run `.\Install-LetsEncryptSSL.ps1`

---

### Issue 6: Redirect loop (keeps redirecting)

**Cause:** HTTPS redirect misconfigured

**Solution:**
1. Verify redirect rule in `web.config` checks `{HTTPS}` pattern "off"
2. Ensure `stopProcessing="true"` is set
3. Check HTTPS binding exists in IIS
4. Restart IIS: `iisreset`

---

### Issue 7: "Cannot resolve hostname"

**Cause:** DNS not configured or using domain without DNS

**Solution:**
- For **IP-based**: Use IP address directly: `https://172.16.20.6`
- For **domain-based**: Verify DNS is configured correctly
- Add to hosts file temporarily (testing only):
  ```
  172.16.20.6  opticonnect.yourdomain.com
  ```

---

### Issue 8: Certificate expired

**Self-Signed:**
- Re-run `.\Install-SelfSignedSSL.ps1`
- Creates new certificate automatically

**Let's Encrypt:**
- Should auto-renew via scheduled task
- Check Task Scheduler: `win-acme renew`
- Manual renewal: `C:\Tools\win-acme\wacs.exe --renew`

---

## ✅ Quick Reference

### Run Scripts on Server VM

**Self-Signed (IP):**
```powershell
cd C:\inetpub\wwwroot\opticonnect-backend
.\Install-SelfSignedSSL.ps1
```

**Let's Encrypt (Domain):**
```powershell
cd C:\inetpub\wwwroot\opticonnect-backend
.\Install-LetsEncryptSSL.ps1
```

### Test HTTPS

```powershell
# Self-Signed
Invoke-WebRequest -Uri "https://172.16.20.6/api/health" -SkipCertificateCheck

# Let's Encrypt
Invoke-WebRequest -Uri "https://yourdomain.com/api/health"
```

### Check Certificate

```powershell
# Open Certificate Manager
certlm.msc

# Check IIS bindings
Get-WebBinding -Name "OptiConnect Backend"
```

### Restart IIS

```powershell
iisreset
```

---

## 📊 Comparison Table

| Feature | Self-Signed | Let's Encrypt |
|---------|-------------|---------------|
| **Use Now?** | ✅ Yes | ❌ Need domain first |
| **Works with IP** | ✅ Yes | ❌ No |
| **Works with Domain** | ✅ Yes | ✅ Yes |
| **Setup Time** | 5 min | 15 min |
| **Browser Warnings** | ⚠️ Yes | ✅ No |
| **Auto-Renewal** | ❌ Manual | ✅ Automatic |
| **Valid Period** | 5 years | 90 days (auto-renews) |
| **Internet Required** | ❌ No | ✅ Yes |
| **Cost** | Free | Free |
| **Best For** | Internal, IP-based | Public, domain-based |

---

## 🎯 Deployment Checklist

### Before SSL:
- [ ] Backend deployed to IIS
- [ ] Backend works on HTTP
- [ ] Database connected
- [ ] Health check responds: `http://172.16.20.6:82/api/health`

### Installing SSL:
- [ ] Ran appropriate script (Self-Signed or Let's Encrypt)
- [ ] Script completed without errors
- [ ] Certificate visible in Certificate Manager
- [ ] HTTPS binding exists in IIS

### Activating HTTPS:
- [ ] Updated `.env` file with HTTPS URLs
- [ ] Uncommented HTTPS redirect in `web.config`
- [ ] Uncommented HSTS header in `web.config`
- [ ] Restarted IIS

### Testing:
- [ ] HTTPS health check works
- [ ] HTTP redirects to HTTPS
- [ ] Frontend can communicate with backend
- [ ] Login/authentication works
- [ ] No errors in browser console
- [ ] No errors in iisnode logs

---

## 📞 Need More Help?

1. **Check logs:**
   - IIS logs: `C:\inetpub\logs\LogFiles\`
   - Application logs: `C:\inetpub\wwwroot\opticonnect-backend\iisnode\`
   - Windows Event Viewer: Application logs

2. **Verify configuration:**
   - Certificate Manager: `certlm.msc`
   - IIS Manager: Check site bindings
   - Firewall: `Get-NetFirewallRule -DisplayName "OptiConnect HTTPS"`

3. **Test connectivity:**
   ```powershell
   Test-NetConnection -ComputerName 172.16.20.6 -Port 443
   ```

---

## 🎉 Summary

**You have 2 automated scripts:**

1. ✅ `Install-SelfSignedSSL.ps1` - Use NOW with IP
2. ✅ `Install-LetsEncryptSSL.ps1` - Use LATER with domain

**Everything is automated - just run the script!**

**Quick Start:**
```powershell
# On Server VM as Administrator
cd C:\inetpub\wwwroot\opticonnect-backend
.\Install-SelfSignedSSL.ps1
```

**That's it!** HTTPS is ready! 🔒

---

*OptiConnect Backend - SSL/HTTPS Complete Guide*
*One document with everything you need!*
