@echo off
title votv-mp-devcast  --  stop
echo Looking for processes on port 7842...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":7842 " ^| findstr "LISTENING"') do (
    echo Killing PID %%P
    taskkill /F /PID %%P
)
echo Done.
pause
