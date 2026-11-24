@echo off
chcp 65001 >nul
title Proyecto 5 - El pendulo
cd /d "%~dp0python"
where py >nul 2>nul &&(set PY=py) || (set PY=python)
echo Instalando las librerias (solo la primera vez tarda un poco)...
%PY% -m pip install -q --disable-pip-version-check -r requirements.txt
if errorlevel 1 (
  echo.
  echo No se encontro Python. Instale Python 3 desde https://www.python.org/downloads/
  echo y marque la casilla "Add Python to PATH". Luego vuelva a abrir este archivo.
  pause
  exit /b 1
)
echo.
%PY% pendulo.py
echo.
start "" "%~dp0python\figuras"
pause
