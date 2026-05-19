@echo off
title AniTOR Streaming Engine
color 0b

echo ===================================================
echo               STARTING ANITOR ENGINE
echo ===================================================
echo.

:: Check if Node.js is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed on this computer!
    echo Please download and install it from https://nodejs.org
    echo.
    pause
    exit
)

:: Check if this is the first time running (missing node_modules)
if not exist "node_modules\" (
    echo [SETUP] First time launch detected. Installing core components...
    echo Please wait, this might take a minute...
    call npm install >nul 2>&1
    echo [SETUP] Installation complete!
    echo.
)

:: Start the server engine
echo [SYSTEM] Booting local servers and opening your browser...
node server.js

pause