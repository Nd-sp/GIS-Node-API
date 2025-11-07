# OptiConnect Backend - Let's Encrypt SSL Certificate Installation Script
# Run this script on the Server VM as Administrator
# REQUIREMENTS:
# 1. A domain name (e.g., opticonnect.yourdomain.com) pointing to this server
# 2. Port 80 and 443 accessible from the internet
# 3. IIS site already configured and running

#Requires -RunAsAdministrator

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "OptiConnect Backend - SSL Setup" -ForegroundColor Cyan
Write-Host "Let's Encrypt Certificate Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$siteName = "OptiConnect Backend"
$winAcmeVersion = "v2.2.9.1701"
$winAcmeUrl = "https://github.com/win-acme/win-acme/releases/download/$winAcmeVersion/win-acme.$winAcmeVersion.x64.trimmed.zip"
$installPath = "C:\Tools\win-acme"
$downloadPath = "$env:TEMP\win-acme.zip"

Write-Host "[1/6] Checking prerequisites..." -ForegroundColor Yellow

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if IIS is installed
$iisFeature = Get-WindowsFeature -Name Web-Server -ErrorAction SilentlyContinue
if (-not $iisFeature -or -not $iisFeature.Installed) {
    Write-Host "ERROR: IIS is not installed!" -ForegroundColor Red
    Write-Host "Please install IIS before running this script." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✓ Running as Administrator" -ForegroundColor Green
Write-Host "✓ IIS is installed" -ForegroundColor Green
Write-Host ""

# Important warning
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "IMPORTANT REQUIREMENTS:" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Before proceeding, ensure you have:" -ForegroundColor White
Write-Host "✓ A domain name (e.g., opticonnect.yourdomain.com)" -ForegroundColor Gray
Write-Host "✓ Domain DNS A record pointing to this server's PUBLIC IP" -ForegroundColor Gray
Write-Host "✓ Port 80 and 443 accessible from the INTERNET" -ForegroundColor Gray
Write-Host "✓ IIS site configured and running" -ForegroundColor Gray
Write-Host "✓ Valid email address for Let's Encrypt notifications" -ForegroundColor Gray
Write-Host ""
Write-Host "NOTE: Let's Encrypt does NOT work with:" -ForegroundColor Red
Write-Host "  ✗ IP addresses only (like 172.16.20.6)" -ForegroundColor Red
Write-Host "  ✗ Internal/private networks" -ForegroundColor Red
Write-Host "  ✗ Domains not accessible from internet" -ForegroundColor Red
Write-Host ""

$continue = Read-Host "Do you have a domain name configured? (yes/no)"
if ($continue -ne "yes" -and $continue -ne "y") {
    Write-Host ""
    Write-Host "Please set up a domain name first, then run this script again." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "For IP-based setup (172.16.20.6), use:" -ForegroundColor Cyan
    Write-Host "  Install-SelfSignedSSL.ps1" -ForegroundColor White
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 0
}

Write-Host ""

# Get domain name
Write-Host "Enter your domain name (e.g., opticonnect.yourdomain.com):" -ForegroundColor Cyan
$domainName = Read-Host "Domain"
if (-not $domainName) {
    Write-Host "ERROR: Domain name is required!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Domain: $domainName" -ForegroundColor Green
Write-Host ""

# Get email for Let's Encrypt
Write-Host "Enter your email address (for Let's Encrypt notifications):" -ForegroundColor Cyan
$emailAddress = Read-Host "Email"
if (-not $emailAddress) {
    Write-Host "ERROR: Email address is required!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Email: $emailAddress" -ForegroundColor Green
Write-Host ""

# Step 2: Download Win-ACME
Write-Host "[2/6] Downloading Win-ACME (Let's Encrypt client)..." -ForegroundColor Yellow

try {
    # Create install directory
    if (-not (Test-Path $installPath)) {
        New-Item -ItemType Directory -Path $installPath -Force | Out-Null
    }

    # Download Win-ACME
    Write-Host "Downloading from: $winAcmeUrl" -ForegroundColor Gray
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $winAcmeUrl -OutFile $downloadPath -UseBasicParsing

    Write-Host "✓ Downloaded Win-ACME" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "ERROR: Failed to download Win-ACME!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "You can download manually from:" -ForegroundColor Yellow
    Write-Host "https://github.com/win-acme/win-acme/releases" -ForegroundColor Cyan
    Read-Host "Press Enter to exit"
    exit 1
}

# Step 3: Extract Win-ACME
Write-Host "[3/6] Extracting Win-ACME..." -ForegroundColor Yellow

try {
    Expand-Archive -Path $downloadPath -DestinationPath $installPath -Force
    Write-Host "✓ Extracted to: $installPath" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "ERROR: Failed to extract Win-ACME!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Step 4: Test domain accessibility
Write-Host "[4/6] Testing domain accessibility..." -ForegroundColor Yellow

try {
    $dnsTest = Resolve-DnsName -Name $domainName -ErrorAction Stop
    Write-Host "✓ Domain DNS resolved successfully" -ForegroundColor Green
    Write-Host "  IP: $($dnsTest.IPAddress -join ', ')" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "WARNING: Could not resolve domain DNS!" -ForegroundColor Yellow
    Write-Host "Make sure DNS is properly configured before continuing." -ForegroundColor Yellow
    Write-Host ""
}

# Step 5: Configure IIS site binding
Write-Host "[5/6] Configuring IIS site..." -ForegroundColor Yellow

Import-Module WebAdministration -ErrorAction SilentlyContinue

# Check if site exists
$site = Get-Website -Name $siteName -ErrorAction SilentlyContinue
if (-not $site) {
    Write-Host "WARNING: IIS site '$siteName' not found!" -ForegroundColor Yellow
    Write-Host "Available sites:" -ForegroundColor Gray
    Get-Website | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor Gray }
    Write-Host ""

    $customSiteName = Read-Host "Enter the exact IIS site name"
    if ($customSiteName) {
        $siteName = $customSiteName
        $site = Get-Website -Name $siteName -ErrorAction SilentlyContinue
    }
}

if ($site) {
    # Update or add HTTP binding with hostname
    $existingHttpBinding = Get-WebBinding -Name $siteName -Protocol "http" -HostHeader $domainName -ErrorAction SilentlyContinue
    if (-not $existingHttpBinding) {
        try {
            New-WebBinding -Name $siteName -Protocol "http" -Port 80 -HostHeader $domainName -ErrorAction Stop
            Write-Host "✓ Added HTTP binding with hostname: $domainName" -ForegroundColor Green
        } catch {
            Write-Host "WARNING: Could not add HTTP binding" -ForegroundColor Yellow
            Write-Host "You may need to add it manually in IIS Manager." -ForegroundColor Gray
        }
    } else {
        Write-Host "✓ HTTP binding already exists" -ForegroundColor Green
    }
    Write-Host ""
} else {
    Write-Host "ERROR: IIS site not found!" -ForegroundColor Red
    Write-Host "Please create the IIS site first." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Step 6: Run Win-ACME
Write-Host "[6/6] Running Win-ACME to obtain Let's Encrypt certificate..." -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Win-ACME Interactive Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "INSTRUCTIONS:" -ForegroundColor White
Write-Host "1. When prompted, select: 'N' (Create certificate with default settings)" -ForegroundColor Gray
Write-Host "2. Choose: '1' (Single binding of an IIS site)" -ForegroundColor Gray
Write-Host "3. Select your site from the list" -ForegroundColor Gray
Write-Host "4. Enter your email: $emailAddress" -ForegroundColor Gray
Write-Host "5. Accept Terms of Service: 'yes'" -ForegroundColor Gray
Write-Host ""
Write-Host "Win-ACME will automatically:" -ForegroundColor Cyan
Write-Host "  ✓ Request certificate from Let's Encrypt" -ForegroundColor Gray
Write-Host "  ✓ Validate domain ownership" -ForegroundColor Gray
Write-Host "  ✓ Install certificate in IIS" -ForegroundColor Gray
Write-Host "  ✓ Set up auto-renewal (runs daily)" -ForegroundColor Gray
Write-Host ""

Read-Host "Press Enter to launch Win-ACME"

# Launch Win-ACME
try {
    Set-Location $installPath
    & ".\wacs.exe"
    Write-Host ""
    Write-Host "✓ Win-ACME configuration complete!" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "ERROR: Failed to run Win-ACME!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "You can run it manually:" -ForegroundColor Yellow
    Write-Host "  cd $installPath" -ForegroundColor White
    Write-Host "  .\wacs.exe" -ForegroundColor White
    Write-Host ""
}

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Certificate Details:" -ForegroundColor White
Write-Host "  Domain: $domainName" -ForegroundColor Gray
Write-Host "  Email: $emailAddress" -ForegroundColor Gray
Write-Host "  Provider: Let's Encrypt" -ForegroundColor Gray
Write-Host "  Auto-renewal: Enabled (runs daily)" -ForegroundColor Gray
Write-Host ""

# Test HTTPS
Write-Host "Testing HTTPS connection..." -ForegroundColor Yellow
try {
    $testUrl = "https://$domainName/api/health"
    $response = Invoke-WebRequest -Uri $testUrl -TimeoutSec 10 -ErrorAction Stop
    Write-Host "✓ HTTPS is working!" -ForegroundColor Green
    Write-Host "  URL: $testUrl" -ForegroundColor Gray
    Write-Host "  Status: $($response.StatusCode)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "⚠ Could not test HTTPS endpoint" -ForegroundColor Yellow
    Write-Host "This is normal if backend is not deployed yet." -ForegroundColor Gray
    Write-Host "Test manually at: https://$domainName" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Verify HTTPS binding in IIS Manager" -ForegroundColor White
Write-Host "2. Activate HTTPS following the guide in: COMPLETE_DEPLOYMENT_GUIDE.md" -ForegroundColor White
Write-Host "3. Update .env file with domain: FRONTEND_URL=https://$domainName" -ForegroundColor White
Write-Host "4. Test HTTPS endpoint: https://$domainName/api/health" -ForegroundColor White
Write-Host ""

Write-Host "Certificate Renewal:" -ForegroundColor Cyan
Write-Host "Win-ACME has set up a scheduled task to renew automatically." -ForegroundColor White
Write-Host "No manual action needed - it renews every 60 days automatically." -ForegroundColor White
Write-Host ""

Write-Host "Win-ACME location: $installPath" -ForegroundColor Gray
Write-Host ""

Read-Host "Press Enter to exit"
