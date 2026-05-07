from typing import Annotated

from fastapi import APIRouter, Depends

from app.deps import get_current_company
from app.models import Company

router = APIRouter(prefix="/employer", tags=["employer"])


@router.get("/company")
def get_my_company(company: Annotated[Company, Depends(get_current_company)]) -> dict[str, str]:
    return {"id": company.id, "slug": company.slug, "name": company.name}
