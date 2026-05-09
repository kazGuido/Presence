import importlib
import csv
import io
import sys
from datetime import datetime, timezone
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


def test_database_parent_creation_skips_postgres_urls(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)

    app_module._ensure_database_parent("postgresql+psycopg://presence:secret@db:5432/presence")
    sqlite_path = tmp_path / "nested" / "app.db"
    app_module._ensure_database_parent(f"sqlite:///{sqlite_path}")

    assert sqlite_path.parent.is_dir()
    assert not (tmp_path / "postgresql+psycopg:").exists()


def test_attendance_session_out_of_zone_completes_with_review_warning(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)

    with TestClient(app_module.app) as client:
        from app.core.database import SessionLocal
        from app.models import (
            AttendanceSession,
            AuditEvent,
            Company,
            Employee,
            GeofenceReviewStatus,
            Punch,
            WorkSite,
        )
        from app.services.attendance_sessions_core import create_attendance_session

        db = SessionLocal()
        try:
            company = Company(name="Acme", slug="acme")
            db.add(company)
            db.flush()
            site = WorkSite(company_id=company.id, name="HQ", lat=0.0, lng=0.0, radius_m=10.0)
            employee = Employee(company_id=company.id, display_name="Ada", pin_hash="unused")
            db.add_all([site, employee])
            db.flush()
            session, raw_token = create_attendance_session(
                db,
                company_id=company.id,
                employee_id=employee.id,
                work_site_id=site.id,
            )
            session_id = session.id
            db.commit()
        finally:
            db.close()

        response = client.post(
            f"/api/attendance-sessions/by-token/{raw_token}/complete",
            data={"lat": "1.0", "lng": "1.0"},
        )

        assert response.status_code == 201
        body = response.json()
        assert body["ok"] is True
        assert body["geofence_warning"] is True
        assert body["review_status"] == "pending"

        db = SessionLocal()
        try:
            punch = db.get(Punch, body["punch_id"])
            completed_session = db.get(AttendanceSession, session_id)
            audit = db.query(AuditEvent).filter(AuditEvent.entity_id == punch.id).one()
            assert punch.within_geofence is False
            assert punch.geofence_review_status == GeofenceReviewStatus.pending
            assert completed_session.completed_punch_id == punch.id
            assert audit.action == "attendance_session.complete"
            assert audit.meta["within_geofence"] is False
        finally:
            db.close()


def test_employer_can_review_geofence_warning_and_audit_it(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)

    with TestClient(app_module.app) as client:
        from app.core.database import SessionLocal
        from app.core.security import create_access_token
        from app.models import (
            AuditEvent,
            Company,
            Employee,
            EmployeeNotification,
            EmployerUser,
            GeofenceReviewStatus,
            Punch,
            PunchKind,
            PunchSource,
            WorkSite,
        )

        db = SessionLocal()
        try:
            company = Company(name="Acme", slug="acme")
            db.add(company)
            db.flush()
            employer = EmployerUser(
                company_id=company.id,
                email="boss@example.com",
                password_hash="unused",
                name="Boss",
            )
            site = WorkSite(company_id=company.id, name="HQ", lat=0.0, lng=0.0, radius_m=10.0)
            employee = Employee(company_id=company.id, display_name="Ada", pin_hash="unused")
            db.add_all([employer, site, employee])
            db.flush()
            punch = Punch(
                company_id=company.id,
                employee_id=employee.id,
                kind=PunchKind.punch_in,
                at=datetime.now(timezone.utc),
                lat=1.0,
                lng=1.0,
                work_site_id=site.id,
                distance_m=157000,
                within_geofence=False,
                source=PunchSource.app,
                geofence_review_status=GeofenceReviewStatus.pending,
            )
            db.add(punch)
            db.commit()
            token = create_access_token(
                {
                    "sub": employer.id,
                    "typ": "employer",
                    "company_id": company.id,
                    "email": employer.email,
                }
            )
            punch_id = punch.id
        finally:
            db.close()

        headers = {"Authorization": f"Bearer {token}"}
        list_response = client.get("/api/punches/geofence-review", headers=headers)
        assert list_response.status_code == 200
        assert [row["id"] for row in list_response.json()] == [punch_id]

        review_response = client.patch(
            f"/api/punches/{punch_id}/geofence-review",
            headers=headers,
            json={"status": "approved", "note": "Supervisor accepted the exception."},
        )
        assert review_response.status_code == 200
        reviewed = review_response.json()
        assert reviewed["geofence_review_status"] == "approved"
        assert reviewed["geofence_review_note"] == "Supervisor accepted the exception."
        assert reviewed["geofence_reviewed_by"] is not None
        assert reviewed["geofence_reviewed_at"] is not None

        db = SessionLocal()
        try:
            punch = db.get(Punch, punch_id)
            audit = (
                db.query(AuditEvent)
                .filter(AuditEvent.action == "punch.geofence_review", AuditEvent.entity_id == punch_id)
                .one()
            )
            notification = (
                db.query(EmployeeNotification)
                .filter(EmployeeNotification.entity_type == "punch", EmployeeNotification.entity_id == punch_id)
                .one()
            )
            employee_token = create_access_token(
                {
                    "sub": punch.employee_id,
                    "typ": "employee",
                    "company_id": company.id,
                    "employee_id": punch.employee_id,
                }
            )
            notification_id = notification.id
            assert punch.geofence_review_status == GeofenceReviewStatus.approved
            assert audit.meta["previous_status"] == "pending"
            assert audit.meta["new_status"] == "approved"
            assert notification.kind == "geofence_review"
        finally:
            db.close()

        notifications_response = client.get(
            "/api/employee/notifications",
            headers={"Authorization": f"Bearer {employee_token}"},
        )
        assert notifications_response.status_code == 200
        assert [row["id"] for row in notifications_response.json()] == [notification_id]

        read_response = client.post(
            f"/api/employee/notifications/{notification_id}/read",
            headers={"Authorization": f"Bearer {employee_token}"},
        )
        assert read_response.status_code == 200
        assert read_response.json()["read_at"] is not None


def test_punch_level_export_includes_geofence_review_fields(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)

    with TestClient(app_module.app) as client:
        from app.core.database import SessionLocal
        from app.core.security import create_access_token
        from app.models import (
            Company,
            Employee,
            EmployerUser,
            GeofenceReviewStatus,
            Punch,
            PunchKind,
            PunchSource,
            WorkSite,
        )

        db = SessionLocal()
        try:
            company = Company(name="Acme", slug="acme")
            db.add(company)
            db.flush()
            employer = EmployerUser(
                company_id=company.id,
                email="boss@example.com",
                password_hash="unused",
                name="Boss",
            )
            site = WorkSite(company_id=company.id, name="HQ", lat=0.0, lng=0.0, radius_m=10.0)
            employee = Employee(company_id=company.id, display_name="Ada", pin_hash="unused")
            db.add_all([employer, site, employee])
            db.flush()
            punch = Punch(
                company_id=company.id,
                employee_id=employee.id,
                kind=PunchKind.punch_in,
                at=datetime(2026, 5, 9, 8, 0, tzinfo=timezone.utc),
                lat=1.0,
                lng=1.0,
                work_site_id=site.id,
                distance_m=157000,
                within_geofence=False,
                source=PunchSource.whatsapp_link,
                geofence_review_status=GeofenceReviewStatus.pending,
                photo_only_attestation=False,
                photo_path="minio:attendance/example.jpg",
            )
            db.add(punch)
            db.commit()
            token = create_access_token(
                {
                    "sub": employer.id,
                    "typ": "employer",
                    "company_id": company.id,
                    "email": employer.email,
                }
            )
        finally:
            db.close()

        response = client.get(
            "/api/analytics/punches/export?from=2026-05-09&to=2026-05-09",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    rows = list(csv.DictReader(io.StringIO(response.text)))
    assert len(rows) == 1
    assert rows[0]["employee_name"] == "Ada"
    assert rows[0]["within_geofence"] == "false"
    assert rows[0]["geofence_review_status"] == "pending"
    assert rows[0]["source"] == "whatsapp_link"
    assert rows[0]["has_photo"] == "true"
