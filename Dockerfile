# syntax=docker/dockerfile:1
# Multi-stage: base -> http / worker / migrate (CODE_SPEC §16, AC-CD16).
# No secrets in any image — configuration is env-only (SPEC §8.3).
#
# Dependencies are installed once per leaf stage (not in `base`), so no
# stage re-resolves an already-installed set. `requirements-worker.txt`
# stays the worker superset per CODE_SPEC §2 / AC-CD1 (it includes
# `-r requirements.txt`); the worker image just installs that single
# superset rather than installing the base set twice.

FROM python:3.12-slim AS base
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1
WORKDIR /app

FROM base AS http
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

FROM base AS worker
COPY requirements.txt requirements-worker.txt ./
RUN pip install --no-cache-dir -r requirements-worker.txt
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
CMD ["celery", "-A", "app.worker:celery_app", "worker", "--loglevel=INFO"]

FROM base AS migrate
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
CMD ["alembic", "upgrade", "head"]
