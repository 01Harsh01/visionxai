$root = $PSScriptRoot
Write-Host "Starting VisionX AI..." -ForegroundColor Cyan

Start-Process cmd -ArgumentList "/k cd /d `"$root\backend`" && python -m uvicorn app.main:app --port 8000 --reload" -WindowStyle Normal
Start-Process cmd -ArgumentList "/k cd /d `"$root\frontend`" && npm run dev" -WindowStyle Normal

Write-Host "VisionX AI is running!" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Yellow
Write-Host "Backend Docs: http://localhost:8000/docs" -ForegroundColor Yellow

Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"

