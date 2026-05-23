"""CORS smoke (AC-CD19, frontend origin allowlist).

The CORS middleware was added so the Next.js frontend at :3000 can
talk to the FastAPI backend at :8000 from a browser. These tests
exercise the middleware:

1. A preflight OPTIONS from an allow-listed origin echoes the origin
   back on ``Access-Control-Allow-Origin``.
2. A preflight from an unknown origin does NOT echo the origin back —
   the request is technically successful at the wire level, but the
   browser refuses to follow through because the header is missing.
3. ``Settings.cors_allowed_origins_list`` parses the comma-separated
   env string into a clean list (trims whitespace, drops empties).

``allow_credentials`` stays False at the middleware (tokens travel in
the Authorization header), so we do NOT assert any cookie-credential
behaviour here. AC-CD19 documents the v1.x upgrade path.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app

client = TestClient(app)


def test_cors_preflight_from_allowed_origin_echoes_origin() -> None:
    resp = client.options(
        "/healthz",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_cors_preflight_from_disallowed_origin_does_not_echo() -> None:
    resp = client.options(
        "/healthz",
        headers={
            "Origin": "http://evil.example.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    # Starlette's CORS middleware returns 400 for a preflight from a
    # non-allow-listed origin; the critical assertion is the missing
    # ACAO header — that's what actually keeps the browser from using
    # the response.
    assert "access-control-allow-origin" not in {k.lower() for k in resp.headers}


def test_cors_allowed_origins_list_parses_comma_separated_env() -> None:
    s = Settings(cors_allowed_origins="http://a.example, http://b.example , ")
    assert s.cors_allowed_origins_list == ["http://a.example", "http://b.example"]
