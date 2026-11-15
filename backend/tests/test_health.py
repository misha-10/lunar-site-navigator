import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint():
    """Verify that /health returns 200 OK and matches the contract."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data == {
        "status": "ok",
        "service": "lunascope-backend",
        "version": "0.1.0",
    }


def test_cors_headers_allowed_origin():
    """Verify CORS headers when request originates from the frontend Vite dev server."""
    headers = {
        "Origin": "http://localhost:5173",
    }
    response = client.get("/health", headers=headers)
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert response.headers.get("access-control-allow-credentials") == "true"


def test_cors_preflight_options():
    """Verify CORS preflight OPTIONS request for frontend origin."""
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "content-type",
    }
    response = client.options("/health", headers=headers)
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert "GET" in response.headers.get("access-control-allow-methods", "")


def test_openapi_schema_available():
    """Verify that /openapi.json loads and contains service information."""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert schema["info"]["title"] == "LunaScope Backend"
    assert "/health" in schema["paths"]


def test_docs_page_available():
    """Verify that Swagger UI documentation endpoint (/docs) responds successfully."""
    response = client.get("/docs")
    assert response.status_code == 200
    assert "swagger-ui" in response.text.lower()
