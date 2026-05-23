"""Acumen HTTP application — setup only (CODE_SPEC §1, AC-CD2).

App factory plus liveness/readiness endpoints. Routers are included here
from P2 onward (auth/users/... per CODE_SPEC §3). The structure-gate
(scripts/structure_gate.py) keeps this file setup-only: no domain/model/
AI imports, no DB access, no business logic. Router includes ARE
permitted — they are wired starting P2.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from app.config import get_settings
from app.permissions import register_exception_handlers
from app.routers import (
    admin,
    assignments,
    attempts,
    auth,
    calibration,
    catalogue,
    cost,
    groups,
    paths,
    rag,
    tests,
    users,
)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Acumen",
        version="0.1.0",
        default_response_class=ORJSONResponse,
        docs_url="/docs",
        openapi_url="/openapi.json",
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

    # P5 Slice 3 — admin AI cost dashboard (AC-D18).
    app.include_router(cost.router)
    app.include_router(calibration.router)

    # P9 — Drive RAG admin surface (Slice 2) + realism feedback
    # endpoints (Slice 4). AC-D22.
    app.include_router(rag.router)

    return app


app = create_app()
