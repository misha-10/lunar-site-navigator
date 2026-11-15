"""Timeline calculation service for time-series ephemeris generation and visibility window derivation."""

from datetime import datetime, timedelta, timezone
import logging
from typing import List, Optional

from fastapi import HTTPException

from app.schemas.mission import CelestialBodyStatus
from app.schemas.timeline import (
    TimelineMetadata,
    TimelineRequest,
    TimelineResponse,
    TimelineSample,
    TimelineScenarioResponse,
)
from app.services.ephemeris_service import EphemerisService, get_ephemeris_service
from app.services.site_service import SiteService, get_site_service
from app.services.visibility_service import VisibilityService, get_visibility_service

logger = logging.getLogger(__name__)


class TimelineService:
    """Orchestrates time-series ephemeris evaluations and visibility window derivations."""

    def __init__(
        self,
        site_service: Optional[SiteService] = None,
        ephemeris_service: Optional[EphemerisService] = None,
        visibility_service: Optional[VisibilityService] = None,
    ):
        self.site_service = site_service or get_site_service()
        self.ephemeris_service = ephemeris_service or get_ephemeris_service()
        self.visibility_service = visibility_service or get_visibility_service()

    def generate_timestamps(
        self,
        start_dt: datetime,
        end_dt: datetime,
        step_minutes: int,
    ) -> List[datetime]:
        """Generate grid of UTC timestamps from start to end with step_minutes interval.

        When end_datetime_utc falls exactly on a step boundary, both endpoints are on-grid.
        When end_datetime_utc does not fall on a step boundary, it is appended as the terminal sample.
        """
        timestamps: List[datetime] = []
        step = timedelta(minutes=step_minutes)
        curr = start_dt

        while curr <= end_dt:
            timestamps.append(curr)
            curr += step

        if timestamps and timestamps[-1] < end_dt:
            timestamps.append(end_dt)

        return timestamps

    def calculate_timeline(self, request: TimelineRequest) -> TimelineResponse:
        """Calculate Sun and Earth geometry time-series and derive geometric visibility windows."""
        # 1. Resolve candidate landing site or custom coordinates
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

        alt_m = float(request.observer_altitude_m or 0.0)

        # 2. Generate timestamps
        timestamps = self.generate_timestamps(
            request.start_datetime_utc,
            request.end_datetime_utc,
            request.step_minutes,
        )

        samples: List[TimelineSample] = []
        data_sources: List[str] = []
        active_reference_frame: Optional[str] = None
        time_scale: str = "UTC"
        any_success = False

        # 3. Calculate ephemeris for each sample reusing loaded SPICE kernel pool
        for dt in timestamps:
            dt_str = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            ephem = self.ephemeris_service.calculate_observer_ephemeris(
                latitude_deg=resolved_lat,
                longitude_deg=resolved_lon,
                datetime_utc_iso=dt_str,
                altitude_m=alt_m,
            )

            if ephem.available:
                any_success = True
                if not data_sources:
                    data_sources = ephem.sources
                    active_reference_frame = ephem.reference_frame
                    time_scale = ephem.time_scale

                sun_status = CelestialBodyStatus(
                    azimuth_deg=ephem.sun.azimuth_deg,
                    elevation_deg=ephem.sun.elevation_deg,
                    geometric_above_horizon=ephem.sun.geometric_above_horizon,
                    terrain_visible=None,
                    status="calculated",
                    reason=None,
                )
                earth_status = CelestialBodyStatus(
                    azimuth_deg=ephem.earth.azimuth_deg,
                    elevation_deg=ephem.earth.elevation_deg,
                    geometric_above_horizon=ephem.earth.geometric_above_horizon,
                    terrain_visible=None,
                    status="calculated",
                    reason=None,
                )
            else:
                sun_status = CelestialBodyStatus(
                    azimuth_deg=None,
                    elevation_deg=None,
                    geometric_above_horizon=None,
                    terrain_visible=None,
                    status="unavailable",
                    reason=ephem.sun.reason,
                )
                earth_status = CelestialBodyStatus(
                    azimuth_deg=None,
                    elevation_deg=None,
                    geometric_above_horizon=None,
                    terrain_visible=None,
                    status="unavailable",
                    reason=ephem.earth.reason,
                )

            samples.append(
                TimelineSample(
                    datetime_utc=dt_str,
                    sun=sun_status,
                    earth=earth_status,
                )
            )

        # 4. Derive visibility windows
        sun_windows = self.visibility_service.derive_windows(samples, body="sun")
        earth_windows = self.visibility_service.derive_windows(samples, body="earth")

        now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        data_mode = "real_ephemeris" if any_success else "unavailable"

        limitations = [
            f"Evaluated over {len(samples)} discrete samples at {request.step_minutes}-minute step.",
            "Visibility window boundaries between opposite-sign elevation samples are estimated using linear interpolation.",
            "Linear interpolation of horizon crossings is an approximation based on sampled elevations and does not model astronomical topocentric trajectory curvature.",
            "Windows bounded by data gaps represent observed visible intervals only; true window boundaries and duration cannot be determined across unavailable samples.",
            "Geometric horizon status only (elevation > 0°); local terrain obstruction is not evaluated.",
            "Pure geometric positions evaluated (aberration correction 'NONE').",
        ]
        if not any_success:
            limitations.append("Ephemeris kernels unavailable; no visibility windows derived.")

        metadata = TimelineMetadata(
            data_mode=data_mode,
            sources=data_sources,
            reference_frame=active_reference_frame,
            time_scale=time_scale,
            step_minutes=request.step_minutes,
            sample_count=len(samples),
            calculated_at_utc=now_utc,
            terrain_evaluated=False,
            limitations=limitations,
        )

        scenario = TimelineScenarioResponse(
            site_id=resolved_site_id,
            latitude_deg=resolved_lat,
            longitude_deg=resolved_lon,
            start_datetime_utc=request.start_datetime_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
            end_datetime_utc=request.end_datetime_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
            step_minutes=request.step_minutes,
        )

        return TimelineResponse(
            scenario=scenario,
            samples=samples,
            sun_visibility_windows=sun_windows,
            earth_visibility_windows=earth_windows,
            windows={
                "sunlight": sun_windows,
                "earth_geometric_visibility": earth_windows,
                "earth_terrain_visibility": [],
            },
            metadata=metadata,
        )


_timeline_service_instance: Optional[TimelineService] = None


def get_timeline_service() -> TimelineService:
    """Singleton getter for TimelineService."""
    global _timeline_service_instance
    if _timeline_service_instance is None:
        _timeline_service_instance = TimelineService()
    return _timeline_service_instance
