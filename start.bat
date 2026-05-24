@echo off
title votv-mp-devcast
echo ============================================================
echo  votv-mp-devcast  --  live GitHub-style overlay for OBS
echo ============================================================
echo  Sister repo : %SISTER_REPO%
echo  URL         : http://localhost:7842/
echo  OBS source  : Browser source, URL above, 1920x1080
echo  Stop        : Ctrl+C in this window  (or run stop.bat)
echo ============================================================
echo.
cd /d "%~dp0"
node src/server/http-server.js
echo.
echo [devcast] server stopped (exit code %ERRORLEVEL%)
pause
