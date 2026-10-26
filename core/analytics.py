"""
core/analytics.py
=================
Core analytics, developer archetype classification, composite scoring,
activity heatmaps, streaks, and repository intelligence algorithms.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List


def _aggregate_languages(repos: List[Dict]) -> Dict[str, int]:
    """Aggregate language byte distribution across own (non-forked) repos."""
    lang_bytes: Dict[str, int] = defaultdict(int)
    for r in repos:
        if r.get("fork"):
            continue
        lang, size = r.get("language"), r.get("size", 0)
        if lang and size:
            lang_bytes[lang] += size
    return dict(sorted(lang_bytes.items(), key=lambda kv: kv[1], reverse=True))


def _compute_archetype(langs: Dict, repos: List[Dict], profile: Dict) -> Dict[str, str]:
    """Classify developer into a primary archetype with glow color styling."""
    total_bytes = sum(langs.values()) or 1
    num_langs = len(langs)
    followers = profile.get("followers", 0)
    total_stars = sum(r.get("stargazers_count", 0) for r in repos if not r.get("fork"))
    top_lang_pct = (list(langs.values())[0] / total_bytes * 100) if langs else 0

    if total_stars >= 1_000:
        return {
            "label": "OPEN-SOURCE LEGEND",
            "glow": "#f59e0b",
            "description": "Codebase that stars entire galaxies.",
        }
    if followers >= 500:
        return {
            "label": "COMMUNITY BEACON",
            "glow": "#8b5cf6",
            "description": "A north star the dev community follows.",
        }
    if num_langs >= 8:
        return {
            "label": "THE POLYGLOT",
            "glow": "#06b6d4",
            "description": "Fluent in more languages than most diplomats.",
        }
    if top_lang_pct >= 80 and langs:
        top = list(langs.keys())[0]
        return {
            "label": f"{top.upper()} SPECIALIST",
            "glow": "#f97316",
            "description": f"Laser-focused mastery. 80%+ in {top}.",
        }
    if num_langs >= 5:
        return {
            "label": "THE GENERALIST",
            "glow": "#10b981",
            "description": "A swiss-army knife of the engineering world.",
        }
    if total_stars >= 100:
        return {
            "label": "RISING STAR",
            "glow": "#0ea5e9",
            "description": "Trajectory clearly upward. Orbital velocity reached.",
        }
    return {
        "label": "CODE CRAFTSMAN",
        "glow": "#94a3b8",
        "description": "Building in the dark. The foundation others stand on.",
    }


def _top_repos(repos: List[Dict], n: int = 6) -> List[Dict]:
    """Extract top N starred repositories (excluding forks)."""
    own = [r for r in repos if not r.get("fork")]
    top = sorted(own, key=lambda r: r.get("stargazers_count", 0), reverse=True)[:n]
    return [
        {
            "name": r["name"],
            "description": r.get("description") or "No description provided.",
            "stars": r.get("stargazers_count", 0),
            "forks": r.get("forks_count", 0),
            "open_issues": r.get("open_issues_count", 0),
            "watchers": r.get("watchers_count", 0),
            "language": r.get("language") or "N/A",
            "url": r["html_url"],
            "topics": r.get("topics", [])[:5],
            "size": r.get("size", 0),
            "updated_at": r.get("updated_at", "")[:10],
        }
        for r in top
    ]


def _compute_score(
    langs: Dict, repos: List[Dict], profile: Dict, events: List[Dict]
) -> Dict[str, Any]:
    """Developer Score™: weighted composite 0–1000."""
    own_repos = [r for r in repos if not r.get("fork")]
    total_stars = sum(r.get("stargazers_count", 0) for r in own_repos)
    followers = profile.get("followers", 0)
    num_langs = len(langs)
    total_repos = len(own_repos)

    # Account age in years
    created_at = profile.get("created_at", "")
    try:
        age_years = (
            datetime.now(timezone.utc)
            - datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        ).days / 365
    except Exception:
        age_years = 1.0

    # Active push days in event window
    push_dates = {e.get("created_at", "")[:10] for e in events if e.get("type") == "PushEvent"}
    activity_days = min(len(push_dates), 90)

    scores = {
        "stars": min(total_stars / 2000 * 300, 300),
        "followers": min(followers / 1000 * 200, 200),
        "diversity": min(num_langs / 12 * 150, 150),
        "repos": min(total_repos / 50 * 100, 100),
        "age": min(age_years / 8 * 80, 80),
        "activity": min(activity_days / 60 * 70, 70),
    }
    total = int(min(sum(scores.values()), 1000))

    grade_map = [
        (900, "S+"),
        (750, "S"),
        (600, "A"),
        (450, "B"),
        (300, "C"),
        (150, "D"),
        (0, "E"),
    ]
    grade = next(g for threshold, g in grade_map if total >= threshold)

    return {
        "total": total,
        "breakdown": {k: int(v) for k, v in scores.items()},
        "grade": grade,
    }


def _compute_heatmap(events: List[Dict]) -> Dict[str, int]:
    """Returns {date_str: commit_count} for all PushEvents in the event window."""
    counts: Dict[str, int] = defaultdict(int)
    for e in events:
        if e.get("type") == "PushEvent":
            d = e.get("created_at", "")[:10]
            if d:
                n = len(e.get("payload", {}).get("commits", []))
                counts[d] += max(n, 1)
    return dict(counts)


def _compute_activity_hours(events: List[Dict]) -> List[List[int]]:
    """Returns 7×24 matrix: grid[weekday][hour] = event_count. Mon=0, Sun=6."""
    grid = [[0] * 24 for _ in range(7)]
    for e in events:
        ts = e.get("created_at", "")
        if not ts:
            continue
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            grid[dt.weekday()][dt.hour] += 1
        except Exception:
            pass
    return grid


def _compute_streaks(events: List[Dict]) -> Dict[str, int]:
    """Current streak, longest streak, total active push days from event window."""
    push_date_strs = {
        e.get("created_at", "")[:10]
        for e in events
        if e.get("type") == "PushEvent" and e.get("created_at")
    }
    if not push_date_strs:
        return {"current": 0, "longest": 0, "total_active_days": 0}

    date_set = set()
    for s in push_date_strs:
        try:
            date_set.add(date.fromisoformat(s))
        except Exception:
            pass

    if not date_set:
        return {"current": 0, "longest": 0, "total_active_days": 0}

    today = date.today()

    # Current streak: walk backwards from today (or yesterday)
    current = 0
    check = today
    while check in date_set:
        current += 1
        check -= timedelta(days=1)
    if current == 0:
        check = today - timedelta(days=1)
        while check in date_set:
            current += 1
            check -= timedelta(days=1)

    # Longest streak: iterate sorted dates
    sorted_dates = sorted(date_set)
    longest = streak = 1
    for i in range(1, len(sorted_dates)):
        if sorted_dates[i] - sorted_dates[i - 1] == timedelta(days=1):
            streak += 1
            longest = max(longest, streak)
        else:
            streak = 1

    return {"current": current, "longest": longest, "total_active_days": len(date_set)}


def _aggregate_topics(repos: List[Dict]) -> Dict[str, int]:
    """Frequency map of repo topics (own repos only), top 30."""
    counts: Dict[str, int] = defaultdict(int)
    for r in repos:
        if r.get("fork"):
            continue
        for t in r.get("topics", []):
            counts[t] += 1
    return dict(sorted(counts.items(), key=lambda kv: kv[1], reverse=True)[:30])


def _language_evolution(repos: List[Dict]) -> Dict[str, Dict[str, int]]:
    """Per-year language distribution (KB) for own repos."""
    evolution: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for r in repos:
        if r.get("fork"):
            continue
        lang = r.get("language")
        size = r.get("size", 0)
        year = r.get("created_at", "")[:4]
        if lang and size and year.isdigit():
            evolution[year][lang] += size
    return {
        y: dict(sorted(v.items(), key=lambda kv: kv[1], reverse=True)[:6])
        for y, v in sorted(evolution.items())
    }


def _gist_stats(gists: List[Dict]) -> Dict[str, Any]:
    """Compute summary metrics for user's public gists."""
    if not gists:
        return {"total": 0, "most_forked": None, "top_language": None, "total_comments": 0}

    total_comments = sum(g.get("comments", 0) for g in gists)
    most_forked = max(gists, key=lambda g: len(g.get("forks", [])), default=None)

    lang_counts: Dict[str, int] = defaultdict(int)
    for g in gists:
        for _, fdata in g.get("files", {}).items():
            lang = fdata.get("language")
            if lang:
                lang_counts[lang] += 1

    return {
        "total": len(gists),
        "total_comments": total_comments,
        "top_language": max(lang_counts, key=lang_counts.get) if lang_counts else None,
        "most_forked": (
            {
                "description": most_forked.get("description") or "Untitled Gist",
                "url": most_forked.get("html_url", ""),
                "forks": len(most_forked.get("forks", [])),
            }
            if most_forked
            else None
        ),
    }


def _extract_commit_messages(events: List[Dict]) -> List[str]:
    """First lines of commit messages from PushEvents (up to 200 total)."""
    messages: List[str] = []
    for e in events:
        if e.get("type") == "PushEvent":
            for commit in e.get("payload", {}).get("commits", []):
                msg = commit.get("message", "").strip()
                if msg:
                    messages.append(msg.split("\n")[0][:200])
    return messages[:200]


def _compute_community(events: List[Dict], username: str) -> Dict[str, Any]:
    """PR/issue/comment activity and external repository contributions."""
    prs_opened = 0
    prs_merged = 0
    issues_opened = 0
    issue_comments = 0
    external_repos: Dict[str, str] = {}

    for e in events:
        etype = e.get("type", "")
        repo_name = e.get("repo", {}).get("name", "")
        payload = e.get("payload", {})

        if etype == "PullRequestEvent":
            action = payload.get("action", "")
            if action == "opened":
                prs_opened += 1
            elif action == "closed" and payload.get("pull_request", {}).get("merged"):
                prs_merged += 1
        elif etype == "IssuesEvent" and payload.get("action") == "opened":
            issues_opened += 1
        elif etype == "IssueCommentEvent":
            issue_comments += 1

        if etype == "PushEvent" and not repo_name.lower().startswith(f"{username.lower()}/"):
            if repo_name and repo_name not in external_repos:
                external_repos[repo_name] = f"https://github.com/{repo_name}"

    return {
        "prs_opened": prs_opened,
        "prs_merged": prs_merged,
        "issues_opened": issues_opened,
        "issue_comments": issue_comments,
        "external_repos": [
            {"name": n, "url": u} for n, u in list(external_repos.items())[:8]
        ],
    }


def _compute_fork_details(repos: List[Dict]) -> List[Dict]:
    """Top forked repos sorted by stars."""
    forks = [r for r in repos if r.get("fork")]
    return [
        {
            "name": r["name"],
            "url": r["html_url"],
            "stars": r.get("stargazers_count", 0),
            "language": r.get("language") or "N/A",
            "updated": r.get("updated_at", "")[:10],
        }
        for r in sorted(forks, key=lambda r: r.get("stargazers_count", 0), reverse=True)[:8]
    ]


def _compute_lang_repo_counts(repos: List[Dict]) -> Dict[str, int]:
    """Number of own (non-forked) repos per language."""
    counts: Dict[str, int] = defaultdict(int)
    for r in repos:
        if r.get("fork"):
            continue
        lang = r.get("language")
        if lang:
            counts[lang] += 1
    return dict(sorted(counts.items(), key=lambda kv: kv[1], reverse=True))


def _compute_peak_hour(events: List[Dict]) -> Dict[str, Any]:
    """Peak coding hour + weekday persona derived from public events."""
    hour_counts = [0] * 24
    day_counts = [0] * 7
    for e in events:
        ts = e.get("created_at", "")
        if not ts:
            continue
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            hour_counts[dt.hour] += 1
            day_counts[dt.weekday()] += 1
        except Exception:
            pass
    if not any(hour_counts):
        return {"hour": "—", "day": "—", "persona": "Ghost Coder", "is_night_owl": False}
    peak_h = hour_counts.index(max(hour_counts))
    peak_d = day_counts.index(max(day_counts))
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    if peak_h == 0:
        h_label = "12 AM"
    elif peak_h < 12:
        h_label = f"{peak_h} AM"
    elif peak_h == 12:
        h_label = "12 PM"
    else:
        h_label = f"{peak_h - 12} PM"
    night = peak_h >= 22 or peak_h <= 4
    if night:
        persona = "🌙 Night Owl"
    elif 5 <= peak_h <= 8:
        persona = "🌅 Early Bird"
    elif 9 <= peak_h <= 17:
        persona = "☀️ 9-to-5 Dev"
    else:
        persona = "🌆 Evening Coder"
    return {"hour": h_label, "day": days[peak_d], "persona": persona, "is_night_owl": night}


def _compute_star_velocity(repos: List[Dict], profile: Dict) -> float:
    """Stars earned per year of account existence (own repos only)."""
    own_repos = [r for r in repos if not r.get("fork")]
    total_stars = sum(r.get("stargazers_count", 0) for r in own_repos)
    try:
        age_years = max(
            (
                datetime.now(timezone.utc)
                - datetime.fromisoformat(profile.get("created_at", "").replace("Z", "+00:00"))
            ).days
            / 365,
            0.1,
        )
    except Exception:
        age_years = 1.0
    return round(total_stars / age_years, 1)


def _compute_roast(
    langs: Dict, repos: List[Dict], profile: Dict, events: List[Dict], streaks: Dict
) -> str:
    """Data-grounded humorous developer roast (max 2 sentences)."""
    own = [r for r in repos if not r.get("fork")]
    stars = sum(r.get("stargazers_count", 0) for r in own)
    followers = profile.get("followers", 0)
    following = profile.get("following", 0)
    forks_cnt = len([r for r in repos if r.get("fork")])
    no_desc = sum(1 for r in own if not r.get("description"))
    streak = streaks.get("current", 0)
    n = len(own) or 1
    lines: List[str] = []
    if no_desc / n > 0.7:
        lines.append("Most repos have no description — mystery wrapped in a .gitignore.")
    if forks_cnt > n * 1.5 and forks_cnt > 3:
        lines.append(f"Forked {forks_cnt} repos, created {n}. Collector energy, not creator energy.")
    if streak == 0:
        lines.append("Commit streak: 0. The GitHub grass is growing back.")
    elif streak < 3:
        lines.append(f"A {streak}-day streak. Barely keeping the garden alive.")
    if following and followers and following > followers * 3:
        lines.append(f"Following {following}, only {followers} follow back. Unrequited code love.")
    if len(langs) == 1 and langs:
        lines.append(f"Only {list(langs.keys())[0]}. Loyalty is admirable. Tunnel vision, less so.")
    elif len(langs) > 12:
        lines.append(f"Codes in {len(langs)} languages — polyglot or commitment issues?")
    if stars == 0:
        lines.append("Zero stars. Not even from a rubber duck.")
    elif stars < 5:
        lines.append(f"Only {stars} star{'s' if stars > 1 else ''}. Keep shipping.")
    if not lines:
        lines.append(
            "Suspiciously well-rounded. Either a 10× engineer or very good at hiding skeletons."
        )
    return " ".join(lines[:2])


def _account_age_years(profile: Dict) -> float:
    """Calculate account age in fractional years."""
    try:
        return (
            datetime.now(timezone.utc)
            - datetime.fromisoformat(profile.get("created_at", "").replace("Z", "+00:00"))
        ).days / 365
    except Exception:
        return 0.0


def _account_year(profile: Dict) -> int:
    """Return creation year of account."""
    try:
        return int(profile.get("created_at", "2099")[:4])
    except Exception:
        return 2099
