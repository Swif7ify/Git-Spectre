"""
core/badge.py
=============
Dynamic SVG Generator for GitHub Profile READMEs & Embeds.
Produces lightweight, GitHub Camo-compatible vector graphics:
- Compact Shields-style Pill Badges (Flat, Cyber, For-The-Badge)
- Rich Tactical Dossier Profile Cards (GitHub README stats style)
"""

from __future__ import annotations

import html
import re
from typing import Any, Dict, List, Optional, Tuple

# Grade accent colors matching Git-Spectre theme system
GRADE_COLORS: Dict[str, str] = {
    "S+": "#f59e0b",
    "S": "#10b981",
    "A": "#06b6d4",
    "B": "#8b5cf6",
    "C": "#f97316",
    "D": "#ef4444",
    "E": "#6b7280",
}

# Curated theme definitions
THEMES: Dict[str, Dict[str, str]] = {
    "spectre": {
        "bg_start": "#090d16",
        "bg_end": "#0f172a",
        "border": "#1e293b",
        "title": "#f8fafc",
        "text": "#94a3b8",
        "muted": "#64748b",
        "accent": "#10b981",
        "accent_glow": "#22d3ee",
        "card_bar_bg": "rgba(255, 255, 255, 0.08)",
        "pill_left_bg": "#1e293b",
    },
    "dark": {
        "bg_start": "#0d1117",
        "bg_end": "#161b22",
        "border": "#30363d",
        "title": "#f0f6fc",
        "text": "#8b949e",
        "muted": "#6e7681",
        "accent": "#58a6ff",
        "accent_glow": "#1f6feb",
        "card_bar_bg": "rgba(255, 255, 255, 0.08)",
        "pill_left_bg": "#21262d",
    },
    "tokyo": {
        "bg_start": "#1a1b26",
        "bg_end": "#16161e",
        "border": "#2f3549",
        "title": "#c0caf5",
        "text": "#9aa5ce",
        "muted": "#565f89",
        "accent": "#bb9af7",
        "accent_glow": "#7dcfff",
        "card_bar_bg": "rgba(255, 255, 255, 0.1)",
        "pill_left_bg": "#24283b",
    },
    "matrix": {
        "bg_start": "#030a05",
        "bg_end": "#051308",
        "border": "#133e1a",
        "title": "#4ade80",
        "text": "#22c55e",
        "muted": "#166534",
        "accent": "#22c55e",
        "accent_glow": "#86efac",
        "card_bar_bg": "rgba(34, 197, 94, 0.15)",
        "pill_left_bg": "#09230e",
    },
    "light": {
        "bg_start": "#ffffff",
        "bg_end": "#f8fafc",
        "border": "#e2e8f0",
        "title": "#0f172a",
        "text": "#475569",
        "muted": "#94a3b8",
        "accent": "#0284c7",
        "accent_glow": "#0ea5e9",
        "card_bar_bg": "rgba(0, 0, 0, 0.06)",
        "pill_left_bg": "#e2e8f0",
    },
}

# Recognized language color map (GitHub standard)
LANG_COLORS: Dict[str, str] = {
    "JavaScript": "#f1e05a",
    "TypeScript": "#3178c6",
    "Python": "#3572A5",
    "HTML": "#e34c26",
    "CSS": "#563d7c",
    "Rust": "#dea584",
    "Go": "#00ADD8",
    "C": "#555555",
    "C++": "#f34b7d",
    "C#": "#178600",
    "Java": "#b07219",
    "PHP": "#4F5D95",
    "Ruby": "#701516",
    "Swift": "#F05138",
    "Kotlin": "#A97BFF",
    "Dart": "#00B4AB",
    "Shell": "#89e051",
    "Bash": "#89e051",
    "Vue": "#41b883",
    "React": "#61dafb",
    "Svelte": "#ff3e00",
    "Lua": "#000080",
    "Zig": "#ec915c",
    "Elixir": "#6e4a7e",
    "Scala": "#c22d40",
    "R": "#198CE7",
    "Julia": "#a270ba",
    "Haskell": "#5e5086",
    "Clojure": "#db5855",
    "Dockerfile": "#384d54",
}


def _get_lang_color(lang: str) -> str:
    """Return specific language color or deterministic HSL fallback."""
    if lang in LANG_COLORS:
        return LANG_COLORS[lang]
    h = 0
    for char in lang:
        h = ord(char) + ((h << 5) - h)
    hue = abs(h) % 360
    return f"hsl({hue}, 68%, 60%)"


def _compact_number(n: Any) -> str:
    """Format numbers into compact strings (e.g. 1.2k, 3.4M)."""
    try:
        num = float(n)
    except (ValueError, TypeError):
        return "0"
    if num >= 1_000_000:
        return f"{num / 1_000_000:.1f}".rstrip("0").rstrip(".") + "M"
    if num >= 1_000:
        return f"{num / 1_000:.1f}".rstrip("0").rstrip(".") + "k"
    return str(int(num))


# ============================================================================
# 1. COMPACT PILL BADGE GENERATOR
# ============================================================================

def generate_pill_badge(
    left: str,
    right: str,
    color: str = "#10b981",
    style: str = "flat",
    theme: str = "spectre",
) -> str:
    """Generate a clean, high-precision SVG pill badge (Shields.io / Cyber).

    Supports:
    - style="flat": Classic shields style with rounded corners (rx="3")
    - style="cyber": Git-Spectre tactical style with glowing border
    - style="for-the-badge": Chunky tall badge (height 28)
    """
    th = THEMES.get(theme.lower(), THEMES["spectre"])
    left_str = str(left).strip()
    right_str = str(right).strip()

    left_e = html.escape(left_str, quote=True)
    right_e = html.escape(right_str, quote=True)
    color_e = html.escape(color, quote=True)

    if style == "for-the-badge":
        height = 28
        font_size = 11
        letter_spacing = 1.0
        left_upper = left_e.upper()
        right_upper = right_e.upper()
        lw = int(len(left_upper) * 7.5 + 24)
        rw = int(len(right_upper) * 7.5 + 24)
        total = lw + rw
        lx = lw / 2
        rx = lw + (rw / 2)

        return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{total}" height="{height}" role="img" aria-label="{left_e}: {right_e}">
  <title>{left_e}: {right_e}</title>
  <clipPath id="r"><rect width="{total}" height="{height}" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="{lw}" height="{height}" fill="{th['pill_left_bg']}"/>
    <rect x="{lw}" width="{rw}" height="{height}" fill="{color_e}"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="{font_size}" font-weight="700" letter-spacing="{letter_spacing}">
    <text x="{lx}" y="18" fill="#fff">{left_upper}</text>
    <text x="{rx}" y="18" fill="#fff">{right_upper}</text>
  </g>
</svg>"""

    elif style == "cyber":
        height = 24
        font_size = 11
        lw = int(len(left_str) * 6.8 + 20)
        rw = int(len(right_str) * 6.8 + 20)
        total = lw + rw
        lx = lw / 2 + 5
        rx = lw + (rw / 2)

        return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{total}" height="{height}" role="img" aria-label="{left_e}: {right_e}">
  <title>{left_e}: {right_e}</title>
  <defs>
    <linearGradient id="cyber-bg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="{th['bg_start']}"/>
      <stop offset="100%" stop-color="{th['bg_end']}"/>
    </linearGradient>
  </defs>
  <rect width="{total}" height="{height}" rx="5" fill="url(#cyber-bg)" stroke="{th['border']}" stroke-width="1"/>
  <!-- Status dot -->
  <circle cx="10" cy="12" r="3" fill="{color_e}"/>
  <!-- Divider -->
  <line x1="{lw}" y1="4" x2="{lw}" y2="20" stroke="{th['border']}" stroke-width="1"/>
  <g text-anchor="middle" font-family="'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace" font-size="{font_size}">
    <text x="{lx}" y="16" fill="{th['title']}" font-weight="600">{left_e}</text>
    <text x="{rx}" y="16" fill="{color_e}" font-weight="700">{right_e}</text>
  </g>
</svg>"""

    else:
        # Default flat shields.io style
        height = 20
        lw = int(len(left_str) * 6.5 + 16)
        rw = int(len(right_str) * 6.5 + 16)
        total = lw + rw
        lx = lw / 2
        rx = lw + (rw / 2)

        return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{total}" height="{height}" role="img" aria-label="{left_e}: {right_e}">
  <title>{left_e}: {right_e}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".15"/>
    <stop offset="100%" stop-color="#000" stop-opacity=".2"/>
  </linearGradient>
  <clipPath id="r"><rect width="{total}" height="{height}" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="{lw}" height="{height}" fill="{th['pill_left_bg']}"/>
    <rect x="{lw}" width="{rw}" height="{height}" fill="{color_e}"/>
    <rect width="{total}" height="{height}" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif" font-size="11" font-weight="600">
    <text x="{lx}" y="15" fill="#010101" fill-opacity=".3">{left_e}</text>
    <text x="{lx}" y="14" fill="#fff">{left_e}</text>
    <text x="{rx}" y="15" fill="#010101" fill-opacity=".3">{right_e}</text>
    <text x="{rx}" y="14" fill="#fff">{right_e}</text>
  </g>
</svg>"""


# ============================================================================
# 2. RICH DOSSIER PROFILE CARD GENERATOR
# ============================================================================

def generate_dossier_card(
    profile: Dict[str, Any],
    score: Dict[str, Any],
    archetype: Optional[Dict[str, Any]] = None,
    languages: Optional[Dict[str, int]] = None,
    rank_info: Optional[Dict[str, Any]] = None,
    streaks: Optional[Dict[str, Any]] = None,
    total_stars: int = 0,
    theme: str = "spectre",
    border: bool = True,
) -> str:
    """Generate a rich, tactical ~495x195 SVG dossier card for GitHub READMEs.
    Strictly standard vector SVG with no external images, perfectly Camo safe.
    """
    th = THEMES.get(theme.lower(), THEMES["spectre"])

    # Extract & clean inputs
    login = html.escape(str(profile.get("login") or "developer"), quote=True)
    name = str(profile.get("name") or "").strip()
    display_title = html.escape(name if name else f"@{login}", quote=True)

    total_score = int(score.get("total", 0))
    tier = str(score.get("tier") or score.get("grade") or "B").upper()
    grade_color = GRADE_COLORS.get(tier, th["accent"])

    # Archetype
    arc_title = "CODE CRAFTSMAN"
    if archetype:
        arc_title = str(archetype.get("title") or archetype.get("label") or arc_title).upper()
    arc_e = html.escape(arc_title, quote=True)

    # Rank
    rank_str = "—"
    if rank_info and rank_info.get("all_time_rank"):
        rank_str = f"#{rank_info['all_time_rank']}"
    elif rank_info and rank_info.get("monthly_rank"):
        rank_str = f"#{rank_info['monthly_rank']}"

    # Stars
    stars_str = _compact_number(total_stars or profile.get("stars_earned", 0))

    # Repos or Streak
    longest_streak = 0
    if streaks and isinstance(streaks, dict):
        longest_streak = int(streaks.get("longest", 0) or streaks.get("current", 0))

    streak_or_repos_val = f"{longest_streak}d" if longest_streak > 0 else str(profile.get("public_repos", 0))
    streak_or_repos_label = "STREAK" if longest_streak > 0 else "REPOS"

    # Languages
    lang_items = list((languages or {}).items())[:4]
    total_bytes = sum(b for _, b in lang_items) or 1
    lang_slices: List[Dict[str, Any]] = []
    accumulated_pct = 0.0

    for lang_name, byte_count in lang_items:
        pct = (byte_count / total_bytes) * 100
        color = _get_lang_color(lang_name)
        lang_slices.append({
            "name": html.escape(lang_name, quote=True),
            "pct": round(pct, 1),
            "color": color,
            "width": max(pct, 2.0),
        })

    # Border style
    stroke_attr = f'stroke="{th["border"]}" stroke-width="1"' if border else ""

    # Score bar calculation (0 - 1000 scaled to 90px width)
    score_bar_w = min(max(int((total_score / 1000) * 80), 4), 80)

    # Compute language bar segments (width = 435 total)
    lang_bar_markup = []
    curr_x = 30.0
    total_bar_w = 435.0

    if lang_slices:
        for idx, s in enumerate(lang_slices):
            w = (s["pct"] / 100.0) * total_bar_w
            # Round ends for first and last
            rx = "3" if (idx == 0 or idx == len(lang_slices) - 1) else "0"
            lang_bar_markup.append(
                f'<rect x="{curr_x:.1f}" y="146" width="{w:.1f}" height="6" fill="{s["color"]}" rx="{rx}"/>'
            )
            curr_x += w
    else:
        lang_bar_markup.append(
            f'<rect x="30" y="146" width="{total_bar_w}" height="6" fill="{th["card_bar_bg"]}" rx="3"/>'
        )

    # Compute language legend row (x offset starting at 30)
    legend_markup = []
    leg_x = 30
    for s in lang_slices:
        legend_markup.append(
            f'<circle cx="{leg_x}" cy="168" r="3.5" fill="{s["color"]}"/>'
            f'<text x="{leg_x + 8}" y="171" fill="{th["text"]}" font-size="10" font-family="-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif">'
            f'{s["name"]} <tspan fill="{th["muted"]}">{s["pct"]}%</tspan></text>'
        )
        leg_x += int(len(s["name"]) * 6.5 + 46)
        if leg_x > 400:
            break

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 495 195" width="495" height="195" role="img" aria-label="Git-Spectre Dossier: {login}">
  <title>Git-Spectre Dossier: {login}</title>
  <defs>
    <linearGradient id="card-grad" x1="0" y1="0" x2="0" y2="100%">
      <stop offset="0%" stop-color="{th['bg_start']}"/>
      <stop offset="100%" stop-color="{th['bg_end']}"/>
    </linearGradient>
    <linearGradient id="glow-grad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="{th['accent']}"/>
      <stop offset="100%" stop-color="{th['accent_glow']}"/>
    </linearGradient>
  </defs>

  <style>
    .mono {{ font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }}
    .sans {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }}
  </style>

  <!-- Card Background -->
  <rect width="495" height="195" rx="14" fill="url(#card-grad)" {stroke_attr}/>

  <!-- Top Reticle & System Header -->
  <g transform="translate(30, 22)">
    <!-- Eye Reticle Icon -->
    <circle cx="8" cy="8" r="7" fill="none" stroke="{th['accent']}" stroke-width="1.5"/>
    <circle cx="8" cy="8" r="2.5" fill="{th['accent']}"/>
    <line x1="8" y1="0" x2="8" y2="4" stroke="{th['accent']}" stroke-width="1.5"/>
    <line x1="8" y1="12" x2="8" y2="16" stroke="{th['accent']}" stroke-width="1.5"/>
    <line x1="0" y1="8" x2="4" y2="8" stroke="{th['accent']}" stroke-width="1.5"/>
    <line x1="12" y1="8" x2="16" y2="8" stroke="{th['accent']}" stroke-width="1.5"/>

    <!-- System Monospace Label -->
    <text x="24" y="11" fill="{th['muted']}" font-size="9.5" font-weight="600" letter-spacing="1.5" class="mono">
      GIT-SPECTRE // DEVELOPER DOSSIER
    </text>
  </g>

  <!-- Grade Badge (Top Right) -->
  <g transform="translate(415, 18)">
    <rect width="50" height="22" rx="6" fill="{th['pill_left_bg']}" stroke="{grade_color}" stroke-opacity="0.4" stroke-width="1"/>
    <text x="25" y="15" fill="{grade_color}" font-size="11" font-weight="800" text-anchor="middle" class="mono">{tier}</text>
  </g>

  <!-- Developer Identity Row -->
  <text x="30" y="58" fill="{th['title']}" font-size="16" font-weight="700" class="sans">
    {display_title}
  </text>
  <g transform="translate(30, 66)">
    <rect width="{len(arc_title) * 6.5 + 16}" height="18" rx="4" fill="{th['card_bar_bg']}"/>
    <text x="8" y="13" fill="{th['accent']}" font-size="9" font-weight="700" letter-spacing="0.8" class="mono">{arc_e}</text>
  </g>

  <!-- Metrics Grid (Y = 96) -->
  <!-- Col 1: Dev Score -->
  <g transform="translate(30, 96)">
    <text x="0" y="10" fill="{th['muted']}" font-size="9" font-weight="600" letter-spacing="0.8" class="mono">DEV SCORE</text>
    <text x="0" y="28" fill="{th['title']}" font-size="18" font-weight="800" class="mono">{total_score}<tspan fill="{th['muted']}" font-size="11" font-weight="500">/1000</tspan></text>
    <!-- Mini progress track -->
    <rect x="0" y="34" width="80" height="3" rx="1.5" fill="{th['card_bar_bg']}"/>
    <rect x="0" y="34" width="{score_bar_w}" height="3" rx="1.5" fill="url(#glow-grad)"/>
  </g>

  <!-- Col 2: Global Rank -->
  <g transform="translate(150, 96)">
    <text x="0" y="10" fill="{th['muted']}" font-size="9" font-weight="600" letter-spacing="0.8" class="mono">GLOBAL RANK</text>
    <text x="0" y="28" fill="{th['title']}" font-size="18" font-weight="800" class="mono">{rank_str}</text>
  </g>

  <!-- Col 3: Stars Earned -->
  <g transform="translate(265, 96)">
    <text x="0" y="10" fill="{th['muted']}" font-size="9" font-weight="600" letter-spacing="0.8" class="mono">STARS EARNED</text>
    <text x="0" y="28" fill="{th['title']}" font-size="18" font-weight="800" class="mono">★ {stars_str}</text>
  </g>

  <!-- Col 4: Streak / Repos -->
  <g transform="translate(380, 96)">
    <text x="0" y="10" fill="{th['muted']}" font-size="9" font-weight="600" letter-spacing="0.8" class="mono">{streak_or_repos_label}</text>
    <text x="0" y="28" fill="{th['title']}" font-size="18" font-weight="800" class="mono">{streak_or_repos_val}</text>
  </g>

  <!-- Stacked Language Distribution Bar -->
  {''.join(lang_bar_markup)}

  <!-- Language Legend -->
  {''.join(legend_markup)}

</svg>"""


# ============================================================================
# 3. ERROR / NOT FOUND BADGE
# ============================================================================

def generate_not_found_badge(username: str, style: str = "pill", theme: str = "spectre") -> str:
    """Generate an informative, graceful error badge when profile is not found."""
    if style == "card":
        th = THEMES.get(theme.lower(), THEMES["spectre"])
        u_e = html.escape(username, quote=True)
        return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 495 120" width="495" height="120" role="img">
  <rect width="495" height="120" rx="12" fill="{th['bg_start']}" stroke="{th['border']}" stroke-width="1"/>
  <circle cx="35" cy="40" r="12" fill="#ef4444" fill-opacity="0.15"/>
  <text x="35" y="44" fill="#ef4444" font-size="14" font-weight="bold" text-anchor="middle" font-family="sans-serif">!</text>
  <text x="60" y="36" fill="{th['title']}" font-size="14" font-weight="bold" font-family="sans-serif">Git-Spectre // User Not Found</text>
  <text x="60" y="55" fill="{th['muted']}" font-size="11" font-family="sans-serif">Could not find public profile for &quot;{u_e}&quot;.</text>
  <text x="60" y="90" fill="{th['accent']}" font-size="10" font-family="monospace">VISIT GIT-SPECTRE.VERCEL.APP TO SCAN</text>
</svg>"""
    return generate_pill_badge("Git-Spectre", "not found", "#6b7280", style=style, theme=theme)
