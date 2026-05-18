# syntax=docker/dockerfile:1
# Multi-stage: base -> http / worker / migrate (CODE_SPEC §16, AC-CD16).
# No secrets in any image — configuration is env-only (SPEC §8.3).

FROM python:3.12-slim AS base
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./

FROM base AS http
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

FROM base AS worker
COPY requirements-worker.txt .
RUN pip install --no-cache-dir -r requirements-worker.txt
CMD ["celery", "-A", "app.worker:celery_app", "worker", "--loglevel=INFO"]

FROM base AS migrate
CMD ["alembic", "upgrade", "head"]
