@echo off
title Servidor Dread Facility
cls
echo ==================================================
echo   Iniciando Dread Facility localmente...
echo ==================================================
powershell -ExecutionPolicy Bypass -File server.ps1
pause
