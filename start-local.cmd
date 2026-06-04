@echo off
setlocal

cd /d "%~dp0"

echo.
echo Starting Muhammad Syafiq portfolio...
echo.

where npm.cmd >nul 2>nul
if errorlevel 1 (
    echo npm.cmd was not found. Please install Node.js, then run this file again.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installing dependencies...
    call npm.cmd install
    if errorlevel 1 (
        echo.
        echo Dependency install failed.
        pause
        exit /b 1
    )
)

echo The site will open at http://127.0.0.1:4173
start "" powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 3; Start-Process 'http://127.0.0.1:4173'"
echo.
echo Keep this window open while viewing the site.
echo Press Ctrl+C to stop the local server.
echo.

call npm.cmd run dev
pause
