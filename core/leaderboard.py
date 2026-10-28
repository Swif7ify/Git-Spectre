"""
core/leaderboard.py
===================
Embedded SQLite storage, time-windowed popularity ranking (Daily, Monthly,
Yearly, All-Time), and multi-tier anti-spam/anti-script gatekeeping.
"""

from __future__ import annotations

import hashlib
import os
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from core.cache import _cache_delete_prefix, _cache_get, _cache_set
from core.config import BASE_DIR, logger

# Database path resolution (supports local dev & Vercel serverless /tmp)
def _get_db_path() -> Path:
    """Resolve database path with fallback to /tmp for read-only serverless environments."""
    if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        return Path("/tmp/spectre_leaderboard.db")

    data_dir = BASE_DIR / "data"
    try:
        data_dir.mkdir(parents=True, exist_ok=True)
        return data_dir / "leaderboard.db"
    except (OSError, PermissionError):
        return Path("/tmp/spectre_leaderboard.db")


def _get_connection() -> sqlite3.Connection:
    """Create a SQLite connection configured with WAL mode and row factory."""
    db_path = _get_db_path()
    conn = sqlite3.connect(str(db_path), timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_leaderboard_db() -> None:
    """Initialize SQLite tables and performance/anti-spam indexes."""
    with _get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS leaderboard_profiles (
                login TEXT PRIMARY KEY COLLATE NOCASE,
                name TEXT,
                avatar_url TEXT NOT NULL,
                dev_score INTEGER NOT NULL DEFAULT 0,
                score_tier TEXT NOT NULL DEFAULT 'B',
                archetype_title TEXT NOT NULL,
                archetype_badge TEXT NOT NULL,
                dev_level INTEGER NOT NULL DEFAULT 1,
                primary_language TEXT NOT NULL DEFAULT '',
                public_repos INTEGER NOT NULL DEFAULT 0,
                stars_earned INTEGER NOT NULL DEFAULT 0,
                followers INTEGER NOT NULL DEFAULT 0,
                first_checked_at REAL NOT NULL,
                last_checked_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS profile_checks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                login TEXT NOT NULL COLLATE NOCASE,
                ip_hash TEXT NOT NULL,
                checked_at REAL NOT NULL,
                date_utc TEXT NOT NULL,
                month_utc TEXT NOT NULL,
                year_utc TEXT NOT NULL
            );

            CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_daily_check 
            ON profile_checks(ip_hash, login, date_utc);

            CREATE INDEX IF NOT EXISTS idx_checks_date ON profile_checks(date_utc, login);
            CREATE INDEX IF NOT EXISTS idx_checks_month ON profile_checks(month_utc, login);
            CREATE INDEX IF NOT EXISTS idx_checks_year ON profile_checks(year_utc, login);
            CREATE INDEX IF NOT EXISTS idx_profile_score ON leaderboard_profiles(dev_score DESC);
            CREATE INDEX IF NOT EXISTS idx_profile_lang ON leaderboard_profiles(primary_language);
            """
        )
        conn.commit()


# Initialize schema on module import
try:
    init_leaderboard_db()
except Exception as e:
    logger.warning("Failed to initialize leaderboard database: %s", e)


# ------------------------------------------------------------
# Anti-Spam / Anti-Gaming Functions
# ------------------------------------------------------------

def _hash_client_ip(client_ip: str, date_str: str) -> str:
    """One-way salted SHA-256 hash of client IP for privacy-preserving rate enforcement."""
    salt = os.getenv("LEADERBOARD_SALT", "git-spectre-anti-gaming-salt-v3")
    raw = f"{salt}:{client_ip}:{date_str}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def is_profile_eligible(profile: Dict[str, Any], score: Dict[str, Any]) -> bool:
    """Verify that a profile meets minimum authentic developer criteria."""
    if not profile or not isinstance(profile, dict):
        return False
    login = (profile.get("login") or "").strip()
    if not login or profile.get("type") in ("Bot", "Organization") or login.lower().endswith("[bot]"):
        return False
    # Must have non-zero activity or presence
    total_score = score.get("total", 0) if isinstance(score, dict) else 0
    repos = profile.get("public_repos", 0) or 0
    followers = profile.get("followers", 0) or 0
    if total_score <= 0 and repos == 0 and followers == 0:
        return False
    return True


def record_profile_check(
    profile: Dict[str, Any],
    score: Dict[str, Any],
    client_ip: str,
    archetype: Optional[Dict[str, Any]] = None,
    dev_level: Optional[Dict[str, Any]] = None,
    languages: Optional[Dict[str, Any]] = None,
    stars_earned: int = 0,
) -> bool:
    """
    Record an analyzed profile in the leaderboard and enforce unique daily IP increment.
    Returns True if this was a new unique check for today, False if already checked today.
    """
    if not is_profile_eligible(profile, score):
        return False

    login = profile["login"].strip()
    name = (profile.get("name") or login)[:80]
    avatar_url = profile.get("avatar_url") or f"https://github.com/{login}.png"
    dev_score = int(score.get("total", 0)) if isinstance(score, dict) else 0
    score_tier = str(score.get("tier", "B")) if isinstance(score, dict) else "B"
    
    arch_title = archetype.get("title", "Developer") if isinstance(archetype, dict) else "Developer"
    arch_badge = archetype.get("badge", "") if isinstance(archetype, dict) else ""
    level_num = int(dev_level.get("level", 1)) if isinstance(dev_level, dict) else 1

    primary_lang = ""
    if isinstance(languages, dict) and languages:
        primary_lang = languages.get("dominant") or next(iter(languages.keys()), "")

    public_repos = int(profile.get("public_repos", 0) or 0)
    followers = int(profile.get("followers", 0) or 0)

    now = time.time()
    now_utc = datetime.now(timezone.utc)
    date_utc = now_utc.strftime("%Y-%m-%d")
    month_utc = now_utc.strftime("%Y-%m")
    year_utc = now_utc.strftime("%Y")

    ip_hash = _hash_client_ip(client_ip or "127.0.0.1", date_utc)

    try:
        with _get_connection() as conn:
            # 1. Upsert profile metadata
            conn.execute(
                """
                INSERT INTO leaderboard_profiles (
                    login, name, avatar_url, dev_score, score_tier,
                    archetype_title, archetype_badge, dev_level,
                    primary_language, public_repos, stars_earned, followers,
                    first_checked_at, last_checked_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(login) DO UPDATE SET
                    name = excluded.name,
                    avatar_url = excluded.avatar_url,
                    dev_score = excluded.dev_score,
                    score_tier = excluded.score_tier,
                    archetype_title = excluded.archetype_title,
                    archetype_badge = excluded.archetype_badge,
                    dev_level = excluded.dev_level,
                    primary_language = excluded.primary_language,
                    public_repos = excluded.public_repos,
                    stars_earned = excluded.stars_earned,
                    followers = excluded.followers,
                    last_checked_at = excluded.last_checked_at;
                """,
                (
                    login, name, avatar_url, dev_score, score_tier,
                    arch_title, arch_badge, level_num,
                    primary_lang, public_repos, stars_earned, followers,
                    now, now,
                ),
            )

            # 2. Attempt to insert unique daily check
            cur = conn.execute(
                """
                INSERT OR IGNORE INTO profile_checks (
                    login, ip_hash, checked_at, date_utc, month_utc, year_utc
                ) VALUES (?, ?, ?, ?, ?, ?);
                """,
                (login, ip_hash, now, date_utc, month_utc, year_utc),
            )
            conn.commit()
            if cur.rowcount > 0:
                _cache_delete_prefix("leaderboard:")
            return cur.rowcount > 0
    except Exception as e:
        logger.error("Failed to record profile check in leaderboard: %s", e)
        return False


# ------------------------------------------------------------
# Time-Windowed Query Functions
# ------------------------------------------------------------

_PERIOD_LABELS = {
    "daily": "Today",
    "monthly": "This Month",
    "yearly": "This Year",
    "all": "All-Time",
}


def get_leaderboard(
    period: str = "daily",
    limit: int = 50,
    language: Optional[str] = None,
    query: Optional[str] = None,
) -> Dict[str, Any]:
    """Retrieve ranked developers for a specific timeframe with optional filtering."""
    valid_period = period.lower() if period else "daily"
    if valid_period not in _PERIOD_LABELS:
        valid_period = "daily"

    safe_limit = max(1, min(int(limit), 100))
    clean_lang = (language or "").strip().lower()
    clean_q = (query or "").strip().lower()

    # Serve from in-memory cache if available to prevent query spam
    cache_key = f"leaderboard:{valid_period}:{safe_limit}:{clean_lang}:{clean_q}"
    cached_data = _cache_get(cache_key)
    if cached_data is not None:
        return cached_data

    now_utc = datetime.now(timezone.utc)
    date_utc = now_utc.strftime("%Y-%m-%d")
    month_utc = now_utc.strftime("%Y-%m")
    year_utc = now_utc.strftime("%Y")

    where_clauses: List[str] = []
    params: List[Any] = []

    # Filter by timeframe
    if valid_period == "daily":
        where_clauses.append("c.date_utc = ?")
        params.append(date_utc)
    elif valid_period == "monthly":
        where_clauses.append("c.month_utc = ?")
        params.append(month_utc)
    elif valid_period == "yearly":
        where_clauses.append("c.year_utc = ?")
        params.append(year_utc)

    # Optional language filter
    if language:
        where_clauses.append("LOWER(p.primary_language) = LOWER(?)")
        params.append(language.strip())

    # Optional search query filter
    if query:
        q_clean = f"%{query.strip().lower()}%"
        where_clauses.append("(LOWER(p.login) LIKE ? OR LOWER(p.name) LIKE ?)")
        params.extend([q_clean, q_clean])

    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    sql = f"""
        SELECT 
            p.login, p.name, p.avatar_url, p.dev_score, p.score_tier,
            p.archetype_title, p.archetype_badge, p.dev_level,
            p.primary_language, p.public_repos, p.stars_earned, p.followers,
            p.last_checked_at,
            COUNT(c.id) AS check_count
        FROM profile_checks c
        JOIN leaderboard_profiles p ON c.login = p.login
        {where_sql}
        GROUP BY c.login
        ORDER BY check_count DESC, p.dev_score DESC, p.stars_earned DESC
        LIMIT ?;
    """
    params.append(safe_limit)

    developers: List[Dict[str, Any]] = []
    try:
        with _get_connection() as conn:
            rows = conn.execute(sql, params).fetchall()
            for idx, row in enumerate(rows, start=1):
                developers.append(
                    {
                        "rank": idx,
                        "login": row["login"],
                        "name": row["name"],
                        "avatar_url": row["avatar_url"],
                        "dev_score": row["dev_score"],
                        "score_tier": row["score_tier"],
                        "dev_grade": row["score_tier"],
                        "archetype_title": row["archetype_title"],
                        "archetype_badge": row["archetype_badge"],
                        "archetype": row["archetype_title"],
                        "dev_level": row["dev_level"],
                        "primary_language": row["primary_language"],
                        "public_repos": row["public_repos"],
                        "stars_earned": row["stars_earned"],
                        "followers": row["followers"],
                        "last_checked_at": row["last_checked_at"],
                        "check_count": row["check_count"],
                    }
                )
    except Exception as e:
        logger.error("Error querying leaderboard: %s", e)

    return {
        "period": valid_period,
        "period_label": _PERIOD_LABELS[valid_period],
        "total": len(developers),
        "total_ranked": len(developers),
        "developers": developers,
        "leaderboard": developers,
    }
    _cache_set(cache_key, response, ttl=60.0)
    return response


def get_profile_rank(username: str) -> Dict[str, Any]:
    """Retrieve a developer's rank and check count across daily, monthly, yearly, and all-time."""
    clean_login = username.strip().lower()
    cache_key = f"leaderboard:rank:{clean_login}"
    cached_rank = _cache_get(cache_key)
    if cached_rank is not None:
        return cached_rank
    now_utc = datetime.now(timezone.utc)
    date_utc = now_utc.strftime("%Y-%m-%d")
    month_utc = now_utc.strftime("%Y-%m")
    year_utc = now_utc.strftime("%Y")

    timeframes = {
        "daily": ("c.date_utc = ?", [date_utc]),
        "monthly": ("c.month_utc = ?", [month_utc]),
        "yearly": ("c.year_utc = ?", [year_utc]),
        "all": ("", []),
    }

    result: Dict[str, Any] = {
        "login": clean_login,
        "username": clean_login,
        "eligible": True,
        "ranks": {},
    }

    try:
        with _get_connection() as conn:
            for period_key, (where_clause, params) in timeframes.items():
                where_sql = f"WHERE {where_clause}" if where_clause else ""
                sql = f"""
                    WITH ranked AS (
                        SELECT 
                            c.login,
                            COUNT(c.id) AS check_count,
                            ROW_NUMBER() OVER (
                                ORDER BY COUNT(c.id) DESC, p.dev_score DESC, p.stars_earned DESC
                            ) AS rank_num
                        FROM profile_checks c
                        JOIN leaderboard_profiles p ON c.login = p.login
                        {where_sql}
                        GROUP BY c.login
                    )
                    SELECT rank_num, check_count FROM ranked WHERE LOWER(login) = ?;
                """
                query_params = list(params) + [clean_login]
                row = conn.execute(sql, query_params).fetchone()
                if row:
                    result["ranks"][period_key] = {
                        "rank": row["rank_num"],
                        "check_count": row["check_count"],
                    }
                else:
                    result["ranks"][period_key] = {"rank": None, "check_count": 0}
    except Exception as e:
        logger.error("Error retrieving profile rank for '%s': %s", clean_login, e)

    # Attach convenient direct keys for daily, monthly, yearly, all_time
    result["daily"] = {
        "rank": result["ranks"].get("daily", {}).get("rank"),
        "checks": result["ranks"].get("daily", {}).get("check_count", 0),
    }
    result["monthly"] = {
        "rank": result["ranks"].get("monthly", {}).get("rank"),
        "checks": result["ranks"].get("monthly", {}).get("check_count", 0),
    }
    result["yearly"] = {
        "rank": result["ranks"].get("yearly", {}).get("rank"),
        "checks": result["ranks"].get("yearly", {}).get("check_count", 0),
    }
    result["all_time"] = {
        "rank": result["ranks"].get("all", {}).get("rank"),
        "checks": result["ranks"].get("all", {}).get("check_count", 0),
    }

    _cache_set(cache_key, result, ttl=60.0)
    return result


def get_leaderboard_languages() -> List[Dict[str, Any]]:
    """
    Retrieve distinct primary languages across all tracked developer profiles with counts.
    Cached in-memory to eliminate redundant database scans on high-traffic queries.
    """
    cache_key = "leaderboard:languages"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    sql = """
        SELECT primary_language, COUNT(*) AS count
        FROM leaderboard_profiles
        WHERE primary_language IS NOT NULL AND TRIM(primary_language) != ''
        GROUP BY primary_language
        ORDER BY count DESC, primary_language ASC;
    """
    languages: List[Dict[str, Any]] = []
    try:
        with _get_connection() as conn:
            rows = conn.execute(sql).fetchall()
            for row in rows:
                languages.append({
                    "language": row["primary_language"],
                    "count": int(row["count"]),
                })
        _cache_set(cache_key, languages)
    except Exception as e:
        logger.error("Failed to query leaderboard languages: %s", e)

    return languages


def get_cached_profile_record(username: str) -> Optional[Dict[str, Any]]:
    """Retrieve stored profile metadata from SQLite leaderboard as an offline fallback."""
    clean_login = username.strip().lower()
    try:
        with _get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM leaderboard_profiles WHERE LOWER(login) = ? LIMIT 1;",
                (clean_login,),
            ).fetchone()
            if row:
                return dict(row)
    except Exception as e:
        logger.warning("Failed to retrieve cached profile record for '%s': %s", clean_login, e)
    return None
