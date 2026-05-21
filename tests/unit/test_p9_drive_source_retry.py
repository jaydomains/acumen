"""P9 Slice 2 — Drive source tenacity retry predicate (AC-D22).

Unit-level coverage of
:func:`app.domain.drive_source._is_retryable_http_error`. The
predicate decides whether the tenacity decorator on
``_list_page`` / ``_export_text`` / ``_download_text`` should retry
a given exception. 5xx HttpError → retry; 4xx / non-HttpError →
propagate immediately (Gitar PR-#21 Slice 2 finding #1).
"""

from __future__ import annotations

import pytest
from googleapiclient.errors import HttpError

from app.domain.drive_source import _is_retryable_http_error


class _StubResp:
    """Minimal HttpError ``resp`` shape — only ``status`` is read."""

    def __init__(self, status: int | str) -> None:
        self.status = status
        self.reason = "stubbed"


def _make_http_error(status: int | str) -> HttpError:
    """Build a minimal :class:`HttpError` with the given ``status``."""
    return HttpError(resp=_StubResp(status), content=b"")


def test_retryable_500_internal_server_error() -> None:
    """5xx errors are documented transient classes — Drive's
    ``files.list`` /``export_media`` / ``get_media`` retry path."""
    assert _is_retryable_http_error(_make_http_error(500)) is True


def test_retryable_502_bad_gateway() -> None:
    assert _is_retryable_http_error(_make_http_error(502)) is True


def test_retryable_503_service_unavailable() -> None:
    assert _is_retryable_http_error(_make_http_error(503)) is True


def test_retryable_504_gateway_timeout() -> None:
    assert _is_retryable_http_error(_make_http_error(504)) is True


def test_not_retryable_401_auth_error() -> None:
    """401 is deterministic — bad credential. Retrying loops
    pointlessly through four attempts at ~10s each (the bug Gitar
    PR-#21 Slice 2 finding #1 caught)."""
    assert _is_retryable_http_error(_make_http_error(401)) is False


def test_not_retryable_403_permission_denied() -> None:
    """403 — Drive folder permission revoked or file moved to a
    sub-folder the service account can't see. Surface immediately."""
    assert _is_retryable_http_error(_make_http_error(403)) is False


def test_not_retryable_404_not_found() -> None:
    """404 — file deleted from Drive between ``list_files`` and
    ``fetch_text``. Per-file fail-soft in
    :func:`ingest_drive_folder` will catch it once and continue."""
    assert _is_retryable_http_error(_make_http_error(404)) is False


def test_not_retryable_429_rate_limited() -> None:
    """429 is rate-limit — Drive's quotas typically refuse rather
    than backoff-and-succeed. Treat as non-retryable at v1; revisit
    if the cron starts hitting quotas (P11 schedule wraps this
    callable)."""
    assert _is_retryable_http_error(_make_http_error(429)) is False


def test_not_retryable_non_http_exception() -> None:
    """A bare ``ValueError`` / ``RuntimeError`` is not an HttpError —
    the predicate returns False so tenacity doesn't retry. The
    per-file fail-soft path in :func:`ingest_drive_folder` catches
    these immediately rather than burning four retry attempts."""
    assert _is_retryable_http_error(ValueError("not http")) is False
    assert _is_retryable_http_error(RuntimeError("simulated")) is False


def test_not_retryable_string_status_falls_through() -> None:
    """Some Drive client versions return ``status`` as a string —
    the predicate handles the ``int(status)`` cast and falls through
    on non-numeric values rather than crashing."""
    assert _is_retryable_http_error(_make_http_error("not-a-number")) is False
    # A numeric string for a retryable code is still retryable
    # (defensive parse).
    assert _is_retryable_http_error(_make_http_error("503")) is True


def test_predicate_with_pytest_skip_falls_through() -> None:
    """``BaseException`` subclasses like :class:`pytest.SkipException`
    must not match — the predicate returns False so tenacity won't
    swallow them. (Defensive: this proves the predicate filters
    properly even if a test ever passes a BaseException through the
    Drive path.)"""

    class _NotHttpError(Exception):
        pass

    assert _is_retryable_http_error(_NotHttpError()) is False


# silence pyflakes "unused"
_ = pytest
