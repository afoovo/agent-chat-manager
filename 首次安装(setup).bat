@echo off
cd /d "%~dp0"
title ChatManager - Setup

echo ============================================
echo   ChatManager Setup Wizard
echo ============================================
echo.

REM --- Check Python ---
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Install Python 3.11+
    echo   Download: https://www.python.org/downloads/
    echo   * Check "Add Python to PATH" during install
    echo.
    pause
    exit /b 1
)
echo [OK] Python found
for /f "tokens=*" %%i in ('python --version 2^>^&1') do echo   %%i
echo.

REM --- Check Node.js ---
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Install Node.js 18+
    echo   Download: https://nodejs.org/
    echo.
    pause
    exit /b 1
)
echo [OK] Node.js found
for /f "tokens=*" %%i in ('node --version 2^>^&1') do echo   %%i
echo.

REM --- Backend venv ---
echo --- Setting up backend ---
if not exist "backend\venv" (
    echo Creating Python virtual environment...
    python -m venv backend\venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create venv
        pause
        exit /b 1
    )
    echo [OK] venv created
) else (
    echo [OK] venv already exists, skip
)

echo Installing Python dependencies...
backend\venv\Scripts\python.exe -m pip install -r backend\requirements.txt -q
if %errorlevel% neq 0 (
    echo [ERROR] pip install failed. Check network connection.
    pause
    exit /b 1
)
echo [OK] Python deps installed
echo.

REM --- Frontend deps ---
echo --- Setting up frontend ---
cd frontend
echo Installing Node.js dependencies (may take a while)...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed. Check network connection.
    cd ..
    pause
    exit /b 1
)
echo [OK] Node.js deps installed
cd ..
echo.

REM --- Check opencode.db ---
echo --- Checking data file ---
set DB_FOUND=0
if exist "%LOCALAPPDATA%\opencode\opencode.db" (
    echo [OK] opencode.db found
    set DB_FOUND=1
)
if exist "%USERPROFILE%\.local\share\opencode\opencode.db" (
    echo [OK] opencode.db found (Linux path)
    set DB_FOUND=1
)
if %DB_FOUND% equ 0 (
    echo [!] opencode.db not found
    echo    Make sure OpenCode has been run at least once
    echo    Typical path: %LOCALAPPDATA%\opencode\opencode.db
)

echo.
echo ============================================
echo   Setup complete!
echo   Double-click "一键启动(start).bat" to launch
echo ============================================
pause
