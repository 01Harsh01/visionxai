@echo off
title VisionX AI Launcher
echo Starting VisionX AI...
cd /d "%~dp0"

echo Starting Backend on http://localhost:8000...
start "VisionX Backend" cmd /k "cd backend && python -m uvicorn app.main:app --port 8000 --reload"

echo Starting Frontend on http://localhost:5173...
start "VisionX Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo VisionX AI is starting up!
echo - Frontend: http://localhost:5173
echo - Backend API Docs: http://localhost:8000/docs
echo.
echo Opening browser at http://localhost:5173...
timeout /t 3 /nobreak >nul
start http://localhost:5173

