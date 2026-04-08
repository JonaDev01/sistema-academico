@echo off
title Agregar dispositivo - Sistema Academico
color 3F
cls

echo.
echo  ================================================
echo   AGREGAR DISPOSITIVO AL SISTEMA
echo   Sistema Academico - Monte Hermon
echo  ================================================
echo.
echo  Este script configura este dispositivo para
echo  acceder al sistema con:
echo    http://colegio.local:3000
echo.
echo  Ejecuta esto UNA SOLA VEZ en cada dispositivo.
echo.

:: Verificar administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  ERROR: Ejecuta este archivo como Administrador.
    echo  Clic derecho ^> Ejecutar como administrador
    echo.
    pause
    exit
)

:: Pedir la IP del servidor
echo  Escribe la IP del servidor (la PC del colegio).
echo  Puedes verla en la ventana negra del servidor.
echo.
set /p SERVIDOR_IP="  IP del servidor: "

if "%SERVIDOR_IP%"=="" (
    echo  ERROR: No ingresaste ninguna IP.
    pause
    exit
)

:: Agregar al archivo hosts
set HOSTS=%SystemRoot%\System32\drivers\etc\hosts

:: Eliminar entrada anterior si existe
type "%HOSTS%" | findstr /v "colegio.local" > "%TEMP%\hosts.tmp"
copy /y "%TEMP%\hosts.tmp" "%HOSTS%" >nul

:: Agregar nueva entrada
echo %SERVIDOR_IP%    colegio.local >> "%HOSTS%"

echo.
echo  ================================================
echo   Listo. Abre el navegador y entra a:
echo.
echo     http://colegio.local:3000
echo.
echo   Guarda esa direccion en favoritos para
echo   no tener que escribirla cada vez.
echo  ================================================
echo.

:: Abrir el navegador directo
set /p ABRIR="  Abrir el navegador ahora? (s/n): "
if /i "%ABRIR%"=="s" start "" "http://colegio.local:3000"

pause
