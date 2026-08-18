@echo off
setlocal
cd /d "%~dp0\.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0cloud-run-set-env.ps1" %*
echo.
echo Exit code: %ERRORLEVEL%
endlocal
