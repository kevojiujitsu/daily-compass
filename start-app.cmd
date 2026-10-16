@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js, then run this file again.
  pause
  exit /b 1
)
powershell.exe -NoProfile -Command "$portOpen = Test-NetConnection -ComputerName localhost -Port 3000 -InformationLevel Quiet; if ($portOpen) { try { $status = Invoke-RestMethod -Uri 'http://localhost:3000/api/status' -TimeoutSec 2; if ($status.accountAuthReady) { exit 0 } } catch {}; exit 3 } else { exit 1 }"
if errorlevel 3 goto stale_server
if errorlevel 1 goto start_server
goto open_app

:start_server
start "Daily Compass server" /b node server.mjs
timeout /t 2 /nobreak >nul
powershell.exe -NoProfile -Command "try { $status = Invoke-RestMethod -Uri 'http://localhost:3000/api/status' -TimeoutSec 3; if ($status.accountAuthReady) { exit 0 } else { exit 1 } } catch { exit 1 }"
if errorlevel 1 (
  echo The new server did not start. Check the server window for its error message.
  pause
  exit /b 1
)

:open_app
start "" http://localhost:3000
echo Daily Compass is running. Keep the server window open while using the app.
pause
exit /b 0

:stale_server
echo A server is already using port 3000 and is not the updated Daily Compass server.
echo Stop the existing server with Ctrl+C in its terminal, then run this file again.
pause
exit /b 1
