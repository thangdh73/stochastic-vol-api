# Switch production from Fly.io to Render (free tier).
# Run after Render service is live at https://stochastic-vol-api.onrender.com

$ErrorActionPreference = "Stop"

$RenderUrl = if ($env:RENDER_API_URL) { $env:RENDER_API_URL.TrimEnd("/") } else { "https://stochastic-vol-api.onrender.com" }
$MmraRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$PortfolioRoot = if ($env:PORTFOLIO_ROOT) { $env:PORTFOLIO_ROOT } else { "d:\1-Projects\thang-doan-portfolio" }

Write-Host "Checking Render API at $RenderUrl/health ..."
$health = Invoke-RestMethod -Uri "$RenderUrl/health" -TimeoutSec 90
if ($health.status -ne "ok") { throw "Render API health check failed." }
Write-Host "Render API OK." -ForegroundColor Green

Write-Host "Building UI with VITE_API_ORIGIN=$RenderUrl ..."
Push-Location (Join-Path $MmraRoot "frontend")
try {
  $env:VITE_BASE_PATH = "/tools/stochastic-volume/"
  $env:VITE_API_BASE = ""
  $env:VITE_API_ORIGIN = $RenderUrl
  npm run build
} finally {
  Pop-Location
}

Write-Host "Copying dist to portfolio ..."
$dest = Join-Path $PortfolioRoot "tools\stochastic-volume"
Remove-Item -Recurse -Force (Join-Path $dest "assets\*") -ErrorAction SilentlyContinue
Copy-Item -Recurse -Force (Join-Path $MmraRoot "frontend\dist\*") $dest

Write-Host "Updating Vercel STOCHASTIC_API_URL ..."
Push-Location $PortfolioRoot
try {
  npx vercel env rm STOCHASTIC_API_URL production --yes 2>$null
  echo $RenderUrl | npx vercel env add STOCHASTIC_API_URL production
  npx vercel --prod --yes
} finally {
  Pop-Location
}

Write-Host ""
Write-Host "Done. App: https://thang-doan.vercel.app/tools/stochastic-volume/" -ForegroundColor Green
Write-Host "Optional: destroy Fly app to avoid charges: flyctl apps destroy stochastic-vol-api --yes"
