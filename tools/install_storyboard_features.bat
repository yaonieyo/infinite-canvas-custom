@echo off
chcp 65001 >nul
setlocal

echo 无限画布故事板工作流安装器
echo.
set /p TARGET=请输入另一台电脑上的无限画布项目根目录: 
if "%TARGET%"=="" (
    echo 未输入目录，安装已取消。
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install_storyboard_features.ps1" -TargetRoot "%TARGET%"
if errorlevel 1 (
    echo.
    echo 安装失败，请查看上面的错误信息。
) else (
    echo.
    echo 安装完成。请重启无限画布服务并刷新网页。
)
pause
