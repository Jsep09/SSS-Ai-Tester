@echo off
setlocal
"%SystemRoot%\System32\chcp.com" 65001 >nul
title SSD AI Tester Installer
echo SSD AI Tester - Install skills for the current Windows user
echo.
"%SystemRoot%\System32\where.exe" node >nul 2>nul
if errorlevel 1 goto node_missing
node "%~dp0bin\install.mjs" %*
set "ssd_install_exit=%errorlevel%"
goto finished

:node_missing
echo ERROR: Node.js was not found.
echo Install Node.js 20 or newer, then run this installer again.
echo If Node.js was just installed, open a new terminal or sign in again.
set "ssd_install_exit=1"

:finished
echo.
if not defined SSD_TESTER_NO_PAUSE pause
exit /b %ssd_install_exit%
