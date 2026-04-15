@echo off
title Sistema Academico - Monte Hermon
color 1F
cls

echo.
echo  ================================================
echo   SISTEMA ACADEMICO - COLEGIO MONTE HERMON
echo  ================================================
echo.
echo  Iniciando...
echo.

:: Cambiar al directorio del bat
cd /d "%~dp0"

:: Usar Node.js para generar QR — guarda acceso_movil.html aqui mismo
:: y devuelve solo la IP en una linea
for /f %%i in ('node generar_qr.js') do set IP=%%i

echo  ================================================
echo.
echo   Acceso desde esta PC:
echo   http://localhost:3000
echo.
echo   IP actual del servidor: %IP%
echo   http://%IP%:3000
echo.
echo   Telefonos: se abrio pagina con codigo QR
echo   (escanear con la camara del telefono)
echo.
echo  ================================================
echo.
echo  Admin: admin@colegio.edu / Admin1234!
echo.
echo  NO cierre esta ventana mientras use el sistema
echo  ================================================
echo.

:: Abrir la pagina del QR (esta en la misma carpeta)
start "" "%~dp0acceso_movil.html"

:: Esperar y abrir el sistema
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"

:: Iniciar servidor
npm run start

pause
