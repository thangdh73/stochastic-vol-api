@echo off
REM MMRA Major Update - start API + frontend (two windows)
set ROOT=%~dp0

start "MMRA API (8002)" cmd /k "cd /d "%ROOT%backend" && uvicorn app.main:app --reload --reload-dir . --reload-dir "..\engine" --host 127.0.0.1 --port 8002"
timeout /t 2 /nobreak >nul
start "MMRA UI (5174)" cmd /k "cd /d "%ROOT%frontend" && set VITE_API_PORT=8002 && set VITE_DEV_PORT=5174 && npm run dev"

echo.
echo Open in browser: http://localhost:5174/
echo API docs:        http://127.0.0.1:8002/docs
echo.
pause
