@echo off
echo Starting Military Asset Manager System...

:: Start Backend
start "Military Backend" cmd /k "cd server && npm run dev"

:: Start Frontend
start "Military Frontend" cmd /k "cd client && npm run dev"

echo Application launching...
echo Backend: http://localhost:5000
echo Frontend: http://localhost:5173
