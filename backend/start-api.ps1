# Start MMRA Web API on port 8002 (required for save, simulation, tornado).
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$venvPy = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPy)) {
    Write-Host "No backend\.venv found. Run setup-venv.ps1 first:" -ForegroundColor Yellow
    Write-Host "  cd backend" -ForegroundColor Yellow
    Write-Host "  .\setup-venv.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "Starting MMRA API at http://127.0.0.1:8002 ..."
& $venvPy -m uvicorn app.main:app --reload --reload-dir . --reload-dir "..\engine" --host 127.0.0.1 --port 8002
