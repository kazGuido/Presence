import csv
import io
from datetime import date, datetime, time, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import get_current_company
from app.models import Company, Employee, Punch, WorkSite
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


@router.get("/punches/export")
def punches_export_csv(
    company: Annotated[Company, Depends(get_current_company)],
    db: Session = Depends(get_db),
    date_from: date = Query(..., alias="from"),
    date_to: date = Query(..., alias="to"),
) -> Response:
    start = datetime.combine(date_from, time.min, tzinfo=timezone.utc)
    end = datetime.combine(date_to, time.max, tzinfo=timezone.utc)
    rows = (
        db.query(Punch, Employee, WorkSite)
        .join(Employee, Employee.id == Punch.employee_id)
        .outerjoin(WorkSite, WorkSite.id == Punch.work_site_id)
        .filter(Punch.company_id == company.id, Punch.at >= start, Punch.at <= end)
        .order_by(Punch.at.asc())
        .all()
    )

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(
        [
            "punch_id",
            "employee_id",
            "employee_name",
            "at",
            "kind",
            "source",
            "work_site_id",
            "work_site_name",
            "lat",
            "lng",
            "distance_m",
            "within_geofence",
            "geofence_review_status",
            "geofence_reviewed_by",
            "geofence_reviewed_at",
            "photo_only_attestation",
            "has_photo",
        ]
    )
    for punch, employee, site in rows:
        w.writerow(
            [
                punch.id,
                employee.id,
                employee.display_name,
                punch.at.isoformat(),
                punch.kind.value,
                punch.source.value,
                punch.work_site_id or "",
                site.name if site else "",
                punch.lat,
                punch.lng,
                punch.distance_m if punch.distance_m is not None else "",
                str(bool(punch.within_geofence)).lower(),
                punch.geofence_review_status.value if punch.geofence_review_status else "",
                punch.geofence_reviewed_by or "",
                punch.geofence_reviewed_at.isoformat() if punch.geofence_reviewed_at else "",
                str(bool(punch.photo_only_attestation)).lower(),
                str(bool(punch.photo_path)).lower(),
            ]
        )
    return Response(
        buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="presence-punches.csv"'},
    )
