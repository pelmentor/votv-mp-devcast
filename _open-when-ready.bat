@echo off
:: Helper invoked by start.bat. Polls for the dev server to be listening on
:: port 7842, then opens the dashboard in the default browser and exits.
:: Underscore prefix marks this as internal — not meant to be run directly.

title devcast: waiting for server...
echo Waiting for http://localhost:7842/ to come up...
:wait
ping 127.0.0.1 -n 2 >nul
netstat -ano | findstr ":7842 " | findstr "LISTENING" >nul
if errorlevel 1 goto wait
echo Server up. Opening browser.
start "" "http://localhost:7842/"
