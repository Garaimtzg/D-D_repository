@echo off
rem Cierra la Mesa de D&D que se abrio con "Mesa DnD.vbs" (la que funciona sin ventana).
rem Busca el Python que ejecuta el app.py de esta carpeta y lo detiene; lo guardado no se pierde.
title Cerrar Mesa de D^&D
set "APP=%~dp0app.py"
powershell -NoProfile -Command "$app = $env:APP.ToLower(); $p = @(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.ToLower().Replace([char]47, [char]92).Contains($app) }); if ($p.Count) { $p | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Write-Host ' La mesa se ha cerrado.' } else { Write-Host ' La mesa no estaba abierta.' }"
ping -n 4 127.0.0.1 >nul
