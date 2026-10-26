"""
core/gamification.py
====================
Gamification layer: XP developer ranking, unlockable achievement badges,
GitHub Wrapped annual summary, profile README scoring, and social graphs.
"""

from __future__ import annotations

import calendar as _cal
import re
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List

from core.analytics import _account_age_years, _account_year


def _compute_achievements(
    langs: Dict,
    repos: List[Dict],
    profile: Dict,
    events: List[Dict],
    streaks: Dict,
    gists: Dict,
) -> List[Dict[str, Any]]:
    """Unlock achievement badges based on developer data."""
    own = [r for r in repos if not r.get("fork")]
    stars = sum(r.get("stargazers_count", 0) for r in own)
    followers = profile.get("followers", 0)
    longest = streaks.get("longest", 0)
    num_langs = len(langs)
    forks_cnt = len([r for r in repos if r.get("fork")])

    night_pushes = 0
    for e in events:
        if e.get("type") == "PushEvent":
            ts = e.get("created_at", "")
            try:
                hour = datetime.fromisoformat(ts.replace("Z", "+00:00")).hour
                if hour >= 22 or hour <= 4:
                    night_pushes += 1
            except Exception:
                pass

    login = profile.get("login", "").lower()
    ext_repos = {
        e.get("repo", {}).get("name", "")
        for e in events
        if e.get("type") == "PushEvent"
        and not e.get("repo", {}).get("name", "").lower().startswith(f"{login}/")
        and e.get("repo", {}).get("name")
    }

    def badge(key, icon, label, desc, unlocked, rarity="common"):
        return {
            "key": key,
            "icon": icon,
            "label": label,
            "desc": desc,
            "unlocked": unlocked,
            "rarity": rarity,
        }

    return [
        badge(
            "night_owl",
            "🦉",
            "Night Owl",
            "Made 5+ pushes between 22:00–04:00 UTC",
            night_pushes >= 5,
            "rare",
        ),
        badge(
            "streak_king",
            "🔥",
            "Streak King",
            "Maintained a 7+ day commit streak",
            longest >= 7,
            "epic",
        ),
        badge(
            "polyglot",
            "🌐",
            "Polyglot",
            "Used 5+ programming languages",
            num_langs >= 5,
            "rare",
        ),
        badge(
            "open_source",
            "🌍",
            "Open Source Hero",
            "Earned 10+ stars on own projects",
            stars >= 10,
            "epic",
        ),
        badge(
            "community",
            "🤝",
            "Community Builder",
            "Has 50+ followers on GitHub",
            followers >= 50,
            "rare",
        ),
        badge(
            "star_collector",
            "⭐",
            "Star Collector",
            "Earned 100+ total stars",
            stars >= 100,
            "epic",
        ),
        badge(
            "fork_collector",
            "🍴",
            "Fork Collector",
            "Has 10+ forked repos in collection",
            forks_cnt >= 10,
            "common",
        ),
        badge(
            "gist_wizard",
            "🧙",
            "Gist Wizard",
            "Published 5+ public gists",
            gists.get("total", 0) >= 5,
            "common",
        ),
        badge(
            "contributor",
            "🔀",
            "External Contributor",
            "Pushed code to 3+ external repos",
            len(ext_repos) >= 3,
            "rare",
        ),
        badge(
            "veteran",
            "📅",
            "GitHub Veteran",
            "Account is 3+ years old",
            _account_age_years(profile) >= 3,
            "epic",
        ),
        badge(
            "prolific",
            "📦",
            "Prolific Creator",
            "Created 20+ original repositories",
            len(own) >= 20,
            "rare",
        ),
        badge(
            "legend",
            "🏆",
            "Legend",
            "Earned 1000+ total stars",
            stars >= 1000,
            "legendary",
        ),
        badge(
            "centurion",
            "💯",
            "Centurion",
            "Has 100+ followers",
            followers >= 100,
            "epic",
        ),
        badge(
            "early_bird",
            "🌅",
            "Early Adopter",
            "Joined GitHub in 2015 or earlier",
            _account_year(profile) <= 2015,
            "legendary",
        ),
        badge(
            "marathon",
            "⚡",
            "Marathon Runner",
            "30+ day longest commit streak",
            longest >= 30,
            "legendary",
        ),
    ]


def _compute_dev_level(score_total: int) -> Dict[str, Any]:
    """XP-based developer level derived from 0–1000 Dev Score."""
    levels = [
        (0, "Intern", "#6b7280", "Just getting started on the journey."),
        (150, "Junior", "#3b82f6", "Foundations solid. Growing fast."),
        (300, "Mid", "#10b981", "Capable and reliable. Getting things done."),
        (450, "Senior", "#f59e0b", "Experienced, architectural thinker."),
        (600, "Staff", "#f97316", "Multiplies team output. Deep expertise."),
        (750, "Principal", "#a855f7", "Sets technical direction. Industry-level impact."),
        (900, "Legend", "#ef4444", "Top 1%. Mythical output. The stuff of changelog lore."),
    ]
    current_level = levels[0]
    next_level = levels[1]
    for i, lvl in enumerate(levels):
        if score_total >= lvl[0]:
            current_level = lvl
            next_level = levels[i + 1] if i + 1 < len(levels) else None
        else:
            break

    xp_current = current_level[0]
    xp_next = next_level[0] if next_level else 1000
    xp_in_level = score_total - xp_current
    xp_needed = xp_next - xp_current
    pct = int(min(xp_in_level / xp_needed * 100, 100)) if xp_needed > 0 else 100

    return {
        "rank": current_level[1],
        "color": current_level[2],
        "description": current_level[3],
        "xp": score_total,
        "xp_current": xp_current,
        "xp_next": xp_next,
        "xp_pct": pct,
        "next_rank": next_level[1] if next_level else None,
    }


def _compute_readme_quality(readme: Dict[str, Any]) -> Dict[str, Any]:
    """Score the user's profile README 0–100 across 6 signals."""
    if not readme.get("found") or not readme.get("content"):
        return {"found": False, "score": 0, "signals": {}}

    content: str = readme["content"]
    lower = content.lower()
    length = len(content)

    signals: Dict[str, bool] = {
        "has_badges": bool(
            re.search(r"!\[.*?\]\(https?://.*?(badge|shield|img\.shields).*?\)", lower)
        ),
        "has_gif_or_img": bool(
            re.search(r"!\[.*?\]\(https?://.*?\.(gif|png|jpg|svg|webp)", lower)
        ),
        "has_links": bool(re.search(r"\[.+?\]\(https?://", content)),
        "is_long": length >= 300,
        "has_headers": bool(re.search(r"^#{1,3} ", content, re.MULTILINE)),
        "has_code_block": bool(re.search(r"```|`[^`]+`", content)),
    }

    weights = {
        "has_badges": 18,
        "has_gif_or_img": 18,
        "has_links": 16,
        "is_long": 18,
        "has_headers": 16,
        "has_code_block": 14,
    }
    score = int(sum(weights[k] for k, v in signals.items() if v))
    return {
        "found": True,
        "score": score,
        "signals": signals,
        "html_url": readme.get("html_url", ""),
    }


def _compute_wrapped(
    repos: List[Dict],
    events: List[Dict],
    profile: Dict,
    streaks: Dict,
    langs: Dict,
    heatmap: Dict,
) -> Dict[str, Any]:
    """GitHub Wrapped: year-in-review highlights derived from existing data."""
    now = datetime.now(timezone.utc)
    current_year = str(now.year)

    # Total commits this year (from heatmap keys)
    year_commits = sum(v for k, v in heatmap.items() if k.startswith(current_year))

    # Best day (most commits)
    best_day = max(heatmap.items(), key=lambda kv: kv[1]) if heatmap else ("—", 0)

    # Best month by commit count
    month_counts: Dict[str, int] = defaultdict(int)
    for ds, cnt in heatmap.items():
        if ds.startswith(current_year):
            month_counts[ds[:7]] += cnt
    best_month_key = max(month_counts, key=month_counts.get) if month_counts else None
    if best_month_key:
        mo = int(best_month_key.split("-")[1])
        best_month = f"{_cal.month_abbr[mo]} {current_year}"
        best_month_commits = month_counts[best_month_key]
    else:
        best_month, best_month_commits = "—", 0

    # Top language
    top_language = list(langs.keys())[0] if langs else "—"

    # Biggest repo (by stars, own only)
    own = [r for r in repos if not r.get("fork")]
    biggest = max(own, key=lambda r: r.get("stargazers_count", 0), default=None)

    # Event type breakdown
    event_types: Dict[str, int] = defaultdict(int)
    for e in events:
        event_types[e.get("type", "Other")] += 1
    top_event = max(event_types, key=event_types.get) if event_types else "—"

    # PR merge rate
    prs_opened = sum(
        1
        for e in events
        if e.get("type") == "PullRequestEvent"
        and e.get("payload", {}).get("action") == "opened"
    )
    prs_merged = sum(
        1
        for e in events
        if e.get("type") == "PullRequestEvent"
        and e.get("payload", {}).get("action") == "closed"
        and e.get("payload", {}).get("pull_request", {}).get("merged")
    )
    merge_rate = round(prs_merged / prs_opened * 100) if prs_opened else None

    # New repos created this year
    new_repos_year = sum(1 for r in own if r.get("created_at", "").startswith(current_year))

    # Account age label
    try:
        age_years = (
            now - datetime.fromisoformat(profile.get("created_at", "").replace("Z", "+00:00"))
        ).days / 365
        age_label = f"{age_years:.1f} years on GitHub"
    except Exception:
        age_label = "—"

    return {
        "year": current_year,
        "year_commits": year_commits,
        "best_day": {"date": best_day[0], "commits": best_day[1]},
        "best_month": {"label": best_month, "commits": best_month_commits},
        "top_language": top_language,
        "biggest_repo": (
            {
                "name": biggest["name"] if biggest else "—",
                "stars": biggest.get("stargazers_count", 0) if biggest else 0,
                "url": biggest["html_url"] if biggest else "#",
            }
            if biggest
            else None
        ),
        "top_event_type": top_event,
        "prs_opened": prs_opened,
        "prs_merged": prs_merged,
        "pr_merge_rate": merge_rate,
        "longest_streak": streaks.get("longest", 0),
        "current_streak": streaks.get("current", 0),
        "new_repos_year": new_repos_year,
        "total_stars": sum(r.get("stargazers_count", 0) for r in own),
        "total_followers": profile.get("followers", 0),
        "age_label": age_label,
    }


def _compute_social_graph(
    followers_raw: List[Dict], following_raw: List[Dict]
) -> Dict[str, Any]:
    """Mutual follows, fans, and one-sided following from fetched lists."""
    fl = {f["login"].lower() for f in followers_raw}
    fw = {f["login"].lower() for f in following_raw}
    mutual = fl & fw
    fans = fl - fw
    one_way = fw - fl

    def _fmt(src: List[Dict], s: set) -> List[Dict]:
        return [
            {
                "login": f["login"],
                "avatar_url": f.get("avatar_url", ""),
                "url": f.get("html_url", f"https://github.com/{f['login']}"),
            }
            for f in src
            if f["login"].lower() in s
        ][:5]

    return {
        "mutual_count": len(mutual),
        "fans_count": len(fans),
        "following_only_count": len(one_way),
        "mutual": _fmt(followers_raw, mutual),
        "fans": _fmt(followers_raw, fans),
        "following_only": _fmt(following_raw, one_way),
    }
