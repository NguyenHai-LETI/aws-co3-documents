@echo off
rem Start the SAA-C03 Trainer and open the browser (Windows): double-click this file.
rem Installs npm packages when needed; if the app is already running, just opens it. Other port: set PORT=4000
setlocal
cd /d "%~dp0"
if "%PORT%"=="" set "PORT=3003"
set "URL=http://localhost:%PORT%"

where node >nul 2>nul
if errorlevel 1 (
  echo [x] Chua cai Node.js ^(can ban 22.18 tro len^). Tai ban LTS tai https://nodejs.org roi chay lai.
  goto fail
)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=18)?0:1)"
if errorlevel 1 (
  echo [x] Node.js qua cu - can ban 22.18 tro len. Cap nhat tai https://nodejs.org
  goto fail
)

rem Already running on this port? Then only open the browser.
curl -fsS -m 2 "http://127.0.0.1:%PORT%/api/meta" >nul 2>nul
if not errorlevel 1 (
  echo [ok] Trainer dang chay san: %URL%
  start "" "%URL%"
  exit /b 0
)

rem npm install when node_modules is missing or package-lock.json changed since the last install (e.g. after a sync).
if not exist "node_modules\" goto install
fc /b package-lock.json node_modules\.trainer-lock.json >nul 2>nul
if errorlevel 1 goto install
goto run

:install
echo Dang cai thu vien (npm install)...
set "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1"
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo [x] npm install that bai - kiem tra mang roi chay lai.
  goto fail
)
copy /y package-lock.json node_modules\.trainer-lock.json >nul

:run
echo Dang khoi dong... (Ctrl+C hoac dong cua so nay de dung)
set "OPEN=1"
node server\index.ts
if errorlevel 1 goto fail
exit /b 0

:fail
echo.
pause
exit /b 1
