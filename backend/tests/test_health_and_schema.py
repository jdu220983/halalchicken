import pytest


@pytest.mark.django_db
def test_healthz(client):
    resp = client.get("/api/healthz/")
    assert resp.status_code == 200
    assert resp.json().get("status") == "ok"


@pytest.mark.django_db
def test_schema(client):
    resp = client.get("/api/schema/")
    assert resp.status_code == 200
    # drf-spectacular may return OpenAPI with vendor content-type, not application/json
    body = resp.content.decode()
    assert "openapi" in body
