import enum
import uuid
from datetime import date, datetime, time, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.dialects.sqlite import CHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class PunchKind(str, enum.Enum):
    punch_in = "punch_in"
    punch_out = "punch_out"


class PunchSource(str, enum.Enum):
    app = "app"
    whatsapp_link = "whatsapp_link"
    controller_scan = "controller_scan"
    controller_manual = "controller_manual"


class AttendanceSessionStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"
    expired = "expired"
    failed_geofence = "failed_geofence"


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    timezone: Mapped[str] = mapped_column(String(64), default="Africa/Abidjan")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Punch channel policy (employer-configurable)
    allow_punch_gps: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_punch_photo: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_punch_kiosk_scan: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_kiosk_borne: Mapped[bool] = mapped_column(Boolean, default=True)

    employers: Mapped[list["EmployerUser"]] = relationship(
        back_populates="company", cascade="all, delete-orphan"
    )


class EmployerUser(Base):
    __tablename__ = "employer_users"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("companies.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    company: Mapped["Company"] = relationship(back_populates="employers")


class WorkSite(Base):
    __tablename__ = "work_sites"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("companies.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    radius_m: Mapped[float] = mapped_column(Float, nullable=False, default=150.0)
    static_map_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)


class WorkSchedule(Base):
    __tablename__ = "work_schedules"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("companies.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)


class WorkScheduleRule(Base):
    __tablename__ = "work_schedule_rules"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=_uuid)
    work_schedule_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("work_schedules.id"), nullable=False)
    weekday: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Monday .. 6=Sunday
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("companies.id"), nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    phone_e164: Mapped[str | None] = mapped_column(String(32), nullable=True)
    pin_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    notify_email: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_whatsapp: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_push: Mapped[bool] = mapped_column(Boolean, default=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    whatsapp_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    can_show_controller_ui: Mapped[bool] = mapped_column(Boolean, default=False)
    default_work_site_id: Mapped[str | None] = mapped_column(CHAR(36), ForeignKey("work_sites.id"), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    default_work_site: Mapped["WorkSite | None"] = relationship(foreign_keys=[default_work_site_id])


class EmployeeScheduleAssignment(Base):
    __tablename__ = "employee_schedule_assignments"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=_uuid)
    employee_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("employees.id"), nullable=False, index=True)
    work_schedule_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("work_schedules.id"), nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)


class Punch(Base):
    __tablename__ = "punches"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("companies.id"), nullable=False, index=True)
    employee_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("employees.id"), nullable=False, index=True)
    kind: Mapped[PunchKind] = mapped_column(Enum(PunchKind), nullable=False)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    work_site_id: Mapped[str | None] = mapped_column(CHAR(36), ForeignKey("work_sites.id"), nullable=True)
    distance_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    within_geofence: Mapped[bool] = mapped_column(Boolean, default=True)
    photo_only_attestation: Mapped[bool] = mapped_column(Boolean, default=False)
    photo_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    source: Mapped[PunchSource] = mapped_column(Enum(PunchSource), default=PunchSource.app)


class ScheduledReminderSent(Base):
    """Dedupe scheduled pre-shift attendance link sends (worker)."""

    __tablename__ = "scheduled_reminder_sent"
    __table_args__ = (
        UniqueConstraint("employee_id", "local_date", "kind", name="uq_reminder_emp_date_kind"),
    )

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=_uuid)
    employee_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("employees.id"), nullable=False, index=True)
    company_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("companies.id"), nullable=False)
    local_date: Mapped[date] = mapped_column(Date, nullable=False)
    kind: Mapped[str] = mapped_column(String(64), nullable=False)  # e.g. pre_shift_attendance
    attendance_session_id: Mapped[str | None] = mapped_column(
        CHAR(36), ForeignKey("attendance_sessions.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("companies.id"), nullable=False)
    employee_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("employees.id"), nullable=False)
    work_site_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("work_sites.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    status: Mapped[AttendanceSessionStatus] = mapped_column(
        Enum(AttendanceSessionStatus), default=AttendanceSessionStatus.pending
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    completed_punch_id: Mapped[str | None] = mapped_column(CHAR(36), ForeignKey("punches.id"), nullable=True)


class EmployeePushDevice(Base):
    """FCM device registrations for native push (employee portal app)."""

    __tablename__ = "employee_push_devices"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=_uuid)
    employee_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("employees.id"), nullable=False, index=True)
    fcm_token: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    platform: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("companies.id"), nullable=False, index=True)
    actor_type: Mapped[str] = mapped_column(String(32), nullable=False)  # employer | employee
    actor_id: Mapped[str] = mapped_column(String(36), nullable=False)
    action: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    entity_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    meta: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
