# Free HTTPS URL for Vercel — run API on this PC + Cloudflare Quick Tunnel.
# Prerequisites: npm run build, server/.env configured, cloudflared installed.
#
# Usage (two terminals):
#   Terminal 1: .\scripts\start-tunnel.ps1 -StartApi
#   Terminal 2: cloudflared tunnel --url http://localhost:8787
# Copy the https://….trycloudflare.com URL into Vercel as COMMAND_CENTRE_API_URL

param(
  [switch]$StartApi
)

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if ($StartApi) {
  Write-Host "Starting Command Centre (UI + API on http://localhost:8787)..." -ForegroundColor Cyan
  npm start
} else {
  Write-Host @"

Family Office — free go-live (Cloudflare Tunnel)

1. Terminal 1 (this window):
   .\scripts\start-tunnel.ps1 -StartApi

2. Terminal 2 (after API is listening):
   cloudflared tunnel --url http://localhost:8787

3. Copy the https URL into Vercel -> COMMAND_CENTRE_API_URL -> Redeploy

Full guide: docs/going-live-free.md

"@ -ForegroundColor Yellow
}
