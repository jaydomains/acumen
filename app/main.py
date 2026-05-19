"""Acumen HTTP application — setup only (CODE_SPEC §1, AC-CD2).

App factory plus liveness/readiness endpoints. Routers are included here
from P2 onward (auth/users/... per CODE_SPEC §3). The structure-gate
(scripts/structure_gate.py) keeps this file setup-only: no domain/model/
AI imports, no DB access, no business logic. Router includes ARE
permitted — they are wired starting P2.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.responses import ORJSONResponse

from app.config import get_settings
from app.permissions import register_exception_handlers
from app.routers import (
    assignments,
    auth,
    catalogue,
    groups,
    paths,
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
    app.include_router(auth.router)
    app.include_router(users.router)

    # P3 — catalogue: Subjects/Pills/discovery/safety/proposals,
    # Learning Paths, Groups (CODE_SPEC §3).
    app.include_router(catalogue.router)
    app.include_router(paths.router)
    app.include_router(groups.router)

    # P4 Slice 1 — Tests + Assignments (CODE_SPEC §3). Attempt lifecycle,
    # deterministic grading + engagement land in Slices 2/3.
    app.include_router(tests.router)
    app.include_router(assignments.router)

    return app


app = create_app()
