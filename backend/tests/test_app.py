import importlib
import sys
from pathlib import Path

from fastapi.testclient import TestClient


def load_app(monkeypatch, tmp_path: Path, *, cors_allowed_origins: str = "http://frontend.test"):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path / "uploads"))
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", cors_allowed_origins)
    monkeypatch.delenv("DEMO_SEED", raising=False)
    monkeypatch.delenv("MINIO_ENDPOINT", raising=False)
    monkeypatch.delenv("MINIO_ACCESS_KEY", raising=False)
    monkeypatch.delenv("MINIO_SECRET_KEY", raising=False)

    for module_name in list(sys.modules):
        if module_name == "app" or module_name.startswith("app."):
            del sys.modules[module_name]

    return importlib.import_module("app.main")


def test_health_check_uses_isolated_database(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)

    with TestClient(app_module.app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert (tmp_path / "test.db").exists()


def test_cors_allows_configured_origin(monkeypatch, tmp_path):
    origin = "http://frontend.test"
    app_module = load_app(monkeypatch, tmp_path, cors_allowed_origins=origin)

    with TestClient(app_module.app) as client:
        response = client.options(
            "/health",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert response.headers["access-control-allow-credentials"] == "true"


def test_wildcard_cors_disables_credentials(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path, cors_allowed_origins="*")

    with TestClient(app_module.app) as client:
        response = client.options(
            "/health",
            headers={
                "Origin": "http://anywhere.test",
                "Access-Control-Request-Method": "GET",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "*"
    assert "access-control-allow-credentials" not in response.headers


def test_spa_reports_missing_frontend_build(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)
    app_module.STATIC_DIR = tmp_path / "missing-static"

    with TestClient(app_module.app) as client:
        response = client.get("/dashboard")

    assert response.status_code == 503
    assert response.json() == {"detail": "Frontend not built (missing static/)"}
