@echo off
cd /d "%~dp0"

set "PYEXE=%~dp0python\python.exe"
if not exist "%PYEXE%" set "PYEXE=python"

set "LAN_IP=127.0.0.1"
for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$ip=(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address } | Select-Object -First 1 -ExpandProperty IPv4Address).IPAddress; if(-not $ip){$ip=(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Sort-Object InterfaceMetric | Select-Object -First 1 -ExpandProperty IPAddress)}; if($ip){$ip}else{'127.0.0.1'}"`) do set "LAN_IP=%%I"
set "APP_URL=http://%LAN_IP%:3000/"

echo Starting ComfyUI-API-Modelscope...
echo Visit: %APP_URL%
echo Local: http://127.0.0.1:3000/
echo Press Ctrl+C to stop.
echo.

start /b cmd /c "timeout /t 3 /nobreak >nul && start %APP_URL%"
"%PYEXE%" main.py

echo.
echo Server stopped.
pause
