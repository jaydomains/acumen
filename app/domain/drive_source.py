"""Drive source seam — Protocol + real google-api-python-client adapter
(AC-D22 / SPEC §7.3).

The ingest pipeline in :mod:`app.domain.drive_rag` consumes a
``DriveSource`` interface: ``list_files()`` returns the current folder
contents, and ``fetch_text()`` extracts plain-text for a given file id.
Two implementations:

* :class:`GoogleDriveSource` — production: builds a Drive v3 client
  lazily on first call using
  ``app.config.Settings.google_drive_credentials_json`` (a service-account
  JSON blob) and reads from the folder named by
  ``system_settings.drive_folder_id``. Tenacity wraps every call with the
  same exponential-backoff policy used by the OpenAI provider, retrying
  on transient :class:`googleapiclient.errors.HttpError` 5xx classes.
  Google Docs are exported as ``text/plain``; plain-text files are
  downloaded directly; anything else is skipped with a log warning so a
  binary PDF in the folder doesn't crash the sweep.

* :class:`_FakeDrive` — the AC-CD15 test double, defined in
  :mod:`tests.integration.conftest`. Both impls share the same Protocol
  so the admin endpoint code path is identical for dev / test / prod
  (Gitar PR-#20 plan-time risk #5 — reuse the OpenAIProvider lazy
  client pattern rather than reinventing it).

The Protocol stays narrow on purpose: the rest of the pipeline
(chunking, embedding, persistence) cares about ``file_id``,
``content_hash``, ``text``. Anything Drive-specific
(``mime_type``, ``modified_time``) is metadata returned by
:meth:`list_files` for diagnostics — not for diff routing, which is
strictly hash-based per AC-D22.
"""

from __future__ import annotations

import io
import json
import logging
from dataclasses import dataclass
from typing import Any, Protocol, runtime_checkable

from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DriveFile:
    """Per-file metadata pulled from Drive's ``files.list`` response.

    Fields chosen to keep the ingest sweep's working set small: id +
    name for audit-trail, mime_type to drive export-vs-download
    routing inside :meth:`GoogleDriveSource.fetch_text`, modified_time
    for diagnostics only (the diff is hash-based, not mtime-based,
    per AC-D22)."""

    id: str
    name: str
    mime_type: str
    modified_time: str


@runtime_checkable
class DriveSource(Protocol):
    """Two-call seam the ingest sweep composes against. Both calls are
    async so the production adapter can do non-blocking I/O against
    googleapiclient's threadpool wrapper; the test fake is trivially
    async by signature only."""

    async def list_files(self, *, folder_id: str) -> list[DriveFile]: ...

    async def fetch_text(self, *, file_id: str, mime_type: str) -> str: ...


# --- google-api-python-client adapter ---------------------------------


_DRIVE_RETRYABLE_STATUS = {500, 502, 503, 504}
"""HTTP 5xx classes Drive v3 returns transiently — backoff. 4xx (401
auth, 403 permission, 404 not found) propagate after the first
attempt; retrying them would loop pointlessly."""


def _is_retryable_http_error(exc: BaseException) -> bool:
    """Filter the tenacity retry policy to 5xx Drive errors only. 4xx
    errors are deterministic — auth, permission, or "file gone" — and
    a retry loop would just amplify them."""
    from googleapiclient.errors import HttpError

    if not isinstance(exc, HttpError):
        return False
    status = getattr(exc.resp, "status", None)
    try:
        status = int(status) if status is not None else None
    except (TypeError, ValueError):
        return False
    return status in _DRIVE_RETRYABLE_STATUS


class GoogleDriveSource:
    """Production :class:`DriveSource` adapter using
    ``google-api-python-client`` + a service-account credential. The
    Drive v3 ``files.list`` call is scoped to one folder via
    ``q="'{folder_id}' in parents"``; mime-type-based routing decides
    whether to ``export_media`` (Google Docs) or ``get_media`` (plain
    text). Anything else is logged and returned as empty so a
    binary PDF / image in the folder doesn't crash the sweep — the
    operator sees a warning per file skipped, and the chunker treats
    empty text as zero chunks.

    Lazy-built mirrors the :class:`~app.ai.openai.OpenAIProvider`
    pattern (Gitar PR-#20 plan-time risk #5): app import must not
    crash when ``google_drive_credentials_json`` is unset, so the
    Drive service object is built on first call only."""

    name = "google-drive"

    # MIME types ``files.export_media`` handles; we ask for plain text.
    _EXPORTABLE_GOOGLE_TYPES = frozenset(
        {
            "application/vnd.google-apps.document",
        }
    )

    # MIME types ``files.get_media`` handles directly (plain bytes →
    # decoded as UTF-8). Anything else is skipped with a log warning.
    _DIRECT_TEXT_TYPES = frozenset(
        {
            "text/plain",
            "text/markdown",
            "text/csv",
        }
    )

    def __init__(self) -> None:
        self._service: Any | None = None

    def _get_service(self) -> Any:
        """Lazy build the Drive v3 service object from the
        service-account credentials JSON. Cached for the life of the
        provider instance — the singleton in ``app.domain.drive_rag``
        is module-level so one process maintains one Drive client."""
        if self._service is not None:
            return self._service
        from google.oauth2.service_account import Credentials
        from googleapiclient.discovery import build

        from app.config import get_settings

        settings = get_settings()
        if not settings.google_drive_credentials_json:
            raise RuntimeError(
                "GoogleDriveSource requires `google_drive_credentials_json` "
                "to be set in the environment (a service-account JSON "
                "blob). Set it before calling list_files / fetch_text, "
                "or use the _FakeDrive seam in tests (AC-CD15)."
            )
        creds_info = json.loads(settings.google_drive_credentials_json)
        creds = Credentials.from_service_account_info(
            creds_info, scopes=["https://www.googleapis.com/auth/drive.readonly"]
        )
        # ``cache_discovery=False`` avoids the
        # ``oauth2client.contrib.locked_file`` deprecation warning at
        # build time. The Drive v3 discovery doc is small enough that
        # the request-time fetch is negligible vs the embedding spend.
        self._service = build("drive", "v3", credentials=creds, cache_discovery=False)
        return self._service

    async def list_files(self, *, folder_id: str) -> list[DriveFile]:
        """Return every file directly under ``folder_id`` (one level —
        no recursion at v1 per AC-D22 "single designated Drive
        folder"). Paginated via ``files.list``'s ``nextPageToken``
        until exhausted so a folder with > 100 files still returns
        every entry."""
        service = self._get_service()
        files: list[DriveFile] = []
        page_token: str | None = None
        while True:
            response = await self._list_page(service, folder_id, page_token)
            for item in response.get("files") or []:
                files.append(
                    DriveFile(
                        id=str(item.get("id", "")),
                        name=str(item.get("name", "")),
                        mime_type=str(item.get("mimeType", "")),
                        modified_time=str(item.get("modifiedTime", "")),
                    )
                )
            page_token = response.get("nextPageToken")
            if not page_token:
                break
        return files

    async def fetch_text(self, *, file_id: str, mime_type: str) -> str:
        """Pull the file's plain-text body. Google Docs → exported via
        ``files.export_media(mimeType="text/plain")``; plain text /
        markdown / csv → ``files.get_media``. Anything else is logged
        and returns empty so the sweep skips the file without crashing.
        UTF-8 decoding errors fall back to ``replace`` so a partially-
        invalid byte sequence inside an otherwise-readable doc doesn't
        kill the file's ingest pass."""
        if mime_type in self._EXPORTABLE_GOOGLE_TYPES:
            return await self._export_text(file_id)
        if mime_type in self._DIRECT_TEXT_TYPES:
            return await self._download_text(file_id)
        logger.warning(
            "Drive ingest: skipping file %s with unsupported mime_type %r "
            "(only Google Docs and plain text/markdown/csv are indexed at v1)",
            file_id,
            mime_type,
        )
        return ""

    @retry(
        reraise=True,
        stop=stop_after_attempt(4),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        # ``retry_if_exception`` (singular) takes a predicate so only
        # 5xx HttpError classes trigger a retry. A 4xx (401 auth,
        # 403 permission, 404 not found) propagates immediately;
        # retrying it would burn ~20 s of wall-clock per file before
        # surfacing the deterministic error to the operator
        # (Gitar PR-#21 Slice 2 finding #1 — the previous
        # ``retry_if_exception_type(BaseException)`` matched
        # everything).
        retry=retry_if_exception(_is_retryable_http_error),
    )
    async def _list_page(
        self, service: Any, folder_id: str, page_token: str | None
    ) -> dict[str, Any]:
        """One ``files.list`` page; wrapped with tenacity backoff on
        5xx Drive errors. ``retry_if_exception_type(BaseException)`` is
        the tenacity surface; the per-attempt body re-raises any
        non-retryable error before tenacity sees it, so the policy
        effectively filters to 5xx (mirrors the OpenAI provider's
        ``_RETRYABLE_EXC`` pattern)."""
        import anyio
        from googleapiclient.errors import HttpError

        def _call() -> dict[str, Any]:
            request = service.files().list(
                q=f"'{folder_id}' in parents and trashed = false",
                fields="nextPageToken, files(id, name, mimeType, modifiedTime)",
                pageSize=100,
                pageToken=page_token,
                supportsAllDrives=False,
                includeItemsFromAllDrives=False,
            )
            try:
                return request.execute()
            except HttpError as exc:
                if _is_retryable_http_error(exc):
                    raise
                # Non-retryable: re-raise without tenacity wrapping
                # (tenacity sees the raise and stops because the
                # exception class slipped past the filter).
                raise

        return await anyio.to_thread.run_sync(_call)

    @retry(
        reraise=True,
        stop=stop_after_attempt(4),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        # ``retry_if_exception`` (singular) takes a predicate so only
        # 5xx HttpError classes trigger a retry. A 4xx (401 auth,
        # 403 permission, 404 not found) propagates immediately;
        # retrying it would burn ~20 s of wall-clock per file before
        # surfacing the deterministic error to the operator
        # (Gitar PR-#21 Slice 2 finding #1 — the previous
        # ``retry_if_exception_type(BaseException)`` matched
        # everything).
        retry=retry_if_exception(_is_retryable_http_error),
    )
    async def _export_text(self, file_id: str) -> str:
        """Export a Google Doc as text/plain. Returns the decoded
        body."""
        import anyio
        from googleapiclient.http import MediaIoBaseDownload

        service = self._get_service()

        def _call() -> str:
            request = service.files().export_media(fileId=file_id, mimeType="text/plain")
            buf = io.BytesIO()
            downloader = MediaIoBaseDownload(buf, request)
            done = False
            while not done:
                _status, done = downloader.next_chunk()
            return buf.getvalue().decode("utf-8", errors="replace")

        return await anyio.to_thread.run_sync(_call)

    @retry(
        reraise=True,
        stop=stop_after_attempt(4),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        # ``retry_if_exception`` (singular) takes a predicate so only
        # 5xx HttpError classes trigger a retry. A 4xx (401 auth,
        # 403 permission, 404 not found) propagates immediately;
        # retrying it would burn ~20 s of wall-clock per file before
        # surfacing the deterministic error to the operator
        # (Gitar PR-#21 Slice 2 finding #1 — the previous
        # ``retry_if_exception_type(BaseException)`` matched
        # everything).
        retry=retry_if_exception(_is_retryable_http_error),
    )
    async def _download_text(self, file_id: str) -> str:
        """Download a plain-text / markdown / csv file. Same shape as
        :meth:`_export_text` but uses ``get_media`` rather than
        ``export_media``."""
        import anyio
        from googleapiclient.http import MediaIoBaseDownload

        service = self._get_service()

        def _call() -> str:
            request = service.files().get_media(fileId=file_id)
            buf = io.BytesIO()
            downloader = MediaIoBaseDownload(buf, request)
            done = False
            while not done:
                _status, done = downloader.next_chunk()
            return buf.getvalue().decode("utf-8", errors="replace")

        return await anyio.to_thread.run_sync(_call)


# --- Module-level singleton (mirrors OpenAIProvider pattern) ---------


_GOOGLE_DRIVE: DriveSource | None = None


def get_drive_source() -> DriveSource:
    """Return the module-level :class:`GoogleDriveSource` singleton.

    Tests substitute the singleton via
    ``monkeypatch.setattr("app.domain.drive_source._GOOGLE_DRIVE",
    _FakeDrive(...))`` exactly as the AI provider seam works
    (``_ANTHROPIC`` / ``_OPENAI`` in :mod:`app.ai.provider`). Domain
    code calls this function rather than constructing a Drive client
    directly so the swap point stays at one symbol."""
    global _GOOGLE_DRIVE
    if _GOOGLE_DRIVE is None:
        _GOOGLE_DRIVE = GoogleDriveSource()
    return _GOOGLE_DRIVE
