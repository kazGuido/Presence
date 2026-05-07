from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import get_current_company
from app.models import Company
from app.services.analytics_service import build_attendance_analytics

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/attendance")
def attendance(
    company: Annotated[Company, Depends(get_current_company)],
    db: Session = Depends(get_db),
    date_from: date = Query(..., alias="from"),
    date_to: date = Query(..., alias="to"),
) -> dict:
    return build_attendance_analytics(db, company.id, company.timezone, date_from, date_to)
