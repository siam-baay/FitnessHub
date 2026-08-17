@echo off
title FitnessHub - No MySQL
cd /d "%~dp0backend"
echo.
echo ==========================================
echo        FITNESSHUB - NO MYSQL MODE
echo ==========================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Install Node.js LTS and run this file again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing dependencies...
  call npm install
)
echo.
echo Starting FitnessHub server...
echo Open: http://localhost:5000
echo Health: http://localhost:5000/api/health
echo.
call npm start
pause
