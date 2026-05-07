"""Optional demo seed (set DEMO_SEED=1)."""

from datetime import date, time
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import (
    Company,
    Employee,
    EmployeeScheduleAssignment,
    EmployerUser,
    WorkSchedule,
    WorkScheduleRule,
    WorkSite,
)


def seed_demo(db: Session) -> None:
    if db.query(Company).first():
        return
    co = Company(name="Demo Corp", slug="demo-corp")
    db.add(co)
    db.flush()
    boss = EmployerUser(
        company_id=co.id,
        email="boss@example.com",
        password_hash=hash_password("demo-demo"),
        name="Patron Demo",
    )
    db.add(boss)
    site = WorkSite(
        company_id=co.id,
        name="Siège Abidjan",
        lat=5.3364,
        lng=-4.0277,
        radius_m=500,
    )
    db.add(site)
    db.flush()
    sched = WorkSchedule(company_id=co.id, name="Bureau 8-17")
    db.add(sched)
    db.flush()
    db.add(
        WorkScheduleRule(
            work_schedule_id=sched.id,
            weekday=0,
            start_time=time(8, 0),
            end_time=time(17, 0),
        )
    )
    emp = Employee(
        company_id=co.id,
        display_name="Employé Demo",
        phone_e164=None,
        pin_hash=hash_password("1234"),
        default_work_site_id=site.id,
    )
    db.add(emp)
    db.flush()
    db.add(
        EmployeeScheduleAssignment(
            employee_id=emp.id,
            work_schedule_id=sched.id,
            effective_from=date.today(),
        )
    )
    db.commit()
