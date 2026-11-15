from fastapi import APIRouter, Depends

from app.api.dependencies import get_site_service
from app.schemas.site import SiteListResponse
from app.services.site_service import SiteService

router = APIRouter(tags=["Sites"])


@router.get(
    "/sites",
    response_model=SiteListResponse,
    summary="List candidate landing sites",
    description="Retrieve curated candidate lunar landing sites with coordinate conventions, status, and provenance.",
)
def list_sites(site_service: SiteService = Depends(get_site_service)) -> SiteListResponse:
    """Return the curated list of lunar candidate landing sites and coordinate metadata."""
    return site_service.get_catalogue()
