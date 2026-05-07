from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


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
    phone_e164: str | None = None
    pin: str = Field(min_length=4, max_length=12)
    default_work_site_id: str | None = None


class EmployeeOut(BaseModel):
    id: str
    display_name: str
    phone_e164: str | None
    default_work_site_id: str | None
    active: bool

    class Config:
        from_attributes = True


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


class SendWaIn(BaseModel):
    token: str = Field(min_length=10)
