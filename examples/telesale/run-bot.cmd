@echo off
setlocal
cd /d "%~dp0"
node "%~dp0run-e2e.mjs"
set "bot_exit=%errorlevel%"
if not defined SSD_TESTER_NO_PAUSE pause
exit /b %bot_exit%
