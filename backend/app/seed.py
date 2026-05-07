"""Optional demo seed (set DEMO_SEED=1)."""

from __future__ import annotations

import math
import random
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import (
    Company,
    Employee,
    EmployeeScheduleAssignment,
    EmployerUser,
    Punch,
    PunchKind,
    PunchSource,
    WorkSchedule,
    WorkScheduleRule,
    WorkSite,
)

DEMO_SLUG = "demo-corp"

# Display name, email, phone — unique per demo employee
DEMO_STAFF: list[tuple[str, str, str]] = [
    ("Employé Demo", "employee@demo.example", "+2250700000000"),
    ("Amadou Koné", "amadou.kone@demo.example", "+2250700000001"),
    ("Aya Traoré", "aya.traore@demo.example", "+2250700000002"),
    ("Koffi Mensah", "koffi.mensah@demo.example", "+2250700000003"),
]


def _offset_m(lat: float, lng: float, north_m: float, east_m: float) -> tuple[float, float]:
    """Approximate offset in meters (good enough for demo punches near Abidjan)."""
    dlat = north_m / 111_320.0
    dlng = east_m / (111_320.0 * math.cos(math.radians(lat)))
    return lat + dlat, lng + dlng


def seed_demo(db: Session) -> None:
    co = db.query(Company).filter(Company.slug == DEMO_SLUG).one_or_none()
    if not co:
        co = Company(name="Demo Corp", slug=DEMO_SLUG)
        db.add(co)
        db.flush()
        boss = EmployerUser(
            company_id=co.id,
            email="boss@example.com",
            password_hash=hash_password("demo-demo"),
            name="Patron Demo",
        )
        db.add(boss)

    site_main = (
        db.query(WorkSite).filter(WorkSite.company_id == co.id, WorkSite.name == "Siège Abidjan").first()
    )
    if not site_main:
        site_main = WorkSite(
            company_id=co.id,
            name="Siège Abidjan",
            lat=5.3364,
            lng=-4.0277,
            radius_m=500,
        )
        db.add(site_main)
        db.flush()

    site_annex = (
        db.query(WorkSite).filter(WorkSite.company_id == co.id, WorkSite.name == "Annexe Plateau").first()
    )
    if not site_annex:
        site_annex = WorkSite(
            company_id=co.id,
            name="Annexe Plateau",
            lat=5.3201,
            lng=-4.0156,
            radius_m=350,
        )
        db.add(site_annex)
        db.flush()

    sched = db.query(WorkSchedule).filter(WorkSchedule.company_id == co.id, WorkSchedule.name == "Bureau 8-17").first()
    if not sched:
        sched = WorkSchedule(company_id=co.id, name="Bureau 8-17")
        db.add(sched)
        db.flush()
        for wd in range(7):
            db.add(
                WorkScheduleRule(
                    work_schedule_id=sched.id,
                    weekday=wd,
                    start_time=time(8, 0),
                    end_time=time(17, 0),
                )
            )

    verified = datetime.now(timezone.utc)
    employee_rows: list[Employee] = []
    sites_for_default = [site_main, site_annex, site_main, site_main]
    for i, (display_name, email, phone) in enumerate(DEMO_STAFF):
        emp = (
            db.query(Employee)
            .filter(Employee.company_id == co.id, Employee.email == email)
            .first()
        )
        if not emp:
            emp = Employee(
                company_id=co.id,
                display_name=display_name,
                email=email,
                phone_e164=phone,
                pin_hash=hash_password("1234"),
                default_work_site_id=sites_for_default[i % len(sites_for_default)].id,
                email_verified_at=verified,
                whatsapp_verified_at=verified,
            )
            db.add(emp)
            db.flush()
        employee_rows.append(emp)

    sched_id = sched.id
    start_assign = date.today() - timedelta(days=45)
    for emp in employee_rows:
        has_asg = (
            db.query(EmployeeScheduleAssignment)
            .filter(EmployeeScheduleAssignment.employee_id == emp.id)
            .first()
        )
        if not has_asg:
            db.add(
                EmployeeScheduleAssignment(
                    employee_id=emp.id,
                    work_schedule_id=sched_id,
                    effective_from=start_assign,
                )
            )

    db.commit()

    _seed_demo_punches_if_empty(db, co, employee_rows, site_main)


def _seed_demo_punches_if_empty(
    db: Session,
    co: Company,
    employees: list[Employee],
    site_main: WorkSite,
) -> None:
    """Populate past attendance only when the demo company has no punches yet (idempotent)."""
    n_existing = db.query(Punch).filter(Punch.company_id == co.id).count()
    if n_existing > 0:
        return

    tz_name = co.timezone or "Africa/Abidjan"
    from zoneinfo import ZoneInfo

    tz = ZoneInfo(tz_name)

    rng = random.Random(42)
    today = date.today()

    def utc_at(local_day: date, local_t: time) -> datetime:
        return datetime.combine(local_day, local_t, tzinfo=tz).astimezone(timezone.utc)

    # Count Mon–Fri days in the window so "perfect" rows always land on real workdays.
    weekday_index = 0

    # Past 21 weekdays + occasional noise
    for day_offset in range(1, 28):
        local_day = today - timedelta(days=day_offset)
        if local_day.weekday() >= 5:
            continue
        weekday_index += 1

        for ei, emp in enumerate(employees):
            site = db.get(WorkSite, emp.default_work_site_id) or site_main
            base_lat, base_lng = site.lat, site.lng

            # Skip punch pair for one employee one weekday (missing day pattern)
            if weekday_index == 11 and ei == 1:
                continue

            # One clean day per demo employee: 4th / 7th / 10th / 13th weekday in window (always exists in ~3 weeks of weekdays).
            perfect_slot = (weekday_index, ei) in {(4, 0), (7, 1), (10, 2), (13, 3)}
            if perfect_slot:
                # 8:03 in / 17:07 out — inside schedule + grace; tight GPS near site center
                pin_n, pin_e = 15.0, -12.0
                lat_in, lng_in = _offset_m(base_lat, base_lng, pin_n, pin_e)
                lat_out, lng_out = _offset_m(base_lat, base_lng, 10.0, 8.0)
                db.add(
                    Punch(
                        company_id=co.id,
                        employee_id=emp.id,
                        kind=PunchKind.punch_in,
                        at=utc_at(local_day, time(8, 3)),
                        lat=lat_in,
                        lng=lng_in,
                        work_site_id=site.id,
                        distance_m=22.0,
                        within_geofence=True,
                        photo_only_attestation=False,
                        source=PunchSource.app,
                    )
                )
                db.add(
                    Punch(
                        company_id=co.id,
                        employee_id=emp.id,
                        kind=PunchKind.punch_out,
                        at=utc_at(local_day, time(17, 7)),
                        lat=lat_out,
                        lng=lng_out,
                        work_site_id=site.id,
                        distance_m=18.0,
                        within_geofence=True,
                        photo_only_attestation=False,
                        source=PunchSource.app,
                    )
                )
                continue

            # Stagger clock-in (minutes after 08:00)
            late_min = rng.randint(0, 35) if ei != 2 else rng.randint(40, 95)  # Aya often "late"
            in_h, in_m = divmod(8 * 60 + late_min, 60)
            in_time = time(int(in_h), int(in_m))

            north = rng.uniform(-40, 40)
            east = rng.uniform(-40, 40)
            lat_in, lng_in = _offset_m(base_lat, base_lng, north, east)
            dist = rng.uniform(5.0, 120.0)

            # One flagged out-of-zone punch for demo analytics (not on an employee's "perfect" day)
            out_of_zone = weekday_index == 6 and ei == 3
            if out_of_zone:
                lat_in, lng_in = _offset_m(base_lat, base_lng, 600, 200)
                dist = 620.0

            db.add(
                Punch(
                    company_id=co.id,
                    employee_id=emp.id,
                    kind=PunchKind.punch_in,
                    at=utc_at(local_day, in_time),
                    lat=lat_in,
                    lng=lng_in,
                    work_site_id=site.id,
                    distance_m=dist,
                    within_geofence=not out_of_zone,
                    photo_only_attestation=False,
                    source=PunchSource.app,
                )
            )

            # Missing punch-out on one synthetic case (different weekday than perfect day for emp 0)
            if weekday_index == 17 and ei == 0:
                db.flush()
                continue

            out_late = rng.randint(0, 45)
            oh = 17 * 60 + out_late
            out_h, out_m = divmod(oh, 60)
            out_time = time(min(out_h, 23), out_m % 60)

            north_o = rng.uniform(-35, 35)
            east_o = rng.uniform(-35, 35)
            lat_out, lng_out = _offset_m(base_lat, base_lng, north_o, east_o)
            db.add(
                Punch(
                    company_id=co.id,
                    employee_id=emp.id,
                    kind=PunchKind.punch_out,
                    at=utc_at(local_day, out_time),
                    lat=lat_out,
                    lng=lng_out,
                    work_site_id=site.id,
                    distance_m=rng.uniform(5.0, 130.0),
                    within_geofence=True,
                    photo_only_attestation=False,
                    source=PunchSource.app,
                )
            )

    db.commit()
