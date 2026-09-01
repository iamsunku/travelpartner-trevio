$ErrorActionPreference = "Continue"
$api = "https://travelpartner-api-v7nt.onrender.com"

function Login([string]$email, [string]$password) {
  $body = @{ email = $email; password = $password } | ConvertTo-Json
  try {
    $resp = Invoke-WebRequest -Uri "$api/api/auth/login" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 60 -UseBasicParsing
    $json = $resp.Content | ConvertFrom-Json
    Write-Host "ROLELOGIN $email -> $($resp.StatusCode) role=$($json.user.role)"
    return $json.token
  } catch {
    $code = $null
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    Write-Host "ROLELOGIN $email -> FAIL status=$code"
    return $null
  }
}

$token = Login "admin@wanderlusttravels.in" "Passw0rd@123"
if ($token) {
  $headers = @{ Authorization = "Bearer $token" }
  foreach ($path in @("/api/bookings", "/api/products/activities?liveOnly=true", "/api/support/tickets")) {
    try {
      $r = Invoke-WebRequest -Uri "$api$path" -Headers $headers -TimeoutSec 60 -UseBasicParsing
      Write-Host "$path -> $($r.StatusCode)"
    } catch {
      $code = $null
      if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
      Write-Host "$path -> FAIL status=$code"
    }
  }
}

Login "superadmin@travelpartner.pro" "Passw0rd@123" | Out-Null
Login "products@wanderlusttravels.in" "Passw0rd@123" | Out-Null
Login "sneha@wanderlusttravels.in" "Passw0rd@123" | Out-Null
Login "admin@travelpartner.pro" "TravioAdmin@2024!" | Out-Null

# Registration validation (invalid payload should 400)
try {
  $bad = @{ fullName = "T"; companyName = "T"; address = "x"; email = "bad"; countryCode = "+91"; phone = "1"; country = ""; state = ""; city = ""; password = "short"; confirmPassword = "short"; termsAccepted = $true } | ConvertTo-Json
  $r = Invoke-WebRequest -Uri "$api/api/auth/register" -Method POST -Body $bad -ContentType "application/json" -TimeoutSec 45 -UseBasicParsing
  Write-Host "REGISTER invalid -> unexpected $($r.StatusCode)"
} catch {
  $code = $null
  if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
  Write-Host "REGISTER invalid -> status=$code (expect 400)"
}

# Duplicate registration attempt with existing agency email
try {
  $dup = @{
    fullName = "Test Agent"
    companyName = "Dup Agency"
    address = "123 Test Street Mumbai"
    email = "admin@wanderlusttravels.in"
    countryCode = "+91"
    phone = "9876543210"
    country = "India"
    state = "Maharashtra"
    city = "Mumbai"
    password = "Passw0rd@123!"
    confirmPassword = "Passw0rd@123!"
    termsAccepted = $true
  } | ConvertTo-Json
  $r = Invoke-WebRequest -Uri "$api/api/auth/register" -Method POST -Body $dup -ContentType "application/json" -TimeoutSec 45 -UseBasicParsing
  Write-Host "REGISTER duplicate -> unexpected $($r.StatusCode)"
} catch {
  $code = $null
  if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
  Write-Host "REGISTER duplicate -> status=$code (expect 409)"
}

# Create support ticket
if ($token) {
  $headers = @{ Authorization = "Bearer $token" }
  try {
    $ticket = @{
      subject = "UAT Support Ticket"
      description = "Automated UAT ticket for operations/delivery routing"
      priority = "Medium"
      operationsType = "hotel_operations"
      deliveryType = "remote"
      customerName = "UAT Tester"
    } | ConvertTo-Json
    $r = Invoke-WebRequest -Uri "$api/api/support/tickets" -Method POST -Body $ticket -Headers $headers -ContentType "application/json" -TimeoutSec 45 -UseBasicParsing
    $tj = $r.Content | ConvertFrom-Json
    Write-Host "SUPPORT create -> $($r.StatusCode) ops=$($tj.ticket.operationsType) dept=$($tj.ticket.department) delivery=$($tj.ticket.deliveryType)"
  } catch {
    $code = $null
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    Write-Host "SUPPORT create -> FAIL status=$code"
  }

  # Scheduled without date should fail
  try {
    $sched = @{
      subject = "UAT Scheduled"
      description = "Should require scheduledAt"
      priority = "Low"
      operationsType = "general_inquiry"
      deliveryType = "scheduled"
      customerName = "UAT Tester"
    } | ConvertTo-Json
    $r = Invoke-WebRequest -Uri "$api/api/support/tickets" -Method POST -Body $sched -Headers $headers -ContentType "application/json" -TimeoutSec 45 -UseBasicParsing
    Write-Host "SUPPORT scheduled missing date -> unexpected $($r.StatusCode)"
  } catch {
    $code = $null
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    Write-Host "SUPPORT scheduled missing date -> status=$code (expect 400)"
  }

  # Products list filters
  foreach ($path in @(
    "/api/products/hotels?approvalStatus=Approved",
    "/api/products/activities?approvalStatus=Pending",
    "/api/support/tickets?operationsType=hotel_operations"
  )) {
    try {
      $r = Invoke-WebRequest -Uri "$api$path" -Headers $headers -TimeoutSec 60 -UseBasicParsing
      Write-Host "$path -> $($r.StatusCode)"
    } catch {
      $code = $null
      if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
      Write-Host "$path -> FAIL status=$code"
    }
  }

  # Quotations list
  try {
    $r = Invoke-WebRequest -Uri "$api/api/quotations" -Headers $headers -TimeoutSec 60 -UseBasicParsing
    Write-Host "/api/quotations -> $($r.StatusCode)"
  } catch {
    $code = $null
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    Write-Host "/api/quotations -> FAIL status=$code"
  }
}

Write-Host "SMOKE_DONE"
