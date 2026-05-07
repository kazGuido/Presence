from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import get_current_company
from app.models import Company, WorkSite
from app.schemas import WorkSiteCreate, WorkSiteOut

router = APIRouter(prefix="/work-sites", tags=["work-sites"])


@router.get("", response_model=list[WorkSiteOut])
def list_sites(
    company: Annotated[Company, Depends(get_current_company)],
    db: Session = Depends(get_db),
) -> list[WorkSite]:
    return db.query(WorkSite).filter(WorkSite.company_id == company.id).order_by(WorkSite.name).all()


@router.post("", response_model=WorkSiteOut, status_code=status.HTTP_201_CREATED)
def create_site(
    body: WorkSiteCreate,
    company: Annotated[Company, Depends(get_current_company)],
    db: Session = Depends(get_db),
) -> WorkSite:
    site = WorkSite(
        company_id=company.id,
        name=body.name.strip(),
        lat=body.lat,
        lng=body.lng,
        radius_m=body.radius_m,
        static_map_image_url=body.static_map_image_url,
    )
    db.add(site)
    db.commit()
    db.refresh(site)
    return site


@router.get("/{site_id}", response_model=WorkSiteOut)
def get_site(
    site_id: str,
    company: Annotated[Company, Depends(get_current_company)],
    db: Session = Depends(get_db),
) -> WorkSite:
    site = db.get(WorkSite, site_id)
    if not site or site.company_id != company.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Site not found")
    return site


@router.delete("/{site_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_site(
    site_id: str,
    company: Annotated[Company, Depends(get_current_company)],
    db: Session = Depends(get_db),
) -> None:
    site = db.get(WorkSite, site_id)
    if not site or site.company_id != company.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Site not found")
    db.delete(site)
    db.commit()
