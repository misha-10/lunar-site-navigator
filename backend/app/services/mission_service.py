"""Mission calculation service orchestrating site lookup, ephemeris calculations, and response generation."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException

from app.schemas.mission import (
    CelestialBodyStatus,
    MissionCalculateRequest,
    MissionCalculateResponse,
    MissionMetadata,
    ScenarioResponse,
)
from app.services.ephemeris_service import EphemerisService, get_ephemeris_service
from app.services.site_service import SiteService, get_site_service


class MissionService:
    """Service handling mission calculations and ephemeris orchestration."""

    def __init__(
        self,
        site_service: Optional[SiteService] = None,
        ephemeris_service: Optional[EphemerisService] = None,
    ):
        self.site_service = site_service or get_site_service()
        self.ephemeris_service = ephemeris_service or get_ephemeris_service()

    def calculate_timestamp(self, request: MissionCalculateRequest) -> MissionCalculateResponse:
        """Evaluate celestial body geometry for a single mission timestamp.

        If required SPICE ephemeris kernels are loaded, returns real calculated azimuth,
        elevation, and geometric horizon status.
        If kernels are unavailable, returns explicit null scientific values with informative reasons.
        """
        # Resolve target coordinates: site_id lookup vs custom coordinates
        resolved_site_id: Optional[str] = None
        if request.site_id:
            site = self.site_service.get_site_by_id(request.site_id)
            if not site:
                raise HTTPException(
                    status_code=404,
                    detail=f"Site '{request.site_id}' not found in catalogue.",
                )
            resolved_site_id = site.id
            resolved_lat = site.latitude_deg
            resolved_lon = site.longitude_deg
        else:
            resolved_site_id = None
            resolved_lat = request.latitude_deg  # type: ignore[assignment]
            resolved_lon = request.longitude_deg  # type: ignore[assignment]

        # Format normalized UTC timestamp
        datetime_utc_str = request.datetime_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
        now_utc_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        altitude_m = float(request.observer_altitude_m or 0.0)

        # Execute SPICE ephemeris evaluation
        ephem_result = self.ephemeris_service.calculate_observer_ephemeris(
            latitude_deg=resolved_lat,
            longitude_deg=resolved_lon,
            datetime_utc_iso=datetime_utc_str,
            altitude_m=altitude_m,
        )

        if ephem_result.available:
            sun_status = CelestialBodyStatus(
                azimuth_deg=ephem_result.sun.azimuth_deg,
                elevation_deg=ephem_result.sun.elevation_deg,
                geometric_above_horizon=ephem_result.sun.geometric_above_horizon,
                terrain_visible=None,
                status="calculated",
                reason=None,
            )
            earth_status = CelestialBodyStatus(
                azimuth_deg=ephem_result.earth.azimuth_deg,
                elevation_deg=ephem_result.earth.elevation_deg,
                geometric_above_horizon=ephem_result.earth.geometric_above_horizon,
                terrain_visible=None,
                status="calculated",
                reason=None,
            )
            metadata = MissionMetadata(
                data_mode="real_ephemeris",
                sources=ephem_result.sources,
                reference_frame=ephem_result.reference_frame,
                time_scale=ephem_result.time_scale,
                calculated_at_utc=now_utc_str,
                limitations=ephem_result.limitations,
            )
        else:
            sun_status = CelestialBodyStatus(
                azimuth_deg=None,
                elevation_deg=None,
                geometric_above_horizon=None,
                terrain_visible=None,
                status="unavailable",
                reason=ephem_result.sun.reason,
            )
            earth_status = CelestialBodyStatus(
                azimuth_deg=None,
                elevation_deg=None,
                geometric_above_horizon=None,
                terrain_visible=None,
                status="unavailable",
                reason=ephem_result.earth.reason,
            )
            metadata = MissionMetadata(
                data_mode="unavailable",
                sources=ephem_result.sources,
                reference_frame=None,
                time_scale="UTC",
                calculated_at_utc=now_utc_str,
                limitations=ephem_result.limitations,
            )

        return MissionCalculateResponse(
            scenario=ScenarioResponse(
                site_id=resolved_site_id,
                latitude_deg=resolved_lat,
                longitude_deg=resolved_lon,
                datetime_utc=datetime_utc_str,
            ),
            sun=sun_status,
            earth=earth_status,
            metadata=metadata,
        )


_mission_service_instance: Optional[MissionService] = None


def get_mission_service() -> MissionService:
    """Singleton getter for MissionService."""
    global _mission_service_instance
    if _mission_service_instance is None:
        _mission_service_instance = MissionService()
    return _mission_service_instance
