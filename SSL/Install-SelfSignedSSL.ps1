# OptiConnect Backend - Self-Signed SSL Certificate Installation Script
# Run this script on the Server VM as Administrator
# This script will:
# 1. Create a self-signed SSL certificate for IP 172.16.20.6
# 2. Add HTTPS binding to IIS site
# 3. Open firewall port 443
# 4. Test the configuration

#Requires -RunAsAdministrator

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "OptiConnect Backend - SSL Setup" -ForegroundColor Cyan
Write-Host "Self-Signed Certificate Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$ipAddress = "172.16.20.6"
$siteName = "OptiConnect Backend"
$certificateName = "OptiConnect Backend SSL"
$validityYears = 5
$httpsPort = 443

Write-Host "[1/5] Checking prerequisites..." -ForegroundColor Yellow

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

# Step 1: Create Self-Signed Certificate
Write-Host "[2/5] Creating self-signed SSL certificate..." -ForegroundColor Yellow

try {
    # Remove old certificate if exists
    $oldCert = Get-ChildItem -Path Cert:\LocalMachine\My | Where-Object { $_.FriendlyName -eq $certificateName }
    if ($oldCert) {
        Write-Host "Removing old certificate..." -ForegroundColor Gray
        $oldCert | Remove-Item -Force
    }

    # Create new certificate
    $cert = New-SelfSignedCertificate `
        -DnsName $ipAddress, "opticonnect-backend", "localhost" `
        -CertStoreLocation "Cert:\LocalMachine\My" `
        -FriendlyName $certificateName `
        -NotAfter (Get-Date).AddYears($validityYears) `
        -KeyExportPolicy Exportable `
        -KeySpec Signature `
        -KeyLength 2048 `
        -KeyAlgorithm RSA `
        -HashAlgorithm SHA256 `
        -Subject "CN=$ipAddress"

    Write-Host "✓ Certificate created successfully!" -ForegroundColor Green
    Write-Host "  Thumbprint: $($cert.Thumbprint)" -ForegroundColor Gray
    Write-Host "  Valid until: $($cert.NotAfter.ToString('yyyy-MM-dd'))" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "ERROR: Failed to create certificate!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Step 2: Check if IIS site exists
Write-Host "[3/5] Configuring IIS HTTPS binding..." -ForegroundColor Yellow

Import-Module WebAdministration -ErrorAction SilentlyContinue

# Check if site exists
$site = Get-Website -Name $siteName -ErrorAction SilentlyContinue
if (-not $site) {
    Write-Host "WARNING: IIS site '$siteName' not found!" -ForegroundColor Yellow
    Write-Host "Available sites:" -ForegroundColor Gray
    Get-Website | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor Gray }
    Write-Host ""

    $customSiteName = Read-Host "Enter the exact IIS site name (or press Enter to skip IIS binding)"
    if ($customSiteName) {
        $siteName = $customSiteName
        $site = Get-Website -Name $siteName -ErrorAction SilentlyContinue
    }
}

if ($site) {
    try {
        # Remove existing HTTPS binding if exists
        $existingBinding = Get-WebBinding -Name $siteName -Protocol "https" -Port $httpsPort -ErrorAction SilentlyContinue
        if ($existingBinding) {
            Write-Host "Removing old HTTPS binding..." -ForegroundColor Gray
            Remove-WebBinding -Name $siteName -Protocol "https" -Port $httpsPort -Confirm:$false
        }

        # Add new HTTPS binding
        New-WebBinding -Name $siteName -IPAddress $ipAddress -Port $httpsPort -Protocol https -ErrorAction Stop

        # Bind certificate to HTTPS binding
        $binding = Get-WebBinding -Name $siteName -Protocol "https" -Port $httpsPort
        $binding.AddSslCertificate($cert.Thumbprint, "my")

        Write-Host "✓ HTTPS binding added to IIS site '$siteName'" -ForegroundColor Green
        Write-Host "  IP: $ipAddress" -ForegroundColor Gray
        Write-Host "  Port: $httpsPort" -ForegroundColor Gray
        Write-Host ""
    } catch {
        Write-Host "ERROR: Failed to configure IIS binding!" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        Write-Host ""
        Write-Host "You may need to configure the binding manually in IIS Manager." -ForegroundColor Yellow
        Write-Host ""
    }
} else {
    Write-Host "⚠ Skipping IIS binding configuration" -ForegroundColor Yellow
    Write-Host "Configure manually in IIS Manager after creating the site." -ForegroundColor Gray
    Write-Host ""
}

# Step 3: Open Firewall Port
Write-Host "[4/5] Configuring Windows Firewall..." -ForegroundColor Yellow

try {
    # Check if rule already exists
    $existingRule = Get-NetFirewallRule -DisplayName "OptiConnect HTTPS" -ErrorAction SilentlyContinue
    if ($existingRule) {
        Write-Host "Removing old firewall rule..." -ForegroundColor Gray
        Remove-NetFirewallRule -DisplayName "OptiConnect HTTPS" -Confirm:$false
    }

    # Create new firewall rule
    New-NetFirewallRule `
        -DisplayName "OptiConnect HTTPS" `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort $httpsPort `
        -Action Allow `
        -Profile Any `
        -Description "Allow HTTPS traffic for OptiConnect Backend" `
        -ErrorAction Stop | Out-Null

    Write-Host "✓ Firewall rule created (Port $httpsPort allowed)" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "ERROR: Failed to create firewall rule!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
}

# Step 4: Export Certificate (for client installation)
Write-Host "[5/5] Exporting certificate for client installation..." -ForegroundColor Yellow

try {
    $exportPath = "C:\OptiConnect-SSL-Certificate.cer"
    Export-Certificate -Cert $cert -FilePath $exportPath -Force | Out-Null

    Write-Host "✓ Certificate exported to: $exportPath" -ForegroundColor Green
    Write-Host ""
    Write-Host "To avoid browser warnings, install this certificate on client machines:" -ForegroundColor Cyan
    Write-Host "1. Copy $exportPath to client machine" -ForegroundColor Gray
    Write-Host "2. Double-click the .cer file" -ForegroundColor Gray
    Write-Host "3. Click 'Install Certificate'" -ForegroundColor Gray
    Write-Host "4. Select 'Local Machine' → 'Trusted Root Certification Authorities'" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "WARNING: Could not export certificate" -ForegroundColor Yellow
    Write-Host ""
}

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Certificate Details:" -ForegroundColor White
Write-Host "  Name: $certificateName" -ForegroundColor Gray
Write-Host "  IP: $ipAddress" -ForegroundColor Gray
Write-Host "  Port: $httpsPort" -ForegroundColor Gray
Write-Host "  Valid until: $($cert.NotAfter.ToString('yyyy-MM-dd'))" -ForegroundColor Gray
Write-Host ""

# Test HTTPS
Write-Host "Testing HTTPS connection..." -ForegroundColor Yellow
try {
    $testUrl = "https://$ipAddress/api/health"
    $response = Invoke-WebRequest -Uri $testUrl -SkipCertificateCheck -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✓ HTTPS is working!" -ForegroundColor Green
    Write-Host "  URL: $testUrl" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "⚠ Could not test HTTPS (this is normal if site is not deployed yet)" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Activate HTTPS following the guide in: COMPLETE_DEPLOYMENT_GUIDE.md" -ForegroundColor White
Write-Host "2. Test HTTPS endpoint: https://$ipAddress" -ForegroundColor White
Write-Host "3. (Optional) Install certificate on client machines to avoid browser warnings" -ForegroundColor White
Write-Host ""

Write-Host "Certificate exported to: $exportPath" -ForegroundColor Green
Write-Host ""

Read-Host "Press Enter to exit"
