@echo off
rem Doble clic para arrancar la Mesa de D&D en este ordenador.
chcp 65001 >nul
cd /d "%~dp0"
title Mesa de D^&D

where py >nul 2>nul
if %errorlevel%==0 (
    py -3 app.py %*
    goto fin
)
where python >nul 2>nul
if %errorlevel%==0 (
    python app.py %*
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
