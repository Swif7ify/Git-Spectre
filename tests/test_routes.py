"""
tests/test_routes.py
====================
Integration tests for Git-Spectre FastAPI routes, static file serving, and health checks.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from fastapi.testclient import TestClient

from main import APP_VERSION, APP_VERSION_SHORT, app

client = TestClient(app)


class TestRootRoute:
    def test_root_serves_html(self):
        resp = client.get("/")
        assert resp.status_code == 200
        assert "text/html" in resp.headers.get("content-type", "")
        html = resp.text
        assert "Git-Spectre" in html
        assert 'id="spectre-telemetry"' in html
        assert 'id="searchForm"' in html
        assert 'id="dossierSection"' in html
        assert '/static/js/app.js' in html
        assert APP_VERSION_SHORT in html


class TestStaticAssets:
    def test_brand_icon_svg(self):
        resp = client.get("/static/icon.svg")
        assert resp.status_code == 200
        assert "svg" in resp.headers.get("content-type", "")

    def test_brand_text_icon_svg(self):
        resp = client.get("/static/text-icon.svg")
        assert resp.status_code == 200
        assert "svg" in resp.headers.get("content-type", "")

    def test_theme_css(self):
        resp = client.get("/static/css/theme.css")
        assert resp.status_code == 200
        assert "css" in resp.headers.get("content-type", "")

    def test_js_app_entry(self):
        resp = client.get("/static/js/app.js")
        assert resp.status_code == 200


class TestHealthEndpoint:
    def test_health_check(self):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("status") == "ok"
        assert data.get("version") == APP_VERSION


class TestVersionEndpoint:
    def test_version_info(self):
        resp = client.get("/api/version")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("version") == APP_VERSION
        assert data.get("short") == APP_VERSION_SHORT
        assert "major" in data


class TestBatchValidation:
    def test_batch_empty_payload(self):
        resp = client.post("/api/batch", json={"usernames": []})
        assert resp.status_code == 422

    def test_batch_exceeds_max_targets(self):
        too_many = [f"user{i}" for i in range(11)]
        resp = client.post("/api/batch", json={"usernames": too_many})
        assert resp.status_code == 422
