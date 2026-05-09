"""initial schema

Revision ID: 20260509_0001
Revises:
Create Date: 2026-05-09 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260509_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "companies",
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("allow_punch_gps", sa.Boolean(), nullable=False),
        sa.Column("allow_punch_photo", sa.Boolean(), nullable=False),
        sa.Column("allow_punch_kiosk_scan", sa.Boolean(), nullable=False),
        sa.Column("allow_kiosk_borne", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_companies_slug"), "companies", ["slug"], unique=True)

    op.create_table(
        "employer_users",
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.Column("company_id", sa.CHAR(length=36), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_employer_users_email"), "employer_users", ["email"], unique=True)

    op.create_table(
        "work_sites",
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.Column("company_id", sa.CHAR(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("radius_m", sa.Float(), nullable=False),
        sa.Column("static_map_image_url", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_work_sites_company_id"), "work_sites", ["company_id"], unique=False)

    op.create_table(
        "work_schedules",
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.Column("company_id", sa.CHAR(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_work_schedules_company_id"), "work_schedules", ["company_id"], unique=False)

    op.create_table(
        "employees",
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.Column("company_id", sa.CHAR(length=36), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone_e164", sa.String(length=32), nullable=True),
        sa.Column("pin_hash", sa.String(length=255), nullable=False),
        sa.Column("notify_email", sa.Boolean(), nullable=False),
        sa.Column("notify_whatsapp", sa.Boolean(), nullable=False),
        sa.Column("notify_push", sa.Boolean(), nullable=False),
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("whatsapp_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("can_show_controller_ui", sa.Boolean(), nullable=False),
        sa.Column("default_work_site_id", sa.CHAR(length=36), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["default_work_site_id"], ["work_sites.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_employees_company_id"), "employees", ["company_id"], unique=False)
    op.create_index(op.f("ix_employees_email"), "employees", ["email"], unique=False)

    op.create_table(
        "work_schedule_rules",
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.Column("work_schedule_id", sa.CHAR(length=36), nullable=False),
        sa.Column("weekday", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.ForeignKeyConstraint(["work_schedule_id"], ["work_schedules.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "employee_schedule_assignments",
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.Column("employee_id", sa.CHAR(length=36), nullable=False),
        sa.Column("work_schedule_id", sa.CHAR(length=36), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"]),
        sa.ForeignKeyConstraint(["work_schedule_id"], ["work_schedules.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_employee_schedule_assignments_employee_id"),
        "employee_schedule_assignments",
        ["employee_id"],
        unique=False,
    )

    op.create_table(
        "punches",
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.Column("company_id", sa.CHAR(length=36), nullable=False),
        sa.Column("employee_id", sa.CHAR(length=36), nullable=False),
        sa.Column("kind", sa.Enum("punch_in", "punch_out", name="punchkind"), nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("work_site_id", sa.CHAR(length=36), nullable=True),
        sa.Column("distance_m", sa.Float(), nullable=True),
        sa.Column("within_geofence", sa.Boolean(), nullable=False),
        sa.Column("photo_only_attestation", sa.Boolean(), nullable=False),
        sa.Column("photo_path", sa.String(length=512), nullable=True),
        sa.Column(
            "source",
            sa.Enum("app", "whatsapp_link", "controller_scan", "controller_manual", name="punchsource"),
            nullable=False,
        ),
        sa.Column(
            "geofence_review_status",
            sa.Enum("pending", "approved", "rejected", name="geofencereviewstatus"),
            nullable=True,
        ),
        sa.Column("geofence_review_note", sa.Text(), nullable=True),
        sa.Column("geofence_reviewed_by", sa.CHAR(length=36), nullable=True),
        sa.Column("geofence_reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"]),
        sa.ForeignKeyConstraint(["geofence_reviewed_by"], ["employer_users.id"]),
        sa.ForeignKeyConstraint(["work_site_id"], ["work_sites.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_punches_company_id"), "punches", ["company_id"], unique=False)
    op.create_index(op.f("ix_punches_employee_id"), "punches", ["employee_id"], unique=False)

    op.create_table(
        "attendance_sessions",
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.Column("company_id", sa.CHAR(length=36), nullable=False),
        sa.Column("employee_id", sa.CHAR(length=36), nullable=False),
        sa.Column("work_site_id", sa.CHAR(length=36), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "completed", "expired", "failed_geofence", name="attendancesessionstatus"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_punch_id", sa.CHAR(length=36), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["completed_punch_id"], ["punches.id"]),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"]),
        sa.ForeignKeyConstraint(["work_site_id"], ["work_sites.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_attendance_sessions_token_hash"), "attendance_sessions", ["token_hash"], unique=True)

    op.create_table(
        "scheduled_reminder_sent",
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.Column("employee_id", sa.CHAR(length=36), nullable=False),
        sa.Column("company_id", sa.CHAR(length=36), nullable=False),
        sa.Column("local_date", sa.Date(), nullable=False),
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column("attendance_session_id", sa.CHAR(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["attendance_session_id"], ["attendance_sessions.id"]),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("employee_id", "local_date", "kind", name="uq_reminder_emp_date_kind"),
    )
    op.create_index(
        op.f("ix_scheduled_reminder_sent_employee_id"),
        "scheduled_reminder_sent",
        ["employee_id"],
        unique=False,
    )

    op.create_table(
        "employee_push_devices",
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.Column("employee_id", sa.CHAR(length=36), nullable=False),
        sa.Column("fcm_token", sa.Text(), nullable=False),
        sa.Column("platform", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("fcm_token"),
    )
    op.create_index(op.f("ix_employee_push_devices_employee_id"), "employee_push_devices", ["employee_id"], unique=False)

    op.create_table(
        "employee_notifications",
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.Column("company_id", sa.CHAR(length=36), nullable=False),
        sa.Column("employee_id", sa.CHAR(length=36), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column("entity_type", sa.String(length=64), nullable=True),
        sa.Column("entity_id", sa.String(length=64), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_employee_notifications_company_id"), "employee_notifications", ["company_id"], unique=False)
    op.create_index(op.f("ix_employee_notifications_employee_id"), "employee_notifications", ["employee_id"], unique=False)

    op.create_table(
        "audit_events",
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.Column("company_id", sa.CHAR(length=36), nullable=False),
        sa.Column("actor_type", sa.String(length=32), nullable=False),
        sa.Column("actor_id", sa.String(length=36), nullable=False),
        sa.Column("action", sa.String(length=128), nullable=False),
        sa.Column("entity_type", sa.String(length=64), nullable=True),
        sa.Column("entity_id", sa.String(length=64), nullable=True),
        sa.Column("meta", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_events_action"), "audit_events", ["action"], unique=False)
    op.create_index(op.f("ix_audit_events_company_id"), "audit_events", ["company_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_audit_events_company_id"), table_name="audit_events")
    op.drop_index(op.f("ix_audit_events_action"), table_name="audit_events")
    op.drop_table("audit_events")
    op.drop_index(op.f("ix_employee_notifications_employee_id"), table_name="employee_notifications")
    op.drop_index(op.f("ix_employee_notifications_company_id"), table_name="employee_notifications")
    op.drop_table("employee_notifications")
    op.drop_index(op.f("ix_employee_push_devices_employee_id"), table_name="employee_push_devices")
    op.drop_table("employee_push_devices")
    op.drop_index(op.f("ix_scheduled_reminder_sent_employee_id"), table_name="scheduled_reminder_sent")
    op.drop_table("scheduled_reminder_sent")
    op.drop_index(op.f("ix_attendance_sessions_token_hash"), table_name="attendance_sessions")
    op.drop_table("attendance_sessions")
    op.drop_index(op.f("ix_punches_employee_id"), table_name="punches")
    op.drop_index(op.f("ix_punches_company_id"), table_name="punches")
    op.drop_table("punches")
    op.drop_index(op.f("ix_employee_schedule_assignments_employee_id"), table_name="employee_schedule_assignments")
    op.drop_table("employee_schedule_assignments")
    op.drop_table("work_schedule_rules")
    op.drop_index(op.f("ix_employees_email"), table_name="employees")
    op.drop_index(op.f("ix_employees_company_id"), table_name="employees")
    op.drop_table("employees")
    op.drop_index(op.f("ix_work_schedules_company_id"), table_name="work_schedules")
    op.drop_table("work_schedules")
    op.drop_index(op.f("ix_work_sites_company_id"), table_name="work_sites")
    op.drop_table("work_sites")
    op.drop_index(op.f("ix_employer_users_email"), table_name="employer_users")
    op.drop_table("employer_users")
    op.drop_index(op.f("ix_companies_slug"), table_name="companies")
    op.drop_table("companies")
