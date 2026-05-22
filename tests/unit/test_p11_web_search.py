"""P11 Slice 3 — :mod:`app.domain.web_search` unit tests (AC-D21).

Covers the Tavily adapter's lazy-build + retry-predicate contracts.
The retry predicate must explicitly exclude :exc:`RuntimeError` so a
missing-API-key misconfiguration fail-fasts on the first call (Gitar
PR-#24 Slice 3 finding #2): tenacity would otherwise burn ~3 s of
exponential backoff before surfacing the deterministic error.

Zero-network (AC-CD15): the test does not touch Tavily; the missing-
key branch fires inside ``_get_client`` before any network.
"""

from __future__ import annotations

import time
from typing import Any

import pytest

from app.domain.web_search import TavilyWebSearch


@pytest.mark.asyncio
async def test_tavily_missing_api_key_fails_fast_without_retry(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """``TavilyWebSearch.search`` against an unset API key raises
    ``RuntimeError`` on the FIRST call — tenacity's retry predicate
    excludes ``RuntimeError`` so the misconfiguration surfaces
    immediately. Wall-clock budget: well under the 1-s minimum a
    single retry-with-backoff would cost (Gitar PR-#24 Slice 3
    finding #2 regression)."""
    # Clear the lru_cache so the test's empty-env Settings binding
    # takes effect inside _get_client.
    from app.config import get_settings

    monkeypatch.setenv("WEB_SEARCH_API_KEY", "")
    get_settings.cache_clear()  # type: ignore[attr-defined]

    adapter = TavilyWebSearch()
    started = time.monotonic()
    with pytest.raises(RuntimeError) as exc:
        await adapter.search("any query")
    elapsed = time.monotonic() - started

    assert "web_search_api_key" in str(exc.value)
    # If tenacity were retrying, elapsed would be > 1 s (the
    # wait_exponential min). Fast-fail keeps it well under 0.5 s
    # even on a slow CI runner.
    assert elapsed < 0.5, (
        f"missing-key path should fail fast; took {elapsed:.3f}s "
        f"(retry predicate likely re-broken)"
    )


def test_host_of_extracts_clean_host() -> None:
    """``_host_of`` returns the URL host so :class:`WebSearchResult`'s
    ``source`` field is admin-readable (``osha.gov`` rather than the
    full URL)."""
    from app.domain.web_search import _host_of

    assert _host_of("https://www.osha.gov/lift") == "www.osha.gov"
    assert _host_of("https://nace.org/page?x=1") == "nace.org"


def test_host_of_falls_back_to_url_on_parse_failure() -> None:
    """An unparseable string returns the input unchanged so the
    ``source`` field is never empty. Defensive against malformed
    Tavily responses."""
    from app.domain.web_search import _host_of

    # urlparse never raises in practice — even on garbage. The
    # function still has to handle the "no hostname" path (e.g. a
    # path-only string).
    result = _host_of("not-a-url")
    assert result == "not-a-url"


def test_get_web_search_source_caches_singleton(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """``get_web_search_source`` returns the same instance across
    calls — mirrors the OpenAIProvider / DriveSource pattern so a
    single client is shared per process."""
    from app.domain import web_search

    # Reset the singleton; the prior test may have populated it.
    monkeypatch.setattr(web_search, "_TAVILY", None)

    a = web_search.get_web_search_source()
    b = web_search.get_web_search_source()
    assert a is b


def test_tavily_search_returns_empty_list_on_empty_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """``search`` returns ``[]`` cleanly when Tavily returns no
    results. The curation pipeline relies on this contract to write
    the ``safety_links.no_results_found`` audit row instead of
    crashing."""

    class _FakeTavilyClient:
        def search(self, *, query: str, max_results: int) -> dict[str, Any]:
            return {"results": []}

    adapter = TavilyWebSearch()
    adapter._client = _FakeTavilyClient()

    import asyncio

    results = asyncio.run(adapter.search("anything"))
    assert results == []


def test_tavily_search_filters_results_with_no_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A Tavily result with an empty ``url`` is dropped silently.
    The curation pipeline never sees a URL-less :class:`WebSearchResult`."""

    class _FakeTavilyClient:
        def search(self, *, query: str, max_results: int) -> dict[str, Any]:
            return {
                "results": [
                    {"url": "", "title": "no url", "content": "x"},
                    {
                        "url": "https://valid.example/ok",
                        "title": "ok",
                        "content": "y",
                    },
                ]
            }

    adapter = TavilyWebSearch()
    adapter._client = _FakeTavilyClient()

    import asyncio

    results = asyncio.run(adapter.search("anything"))
    assert len(results) == 1
    assert results[0].url == "https://valid.example/ok"
    assert results[0].source == "valid.example"
