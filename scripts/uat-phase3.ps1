$ErrorActionPreference = "Continue"
$api = "https://travelpartner-api-v7nt.onrender.com"
$body = @{ email = "admin@wanderlusttravels.in"; password = "Passw0rd@123" } | ConvertTo-Json

try {
  $resp = Invoke-WebRequest -Uri "$api/api/auth/login" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 60 -UseBasicParsing
  $admin = $resp.Content | ConvertFrom-Json
  Write-Host "LOGIN admin -> $($resp.StatusCode) role=$($admin.user.role)"
} catch {
  $code = $null
  if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
  Write-Host "LOGIN admin -> FAIL status=$code"
  exit 1
}

$headers = @{ Authorization = "Bearer $($admin.token)" }

# Wallet
try {
  $r = Invoke-WebRequest -Uri "$api/api/wallet" -Headers $headers -TimeoutSec 45 -UseBasicParsing
  $w = $r.Content | ConvertFrom-Json
  Write-Host "WALLET -> $($r.StatusCode) keys=$($w.PSObject.Properties.Name -join ',')"
} catch {
  $code = $null
  if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
  Write-Host "WALLET -> FAIL status=$code"
}

# Quotes
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
  Write-Host "QUOTE holiday -> $($r.StatusCode)"
} catch {
  $code = $null
  if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
  Write-Host "QUOTE holiday -> FAIL status=$code"
}

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

# Products
foreach ($path in @(
  "/api/products/activities",
  "/api/products/hotels?approvalStatus=Approved",
  "/api/products/hotels?approvalStatus=Pending",
  "/api/products/transfers?liveOnly=true",
  "/api/products/destinations",
  "/api/flights",
  "/api/hotels"
)) {
  try {
    $r = Invoke-WebRequest -Uri "$api$path" -Headers $headers -TimeoutSec 60 -UseBasicParsing
    Write-Host "$path -> $($r.StatusCode) len=$($r.Content.Length)"
  } catch {
    $code = $null
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    Write-Host "$path -> FAIL status=$code"
  }
}

# Activity sample details
try {
  $r = Invoke-WebRequest -Uri "$api/api/products/activities" -Headers $headers -TimeoutSec 45 -UseBasicParsing
  $aj = $r.Content | ConvertFrom-Json
  $items = @()
  foreach ($key in @("activities","products","items","data")) {
    if ($aj.$key) { $items = @($aj.$key); break }
  }
  # maybe top-level array
  if ($items.Count -eq 0 -and $aj -is [System.Array]) { $items = @($aj) }
  Write-Host "ACTIVITIES count=$($items.Count) topKeys=$($aj.PSObject.Properties.Name -join ',')"
  if ($items.Count -gt 0) {
    $a0 = $items[0]
    $currencies = ($items | ForEach-Object { $_.currency } | Select-Object -Unique) -join "|"
    $withTransfers = @($items | Where-Object { $_.transferOptions }).Count
    $withPending = @($items | Where-Object { $_.pendingRateChanges }).Count
    $approved = @($items | Where-Object { $_.approvalStatus -eq "Approved" }).Count
    Write-Host "ACTIVITY currencies=$currencies transfers=$withTransfers pendingRates=$withPending approved=$approved sampleApproval=$($a0.approvalStatus)"
  }
} catch {
  Write-Host "ACTIVITIES detail FAIL"
}

# Support filter already created; list departments
try {
  $r = Invoke-WebRequest -Uri "$api/api/support/tickets" -Headers $headers -TimeoutSec 45 -UseBasicParsing
  $sj = $r.Content | ConvertFrom-Json
  $tickets = @($sj.tickets)
  $ops = ($tickets | ForEach-Object { $_.operationsType } | Select-Object -Unique) -join "|"
  $depts = ($tickets | ForEach-Object { $_.department } | Select-Object -Unique) -join "|"
  Write-Host "SUPPORT tickets=$($tickets.Count) ops=$ops depts=$depts"
} catch {
  Write-Host "SUPPORT list FAIL"
}

# Employee login for liveOnly rates
try {
  $eb = @{ email = "sneha@wanderlusttravels.in"; password = "Passw0rd@123" } | ConvertTo-Json
  $er = Invoke-WebRequest -Uri "$api/api/auth/login" -Method POST -Body $eb -ContentType "application/json" -TimeoutSec 45 -UseBasicParsing
  $ej = $er.Content | ConvertFrom-Json
  $eh = @{ Authorization = "Bearer $($ej.token)" }
  Write-Host "LOGIN employee -> $($er.StatusCode)"
  $r = Invoke-WebRequest -Uri "$api/api/products/activities?liveOnly=true" -Headers $eh -TimeoutSec 45 -UseBasicParsing
  $aj = $r.Content | ConvertFrom-Json
  $items = @()
  foreach ($key in @("activities","products","items","data")) { if ($aj.$key) { $items = @($aj.$key); break } }
  $nonApproved = @($items | Where-Object { $_.approvalStatus -and $_.approvalStatus -ne "Approved" }).Count
  Write-Host "EMPLOYEE liveOnly activities=$($items.Count) nonApproved=$nonApproved"
} catch {
  $code = $null
  if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
  Write-Host "EMPLOYEE liveOnly -> FAIL status=$code"
}

# Product executive login again
try {
  $pb = @{ email = "products@wanderlusttravels.in"; password = "Passw0rd@123" } | ConvertTo-Json
  $pr = Invoke-WebRequest -Uri "$api/api/auth/login" -Method POST -Body $pb -ContentType "application/json" -TimeoutSec 45 -UseBasicParsing
  Write-Host "LOGIN products -> $($pr.StatusCode)"
} catch {
  $code = $null
  if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
  Write-Host "LOGIN products -> FAIL status=$code (seed may be missing product_executive)"
}

Write-Host "UAT3_DONE"
