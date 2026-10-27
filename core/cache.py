"""
core/cache.py
=============
In-memory TTL caching for GitHub API profiles and analysis results.
Prevents rate limit hammering and speeds up repetitive queries.
"""

from __future__ import annotations

import time
from typing import Any, Dict, Optional, Tuple

_CACHE: Dict[str, Tuple[float, Any, Optional[float]]] = {}
CACHE_TTL = 300  # 5 minutes default


def _cache_get(key: str) -> Optional[Any]:
    """Retrieve value from cache if entry is not expired."""
    entry = _CACHE.get(key)
    if not entry:
        return None
    created_at = entry[0]
    value = entry[1]
    custom_ttl = entry[2] if len(entry) > 2 else None
    ttl = custom_ttl if custom_ttl is not None else CACHE_TTL
    if (time.time() - created_at) < ttl:
        return value
    return None


def _cache_set(key: str, value: Any, ttl: Optional[float] = None) -> None:
    """Store value in cache with current timestamp and optional custom TTL."""
    _CACHE[key] = (time.time(), value, ttl)


def _cache_delete(key: str) -> None:
    """Delete a single key from cache."""
    _CACHE.pop(key, None)


def _cache_delete_prefix(prefix: str) -> None:
    """Delete all keys starting with prefix from cache."""
    keys_to_delete = [k for k in list(_CACHE.keys()) if k.startswith(prefix)]
    for k in keys_to_delete:
        _CACHE.pop(k, None)


def _cache_clear() -> None:
    """Clear all cached entries (useful for testing or cache invalidation)."""
    _CACHE.clear()
