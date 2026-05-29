# Build static files for your personal website "technical corner".
# Default public URL: https://YOUR-DOMAIN/technical-corner/stochastic-volume/

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Frontend = Join-Path $Root "frontend"

$PublicPath = if ($env:PUBLIC_PATH) { $env:PUBLIC_PATH } else { "/tools/stochastic-volume/" }
if (-not $PublicPath.StartsWith("/")) { $PublicPath = "/$PublicPath" }
if (-not $PublicPath.EndsWith("/")) { $PublicPath = "$PublicPath/" }

$ApiBase = if ($env:VITE_API_BASE) { $env:VITE_API_BASE } else { $PublicPath.TrimEnd("/") }

Write-Host "Building frontend for: $PublicPath"
Write-Host "API base: $ApiBase"

Push-Location $Frontend
try {
  $env:VITE_BASE_PATH = $PublicPath
  $env:VITE_API_BASE = $ApiBase
  npm run build
  Write-Host ""
  Write-Host "Done. Static files: frontend\dist\"
  Write-Host "Copy dist\ contents to your website folder for this path."
  Write-Host "See docs\DEPLOY_PERSONAL_SITE.md for nginx + API setup."
} finally {
  Pop-Location
}
