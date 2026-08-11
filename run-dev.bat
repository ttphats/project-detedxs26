@echo off
cd /d "%~dp0"
echo Starting TEDx backend...
start "TEDx Backend" cmd /k "npm run dev:backend"
timeout /t 5 /nobreak >nul
echo Starting TEDx web-client and web-admin...
start "TEDx Web Client" cmd /k "npm run dev:client"
start "TEDx Web Admin" cmd /k "npm run dev:admin"
