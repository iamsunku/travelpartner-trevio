$ErrorActionPreference = "Continue"
$api = "https://travelpartner-api-v7nt.onrender.com"
$stamp = Get-Date -Format "yyyyMMddHHmmss"
$email = "uat.agent.$stamp@trevioglobal-test.com"

function Login([string]$email, [string]$password) {
  $body = @{ email = $email; password = $password } | ConvertTo-Json
  try {
    $resp = Invoke-WebRequest -Uri "$api/api/auth/login" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 60 -UseBasicParsing
    $json = $resp.Content | ConvertFrom-Json
    Write-Host "LOGIN $email -> $($resp.StatusCode) role=$($json.user.role) agency=$([bool]$json.user.agencyId)"
    return $json
  } catch {
    $code = $null
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    Write-Host "LOGIN $email -> FAIL status=$code"
    return $null
  }
}

# Successful agent registration
try {
  $reg = @{
    fullName = "UAT Agent $stamp"
    companyName = "UAT Travels $stamp"
    address = "42 Marine Drive, Mumbai, Maharashtra"
    email = $email
    countryCode = "+91"
    phone = "987650$stamp".Substring(0,10)
    country = "India"
    state = "Maharashtra"
    city = "Mumbai"
    panNumber = "ABCDE1234F"
    gstNumber = "27ABCDE1234F1Z5"
    password = "Passw0rd@123!"
    confirmPassword = "Passw0rd@123!"
    termsAccepted = $true
  } | ConvertTo-Json
  $r = Invoke-WebRequest -Uri "$api/api/auth/register" -Method POST -Body $reg -ContentType "application/json" -TimeoutSec 60 -UseBasicParsing
  $j = $r.Content | ConvertFrom-Json
  Write-Host "REGISTER success -> $($r.StatusCode) role=$($j.user.role) agencyId=$([bool]$j.user.agencyId) token=$([bool]$j.token)"
  $newToken = $j.token
} catch {
  $code = $null
  $body = ""
  if ($_.Exception.Response) {
    $code = [int]$_.Exception.Response.StatusCode
    try {
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $body = $reader.ReadToEnd()
    } catch {}
  }
  Write-Host "REGISTER success -> FAIL status=$code body=$body"
  $newToken = $null
}

# Login newly registered user
Login $email "Passw0rd@123!" | Out-Null

# Other role logins
Login "manager.mumbai@wanderlusttravels.in" "Passw0rd@123" | Out-Null
Login "accounts@wanderlusttravels.in" "Passw0rd@123" | Out-Null
Login "sales@wanderlusttravels.in" "Passw0rd@123" | Out-Null

# Agency admin for deeper tests
$admin = Login "admin@wanderlusttravels.in" "Passw0rd@123"
if ($admin -and $admin.token) {
  $headers = @{ Authorization = "Bearer $($admin.token)" }

  # Wallet
  try {
    $r = Invoke-WebRequest -Uri "$api/api/wallet" -Headers $headers -TimeoutSec 45 -UseBasicParsing
    $w = $r.Content | ConvertFrom-Json
    Write-Host "WALLET -> $($r.StatusCode) hasBalance=$([bool](($w.PSObject.Properties.Name -contains 'balance') -or ($w.PSObject.Properties.Name -contains 'walletBalance') -or ($w.agency)))"
    Write-Host "WALLET keys=$($w.PSObject.Properties.Name -join ',')"
  } catch {
    $code = $null
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    Write-Host "WALLET -> FAIL status=$code"
  }

  # Create quotation
  try {
    $q = @{
      customerName = "UAT Quote Customer"
      service = "Holiday"
      items = 2
      amount = 10000
      gst = 1800
      total = 11800
      validTill = (Get-Date).AddDays(14).ToString("yyyy-MM-dd")
      createdBy = "UAT"
      status = "Draft"
      destination = "Singapore"
      currency = "SGD"
    } | ConvertTo-Json
    $r = Invoke-WebRequest -Uri "$api/api/quotations" -Method POST -Body $q -Headers $headers -ContentType "application/json" -TimeoutSec 45 -UseBasicParsing
    $qj = $r.Content | ConvertFrom-Json
    Write-Host "QUOTE create -> $($r.StatusCode) id=$([bool]$qj.quotation.id) service=$($qj.quotation.service)"
  } catch {
    $code = $null
    $body = ""
    if ($_.Exception.Response) {
      $code = [int]$_.Exception.Response.StatusCode
      try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $reader.ReadToEnd()
      } catch {}
    }
    Write-Host "QUOTE create -> FAIL status=$code body=$body"
  }

  # International quotation
  try {
    $q = @{
      customerName = "UAT Intl Customer"
      service = "International"
      items = 4
      amount = 50000
      gst = 9000
      total = 59000
      validTill = (Get-Date).AddDays(14).ToString("yyyy-MM-dd")
      createdBy = "UAT"
      status = "Draft"
      isInternational = $true
      destination = "Dubai"
      country = "United Arab Emirates"
      currency = "AED"
    } | ConvertTo-Json
    $r = Invoke-WebRequest -Uri "$api/api/quotations" -Method POST -Body $q -Headers $headers -ContentType "application/json" -TimeoutSec 45 -UseBasicParsing
    Write-Host "QUOTE intl -> $($r.StatusCode)"
  } catch {
    $code = $null
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    Write-Host "QUOTE intl -> FAIL status=$code"
  }

  # Activities with transfer options / currency sample
  try {
    $r = Invoke-WebRequest -Uri "$api/api/products/activities" -Headers $headers -TimeoutSec 45 -UseBasicParsing
    $aj = $r.Content | ConvertFrom-Json
    $items = @()
    if ($aj.activities) { $items = $aj.activities }
    elseif ($aj.products) { $items = $aj.products }
    elseif ($aj.items) { $items = $aj.items }
    Write-Host "ACTIVITIES count=$($items.Count)"
    if ($items.Count -gt 0) {
      $a0 = $items[0]
      Write-Host "ACTIVITY sample currency=$($a0.currency) approval=$($a0.approvalStatus) hasTransferOpts=$([bool]$a0.transferOptions) hasPending=$([bool]$a0.pendingRateChanges)"
    }
  } catch {
    $code = $null
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    Write-Host "ACTIVITIES -> FAIL status=$code"
  }

  # Hotels pending rate approvals endpoint patterns
  foreach ($path in @(
    "/api/products/hotels?approvalStatus=Pending",
    "/api/products/transfers?liveOnly=true",
    "/api/products/destinations"
  )) {
    try {
      $r = Invoke-WebRequest -Uri "$api$path" -Headers $headers -TimeoutSec 45 -UseBasicParsing
      Write-Host "$path -> $($r.StatusCode)"
    } catch {
      $code = $null
      if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
      Write-Host "$path -> FAIL status=$code"
    }
  }
}

# Frontend registration CTA presence
try {
  $html = (Invoke-WebRequest -Uri "https://trevioglobal-frontend.vercel.app" -TimeoutSec 45 -UseBasicParsing).Content
  $hasRegister = $html -match "Register with Trevio|NEW AGENT REGISTRATION|Create Your"
  $hasLogin = $html -match "Sign in|Login"
  Write-Host "FRONTEND markers registerLike=$hasRegister loginLike=$hasLogin len=$($html.Length)"
} catch {
  Write-Host "FRONTEND content -> FAIL $($_.Exception.Message)"
}

Write-Host "UAT2_DONE"
