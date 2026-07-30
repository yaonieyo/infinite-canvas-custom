@echo off
chcp 65001 >nul
setlocal
set "APP_DIR=F:\下载\26-5-17-无限画布\网盘会员最新版"
set "LAUNCHER=F:\下载\26-5-17-无限画布\网盘会员最新版\启动服务.bat"
set "LOG_FILE=F:\下载\26-5-17-无限画布\网盘会员最新版\_self_restart.log"
echo [%date% %time%] restart scheduled >> "%LOG_FILE%"
timeout /t 3 /nobreak >nul
echo [%date% %time%] stopping old process >> "%LOG_FILE%"
taskkill /F /PID 17136 >nul 2>&1
timeout /t 2 /nobreak >nul
cd /d "%APP_DIR%"
if exist "%LAUNCHER%" (
  echo [%date% %time%] starting launcher: %LAUNCHER% >> "%LOG_FILE%"
  start "ComfyUI-API-Modelscope" /D "%APP_DIR%" cmd /k call "%LAUNCHER%"
) else (
  echo [%date% %time%] launcher missing, fallback to python main.py >> "%LOG_FILE%"
  if exist "%APP_DIR%\python\python.exe" (
    start "ComfyUI-API-Modelscope" /D "%APP_DIR%" cmd /k ""%APP_DIR%\python\python.exe" main.py"
  ) else (
    start "ComfyUI-API-Modelscope" /D "%APP_DIR%" cmd /k python main.py
  )
)
del "%~f0"
