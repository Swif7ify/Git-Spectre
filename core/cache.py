"""
core/cache.py
=============
In-memory TTL caching for GitHub API profiles and analysis results.
Prevents rate limit hammering and speeds up repetitive queries.
"""

from __future__ import annotations

import time
from typing import Any, Dict, Optional, Tuple

_CACHE: Dict[str, Tuple[float, Any]] = {}
CACHE_TTL = 300  # 5 minutes


def _cache_get(key: str) -> Optional[Any]:
    """Retrieve value from cache if entry is not expired."""
    entry = _CACHE.get(key)
    if entry and (time.time() - entry[0]) < CACHE_TTL:
        return entry[1]
    return None


def _cache_set(key: str, value: Any) -> None:
    """Store value in cache with current timestamp."""
    _CACHE[key] = (time.time(), value)


def _cache_clear() -> None:
    """Clear all cached entries (useful for testing or cache invalidation)."""
    _CACHE.clear()
