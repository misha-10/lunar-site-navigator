"""Ephemeris calculation service computing Sun and Earth geometry for lunar observers."""

from dataclasses import dataclass, field
import logging
from typing import List, Optional

from app.services.coordinate_service import CoordinateService, get_coordinate_service
from app.services.spice_service import SpiceService, get_spice_service

logger = logging.getLogger(__name__)


@dataclass
class BodyGeometry:
    """Calculated position and geometric horizon status for a celestial body."""

    azimuth_deg: Optional[float] = None
    elevation_deg: Optional[float] = None
    geometric_above_horizon: Optional[bool] = None
    terrain_visible: Optional[bool] = None
    status: str = "unavailable"
    reason: Optional[str] = None


@dataclass
class EphemerisResult:
    """Result of an ephemeris calculation for a lunar observer."""

    available: bool = False
    reason: Optional[str] = None
    sun: BodyGeometry = field(default_factory=BodyGeometry)
    earth: BodyGeometry = field(default_factory=BodyGeometry)
    reference_frame: Optional[str] = None
    time_scale: str = "UTC"
    sources: List[str] = field(default_factory=list)
    limitations: List[str] = field(default_factory=list)


class EphemerisService:
    """Computes observer-relative Sun and Earth vectors using NASA/JPL SPICE and transforms to local ENU."""

    def __init__(
        self,
        spice_service: Optional[SpiceService] = None,
        coordinate_service: Optional[CoordinateService] = None,
    ):
        self.spice_service = spice_service or get_spice_service()
        self.coordinate_service = coordinate_service or get_coordinate_service()

    def calculate_observer_ephemeris(
        self,
        latitude_deg: float,
        longitude_deg: float,
        datetime_utc_iso: str,
        altitude_m: float = 0.0,
        abcorr: str = "NONE",
    ) -> EphemerisResult:
        """Calculate geometric Sun and Earth azimuth, elevation, and geometric visibility relative to a surface observer.

        Parameters:
            latitude_deg: Observer lunar latitude in degrees [-90, +90], negative south.
            longitude_deg: Observer lunar east-positive longitude in degrees [-180, +180].
            datetime_utc_iso: Target instant formatted as ISO 8601 UTC string.
            altitude_m: Observer height above local reference surface in meters.
            abcorr: SPICE aberration correction flag. Default is 'NONE' (pure geometric positions).
                    Topocentric light-time and stellar aberration for surface observers are not
                    claimed without an explicit observer ephemeris object.
        """
        # Check if required kernels are loaded
        if not self.spice_service.is_ready():
            missing = self.spice_service.get_missing_kernels()
            missing_msg = ", ".join(missing) if missing else "Required kernels not loaded"
            reason = f"SPICE kernels missing: {missing_msg}. Place required kernels in '{self.spice_service.kernel_dir}'."
            return EphemerisResult(
                available=False,
                reason=reason,
                sun=BodyGeometry(status="unavailable", reason=reason),
                earth=BodyGeometry(status="unavailable", reason=reason),
                limitations=[
                    f"Ephemeris calculation unavailable: {reason}",
                    "Terrain visibility has not been evaluated.",
                ],
            )

        try:
            # 1. Convert UTC timestamp to Ephemeris Time (TDB)
            et = self.spice_service.utc_to_et(datetime_utc_iso)

            # 2. Determine active lunar body-fixed frame (e.g. MOON_ME or IAU_MOON)
            frame = self.spice_service.determine_lunar_frame(et)

            # 3. Compute observer Cartesian position in lunar body-fixed frame (km)
            r_obs_bf = self.coordinate_service.lunar_lat_lon_to_cartesian(
                latitude_deg, longitude_deg, altitude_m=altitude_m
            )

            # 4. Compute Sun position relative to Moon body center in body-fixed frame (km)
            # Using 'NONE' ensures true geometric vectors are subtracted
            r_sun_bf, _ = self.spice_service.get_body_position_wrt_moon("SUN", et, frame, abcorr=abcorr)
            # Geometric observer-relative Sun vector: r_Sun/obs = r_Sun/Moon - r_obs/Moon
            r_sun_obs_bf = r_sun_bf - r_obs_bf

            # 5. Compute Earth position relative to Moon body center in body-fixed frame (km)
            r_earth_bf, _ = self.spice_service.get_body_position_wrt_moon("EARTH", et, frame, abcorr=abcorr)
            # Geometric observer-relative Earth vector: r_Earth/obs = r_Earth/Moon - r_obs/Moon
            r_earth_obs_bf = r_earth_bf - r_obs_bf

            # 6. Transform observer-relative vectors to local East-North-Up (ENU) coordinates
            r_sun_enu = self.coordinate_service.body_fixed_to_enu(r_sun_obs_bf, latitude_deg, longitude_deg)
            r_earth_enu = self.coordinate_service.body_fixed_to_enu(r_earth_obs_bf, latitude_deg, longitude_deg)

            # 7. Convert ENU direction vectors to local azimuth and elevation
            sun_az, sun_el = self.coordinate_service.vector_to_azimuth_elevation(r_sun_enu)
            earth_az, earth_el = self.coordinate_service.vector_to_azimuth_elevation(r_earth_enu)

            # 8. Evaluate geometric horizon status (elevation > 0)
            sun_geom = self.coordinate_service.is_above_geometric_horizon(sun_el)
            earth_geom = self.coordinate_service.is_above_geometric_horizon(earth_el)

            loaded_kernels = self.spice_service.get_loaded_kernels()

            frame_note = (
                "Reference frame: MOON_ME (Lunar Mean Earth / Polar Axis high-precision frame aligned with LOLA/LRO standards)."
                if frame == "MOON_ME"
                else "Reference frame: IAU_MOON (analytical low-order approximation; sub-kilometer precision limitations apply)."
            )

            abcorr_note = (
                "Pure geometric positions evaluated (aberration correction 'NONE')."
                if abcorr == "NONE"
                else f"Aberration correction '{abcorr}' applied."
            )

            return EphemerisResult(
                available=True,
                sun=BodyGeometry(
                    azimuth_deg=round(sun_az, 4),
                    elevation_deg=round(sun_el, 4),
                    geometric_above_horizon=sun_geom,
                    terrain_visible=None,
                    status="calculated",
                    reason=None,
                ),
                earth=BodyGeometry(
                    azimuth_deg=round(earth_az, 4),
                    elevation_deg=round(earth_el, 4),
                    geometric_above_horizon=earth_geom,
                    terrain_visible=None,
                    status="calculated",
                    reason=None,
                ),
                reference_frame=frame,
                time_scale="UTC converted to ET/TDB via SPICE LSK",
                sources=loaded_kernels,
                limitations=[
                    frame_note,
                    abcorr_note,
                    "Geometric positions evaluated; topocentric light-time and stellar aberration are not modeled.",
                    "Geometric horizon status only (elevation > 0°); local terrain obstruction is not evaluated.",
                    "Observer local tangent plane computed on standard IAU reference sphere (R=1737.4 km).",
                ],
            )

        except Exception as exc:
            logger.error("Ephemeris calculation failed: %s", exc, exc_info=True)
            reason = f"Ephemeris calculation error: {exc}"
            return EphemerisResult(
                available=False,
                reason=reason,
                sun=BodyGeometry(status="unavailable", reason=reason),
                earth=BodyGeometry(status="unavailable", reason=reason),
                limitations=[
                    reason,
                    "Terrain visibility has not been evaluated.",
                ],
            )


_ephemeris_service_instance: Optional[EphemerisService] = None


def get_ephemeris_service() -> EphemerisService:
    """Singleton getter for EphemerisService."""
    global _ephemeris_service_instance
    if _ephemeris_service_instance is None:
        _ephemeris_service_instance = EphemerisService()
    return _ephemeris_service_instance
