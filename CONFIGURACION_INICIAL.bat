@echo off
title Configuracion inicial - Sistema Academico
color 2F
cls

echo.
echo  ================================================
echo   CONFIGURACION INICIAL
echo   Sistema Academico - Monte Hermon
echo  ================================================
echo.
echo  Este script solo se ejecuta UNA VEZ.
echo  Configura el firewall y el nombre de dominio
echo  local para acceder como: http://colegio.local:3000
echo.

:: Verificar si se ejecuta como administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  ERROR: Ejecuta este archivo como Administrador.
    echo  Clic derecho sobre el archivo ^> Ejecutar como administrador
    echo.
    pause
    exit
)

:: 1. Configurar firewall
echo  [1/2] Configurando firewall...
netsh advfirewall firewall delete rule name="Sistema Academico Puerto 3000" >nul 2>&1
netsh advfirewall firewall add rule ^
    name="Sistema Academico Puerto 3000" ^
    dir=in ^
    action=allow ^
    protocol=TCP ^
    localport=3000 >nul
echo       Firewall OK

:: 2. Agregar colegio.local al archivo hosts
echo  [2/2] Configurando nombre de dominio local...
set HOSTS=%SystemRoot%\System32\drivers\etc\hosts

:: Eliminar entrada anterior si existe
type "%HOSTS%" | findstr /v "colegio.local" > "%TEMP%\hosts.tmp"
copy /y "%TEMP%\hosts.tmp" "%HOSTS%" >nul

:: Obtener IP del WiFi
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "192.168.56" ^| findstr /v "127.0.0.1"') do (
    set IP=%%a
    goto :gotip
)
:gotip
set IP=%IP: =%

:: Agregar nueva entrada
echo %IP%    colegio.local >> "%HOSTS%"
echo       Dominio local OK ^(colegio.local ^→ %IP%^)

echo.
echo  ================================================
echo   Configuracion completada correctamente.
echo.
echo   Desde ESTA PC:
echo     http://localhost:3000
echo     http://colegio.local:3000
echo.
echo   Desde OTROS dispositivos en la misma red:
echo     Sigue las instrucciones del archivo
echo     AGREGAR_DISPOSITIVO.bat
echo  ================================================
echo.
pause
