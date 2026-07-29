# Aegis402 Cloud Deploy Script
# Usage: .\scripts\deploy.ps1
# Requires Docker to be installed

param(
  [string]$Network = "testnet",
  [string]$Upstream = "http://api:8080",
  [string]$PayTo = "",
  [string]$CdpKeyId = "",
  [string]$CdpKeySecret = "",
  [switch]$Detach = $false
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) {
  Write-Host "==> $msg" -ForegroundColor Cyan
}

Write-Step "Aegis402 Deploy"

# Validate network
if ($Network -eq "mainnet") {
  $networkId = "eip155:8453"
  Write-Host "  Target: Base Mainnet (real USDC)" -ForegroundColor Yellow
} elseif ($Network -eq "testnet") {
  $networkId = "eip155:84532"
  Write-Host "  Target: Base Sepolia testnet" -ForegroundColor Green
} else {
  Write-Host "  Unknown network '$Network'. Use 'testnet' or 'mainnet'." -ForegroundColor Red
  exit 1
}

# Generate .env from template
Write-Step "Generating .env"
@"
UPSTREAM_URL=$Upstream
PORT=3000
HOST=0.0.0.0
PRICE=0.05
NETWORK=$networkId
ASSET=USDC
PAY_TO=$PayTo
CDP_API_KEY_ID=$CdpKeyId
CDP_API_KEY_SECRET=$CdpKeySecret
NODE_ENV=production
LOG_JSON=true
"@ | Out-File -FilePath ".env" -Encoding utf8

Write-Step "Starting services"
$detachArg = if ($Detach) { "-d" } else { "" }
docker compose up --build $detachArg

Write-Step "Checking health"
Start-Sleep -Seconds 3
try {
  $health = Invoke-RestMethod -Uri "http://localhost:3000/health" -TimeoutSec 5
  Write-Host "  Status: $($health.status)" -ForegroundColor Green
  Write-Host "  CDP: $($health.cdpMode)" -ForegroundColor $(if($health.cdpConfigured){"Green"}else{"Yellow"})
} catch {
  Write-Host "  Health check failed. Make sure port 3000 is accessible." -ForegroundColor Red
}
