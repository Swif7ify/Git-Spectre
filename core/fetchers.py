"""
core/fetchers.py
================
Asynchronous GitHub API scrapers and network fetchers with exponential retry logic.
"""

from __future__ import annotations

import asyncio
import base64 as _b64
import re as _re
from typing import Any, Dict, List, Optional

import httpx
from fastapi import HTTPException

from core.config import BACKOFF, GITHUB_API, MAX_RETRIES, logger


def _build_headers(token: Optional[str]) -> Dict[str, str]:
    """Build standard GitHub REST headers with optional bearer authentication."""
    h = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "Git-Spectre/2.0",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


_RETRYABLE = (
    httpx.ReadError,
    httpx.ConnectError,
    httpx.RemoteProtocolError,
    httpx.TimeoutException,
)


async def _get_with_retry(
    client: httpx.AsyncClient,
    url: str,
    **kwargs: Any,
) -> httpx.Response:
    """GET with exponential back-off retry on transient network errors."""
    delay = BACKOFF
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return await client.get(url, **kwargs)
        except _RETRYABLE as exc:
            if attempt == MAX_RETRIES:
                logger.error("All retries exhausted for %s: %s", url, exc)
                raise HTTPException(
                    502,
                    f"Network error after {MAX_RETRIES} attempts ({type(exc).__name__}). Please retry.",
                ) from exc
            logger.warning(
                "Attempt %d/%d failed for %s: %s. Retrying…", attempt, MAX_RETRIES, url, exc
            )
            await asyncio.sleep(delay)
            delay *= 2


async def _fetch_profile(client: httpx.AsyncClient, username: str, headers: Dict) -> Dict:
    """Fetch GitHub user profile information."""
    resp = await _get_with_retry(client, f"{GITHUB_API}/users/{username}", headers=headers)
    if resp.status_code == 404:
        raise HTTPException(404, f"GitHub user '{username}' not found.")
    if resp.status_code == 403:
        raise HTTPException(403, "GitHub API rate limit exceeded. Add a token via the API Vault.")
    resp.raise_for_status()
    return resp.json()


async def _fetch_repos(client: httpx.AsyncClient, username: str, headers: Dict) -> List[Dict]:
    """Fetch up to 300 repos across 3 pages concurrently."""
    async def _page(page: int) -> List[Dict]:
        resp = await _get_with_retry(
            client,
            f"{GITHUB_API}/users/{username}/repos",
            headers=headers,
            params={"per_page": 100, "page": page, "sort": "updated"},
        )
        if resp.status_code in (403, 404):
            return []
        resp.raise_for_status()
        return resp.json()

    pages = await asyncio.gather(_page(1), _page(2), _page(3))
    repos: List[Dict] = []
    for page in pages:
        if not page:
            break
        repos.extend(page)
        if len(page) < 100:
            break
    return repos


async def _fetch_events(client: httpx.AsyncClient, username: str, headers: Dict) -> List[Dict]:
    """Fetch up to 1000 public events (10 pages × 100) — GitHub's hard ceiling.
    This maximises full-year heatmap coverage for all activity levels."""
    async def _page(p: int) -> List[Dict]:
        resp = await _get_with_retry(
            client,
            f"{GITHUB_API}/users/{username}/events/public",
            headers=headers,
            params={"per_page": 100, "page": p},
        )
        if resp.status_code in (403, 404, 422):
            return []
        resp.raise_for_status()
        return resp.json()

    # Fire all 10 pages concurrently; GitHub returns [] for pages beyond history
    pages = await asyncio.gather(*[_page(p) for p in range(1, 11)])
    events: List[Dict] = []
    for page in pages:
        events.extend(page)
    return events


async def _fetch_orgs(client: httpx.AsyncClient, username: str, headers: Dict) -> List[Dict]:
    """Fetch user organizations membership."""
    resp = await _get_with_retry(
        client,
        f"{GITHUB_API}/users/{username}/orgs",
        headers=headers,
        params={"per_page": 10},
    )
    if resp.status_code in (403, 404):
        return []
    resp.raise_for_status()
    return resp.json()


async def _fetch_gists(client: httpx.AsyncClient, username: str, headers: Dict) -> List[Dict]:
    """Fetch user public gists."""
    resp = await _get_with_retry(
        client,
        f"{GITHUB_API}/users/{username}/gists",
        headers=headers,
        params={"per_page": 30},
    )
    if resp.status_code in (403, 404):
        return []
    resp.raise_for_status()
    return resp.json()


async def _fetch_followers(client: httpx.AsyncClient, username: str, headers: Dict) -> List[Dict]:
    """Fetch first 10 followers (login + avatar)."""
    resp = await _get_with_retry(
        client,
        f"{GITHUB_API}/users/{username}/followers",
        headers=headers,
        params={"per_page": 10},
    )
    if resp.status_code in (403, 404):
        return []
    resp.raise_for_status()
    return resp.json()


async def _fetch_following(client: httpx.AsyncClient, username: str, headers: Dict) -> List[Dict]:
    """Fetch first 10 following (login + avatar)."""
    resp = await _get_with_retry(
        client,
        f"{GITHUB_API}/users/{username}/following",
        headers=headers,
        params={"per_page": 10},
    )
    if resp.status_code in (403, 404):
        return []
    resp.raise_for_status()
    return resp.json()


async def _fetch_starred_repos(client: httpx.AsyncClient, username: str, headers: Dict) -> List[Dict]:
    """Fetch up to 30 repos the user has starred on GitHub."""
    resp = await _get_with_retry(
        client,
        f"{GITHUB_API}/users/{username}/starred",
        headers=headers,
        params={"per_page": 30, "sort": "created", "direction": "desc"},
    )
    if resp.status_code in (403, 404):
        return []
    resp.raise_for_status()
    return resp.json()


async def _fetch_contribution_calendar(
    client: httpx.AsyncClient, username: str
) -> Dict[str, int]:
    """
    Scrape GitHub's public contribution calendar SVG.
    URL: https://github.com/users/{username}/contributions
    Returns {date_str: approx_count} derived from contribution level (0-4).
    Level → approximate commit count mapping: 1→1, 2→3, 3→6, 4→12.
    Covers the full visible year with no authentication required.
    """
    LEVEL_COUNT = {0: 0, 1: 1, 2: 3, 3: 6, 4: 12}
    try:
        resp = await client.get(
            f"https://github.com/users/{username}/contributions",
            headers={
                "Accept": "text/html,application/xhtml+xml",
                "User-Agent": "Mozilla/5.0 (compatible; Git-Spectre/2.2)",
            },
            follow_redirects=True,
            timeout=httpx.Timeout(15.0),
        )
        if resp.status_code != 200:
            return {}
        html = resp.text
        counts: Dict[str, int] = {}
        # GitHub renders cells like:
        #   data-date="2026-09-19" ... data-level="2"
        # Attribute order may vary; try both orderings.
        for m in _re.finditer(
            r'data-date="(\d{4}-\d{2}-\d{2})"[^>]*data-level="(\d)"', html
        ):
            lvl = int(m.group(2))
            if lvl > 0:
                counts[m.group(1)] = LEVEL_COUNT.get(lvl, lvl)
        if not counts:
            for m in _re.finditer(
                r'data-level="(\d)"[^>]*data-date="(\d{4}-\d{2}-\d{2})"', html
            ):
                lvl = int(m.group(1))
                if lvl > 0:
                    counts[m.group(2)] = LEVEL_COUNT.get(lvl, lvl)
        return counts
    except Exception as exc:
        logger.warning("Contribution calendar scrape failed for '%s': %s", username, exc)
        return {}


async def _fetch_readme_for_quality(username: str, headers: Dict) -> Dict[str, Any]:
    """Lightweight README fetch for quality scoring — reuses the readme endpoint logic."""
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
        resp = await client.get(
            f"{GITHUB_API}/repos/{username}/{username}/readme",
            headers=headers,
        )
        if resp.status_code in (404, 403, 422):
            return {"found": False, "content": "", "html_url": ""}
        try:
            resp.raise_for_status()
        except Exception:
            return {"found": False, "content": "", "html_url": ""}
        data = resp.json()
        try:
            content = _b64.b64decode(data.get("content", "")).decode("utf-8", errors="replace")
        except Exception:
            content = ""
        return {"found": bool(content.strip()), "content": content, "html_url": data.get("html_url", "")}
