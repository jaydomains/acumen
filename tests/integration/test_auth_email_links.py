"""Setup/reset email link contract (AC-CD5 link contract; audit C1, WS-A
Slice 1).

The seam helpers ``setup_email_content`` / ``reset_email_content`` build the
token-bearing links embedded in account emails. The contract (AC-CD5,
amended 2026-06-06):

- built against the public **frontend** origin (``app_frontend_url``),
  deliberately distinct from the API origin (``app_public_url``), so the
  link resolves to the browser app rather than the API host;
- a **path-segment** token (matching the FE ``/<flow>/[token]`` route
  shape), not a query-string token, so it does not 404.

This is the seam no test exercised before C1 (auditor1.md:70).
"""

from __future__ import annotations

from urllib.parse import urlsplit

import pytest

from app.config import get_settings
from app.permissions import reset_email_content, setup_email_content

_FRONTEND = "https://acumen.example.com"
_API = "https://api.acumen.example.com"
_TOKEN = "abc123-raw-token"


@pytest.fixture(autouse=True)
def _distinct_origins(monkeypatch: pytest.MonkeyPatch) -> None:
    """Pin a frontend origin distinct from the API origin so the test
    proves the link is built from the FRONTEND, not the API host."""
    settings = get_settings()
    monkeypatch.setattr(settings, "app_frontend_url", _FRONTEND)
    monkeypatch.setattr(settings, "app_public_url", _API)


def test_setup_email_links_to_frontend_path_segment() -> None:
    _, body = setup_email_content(_TOKEN)
    assert f"{_FRONTEND}/setup/{_TOKEN}" in body
    # frontend host, not the API host
    assert _API not in body


def test_reset_email_links_to_frontend_path_segment() -> None:
    _, body = reset_email_content(_TOKEN)
    assert f"{_FRONTEND}/reset/{_TOKEN}" in body
    assert _API not in body


def test_trailing_slash_frontend_url_does_not_double_slash(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A natural operator form ``https://app.example.com/`` must not yield a
    double-slash ``//setup/<token>`` link (which 404s — the C1 failure
    class). The Settings validator normalises the trailing slash."""
    from app.config import Settings

    s = Settings(app_frontend_url="https://app.example.com/")
    monkeypatch.setattr("app.permissions.get_settings", lambda: s)
    _, setup_body = setup_email_content(_TOKEN)
    _, reset_body = reset_email_content(_TOKEN)
    assert f"https://app.example.com/setup/{_TOKEN}" in setup_body
    assert f"https://app.example.com/reset/{_TOKEN}" in reset_body
    assert "//setup/" not in setup_body
    assert "//reset/" not in reset_body


@pytest.mark.parametrize(
    ("content_fn", "flow"),
    [(setup_email_content, "setup"), (reset_email_content, "reset")],
)
def test_token_is_last_path_segment_no_query_string(content_fn, flow: str) -> None:
    """The token must be the final PATH segment (FE ``[token]`` route), not a
    query-string param — the exact shape that 404'd before C1."""
    _, body = content_fn(_TOKEN)
    link = next(line for line in body.split() if line.startswith(_FRONTEND))
    parts = urlsplit(link)
    assert parts.scheme + "://" + parts.netloc == _FRONTEND
    assert parts.query == ""  # no ?token=… query string
    segments = parts.path.strip("/").split("/")
    assert segments == [flow, _TOKEN]  # /<flow>/<token>, token last
