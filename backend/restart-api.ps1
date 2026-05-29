# Stop anything on port 8002 and start a fresh MMRA API (with engine reload).
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$conns = Get-NetTCPConnection -LocalPort 8002 -State Listen -ErrorAction SilentlyContinue
foreach ($c in $conns) {
    $pid = $c.OwningProcess
    if ($pid) {
        Write-Host "Stopping process on port 8002 (PID $pid)..."
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
}
Start-Sleep -Seconds 2

$venvPy = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPy)) {
    Write-Host "No backend\.venv — run .\setup-venv.ps1 first" -ForegroundColor Yellow
    exit 1
}

Write-Host "Starting MMRA API at http://127.0.0.1:8002 ..."
& $venvPy -m uvicorn app.main:app --reload --reload-dir . --reload-dir "..\engine" --host 127.0.0.1 --port 8002
