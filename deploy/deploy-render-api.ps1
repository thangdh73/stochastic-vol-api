# Deploy stochastic-vol-api to Render (free tier) via Render API.
# Get API key: https://dashboard.render.com/u/settings#api-keys
#
# Usage:
#   $env:RENDER_API_KEY = "rnd_..."
#   .\deploy\deploy-render-api.ps1

$ErrorActionPreference = "Stop"

if (-not $env:RENDER_API_KEY) {
    Write-Host "Set RENDER_API_KEY first." -ForegroundColor Yellow
    Write-Host "One-click (no API key): https://render.com/deploy?repo=https://github.com/thangdh73/stochastic-vol-api"
    exit 1
}

$headers = @{
    Authorization  = "Bearer $env:RENDER_API_KEY"
    Accept         = "application/json"
    "Content-Type" = "application/json"
}

$services = Invoke-RestMethod -Uri "https://api.render.com/v1/services?limit=100" -Headers $headers
$existing = $services | ForEach-Object { $_.service } | Where-Object { $_.name -eq "stochastic-vol-api" } | Select-Object -First 1

if (-not $existing) {
    $owners = Invoke-RestMethod -Uri "https://api.render.com/v1/owners?limit=20" -Headers $headers
    $ownerId = $owners[0].owner.id
    if (-not $ownerId) { throw "No Render workspace found." }

    $body = @{
        type    = "web_service"
        name    = "stochastic-vol-api"
        ownerId = $ownerId
        repo    = "https://github.com/thangdh73/stochastic-vol-api"
        branch  = "main"
        autoDeploy = "yes"
        envVars = @(
            @{ key = "MMRA_DATABASE_URL"; value = "sqlite:////app/backend/mmra.db" }
            @{ key = "PYTHONPATH"; value = "/app/engine" }
        )
        serviceDetails = @{
            runtime = "docker"
            plan    = "free"
            healthCheckPath = "/health"
            envSpecificDetails = @{
                dockerfilePath = "deploy/Dockerfile"
                dockerContext  = "."
            }
        }
    } | ConvertTo-Json -Depth 10

    $created = Invoke-RestMethod -Uri "https://api.render.com/v1/services" -Method Post -Headers $headers -Body $body
    $existing = $created.service
    Write-Host "Created service, first deploy started."
}

$url = if ($existing.serviceDetails.url) { $existing.serviceDetails.url } else { "https://$($existing.slug).onrender.com" }
$url = $url.TrimEnd("/")
Write-Host "Service URL: $url"

for ($i = 1; $i -le 40; $i++) {
    try {
        $health = Invoke-RestMethod -Uri "$url/health" -TimeoutSec 90
        if ($health.status -eq "ok") {
            Write-Host "API live: $url" -ForegroundColor Green
            Write-Host "Run: .\deploy\switch-to-render.ps1"
            exit 0
        }
    } catch {
        Write-Host "  build/cold start $i/40 ..."
        Start-Sleep -Seconds 20
    }
}

Write-Host "Timed out — check build logs in Render dashboard." -ForegroundColor Yellow
exit 1
