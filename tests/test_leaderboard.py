"""
tests/test_leaderboard.py
=========================
Comprehensive unit and integration tests for Git-Spectre Global Leaderboard:
- SQLite dual-table initialization and indexing
- Salted IP anti-spam hashing
- Repeat check suppression per IP per UTC calendar day
- Multi-window aggregation (Daily, Monthly, Yearly, All-Time)
- FastAPI /api/leaderboard and /api/leaderboard/rank/{username} routes
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from fastapi.testclient import TestClient

from core.leaderboard import (
    _get_connection,
    _hash_client_ip,
    get_leaderboard,
    get_leaderboard_languages,
    get_profile_rank,
    init_leaderboard_db,
    is_profile_eligible,
    record_profile_check,
)
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def isolated_db(tmp_path, monkeypatch):
    """Use an isolated SQLite test database for each test function."""
    test_db = tmp_path / "test_spectre_leaderboard.db"
    monkeypatch.setattr("core.leaderboard._get_db_path", lambda: test_db)
    init_leaderboard_db()
    yield test_db


def _make_dummy_dossier(login="octocat", score=750, stars=120, lang="Python"):
    return {
        "profile": {
            "login": login,
            "name": f"User {login}",
            "avatar_url": f"https://avatars.githubusercontent.com/{login}",
            "public_repos": 15,
            "followers": 80,
            "html_url": f"https://github.com/{login}",
        },
        "score": {"total": score, "tier": "A"},
        "archetype": {"title": "Code Architect", "badge": ""},
        "dev_level": {"level": 12},
        "languages": {"dominant": lang, lang: 50000},
        "stars_earned": stars,
    }


def _record(dossier, client_ip="127.0.0.1"):
    return record_profile_check(
        profile=dossier["profile"],
        score=dossier["score"],
        client_ip=client_ip,
        archetype=dossier.get("archetype"),
        dev_level=dossier.get("dev_level"),
        languages=dossier.get("languages"),
        stars_earned=dossier.get("stars_earned", 0),
    )


class TestLeaderboardInitialization:
    def test_database_tables_and_indexes(self):
        """Verify schema and indexes exist."""
        with _get_connection() as conn:
            tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
            assert "leaderboard_profiles" in tables
            assert "profile_checks" in tables

            indexes = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='index'").fetchall()]
            assert "idx_unique_daily_check" in indexes
            assert "idx_checks_date" in indexes


class TestAntiSpamAndCheckRecording:
    def test_salted_ip_hashing_consistency(self):
        """IP hashes must be deterministic within the same day but opaque."""
        date_today = "2026-10-26"
        h1 = _hash_client_ip("192.168.1.100", date_today)
        h2 = _hash_client_ip("192.168.1.100", date_today)
        h3 = _hash_client_ip("192.168.1.101", date_today)

        assert h1 == h2
        assert h1 != h3
        assert len(h1) == 64  # SHA-256 hex digest
        assert "192.168.1.100" not in h1

    def test_first_check_increments_count(self):
        """First check from an IP increments check count and records profile."""
        dossier = _make_dummy_dossier("torvalds", score=980, stars=50000, lang="C")
        new_check = _record(dossier, client_ip="203.0.113.1")
        assert new_check is True

        rank = get_profile_rank("torvalds")
        assert rank["eligible"] is True
        assert rank["daily"]["checks"] == 1

    def test_repeat_check_same_day_same_ip_suppressed(self):
        """Repeated automated scans from same IP on same day must NOT increment check count."""
        dossier = _make_dummy_dossier("torvalds", score=980, stars=50000, lang="C")

        # First check
        r1 = _record(dossier, client_ip="203.0.113.1")
        assert r1 is True
        assert get_profile_rank("torvalds")["daily"]["checks"] == 1

        # Second check from same IP (anti-spam defense)
        r2 = _record(dossier, client_ip="203.0.113.1")
        assert r2 is False
        assert get_profile_rank("torvalds")["daily"]["checks"] == 1  # Still 1!

        # Third check from different IP
        r3 = _record(dossier, client_ip="198.51.100.99")
        assert r3 is True
        assert get_profile_rank("torvalds")["daily"]["checks"] == 2  # Incremented to 2!

    def test_ineligible_profile_rejected(self):
        """Ineligible profile (e.g., bot, org, empty) should not be recorded."""
        assert is_profile_eligible({}, {}) is False
        assert is_profile_eligible({"type": "Organization", "login": "my-org"}, {"total": 500}) is False
        assert is_profile_eligible({"login": "dependabot[bot]"}, {"total": 500}) is False

        bad_profile = {"login": "ci-bot", "type": "Bot"}
        res = record_profile_check(
            profile=bad_profile,
            score={"total": 400},
            client_ip="127.0.0.1",
        )
        assert res is False


class TestLeaderboardQueries:
    def test_multi_window_leaderboard_ordering(self):
        """Developers must be sorted by check_count DESC, then dev_score DESC."""
        dev_a = _make_dummy_dossier("dev-a", score=500, stars=10, lang="Rust")
        dev_b = _make_dummy_dossier("dev-b", score=800, stars=50, lang="TypeScript")

        # dev-a gets 3 checks from 3 IPs
        _record(dev_a, client_ip="1.1.1.1")
        _record(dev_a, client_ip="1.1.1.2")
        _record(dev_a, client_ip="1.1.1.3")

        # dev-b gets 1 check
        _record(dev_b, client_ip="1.1.1.4")

        # In daily period, dev-a should be #1 (3 checks), dev-b should be #2 (1 check)
        lb_daily = get_leaderboard(period="daily")
        assert lb_daily["total"] == 2
        items = lb_daily["leaderboard"]
        assert items[0]["login"] == "dev-a"
        assert items[0]["check_count"] == 3
        assert items[0]["rank"] == 1
        assert items[1]["login"] == "dev-b"
        assert items[1]["check_count"] == 1
        assert items[1]["rank"] == 2

    def test_filter_by_language_and_search(self):
        """Language and query filters work correctly."""
        dev_py = _make_dummy_dossier("py-coder", score=700, lang="Python")
        dev_rs = _make_dummy_dossier("rust-ace", score=850, lang="Rust")

        _record(dev_py, client_ip="2.2.2.1")
        _record(dev_rs, client_ip="2.2.2.2")

        # Filter by language
        py_only = get_leaderboard(period="daily", language="Python")
        assert len(py_only["leaderboard"]) == 1
        assert py_only["leaderboard"][0]["login"] == "py-coder"

        # Search query
        rust_search = get_leaderboard(period="daily", query="rust")
        assert len(rust_search["leaderboard"]) == 1
        assert rust_search["leaderboard"][0]["login"] == "rust-ace"

    def test_get_profile_rank(self):
        """Profile rank returns ranking across periods."""
        dev = _make_dummy_dossier("torvalds", score=990, lang="C")
        _record(dev, client_ip="3.3.3.1")

        rank_data = get_profile_rank("torvalds")
        assert rank_data["username"] == "torvalds"
        assert rank_data["eligible"] is True
        assert rank_data["daily"]["rank"] == 1
        assert rank_data["daily"]["checks"] == 1
        assert rank_data["monthly"]["rank"] == 1
        assert rank_data["yearly"]["rank"] == 1
        assert rank_data["all_time"]["rank"] == 1


class TestLeaderboardApiRoutes:
    def test_api_get_leaderboard_success(self):
        dev = _make_dummy_dossier("linus", score=900, lang="C")
        _record(dev, client_ip="4.4.4.1")

        resp = client.get("/api/leaderboard?period=daily&limit=20")
        assert resp.status_code == 200
        data = resp.json()
        assert data["period"] == "daily"
        assert len(data["leaderboard"]) >= 1
        assert data["leaderboard"][0]["login"] == "linus"

    def test_api_get_leaderboard_invalid_period(self):
        resp = client.get("/api/leaderboard?period=century")
        assert resp.status_code == 400
        assert "Invalid period" in resp.json()["detail"]

    def test_api_get_profile_rank(self):
        dev = _make_dummy_dossier("guido", score=920, lang="Python")
        _record(dev, client_ip="5.5.5.1")

        resp = client.get("/api/leaderboard/rank/guido")
        assert resp.status_code == 200
        data = resp.json()
        assert data["username"] == "guido"
        assert data["daily"]["checks"] == 1

    def test_api_get_leaderboard_languages(self):
        dev1 = _make_dummy_dossier("rustacean", score=880, lang="Rust")
        dev2 = _make_dummy_dossier("gopher", score=850, lang="Go")
        _record(dev1, client_ip="6.6.6.1")
        _record(dev2, client_ip="6.6.6.2")

        resp = client.get("/api/leaderboard/languages")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 2
        assert "Rust" in data["languages"]
        assert "Go" in data["languages"]
        assert any(d["language"] == "Rust" and d["count"] >= 1 for d in data["details"])
