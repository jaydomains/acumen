"""GET /v1/config — public runtime config probe.

The endpoint is reachable without authentication and mirrors
``Settings.app_public_url`` / ``Settings.app_env``. The frontend has
its own same-origin /api/config; this endpoint is for direct API
consumers (mobile, third-party docs)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.config import get_settings


def test_runtime_config_returns_settings_values(client: TestClient) -> None:
    settings = get_settings()
    r = client.get("/v1/config")
    assert r.status_code == 200, r.text
    assert r.json() == {
        "api_base_url": settings.app_public_url,
        "app_env": settings.app_env,
    }


def test_runtime_config_is_public(client: TestClient) -> None:
    r = client.get("/v1/config")
    assert r.status_code == 200
