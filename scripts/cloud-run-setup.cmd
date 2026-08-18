@echo off
setlocal
cd /d "%~dp0\.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0cloud-run-setup.ps1" %*
echo.
echo Exit code: %ERRORLEVEL%
endlocal
