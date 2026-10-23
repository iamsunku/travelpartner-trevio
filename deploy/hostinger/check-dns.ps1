# Verify treviogobal.com A records point at the Hostinger VPS.
param(
  [string]$ExpectedIp = "200.234.47.151",
  [string]$Resolver = "8.8.8.8"
)

$names = @("treviogobal.com", "www.treviogobal.com")
$ok = $true

foreach ($name in $names) {
  Write-Host "Looking up $name via $Resolver ..."
  $out = (& nslookup $name $Resolver 2>&1 | ForEach-Object { "$_" }) -join "`n"
  Write-Host $out
  if ($out -match "Non-existent domain|can't find") {
    Write-Host "FAIL: $name is NXDOMAIN (not registered or nameservers not set)" -ForegroundColor Red
    $ok = $false
  } elseif ($out -match [regex]::Escape($ExpectedIp)) {
    Write-Host "OK: $name -> $ExpectedIp" -ForegroundColor Green
  } else {
    Write-Host "FAIL: $name does not resolve to $ExpectedIp" -ForegroundColor Red
    $ok = $false
  }
}

if (-not $ok) {
  Write-Host ""
  Write-Host "In Hostinger hPanel -> Domains -> treviogobal.com -> DNS / Nameservers:"
  Write-Host "  A   @     $ExpectedIp"
  Write-Host "  A   www   $ExpectedIp"
  Write-Host "If nslookup says Non-existent domain, the domain is not registered or nameservers are wrong."
  exit 1
}

Write-Host "DNS looks good."
exit 0
