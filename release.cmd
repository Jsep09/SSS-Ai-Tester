@echo off
setlocal
pushd "%~dp0"
node scripts/release-local.mjs %*
set "ssd_release_exit=%errorlevel%"
popd
if not defined SSD_RELEASE_NO_PAUSE pause
exit /b %ssd_release_exit%
