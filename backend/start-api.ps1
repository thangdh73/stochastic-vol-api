# Start MMRA Web API on port 8002 (required for tab simulations + full MC).
Set-Location $PSScriptRoot
Write-Host "Starting MMRA API at http://127.0.0.1:8002 ..."
python -m uvicorn app.main:app --reload --reload-dir . --reload-dir "..\engine" --host 127.0.0.1 --port 8002
