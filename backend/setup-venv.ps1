# One-time: create backend/.venv with compatible numpy/scipy (avoids Anaconda numpy 2.x crash).
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$venvPy = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $venvPy)) {
    Write-Host "Creating virtual environment in backend\.venv ..."
    python -m venv .venv
}

Write-Host "Installing backend + engine dependencies ..."
& $venvPy -m pip install --upgrade pip
& $venvPy -m pip install -r requirements.txt -r "..\engine\requirements.txt"

Write-Host "Verifying API import ..."
& $venvPy -c "from app.main import app; print('OK: API app loads')"

Write-Host ""
Write-Host "Done. Start the API with:  .\start-api.ps1"
Write-Host "Or from project root:     start-dev.bat"
