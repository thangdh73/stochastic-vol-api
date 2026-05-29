# Deploy stochastic-vol-api to Render (free tier) via Render API.
# Requires: RENDER_API_KEY from https://dashboard.render.com/u/settings#api-keys
#
# Usage:
#   $env:RENDER_API_KEY = "rnd_..."
#   .\deploy\deploy-render-api.ps1

$ErrorActionPreference = "Stop"

if (-not $env:RENDER_API_KEY) {
    Write-Host "Set RENDER_API_KEY first (Render Dashboard -> Account Settings -> API Keys)." -ForegroundColor Yellow
    Write-Host "Or use one-click deploy: https://render.com/deploy?repo=https://github.com/thangdh73/stochastic-vol-api"
    exit 1
}

$headers = @{
    Authorization = "Bearer $env:RENDER_API_KEY"
    Accept        = "application/json"
    "Content-Type" = "application/json"
}

Write-Host "Checking for existing Render service..."
$services = Invoke-RestMethod -Uri "https://api.render.com/v1/services?limit=100" -Headers $headers
$existing = $services | ForEach-Object { $_.service } | Where-Object { $_.name -eq "stochastic-vol-api" } | Select-Object -First 1

if (-not $existing) {
    Write-Host "Creating Blueprint from GitHub repo..."
    $owners = Invoke-RestMethod -Uri "https://api.render.com/v1/owners?limit=20" -Headers $headers
    $owner = $owners[0].owner
    if (-not $owner) { throw "No Render workspace found on this account." }

    $body = @{
        name     = "stochastic-vol-api"
        repo     = "https://github.com/thangdh73/stochastic-vol-api"
        branch   = "main"
        autoSync = $true
    } | ConvertTo-Json

    $blueprint = Invoke-RestMethod -Uri "https://api.render.com/v1/blueprints" -Method Post -Headers $headers -Body $body
    Write-Host "Blueprint created: $($blueprint.id). Waiting for sync..."
    Start-Sleep -Seconds 30
    $services = Invoke-RestMethod -Uri "https://api.render.com/v1/services?limit=100" -Headers $headers
    $existing = $services | ForEach-Object { $_.service } | Where-Object { $_.name -eq "stochastic-vol-api" } | Select-Object -First 1
}

if (-not $existing) {
    throw "Service stochastic-vol-api not found after blueprint create. Check Render dashboard."
}

$url = $existing.serviceDetails.url
if (-not $url) { $url = "https://$($existing.slug).onrender.com" }
$url = $url.TrimEnd("/")

Write-Host "Service URL: $url"
Write-Host "Waiting for /health..."

for ($i = 1; $i -le 40; $i++) {
    try {
        $health = Invoke-RestMethod -Uri "$url/health" -TimeoutSec 30
        if ($health.status -eq "ok") {
            Write-Host "API is live: $url/health" -ForegroundColor Green
            Write-Host ""
            Write-Host "Next: set VITE_API_ORIGIN=$url and rebuild UI, or run deploy/update-portfolio.ps1"
            exit 0
        }
    } catch {
        Write-Host "  attempt $i/40 — not ready yet (cold start / building)..."
        Start-Sleep -Seconds 15
    }
}

Write-Host "Health check timed out. Check build logs in Render dashboard." -ForegroundColor Yellow
exit 1
