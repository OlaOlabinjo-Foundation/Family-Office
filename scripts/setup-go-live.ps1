# One-time local prep for production deploy (secrets, users, build, health check).
# Run from repo root:  .\scripts\setup-go-live.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function New-Secret([int]$bytes = 32) {
  $b = New-Object byte[] $bytes
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  -join ((1..$bytes) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
}

Write-Host ""
Write-Host "=== Family Office go-live setup ===" -ForegroundColor Cyan

$envPath = Join-Path $Root "server\.env"
$jwt = New-Secret
$mfa = New-Secret
$portalPassword = "OoFo-" + (New-Secret 16)

if (-not (Test-Path $envPath)) {
  $lines = @(
    "NODE_ENV=production",
    "FAMILY_OFFICE_AUTH=sqlite",
    "FAMILY_OFFICE_SQLITE=server/data/family-office.sqlite",
    "FAMILY_OFFICE_VAULT_DIR=server/data/vault",
    "JWT_SECRET=$jwt",
    "FAMILY_OFFICE_MFA_KEY=$mfa",
    "FAMILY_OFFICE_MFA_REQUIRED=0",
    "FAMILY_OFFICE_DIGEST_CRON=0"
  )
  $lines | Set-Content -Path $envPath -Encoding UTF8
  Write-Host "(ok) Created server/.env" -ForegroundColor Green
} else {
  Write-Host "(skip) server/.env already exists" -ForegroundColor Yellow
}

$dataDir = Join-Path $Root "server\data"
$vaultDir = Join-Path $dataDir "vault"
New-Item -ItemType Directory -Force -Path $dataDir, $vaultDir | Out-Null

Write-Host "(..) Seeding users..." -ForegroundColor Cyan
$env:FAMILY_OFFICE_SQLITE = Join-Path $dataDir "family-office.sqlite"
node (Join-Path $Root "scripts\seed-all-users.mjs") $portalPassword
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$credFile = Join-Path $dataDir "DEPLOY-CREDENTIALS.local.txt"
$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
@(
  "Family Office - initial portal logins (change after first sign-in)",
  "Generated: $stamp",
  "",
  "Users: chairman | lead | analyst | viewer",
  "Password (all roles): $portalPassword",
  "",
  "Local API: http://localhost:8787",
  "After Render deploy: seed again on the server.",
  "",
  "KEEP PRIVATE - gitignored."
) | Set-Content -Path $credFile -Encoding UTF8
Write-Host "(ok) Credentials: server\data\DEPLOY-CREDENTIALS.local.txt" -ForegroundColor Green

Write-Host "(..) npm run build..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "=== YOUR TURN (browser) ===" -ForegroundColor Yellow
Write-Host "1. Push code: git add -A && git commit && git push origin main"
Write-Host "2. Render: https://dashboard.render.com/blueprint/new"
Write-Host "   Repo: https://github.com/OlaOlabinjo-Foundation/Family-Office"
Write-Host "   Blueprint: render.free.yaml"
Write-Host "3. After Render URL works, Vercel env COMMAND_CENTRE_API_URL = that URL, redeploy"
Write-Host "4. Seed on Render Shell: node scripts/seed-all-users.mjs YOUR_PASSWORD"
Write-Host ""
Write-Host "Portal password (local DB): $portalPassword" -ForegroundColor Cyan
Write-Host "Full details in server\data\DEPLOY-CREDENTIALS.local.txt" -ForegroundColor Cyan
