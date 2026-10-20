@echo off
rem Start the SAA-C03 Trainer and open the browser (Windows): double-click this file. Other port: set PORT=4000
rem start.bat --lan (or set LAN=1): also open it to phones on the same Wi-Fi (access code / QR on the Cong cu page).
rem Installs npm packages when needed; if the app is already running, just opens it (and turns LAN access on if asked).
rem Exit code 75 from the server = restart: a sync brought newer app code and the learner pressed "Khoi dong lai" -
rem npm install runs when package-lock.json changed, then the server starts again (the open page reloads by itself).
setlocal
cd /d "%~dp0"
if "%PORT%"=="" set "PORT=3003"
set "URL=http://localhost:%PORT%"
set "WANT_LAN=0"
for %%a in (%*) do if /i "%%~a"=="--lan" set "WANT_LAN=1"
if /i "%LAN%"=="1" set "WANT_LAN=1"
if /i "%LAN%"=="true" set "WANT_LAN=1"

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

rem Already running on this port? Then only open the browser (LAN requested: switch it on through the API).
curl -fsS -m 2 "http://127.0.0.1:%PORT%/api/meta" >nul 2>nul
if errorlevel 1 goto notrunning
echo [ok] Trainer dang chay san: %URL%
if not "%WANT_LAN%"=="1" (
  start "" "%URL%"
  exit /b 0
)
curl -fsS -m 10 -X POST -H "X-Trainer: 1" -H "Content-Type: application/json" -d "{\"enabled\":true}" "http://127.0.0.1:%PORT%/api/lan" >nul 2>nul
if not errorlevel 1 echo [ok] Da mo truy cap LAN - quet ma QR o trang Cong cu
start "" "%URL%/#/tools"
exit /b 0

:notrunning
set "OPEN=1"
set "TRAINER_LAUNCHER=1"

:deps
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
rem One parenthesized block, read by cmd in one go: a sync that replaced this file while the server ran cannot make cmd
rem go on reading the new file at an old offset ("goto" looks the label up again, in whatever the file is now).
(
  node server\index.ts %*
  if errorlevel 75 if not errorlevel 76 goto restart
  if errorlevel 1 goto fail
  exit /b 0
)

:restart
echo Khoi dong lai de dung ban moi...
rem the page that asked for the restart reloads by itself: no second browser tab
set "OPEN="
goto deps

:fail
echo.
pause
exit /b 1
