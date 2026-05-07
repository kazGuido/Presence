from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import get_current_company, get_current_employer
from app.models import Company, EmployerUser, WorkSchedule, WorkScheduleRule
from app.schemas import ScheduleRuleOut, WorkScheduleCreate, WorkScheduleDetailOut, WorkScheduleOut, WorkSchedulePut
from app.services.audit_log import write_audit

router = APIRouter(prefix="/work-schedules", tags=["work-schedules"])


def _schedule_detail(db: Session, ws: WorkSchedule) -> WorkScheduleDetailOut:
    rules = (
        db.query(WorkScheduleRule)
        .filter(WorkScheduleRule.work_schedule_id == ws.id)
        .order_by(WorkScheduleRule.weekday, WorkScheduleRule.start_time)
        .all()
    )
    return WorkScheduleDetailOut(
        id=ws.id,
        name=ws.name,
        rules=[ScheduleRuleOut.model_validate(x) for x in rules],
    )


@router.get("", response_model=list[WorkScheduleOut])
def list_schedules(
    company: Annotated[Company, Depends(get_current_company)],
    db: Session = Depends(get_db),
) -> list[WorkSchedule]:
    return (
        db.query(WorkSchedule)
        .filter(WorkSchedule.company_id == company.id)
        .order_by(WorkSchedule.name)
        .all()
    )


@router.post("", response_model=WorkScheduleOut, status_code=status.HTTP_201_CREATED)
def create_schedule(
    body: WorkScheduleCreate,
    company: Annotated[Company, Depends(get_current_company)],
    employer: Annotated[EmployerUser, Depends(get_current_employer)],
    db: Session = Depends(get_db),
) -> WorkSchedule:
    ws = WorkSchedule(company_id=company.id, name=body.name.strip())
    db.add(ws)
    db.flush()
    for r in body.rules:
        db.add(
            WorkScheduleRule(
                work_schedule_id=ws.id,
                weekday=r.weekday,
                start_time=r.start_time,
                end_time=r.end_time,
            )
        )
    write_audit(
        db,
        company_id=company.id,
        actor_type="employer",
        actor_id=employer.id,
        action="work_schedule.create",
        entity_type="work_schedule",
        entity_id=ws.id,
        meta={"name": ws.name},
    )
    db.commit()
    db.refresh(ws)
    return ws


@router.get("/{schedule_id}", response_model=WorkScheduleDetailOut)
def get_schedule_detail(
    schedule_id: str,
    company: Annotated[Company, Depends(get_current_company)],
    db: Session = Depends(get_db),
) -> WorkScheduleDetailOut:
    ws = db.get(WorkSchedule, schedule_id)
    if not ws or ws.company_id != company.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Schedule not found")
    return _schedule_detail(db, ws)


@router.put("/{schedule_id}", response_model=WorkScheduleDetailOut)
def update_schedule(
    schedule_id: str,
    body: WorkSchedulePut,
    company: Annotated[Company, Depends(get_current_company)],
    employer: Annotated[EmployerUser, Depends(get_current_employer)],
    db: Session = Depends(get_db),
) -> WorkScheduleDetailOut:
    ws = db.get(WorkSchedule, schedule_id)
    if not ws or ws.company_id != company.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Schedule not found")
    if body.name is not None:
        ws.name = body.name.strip()
    if body.rules is not None:
        db.query(WorkScheduleRule).filter(WorkScheduleRule.work_schedule_id == ws.id).delete(synchronize_session=False)
        for r in body.rules:
            if r.end_time <= r.start_time:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Rule end must be after start")
            db.add(
                WorkScheduleRule(
                    work_schedule_id=ws.id,
                    weekday=r.weekday,
                    start_time=r.start_time,
                    end_time=r.end_time,
                )
            )
    write_audit(
        db,
        company_id=company.id,
        actor_type="employer",
        actor_id=employer.id,
        action="work_schedule.update",
        entity_type="work_schedule",
        entity_id=ws.id,
        meta=None,
    )
    db.commit()
    db.refresh(ws)
    return _schedule_detail(db, ws)
