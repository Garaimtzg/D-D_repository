@echo off
rem Doble clic para arrancar la Mesa de D&D y poder abrirla desde moviles de la misma wifi.
chcp 65001 >nul
cd /d "%~dp0"
title Mesa de D^&D (moviles)
echo  Abre en el movil la direccion que aparece abajo (misma wifi que este ordenador).
echo  Si Windows pregunta por el cortafuegos, permite el acceso en redes privadas.
echo.

where py >nul 2>nul
if %errorlevel%==0 (
    py -3 app.py --lan %*
    goto fin
)
where python >nul 2>nul
if %errorlevel%==0 (
    python app.py --lan %*
    goto fin
)
echo.
echo  No se ha encontrado Python en este ordenador.
echo  Instalalo desde https://www.python.org/downloads/
echo  y marca la casilla "Add python.exe to PATH" durante la instalacion.
echo.

:fin
echo.
echo  La mesa se ha cerrado. Pulsa una tecla para salir.
pause >nul
