"""Schemas for mission timeline requests, time-series samples, and visibility windows."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.mission import CelestialBodyStatus
from app.utils.validation import validate_lunar_coordinates

MAX_TIMELINE_DAYS = 7
MAX_TIMELINE_SECONDS = MAX_TIMELINE_DAYS * 86400
MIN_STEP_MINUTES = 15
MAX_STEP_MINUTES = 360
MAX_SAMPLE_LIMIT = 700


class TimelineRequest(BaseModel):
    """Request payload for POST /mission/timeline."""

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
    start_datetime_utc: datetime = Field(
        ...,
        description="Start instant of the evaluation interval in ISO 8601 UTC format",
        examples=["2027-01-15T00:00:00Z"],
    )
    end_datetime_utc: datetime = Field(
        ...,
        description="End instant of the evaluation interval in ISO 8601 UTC format (maximum 7 days after start)",
        examples=["2027-01-18T00:00:00Z"],
    )
    step_minutes: int = Field(
        default=30,
        ge=MIN_STEP_MINUTES,
        le=MAX_STEP_MINUTES,
        description=f"Sampling interval in minutes (between {MIN_STEP_MINUTES} and {MAX_STEP_MINUTES})",
        examples=[30],
    )
    observer_altitude_m: Optional[float] = Field(
        default=0.0,
        ge=0.0,
        description="Observer height above local surface in meters (default 0.0)",
        examples=[0.0],
    )

    @field_validator("start_datetime_utc", "end_datetime_utc", mode="before")
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
                    "Timestamp must be timezone-aware (e.g. '2027-01-15T00:00:00Z' or with a UTC offset). Naive timestamps are rejected."
                )
            return dt.astimezone(timezone.utc)
        elif isinstance(v, datetime):
            if v.tzinfo is None or v.tzinfo.utcoffset(v) is None:
                raise ValueError(
                    "Timestamp must be timezone-aware. Naive timestamps are rejected."
                )
            return v.astimezone(timezone.utc)
        raise ValueError("Timestamp must be a valid ISO 8601 string or datetime object.")

    @model_validator(mode="after")
    def validate_timeline_constraints(self) -> "TimelineRequest":
        """Validate site/coordinates, time range duration, ordering, step, and sample limits."""
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
            lat, lon = validate_lunar_coordinates(self.latitude_deg, self.longitude_deg)
            self.latitude_deg = lat
            self.longitude_deg = lon

        # Verify time ordering
        if self.end_datetime_utc <= self.start_datetime_utc:
            raise ValueError(
                f"'end_datetime_utc' ({self.end_datetime_utc.isoformat()}) must be strictly after "
                f"'start_datetime_utc' ({self.start_datetime_utc.isoformat()})."
            )

        diff_seconds = (self.end_datetime_utc - self.start_datetime_utc).total_seconds()

        # Verify sample count limit
        max_estimated_samples = int(diff_seconds / (self.step_minutes * 60)) + 2
        if max_estimated_samples > MAX_SAMPLE_LIMIT:
            raise ValueError(
                f"Requested interval and step_minutes would generate ~{max_estimated_samples} samples, "
                f"which exceeds the maximum allowed limit of {MAX_SAMPLE_LIMIT} samples."
            )

        # Verify maximum range of 7 days
        if diff_seconds > MAX_TIMELINE_SECONDS:
            raise ValueError(
                f"Requested timeline interval exceeds maximum limit of {MAX_TIMELINE_DAYS} days "
                f"({diff_seconds / 86400:.2f} days requested)."
            )

        return self


class TimelineScenarioResponse(BaseModel):
    """Parameters of the evaluated timeline scenario."""

    site_id: Optional[str] = Field(
        default=None,
        description="Candidate landing site identifier, or null if custom coordinates",
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
    start_datetime_utc: str = Field(
        ...,
        description="Start timestamp of the evaluated timeline in ISO 8601 UTC format",
        examples=["2027-01-15T00:00:00Z"],
    )
    end_datetime_utc: str = Field(
        ...,
        description="End timestamp of the evaluated timeline in ISO 8601 UTC format",
        examples=["2027-01-18T00:00:00Z"],
    )
    step_minutes: int = Field(
        ...,
        description="Sampling interval in minutes used for time-series generation",
        examples=[30],
    )


class TimelineSample(BaseModel):
    """Single discrete point in time along the evaluated timeline."""

    datetime_utc: str = Field(
        ...,
        description="Timestamp of the sample in ISO 8601 UTC format",
        examples=["2027-01-15T00:00:00Z"],
    )
    sun: CelestialBodyStatus = Field(
        ...,
        description="Sun position, geometric visibility, and calculation status",
    )
    earth: CelestialBodyStatus = Field(
        ...,
        description="Earth position, geometric visibility, and calculation status",
    )


class VisibilityWindow(BaseModel):
    """Derived continuous visibility interval above the geometric horizon."""

    start_datetime_utc: str = Field(
        ...,
        description="Start instant of visibility window in ISO 8601 UTC format",
        examples=["2027-01-15T02:00:00Z"],
    )
    end_datetime_utc: str = Field(
        ...,
        description="End instant of visibility window in ISO 8601 UTC format",
        examples=["2027-01-15T10:30:00Z"],
    )
    duration_hours: float = Field(
        ...,
        description="Duration of the window in hours based on sample timestamps",
        examples=[8.5],
    )
    start_boundary_estimated: bool = Field(
        ...,
        description="True if window start transition occurred between samples",
    )
    end_boundary_estimated: bool = Field(
        ...,
        description="True if window end transition occurred between samples",
    )
    start_boundary_reason: Literal["horizon_transition", "range_boundary", "data_gap"] = Field(
        ...,
        description="Reason for start boundary: 'horizon_transition', 'range_boundary', or 'data_gap'",
        examples=["horizon_transition"],
    )
    end_boundary_reason: Literal["horizon_transition", "range_boundary", "data_gap"] = Field(
        ...,
        description="Reason for end boundary: 'horizon_transition', 'range_boundary', or 'data_gap'",
        examples=["horizon_transition"],
    )
    truncated_at_start: bool = Field(
        default=False,
        description="True if window was already active at start of requested timeline range",
    )
    truncated_at_end: bool = Field(
        default=False,
        description="True if window remained active at end of requested timeline range",
    )
    visibility_type: str = Field(
        default="geometric",
        description="Visibility definition: 'geometric' (elevation > 0°) or 'terrain'",
    )
    status: str = Field(
        default="estimated_from_samples",
        description="Calculation status indicator",
    )


class TimelineMetadata(BaseModel):
    """Scientific data provenance, reference frame, and timeline evaluation metadata."""

    data_mode: str = Field(
        default="unavailable",
        description="Calculation mode: 'real_ephemeris' or 'unavailable'",
    )
    sources: List[str] = Field(
        default_factory=list,
        description="Loaded SPICE kernels or data sources utilized",
    )
    reference_frame: Optional[str] = Field(
        default=None,
        description="Astronomical reference frame used for calculation",
    )
    time_scale: str = Field(
        default="UTC",
        description="Time scale specification",
    )
    step_minutes: int = Field(
        ...,
        description="Sampling interval in minutes",
    )
    sample_count: int = Field(
        ...,
        description="Total number of evaluated timeline samples",
    )
    calculated_at_utc: str = Field(
        ...,
        description="Calculation generation timestamp in ISO 8601 UTC",
    )
    terrain_evaluated: bool = Field(
        default=False,
        description="Whether terrain-aware visibility was evaluated",
    )
    limitations: List[str] = Field(
        default_factory=list,
        description="Operational caveats, sampling resolution limitations, and assumptions",
    )


class TimelineResponse(BaseModel):
    """Top-level response payload for POST /mission/timeline."""

    scenario: TimelineScenarioResponse
    samples: List[TimelineSample]
    sun_visibility_windows: List[VisibilityWindow]
    earth_visibility_windows: List[VisibilityWindow]
    windows: Optional[Dict[str, List[VisibilityWindow]]] = Field(
        default=None,
        description="Categorized visibility windows (sunlight, earth_geometric_visibility)",
    )
    metadata: TimelineMetadata
