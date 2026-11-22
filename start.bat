@echo off
echo ====================================================
echo Starting Chat Server and Client...
echo ====================================================

start "Chat Backend (Port 5000)" cmd /k "cd server && npm run dev"
timeout /t 3 /nobreak >nul
start "Chat Frontend (Port 5173)" cmd /k "cd client && npm run dev"

echo.
echo Server: http://localhost:5000
echo Client: http://localhost:5173
echo ====================================================
