from datetime import date, datetime, time
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class RegisterIn(BaseModel):
    company_name: str = Field(min_length=1, max_length=255)
    employer_name: str = Field(min_length=1, max_length=255)
    employer_email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class EmployeeLoginIn(BaseModel):
    company_slug: str
    employee_id: str
    pin: str = Field(min_length=4, max_length=12)


class EmployeeMagicConsumeIn(BaseModel):
    token: str = Field(min_length=20)


class EmployeeOtpRequestIn(BaseModel):
    company_slug: str
    employee_id: str


class EmployeeOtpVerifyIn(BaseModel):
    company_slug: str
    employee_id: str
    code: str = Field(min_length=4, max_length=10)


class EmployeePatchIn(BaseModel):
    can_show_controller_ui: bool | None = None


class CompanyAttendanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    allow_punch_gps: bool
    allow_punch_photo: bool
    allow_punch_kiosk_scan: bool
    allow_kiosk_borne: bool


class CompanyAttendanceUpdate(BaseModel):
    allow_punch_gps: bool
    allow_punch_photo: bool
    allow_punch_kiosk_scan: bool
    allow_kiosk_borne: bool

    @model_validator(mode="after")
    def at_least_one_app_or_scan_path(self) -> "CompanyAttendanceUpdate":
        if not (
            self.allow_punch_gps or self.allow_punch_photo or self.allow_punch_kiosk_scan
        ):
            raise ValueError(
                "At least one of GPS punch, photo attestation, or kiosk scan must stay enabled"
            )
        return self


class WorkSiteCreate(BaseModel):
    name: str
    lat: float
    lng: float
    radius_m: float = 150.0
    static_map_image_url: str | None = None


class WorkSiteOut(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    radius_m: float
    static_map_image_url: str | None

    class Config:
        from_attributes = True


class ScheduleRuleIn(BaseModel):
    weekday: int = Field(ge=0, le=6)
    start_time: time
    end_time: time


class WorkScheduleCreate(BaseModel):
    name: str
    rules: list[ScheduleRuleIn] = []


class WorkScheduleOut(BaseModel):
    id: str
    name: str

    class Config:
        from_attributes = True


class EmployeeCreate(BaseModel):
    display_name: str
    email: EmailStr | None = None
    phone_e164: str | None = None
    pin: str = Field(min_length=4, max_length=12)
    default_work_site_id: str | None = None
    notify_email: bool = True
    notify_whatsapp: bool = True
    notify_push: bool = True


class EmployeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    display_name: str
    email: str | None
    phone_e164: str | None
    notify_email: bool
    notify_whatsapp: bool
    notify_push: bool = True
    email_verified: bool
    whatsapp_verified: bool
    default_work_site_id: str | None
    active: bool
    can_show_controller_ui: bool = False

    @model_validator(mode="before")
    @classmethod
    def from_employee(cls, v: Any) -> Any:
        if hasattr(v, "email_verified_at") and hasattr(v, "id"):
            return {
                "id": v.id,
                "display_name": v.display_name,
                "email": v.email,
                "phone_e164": v.phone_e164,
                "notify_email": v.notify_email,
                "notify_whatsapp": v.notify_whatsapp,
                "notify_push": bool(getattr(v, "notify_push", True)),
                "email_verified": v.email_verified_at is not None,
                "whatsapp_verified": v.whatsapp_verified_at is not None,
                "default_work_site_id": v.default_work_site_id,
                "active": v.active,
                "can_show_controller_ui": bool(getattr(v, "can_show_controller_ui", False)),
            }
        return v


class AssignScheduleIn(BaseModel):
    work_schedule_id: str
    effective_from: date
    effective_to: date | None = None


class PunchCreate(BaseModel):
    kind: Literal["punch_in", "punch_out"]
    lat: float
    lng: float


class PunchOut(BaseModel):
    id: str
    kind: str
    at: datetime
    lat: float
    lng: float
    work_site_id: str | None
    distance_m: float | None
    within_geofence: bool
    photo_only_attestation: bool = False
    photo_path: str | None
    source: str

    class Config:
        from_attributes = True


class PunchStateOut(BaseModel):
    next_kind: str
    local_date: date


class AttendanceSessionCreate(BaseModel):
    employee_id: str
    work_site_id: str
    expires_hours: int = Field(default=24, ge=1, le=168)


class AttendanceSessionPublicOut(BaseModel):
    site_name: str
    employee_display_name: str
    expires_at: datetime
    status: str
    already_completed: bool


class SendNotificationIn(BaseModel):
    token: str = Field(min_length=10)
    channel: Literal["auto", "email", "whatsapp"] = "auto"


class SendWaIn(BaseModel):
    token: str = Field(min_length=10)


class ScheduleRuleOut(BaseModel):
    id: str
    weekday: int
    start_time: time
    end_time: time

    class Config:
        from_attributes = True


class WorkScheduleDetailOut(BaseModel):
    id: str
    name: str
    rules: list[ScheduleRuleOut]

    class Config:
        from_attributes = True


class WorkSchedulePut(BaseModel):
    name: str | None = None
    rules: list[ScheduleRuleIn] | None = None


class AttendanceSessionListOut(BaseModel):
    id: str
    employee_id: str
    work_site_id: str
    status: str
    expires_at: datetime
    created_at: datetime
    completed_punch_id: str | None

    class Config:
        from_attributes = True


class AuditEventOut(BaseModel):
    id: str
    actor_type: str
    actor_id: str
    action: str
    entity_type: str | None
    entity_id: str | None
    meta: dict[str, Any] | None
    created_at: datetime

    class Config:
        from_attributes = True
