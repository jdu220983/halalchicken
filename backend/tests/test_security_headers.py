import pytest


@pytest.mark.django_db
def test_security_headers_present(client, settings, monkeypatch):
    settings.DEBUG = False
    resp = client.get("/api/healthz/")
    assert resp["X-Content-Type-Options"] == "nosniff"
    assert resp["X-Frame-Options"] == "DENY"
    assert resp["Referrer-Policy"] == "same-origin"
    assert "Strict-Transport-Security" in resp


@pytest.mark.django_db
def test_csp_header_when_enabled(client, settings):
    settings.DEBUG = False
    settings.CSP_ENABLED = True
    settings.CSP_CONNECT_SRC_EXTRA = "https://api.example.com https://s3.amazonaws.com"
    resp = client.get("/api/healthz/")
    csp = resp.get("Content-Security-Policy")
    assert csp is not None
    assert "default-src 'self'" in csp
    assert "connect-src 'self' https:" in csp
