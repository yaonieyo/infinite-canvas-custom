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

echo ============================================
echo    Install all canvas custom features
echo ============================================
echo.
echo This will install or restore:
echo - Batch poster frames
echo - Product poster prompt cards
echo - AI prompt splitting
echo - Frame provider/model/ratio/resolution controls
echo - Reference image inheritance and display
echo - @reference image tags in prompt inputs
echo - Doubao account pool video API with 5/10 second duration
echo.
echo Current project files will be backed up before restore.
echo.

where py >nul 2>&1
if not errorlevel 1 (
  py -3 "%PATCH_SCRIPT%" --force
  goto done
)

where python >nul 2>&1
if not errorlevel 1 (
  python "%PATCH_SCRIPT%" --force
  goto done
)

echo Python was not found. Please install Python 3 and run this script again.
pause
exit /b 1

:done
pause
exit /b %ERRORLEVEL%
