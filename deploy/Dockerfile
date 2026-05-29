FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/backend/requirements.txt
COPY engine/requirements.txt /app/engine/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt -r /app/engine/requirements.txt

COPY backend /app/backend
COPY engine /app/engine

ENV PYTHONPATH=/app/engine
ENV MMRA_DATABASE_URL=sqlite:////data/mmra.db

RUN mkdir -p /data

WORKDIR /app/backend

EXPOSE 8002

CMD ["sh", "-c", "python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8002}"]
