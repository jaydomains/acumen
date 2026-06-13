"""Acumen HTTP application — setup only (CODE_SPEC §1, AC-CD2).

App factory plus liveness/readiness endpoints. Routers are included here
from P2 onward (auth/users/... per CODE_SPEC §3). The structure-gate
(scripts/structure_gate.py) keeps this file setup-only: no domain/model/
AI imports, no DB access, no business logic. Router includes ARE
permitted — they are wired starting P2.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from app.config import Settings, check_startup_config, get_settings
from app.permissions import register_exception_handlers
from app.routers import (
    admin,
    assignments,
    attempts,
    auth,
    calibration,
    catalogue,
    competency,
    cost,
    groups,
    oversight,
    paths,
    rag,
    tests,
    users,
)
from app.schemas import RuntimeConfigResponse

_startup_log = logging.getLogger("acumen.startup")


def run_startup_checks(settings: Settings) -> None:
    """Log config warnings and fail the boot CLOSED on config errors.

    Called from the FastAPI lifespan at uvicorn startup. Delegates to
    ``app.config.check_startup_config`` (which reads only ``Settings`` — no
    ``app.ai`` import — so the structure-gate stays green, grounding G3).
    A missing AI key surfaces as a loud WARN in every env — making the
    "stub served as real" condition visible (A4-S3-C) — and an insecure
    non-dev config (default secrets / wildcard|localhost CORS) raises
    :class:`RuntimeError`, which aborts startup so a misconfigured
    production deployment never serves (Decision D2; WS4 pre-deploy subset).
    """
    warnings, errors = check_startup_config(settings)
    for message in warnings:
        _startup_log.warning("startup config: %s", message)
    if errors:
        for message in errors:
            _startup_log.error("startup config: %s", message)
        raise RuntimeError(
            "Refusing to start — insecure configuration for "
            f"app_env={settings.app_env!r}: " + "; ".join(errors)
        )


def create_app() -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        run_startup_checks(settings)
        yield

    app = FastAPI(
        title="Acumen",
        version="0.1.0",
        default_response_class=ORJSONResponse,
        docs_url="/docs",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    @app.get("/healthz", tags=["meta"])
    async def healthz() -> dict[str, str]:
        """Liveness — static, no dependencies."""
        return {"status": "ok", "env": settings.app_env}

    @app.get("/readyz", tags=["meta"])
    async def readyz() -> dict[str, str]:
        """Readiness.

        P0 returns ready unconditionally. (pending P1) add a Postgres
        readiness probe once the async engine + data model land.
        (pending P5/P6) add a Celery/Redis worker-connectivity probe
        when the AI/worker path is wired.
        """
        return {"status": "ready"}

    @app.get("/v1/config", tags=["meta"])
    async def runtime_config() -> RuntimeConfigResponse:
        """Public runtime config probe — no auth required.

        Returns the values direct API consumers (mobile, third-party,
        documentation) need to talk to this deployment. The Acumen
        frontend has its own same-origin /api/config that reads its
        container env at runtime, so frontend boot does not depend on
        this endpoint; this is the canonical source of truth for
        anyone else.
        """
        return RuntimeConfigResponse(
            api_base_url=settings.app_public_url,
            app_env=settings.app_env,
        )

    # P2 — auth & user management (CODE_SPEC §3). The error-envelope
    # handler and these two routers are the standalone-auth surface;
    # ``register_exception_handlers`` lives in the AC-CD5 port seam.
    register_exception_handlers(app)

    # Frontend CORS (AC-CD19). Allow-list is env-driven so deployments
    # set the production origin explicitly; default covers local dev
    # (Next.js at :3000 → FastAPI at :8000). allow_credentials stays
    # False — tokens travel in the Authorization header, not cookies.
    # The v1.x httpOnly-cookies upgrade path (documented in AC-CD19)
    # would flip this to credentialed mode and require the origin list
    # to be explicit (no wildcard).
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allowed_origins_list,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router)
    app.include_router(users.router)

    # P3 — catalogue: Subjects/Pills/discovery/safety/proposals,
    # Learning Paths, Groups (CODE_SPEC §3).
    app.include_router(catalogue.router)
    app.include_router(paths.router)
    app.include_router(groups.router)

    # P4 Slice 1 — Tests + Assignments (CODE_SPEC §3). Slice 2 added
    # the attempt lifecycle (start / autosave / pause / resume / next /
    # submit). Slice 3 adds deterministic grading + the result-gate
    # endpoint + the admin engagement surfaces.
    app.include_router(tests.router)
    app.include_router(assignments.router)
    app.include_router(attempts.router)
    app.include_router(admin.router)

    # Slice B B.4 — testee /v1/me/* surface (competence profile).
    app.include_router(competency.router)

    # P5 Slice 3 — admin AI cost dashboard (AC-D18).
    app.include_router(cost.router)
    app.include_router(calibration.router)

    # P9 — Drive RAG admin surface (Slice 2) + realism feedback
    # endpoints (Slice 4). AC-D22.
    app.include_router(rag.router)

    # E1 — retroactive content-oversight dashboard read API (AC-CD26).
    app.include_router(oversight.router)

    return app


app = create_app()
