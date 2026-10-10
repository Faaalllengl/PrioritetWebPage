@echo off
setlocal EnableExtensions

cd /d "%~dp0"

set "PORT=8765"
set "BIND=127.0.0.1"
set "PYTHON="

where py >nul 2>&1
if not errorlevel 1 set "PYTHON=py -3"

if not defined PYTHON (
  where python >nul 2>&1
  if not errorlevel 1 set "PYTHON=python"
)

if not defined PYTHON (
  echo Python не найден.
  echo Установите Python с https://www.python.org/downloads/
  pause
  exit /b 1
)

echo.
echo Локальный сервер запущен.
echo Папка: %CD%
echo Главная страница: http://%BIND%:%PORT%/prototypes/prototype-home.html
echo Админка видео: http://%BIND%:%PORT%/prototypes/admin.html
echo.
echo Чтобы остановить сервер, закройте это окно или нажмите Ctrl+C.
echo.

%PYTHON% server.py

set "EXIT_CODE=%ERRORLEVEL%"
echo.
echo Сервер остановлен.
pause
exit /b %EXIT_CODE%
