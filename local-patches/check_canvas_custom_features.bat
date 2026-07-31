@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "PATCH_SCRIPT=at-reference\restore_at_reference_patch.py"
if not exist "%PATCH_SCRIPT%" (
  echo Cannot find patch script: %PATCH_SCRIPT%
  echo Please copy the complete local-patches folder to the Infinite Canvas project root.
  pause
  exit /b 1
)

where py >nul 2>&1
if not errorlevel 1 (
  py -3 "%PATCH_SCRIPT%" --diagnose
  goto done
)

where python >nul 2>&1
if not errorlevel 1 (
  python "%PATCH_SCRIPT%" --diagnose
  goto done
)

echo Python was not found. Please install Python 3 and run this script again.
pause
exit /b 1

:done
pause
exit /b %ERRORLEVEL%
