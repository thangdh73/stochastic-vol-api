@echo off

REM Stochastic volume calculation - start API + frontend (two windows)

set ROOT=%~dp0

set VENV_PY=%ROOT%backend\.venv\Scripts\python.exe



if not exist "%VENV_PY%" (

  echo.

  echo [Stochastic volume calculation] Backend virtual environment not found.

  echo Run once from PowerShell:

  echo   cd "%ROOT%backend"

  echo   .\setup-venv.ps1

  echo.

  pause

  exit /b 1

)



start "Stochastic Vol API (8002)" cmd /k "cd /d "%ROOT%backend" && "%VENV_PY%" -m uvicorn app.main:app --reload --reload-dir . --reload-dir "..\engine" --host 127.0.0.1 --port 8002"

timeout /t 2 /nobreak >nul

start "Stochastic Vol UI (5174)" cmd /k "cd /d "%ROOT%frontend" && set VITE_API_PORT=8002 && set VITE_DEV_PORT=5174 && npm run dev"



echo.

echo Open in browser: http://localhost:5174/

echo API health:    http://127.0.0.1:8002/health

echo.

pause

