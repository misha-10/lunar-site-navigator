from fastapi import APIRouter, Depends
from app.api.dependencies import get_settings
from app.config import Settings
from app.schemas.health import HealthResponse

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check",
    description="Check backend operational status and service information.",
)
def get_health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    """Return backend service status, name, and version."""
    return HealthResponse(
        status="ok",
        service=settings.SERVICE_NAME,
        version=settings.VERSION,
    )
