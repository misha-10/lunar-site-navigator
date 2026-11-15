"""Schemas for mission calculations, celestial body status, and metadata."""

from datetime import datetime, timezone
from typing import Any, List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator

from app.utils.validation import validate_lunar_coordinates


class MissionCalculateRequest(BaseModel):
    """Request payload for calculating Sun and Earth positions at a single timestamp."""

    site_id: Optional[str] = Field(
        default=None,
        description="Known candidate site ID from the catalogue (e.g. 'shackleton_region')",
        examples=["shackleton_region"],
    )
    latitude_deg: Optional[float] = Field(
        default=None,
        description="Target lunar latitude in degrees [-90.0, 90.0], negative South",
        examples=[-89.9],
    )
    longitude_deg: Optional[float] = Field(
        default=None,
        description="Target lunar longitude in degrees [-180.0, 180.0], East-positive",
        examples=[0.0],
    )
    datetime_utc: datetime = Field(
        ...,
        description="Target calculation instant in ISO 8601 format with explicit timezone (e.g. '2027-01-15T12:00:00Z')",
        examples=["2027-01-15T12:00:00Z"],
    )
    observer_altitude_m: Optional[float] = Field(
        default=0.0,
        ge=0.0,
        description="Observer altitude above local surface in meters (default 0)",
        examples=[0.0],
    )

    @field_validator("datetime_utc", mode="before")
    @classmethod
    def validate_timezone_aware(cls, v: Any) -> datetime:
        """Enforce timezone awareness and normalize to UTC."""
        if isinstance(v, str):
            try:
                dt = datetime.fromisoformat(v)
            except Exception as e:
                raise ValueError(f"Invalid ISO 8601 datetime format: {e}")
            if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
                raise ValueError(
                    "Timestamp must be timezone-aware (e.g. '2027-01-15T12:00:00Z' or with a UTC offset). Naive timestamps are rejected."
                )
            return dt.astimezone(timezone.utc)
        elif isinstance(v, datetime):
            if v.tzinfo is None or v.tzinfo.utcoffset(v) is None:
                raise ValueError(
                    "Timestamp must be timezone-aware. Naive timestamps are rejected."
                )
            return v.astimezone(timezone.utc)
        raise ValueError("datetime_utc must be a valid ISO 8601 string or datetime object.")

    @model_validator(mode="after")
    def validate_site_or_coordinates(self) -> "MissionCalculateRequest":
        """Validate that either a site_id or complete custom coordinates (lat and lon) are supplied."""
        has_site = self.site_id is not None and bool(self.site_id.strip())
        has_lat = self.latitude_deg is not None
        has_lon = self.longitude_deg is not None

        if not has_site and not has_lat and not has_lon:
            raise ValueError(
                "Either 'site_id' or both 'latitude_deg' and 'longitude_deg' must be provided."
            )

        if (has_lat and not has_lon) or (has_lon and not has_lat):
            raise ValueError(
                "Both 'latitude_deg' and 'longitude_deg' must be provided for custom coordinates."
            )

        if has_lat and has_lon:
            # Validate coordinates ranges and normalize longitude if needed
            lat, lon = validate_lunar_coordinates(self.latitude_deg, self.longitude_deg)
            self.latitude_deg = lat
            self.longitude_deg = lon

        return self


class ScenarioResponse(BaseModel):
    """Evaluated mission scenario parameters."""

    site_id: Optional[str] = Field(
        default=None,
        description="Candidate site identifier from catalogue, or null if custom coordinates",
        examples=["shackleton_region"],
    )
    latitude_deg: float = Field(
        ...,
        description="Target lunar latitude in degrees [-90.0, 90.0], negative South",
        examples=[-89.9],
    )
    longitude_deg: float = Field(
        ...,
        description="Target lunar longitude in degrees [-180.0, 180.0], East-positive",
        examples=[0.0],
    )
    datetime_utc: str = Field(
        ...,
        description="Target calculation instant formatted as ISO 8601 UTC string",
        examples=["2027-01-15T12:00:00Z"],
    )


class CelestialBodyStatus(BaseModel):
    """Position, geometric visibility, and terrain visibility for a celestial body (Sun or Earth)."""

    azimuth_deg: Optional[float] = Field(
        default=None,
        description="Local azimuth in degrees clockwise from local north [0, 360)",
    )
    elevation_deg: Optional[float] = Field(
        default=None,
        description="Local elevation in degrees relative to the geometric horizontal plane",
    )
    geometric_above_horizon: Optional[bool] = Field(
        default=None,
        description="True if celestial body is geometrically above the local tangent horizon",
    )
    terrain_visible: Optional[bool] = Field(
        default=None,
        description="True if celestial body is visible above local terrain topography",
    )
    status: str = Field(
        default="unavailable",
        description="Calculation status: 'unavailable', 'calculated', or 'approximate'",
    )
    reason: Optional[str] = Field(
        default=None,
        description="Scientific reason explaining why a calculation or terrain visibility is unavailable",
    )


class MissionMetadata(BaseModel):
    """Scientific data provenance, reference frame, and calculation limitations."""

    data_mode: str = Field(
        default="unavailable",
        description="Data mode: 'unavailable', 'real_ephemeris', or 'simplified'",
    )
    sources: List[str] = Field(
        default_factory=list,
        description="List of authoritative ephemeris/kernel data sources used",
    )
    reference_frame: Optional[str] = Field(
        default=None,
        description="Astronomical reference frame (e.g. 'MOON_ME' / 'MOON_PA')",
    )
    time_scale: str = Field(
        default="UTC",
        description="Time scale used for the evaluation",
    )
    calculated_at_utc: str = Field(
        ...,
        description="Timestamp when calculation was performed (ISO 8601 UTC)",
    )
    limitations: List[str] = Field(
        default_factory=list,
        description="Known operational and scientific limitations of the returned data",
    )


class MissionCalculateResponse(BaseModel):
    """Top-level response payload for POST /mission/calculate."""

    scenario: ScenarioResponse
    sun: CelestialBodyStatus
    earth: CelestialBodyStatus
    metadata: MissionMetadata
