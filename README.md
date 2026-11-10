# VisionX AI
FastAPI + PyTorch (BLIP caption/VQA, YOLOv8, EasyOCR, CLIP) with a React/Vite/TS/Tailwind frontend.

## Run (Docker)
    cp .env.example .env   # set DB_PASSWORD and JWT_SECRET
    docker compose up --build
Open http://localhost:3000 · API docs http://localhost:8000/docs
First request downloads model weights (~2 GB, cached in a volume).

## Run (local dev)
    cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload
    cd frontend && npm install && npm run dev      # http://localhost:5173

## Not yet implemented
Celery/Redis job queue, rate limiting, S3 storage, PDF reports, image comparison, forgot-password,
tests, and measured evaluation results. Do not publish metrics until you have run them.
