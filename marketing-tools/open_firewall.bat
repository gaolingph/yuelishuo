@echo off
title 乐说邦 - 开放防火墙端口 8080
echo ========================================
echo  正在添加防火墙规则...
echo ========================================
echo.
netsh advfirewall firewall add rule name="乐说邦 8080" dir=in action=allow protocol=tcp localport=8080
echo.
if %errorlevel%==0 (
    echo ✓ 防火墙规则添加成功！
    echo 现在你可以用 iPhone 访问:
    echo   http://192.168.0.14:8080
) else (
    echo ✗ 添加失败，请以管理员身份运行此脚本
)
echo.
pause
