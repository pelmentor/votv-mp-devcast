@echo off
:: Run this AFTER closing the Claude Code session that has this folder open.
:: It will:
::   1) confirm no process holds the folder (Claude Code's shell, the dev server, etc.)
::   2) rename d:\Projects\Programming\Code_Visuals_HTML_OBS  ->  votv-mp-devcast
::   3) copy the Claude memory dir to the matching new path so saved rules keep loading
::
:: It is idempotent: running it twice after a successful rename does nothing harmful.

setlocal
set OLD=d:\Projects\Programming\Code_Visuals_HTML_OBS
set NEW=d:\Projects\Programming\votv-mp-devcast
set OLDMEM=%USERPROFILE%\.claude\projects\d--Projects-Programming-Code-Visuals-HTML-OBS
set NEWMEM=%USERPROFILE%\.claude\projects\d--Projects-Programming-votv-mp-devcast

echo ============================================================
echo  Rename: Code_Visuals_HTML_OBS  ->  votv-mp-devcast
echo ============================================================
echo  OLD : %OLD%
echo  NEW : %NEW%
echo  MEM : %OLDMEM%
echo     -> %NEWMEM%
echo ------------------------------------------------------------

if not exist "%OLD%" (
    echo [skip] OLD folder does not exist. Already renamed?
    goto :memmove
)
if exist "%NEW%" (
    echo [error] NEW folder already exists; refusing to overwrite.
    pause
    exit /b 1
)

:: Make sure the dev server isn't still running on 7842.
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":7842 " ^| findstr "LISTENING"') do (
    echo [stop] killing PID %%P on port 7842
    taskkill /F /PID %%P
)

echo.
echo [move] ren "%OLD%" votv-mp-devcast
ren "%OLD%" votv-mp-devcast
if errorlevel 1 (
    echo.
    echo [error] rename failed -- something still has the folder open.
    echo Close ALL Claude Code windows, any cmd prompts in that folder,
    echo any browser tabs pointing at localhost:7842, and try again.
    pause
    exit /b 1
)
echo [ok] folder renamed.

:memmove
if not exist "%OLDMEM%" (
    echo [skip] OLD memory dir does not exist.
    goto :done
)
if exist "%NEWMEM%" (
    echo [merge] NEW memory dir exists; copying memory\ contents into it.
    xcopy /E /Y /I "%OLDMEM%\memory\*" "%NEWMEM%\memory\" >nul
) else (
    echo [copy] copying memory dir to new path...
    xcopy /E /Y /I "%OLDMEM%" "%NEWMEM%" >nul
)
echo [ok] memory dir migrated.

:done
echo.
echo ============================================================
echo  Done. Open Claude Code in the new folder:
echo    %NEW%
echo ============================================================
pause
