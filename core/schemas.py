"""
core/schemas.py
===============
Pydantic models, request validators, and validation regexes for input sanitation.
"""

from __future__ import annotations

import html as _html
import re
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

_USERNAME_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9\-]{0,37}[a-zA-Z0-9]$|^[a-zA-Z0-9]$")
# Matches classic GitHub PAT formats (ghp_, gho_, ghu_, ghr_, ghs_) and fine-grained PATs (github_pat_)
_TOKEN_RE = re.compile(r"^(?:gh[pousr]_[A-Za-z0-9_]{36,255}|github_pat_[A-Za-z0-9_]{22,255})$")


def _validate_username(v: str) -> str:
    """Validate GitHub username according to GitHub naming rules."""
    v = v.strip()
    if not v:
        raise ValueError("Username cannot be empty.")
    if not _USERNAME_RE.match(v):
        raise ValueError(
            "Invalid GitHub username. Use only letters, numbers, and hyphens (1–39 chars)."
        )
    return v


def _validate_token(v: Optional[str]) -> Optional[str]:
    """Validate GitHub PAT format — rejects obviously invalid or injected strings."""
    if v is None:
        return None
    v = v.strip()
    if not v:
        return None
    if not _TOKEN_RE.match(v):
        raise ValueError(
            "Invalid GitHub token format. Provide a valid Personal Access Token "
            "(ghp_…, gho_…, ghu_…, ghr_…, or ghs_…)."
        )
    return v


class _WithToken(BaseModel):
    """Mixin that adds a validated, optional github_token field to all request models."""

    github_token: Optional[str] = None

    @field_validator("github_token")
    @classmethod
    def validate_token(cls, v: Optional[str]) -> Optional[str]:
        return _validate_token(v)


class AnalyzeRequest(_WithToken):
    username: str

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        return _validate_username(v)


class CompareRequest(_WithToken):
    username_a: str
    username_b: str

    @field_validator("username_a", "username_b")
    @classmethod
    def validate_usernames(cls, v: str) -> str:
        return _validate_username(v)


class BatchRequest(_WithToken):
    usernames: List[str] = Field(..., min_length=1, max_length=10)

    @field_validator("usernames", mode="before")
    @classmethod
    def validate_usernames(cls, v: List[str]) -> List[str]:
        return [_validate_username(u) for u in v]


def _make_badge_svg(left: str, right: str, color: str) -> str:
    """Minimal shields.io-compatible flat SVG badge."""
    left_e = _html.escape(left, quote=True)
    right_e = _html.escape(right, quote=True)
    color_e = _html.escape(color, quote=True)
    lw = len(left) * 6 + 10
    rw = len(right) * 6 + 10
    total = lw + rw
    lx = lw // 2
    rx = lw + rw // 2
    return f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="{total}" height="20" role="img" aria-label="{left_e}: {right_e}">
  <title>{left_e}: {right_e}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="{total}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="{lw}" height="20" fill="#555"/>
    <rect x="{lw}" width="{rw}" height="20" fill="{color_e}"/>
    <rect width="{total}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="110" text-rendering="geometricPrecision">
    <text x="{lx * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="{(lw - 10) * 10}" lengthAdjust="spacing">{left_e}</text>
    <text x="{lx * 10}" y="140" transform="scale(.1)" textLength="{(lw - 10) * 10}" lengthAdjust="spacing">{left_e}</text>
    <text x="{rx * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="{(rw - 10) * 10}" lengthAdjust="spacing">{right_e}</text>
    <text x="{rx * 10}" y="140" transform="scale(.1)" textLength="{(rw - 10) * 10}" lengthAdjust="spacing">{right_e}</text>
  </g>
</svg>"""
