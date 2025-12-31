@echo off
echo Stopping any running Node processes...
taskkill /F /IM node.exe >nul 2>&1

echo Cleaning Client Directory...
cd client
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json

echo Installing Dependencies (This may take a few minutes)...
call npm install
call npm install vite --save-dev

echo.
echo ===================================================
echo Fix Complete!
echo You can now run 'start_app.bat' to start the system.
echo ===================================================
pause
