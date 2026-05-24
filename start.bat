@echo off
title votv-mp-devcast
echo ============================================================
echo  votv-mp-devcast  --  live GitHub-style overlay for OBS
echo ============================================================
echo  Sister repo : D:\Projects\Programming\VOTV_MP
echo  URL         : http://localhost:7842/   (will open in browser)
echo  OBS source  : Browser source, URL above, 1920x1080
echo  Stop        : Ctrl+C in this window  (or run stop.bat)
echo ============================================================
echo.
cd /d "%~dp0"

:: Open the dashboard in the default browser as soon as the server is up.
:: The helper polls port 7842 in a minimized window and exits after opening.
start "" /MIN cmd /c _open-when-ready.bat

node src/server/http-server.js
echo.
echo [devcast] server stopped (exit code %ERRORLEVEL%)
pause
