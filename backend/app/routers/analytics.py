import csv
import io
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
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


@router.get("/attendance/export")
def attendance_export_csv(
    company: Annotated[Company, Depends(get_current_company)],
    db: Session = Depends(get_db),
    date_from: date = Query(..., alias="from"),
    date_to: date = Query(..., alias="to"),
) -> Response:
    data = build_attendance_analytics(db, company.id, company.timezone, date_from, date_to)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(
        [
            "employee_id",
            "employee_name",
            "date",
            "first_punch_in_at",
            "last_punch_out_at",
            "expected_start",
            "expected_end",
            "flags",
        ]
    )
    for block in data["per_employee"]:
        emp = block["employee"]
        for day in block["days"]:
            w.writerow(
                [
                    emp["id"],
                    emp["name"],
                    day["date"],
                    day.get("first_punch_in_at") or "",
                    day.get("last_punch_out_at") or "",
                    day.get("expected_start") or "",
                    day.get("expected_end") or "",
                    ";".join(day.get("flags") or []),
                ]
            )
    return Response(
        buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="presence-attendance.csv"'},
    )
