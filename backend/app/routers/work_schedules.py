from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import get_current_company
from app.models import Company, WorkSchedule, WorkScheduleRule
from app.schemas import WorkScheduleCreate, WorkScheduleOut

router = APIRouter(prefix="/work-schedules", tags=["work-schedules"])


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
    db.commit()
    db.refresh(ws)
    return ws


@router.get("/{schedule_id}", response_model=WorkScheduleOut)
def get_schedule(
    schedule_id: str,
    company: Annotated[Company, Depends(get_current_company)],
    db: Session = Depends(get_db),
) -> WorkSchedule:
    ws = db.get(WorkSchedule, schedule_id)
    if not ws or ws.company_id != company.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Schedule not found")
    return ws
