"""Web-search seam — Protocol + Tavily adapter (AC-D21 / SPEC §7).

The safety-link curation pipeline in :mod:`app.domain.safety_links`
consumes a ``WebSearchSource`` interface: ``search(query, ...)``
returns the top authoritative external references for a query. Two
implementations:

* :class:`TavilyWebSearch` — production: builds a Tavily client lazily
  on first call using ``app.config.Settings.web_search_api_key``;
  tenacity wraps every call with the same exponential-backoff policy
  used by the OpenAI provider. SPEC §7 defers the search provider to
  the operator; Tavily is the P11 default (LLM-friendly JSON, low-
  friction SDK).

* :class:`_FakeWebSearch` — the AC-CD15 test double, defined in
  :mod:`tests.integration.conftest`. Both impls share the same
  Protocol so the admin endpoint code path is identical for
  dev / test / prod (mirrors the AI provider + Drive source pattern
  established in PR-#20 / PR-#21).

The Protocol stays narrow on purpose: the rest of the pipeline
(httpx fetch, SHA-256 content_hash, audit-log writes) cares about
``url``, ``title``, ``snippet`` — Tavily-specific raw fields
(``score``, ``content``, etc.) stay inside the adapter.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Protocol, runtime_checkable

from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class WebSearchResult:
    """One row from a web search. Fields chosen to support both the
    "fresh curation at pill creation" use and the "monthly link-check
    replacement" use of AC-D21:

    * ``url`` — the cached link target; written verbatim to
      :class:`~app.models.PillSafetyLink.url`.
    * ``title`` — page title; written to ``PillSafetyLink.title``.
    * ``snippet`` — short text excerpt; used only for the audit-log
      detail on curation (so an admin can verify the chosen link
      without opening the URL).
    * ``source`` — host or provider tag (e.g. ``"nace.org"``,
      ``"osha.gov"``); written to ``PillSafetyLink.source`` so the
      admin queue can sort/filter by authority.
    """

    url: str
    title: str
    snippet: str
    source: str


@runtime_checkable
class WebSearchSource(Protocol):
    """Single-call seam the curation + check sweeps compose against.
    Async so the production adapter can do non-blocking I/O against
    Tavily's threadpool-wrapped SDK; the test fake is trivially async
    by signature only."""

    async def search(
        self, query: str, *, max_results: int = 5
    ) -> list[WebSearchResult]: ...


# --- Tavily adapter ---------------------------------------------------


class TavilyWebSearch:
    """Production :class:`WebSearchSource` adapter using
    ``tavily-python``. Tavily returns LLM-friendly JSON with a
    ``results`` list; each result carries ``url``, ``title``,
    ``content`` (snippet). The adapter maps those onto
    :class:`WebSearchResult` and derives ``source`` from the URL's
    host.

    Lazy-built mirrors the :class:`~app.ai.openai.OpenAIProvider` +
    :class:`~app.domain.drive_source.GoogleDriveSource` patterns: app
    import must not crash when ``web_search_api_key`` is unset, so the
    Tavily client object is built on first call only. The retry
    policy wraps :exc:`Exception` because Tavily's SDK surfaces a
    generic exception class for both HTTP and quota errors — tenacity
    backs off all of them. Non-retryable misconfiguration
    (missing API key) raises :exc:`RuntimeError` from
    :meth:`_get_client` BEFORE the retry policy engages.
    """

    name = "tavily"

    def __init__(self) -> None:
        self._client: Any | None = None

    def _get_client(self) -> Any:
        """Lazy build the Tavily client from
        ``Settings.web_search_api_key``. Cached for the life of the
        provider instance — the singleton in this module keeps one
        client per process."""
        if self._client is not None:
            return self._client
        from tavily import TavilyClient

        from app.config import get_settings

        settings = get_settings()
        if not settings.web_search_api_key:
            raise RuntimeError(
                "TavilyWebSearch requires `web_search_api_key` to be set "
                "in the environment. Set it before calling search(), or "
                "use the _FakeWebSearch seam in tests (AC-CD15)."
            )
        self._client = TavilyClient(api_key=settings.web_search_api_key)
        return self._client

    @retry(
        reraise=True,
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type(Exception),
    )
    async def search(self, query: str, *, max_results: int = 5) -> list[WebSearchResult]:
        """Return up to ``max_results`` authoritative web references
        for ``query``. Used both for the initial AC-D21 curation at
        pill-create time and for the monthly link-check replacement
        path. Empty list on a query that returns nothing — the
        curation callable then audit-logs ``safety_links.no_results_found``.

        The Tavily SDK is sync-only; we run it on the default thread
        pool via :func:`anyio.to_thread.run_sync` so this async
        callable does not block the event loop."""
        import anyio

        client = self._get_client()

        def _call() -> dict[str, Any]:
            return client.search(query=query, max_results=max_results)

        response = await anyio.to_thread.run_sync(_call)
        results: list[WebSearchResult] = []
        for item in response.get("results") or []:
            url = str(item.get("url", "")).strip()
            if not url:
                continue
            results.append(
                WebSearchResult(
                    url=url,
                    title=str(item.get("title", "")).strip() or url,
                    snippet=str(item.get("content", "")).strip(),
                    source=_host_of(url),
                )
            )
        return results


def _host_of(url: str) -> str:
    """Extract the host (e.g. ``"osha.gov"``) from a URL for the
    ``source`` field. Falls back to the raw URL on a parse failure so
    the field is always non-empty."""
    from urllib.parse import urlparse

    try:
        host = urlparse(url).hostname
        return host or url
    except (ValueError, TypeError):
        return url


# --- Module-level singleton (mirrors OpenAIProvider / DriveSource) ---


_TAVILY: WebSearchSource | None = None


def get_web_search_source() -> WebSearchSource:
    """Return the module-level :class:`TavilyWebSearch` singleton.

    Tests substitute the singleton via
    ``monkeypatch.setattr("app.domain.web_search._TAVILY",
    _FakeWebSearch(...))`` exactly as the Drive source seam works
    (``_GOOGLE_DRIVE`` in :mod:`app.domain.drive_source`). Domain
    code calls this function rather than constructing a Tavily client
    directly so the swap point stays at one symbol."""
    global _TAVILY
    if _TAVILY is None:
        _TAVILY = TavilyWebSearch()
    return _TAVILY
