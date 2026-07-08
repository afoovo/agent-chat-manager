@echo off
cd /d "%~dp0"
title ChatManager

REM --- Env check ---
if not exist "backend\venv\Scripts\python.exe" (
    echo [ERROR] Backend not set up
    echo   Run setup.bat first
    echo.
    pause
    exit /b 1
)

if not exist "frontend\node_modules" (
    echo [ERROR] Frontend not set up
    echo   Run setup.bat first
    echo.
    pause
    exit /b 1
)

echo.
echo   ChatManager starting...
echo   Backend: http://localhost:8000
echo   Frontend: http://localhost:5173
echo.
echo   Ctrl+C to stop all services
echo   =============================
echo.

cd frontend
call npm run dev:all

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Startup failed. Check if ports 8000/5173 are in use.
    pause
)
