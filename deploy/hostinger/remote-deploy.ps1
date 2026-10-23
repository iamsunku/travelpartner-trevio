# Run full remote deploy over SSH (requires password or key).
# Example:
#   $env:TREVIO_VPS_PASSWORD = 'your-root-password'
#   .\deploy\hostinger\remote-deploy.ps1
param(
  [string]$HostName = "200.234.47.151",
  [string]$User = $(if ($env:TREVIO_VPS_USER) { $env:TREVIO_VPS_USER } else { "root" }),
  [string]$Password = $env:TREVIO_VPS_PASSWORD,
  [string]$LocalBackendEnv = "backend\.env"
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

if (-not $Password) {
  Write-Error "Set TREVIO_VPS_PASSWORD or pass -Password. SSH key auth failed earlier (Permission denied)."
}

if (-not (Test-Path $LocalBackendEnv)) {
  Write-Error "Missing $LocalBackendEnv — needed for DATABASE_URL / DIRECT_URL / JWT_SECRET"
}

# Parse needed keys from local backend .env (not printed)
$kv = @{}
Get-Content $LocalBackendEnv | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $p = $_.Split('=', 2)
  $kv[$p[0].Trim()] = $p[1].Trim().Trim('"').Trim("'")
}
foreach ($req in @("DATABASE_URL", "DIRECT_URL", "JWT_SECRET")) {
  if (-not $kv.ContainsKey($req) -or [string]::IsNullOrWhiteSpace($kv[$req])) {
    Write-Error "backend/.env missing $req"
  }
}

function Invoke-SshBash([string]$Script) {
  $plink = Get-Command plink -ErrorAction SilentlyContinue
  if ($plink) {
    $Script | & plink -batch -ssh "$User@$HostName" -pw $Password -hostkey *
    return
  }
  # OpenSSH: use sshpass if present, else fail with clear message
  $sshpass = Get-Command sshpass -ErrorAction SilentlyContinue
  if ($sshpass) {
    $env:SSHPASS = $Password
    $Script | sshpass -e ssh -o StrictHostKeyChecking=accept-new "$User@$HostName" "bash -s"
    return
  }
  Write-Error "Install plink (PuTTY) or sshpass, or add an SSH key for $User@$HostName"
}

Write-Host "Connecting to $User@$HostName ..."
$bootstrap = Get-Content (Join-Path $PSScriptRoot "bootstrap-on-server.sh") -Raw
$remote = @"
export DATABASE_URL='$($kv['DATABASE_URL'] -replace "'","'\''")'
export DIRECT_URL='$($kv['DIRECT_URL'] -replace "'","'\''")'
export JWT_SECRET='$($kv['JWT_SECRET'] -replace "'","'\''")'
$bootstrap
"@

Invoke-SshBash $remote
Write-Host "Remote deploy finished."
