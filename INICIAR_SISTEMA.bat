@echo off
title Sistema Academico - Monte Hermon
color 1F
cls

echo.
echo  ================================================
echo   SISTEMA ACADEMICO - COLEGIO MONTE HERMON
echo  ================================================
echo.

:: Obtener IP del WiFi automaticamente
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "192.168.56"') do (
    set IP=%%a
    goto :found
)
:found
set IP=%IP: =%

echo  Iniciando servidor...
echo.
echo  ================================================
echo   Acceso desde esta PC:
echo   http://localhost:3000
echo   http://colegio.local:3000
echo.
echo   Acceso desde otros dispositivos (misma red):
echo   http://colegio.local:3000
echo  ================================================
echo.
echo  Credenciales admin:
echo    Email   : admin@colegio.edu
echo    Password: Admin1234!
echo.
echo  IMPORTANTE: No cierre esta ventana mientras
echo  el sistema este en uso.
echo  ================================================
echo.

:: Abrir el navegador automaticamente despues de 3 segundos
timeout /t 3 /nobreak >nul
start "" "http://localhost:3000"

:: Iniciar el servidor
cd /d "%~dp0"
npm run start

pause
