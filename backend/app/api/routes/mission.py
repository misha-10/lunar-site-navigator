"""Mission calculation endpoints."""

from fastapi import APIRouter, Depends, status

from app.api.dependencies import (
    get_comparison_service,
    get_mission_service,
    get_timeline_service,
)
from app.schemas.comparison import ComparisonRequest, ComparisonResponse
from app.schemas.mission import MissionCalculateRequest, MissionCalculateResponse
from app.schemas.timeline import TimelineRequest, TimelineResponse
from app.services.comparison_service import ComparisonService
from app.services.mission_service import MissionService
from app.services.timeline_service import TimelineService

router = APIRouter(prefix="/mission", tags=["Mission"])


@router.post(
    "/calculate",
    response_model=MissionCalculateResponse,
    status_code=status.HTTP_200_OK,
    summary="Calculate Sun and Earth positions for a single timestamp",
    description=(
        "Calculate Sun and Earth local azimuth, elevation, and geometric visibility "
        "at a candidate landing site or custom lunar coordinates for a specific UTC instant."
    ),
)
def calculate_mission_timestamp(
    request: MissionCalculateRequest,
    mission_service: MissionService = Depends(get_mission_service),
) -> MissionCalculateResponse:
    """Evaluate Sun and Earth position and visibility for a given site/coordinate and UTC timestamp."""
    return mission_service.calculate_timestamp(request)


@router.post(
    "/timeline",
    response_model=TimelineResponse,
    status_code=status.HTTP_200_OK,
    summary="Calculate mission timeline and geometric visibility windows",
    description=(
        "Calculate Sun and Earth local azimuth and elevation across a bounded time interval "
        "and derive continuous geometric visibility windows."
    ),
)
def calculate_mission_timeline(
    request: TimelineRequest,
    timeline_service: TimelineService = Depends(get_timeline_service),
) -> TimelineResponse:
    """Generate time-series ephemeris samples and derive visibility windows for a mission interval."""
    return timeline_service.calculate_timeline(request)


@router.post(
    "/compare",
    response_model=ComparisonResponse,
    status_code=status.HTTP_200_OK,
    summary="Compare 2-4 candidate landing site scenarios over a shared timeline",
    description=(
        "Evaluate Sun and Earth geometric visibility and elevation statistics across "
        "2 to 4 lunar landing site scenarios over a shared UTC time range."
    ),
)
def compare_mission_scenarios(
    request: ComparisonRequest,
    comparison_service: ComparisonService = Depends(get_comparison_service),
) -> ComparisonResponse:
    """Evaluate and compare multiple lunar landing site scenarios over a common evaluation grid."""
    return comparison_service.compare_scenarios(request)

