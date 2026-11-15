"""Schemas for multi-site mission comparison requests, summary metrics, and comparison responses."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.timeline import (
    MAX_SAMPLE_LIMIT,
    MAX_STEP_MINUTES,
    MAX_TIMELINE_DAYS,
    MAX_TIMELINE_SECONDS,
    MIN_STEP_MINUTES,
    TimelineMetadata,
    TimelineSample,
    VisibilityWindow,
)
from app.utils.validation import validate_lunar_coordinates

MIN_SCENARIOS = 2
MAX_SCENARIOS = 4


class ScenarioDefinition(BaseModel):
    """Specification of an individual candidate landing site scenario for comparison."""

    scenario_id: str = Field(
        ...,
        description="Unique identifier for this scenario within the comparison request",
        examples=["shackleton_base"],
    )
    name: Optional[str] = Field(
        default=None,
        description="Optional human-readable label or display name",
        examples=["Shackleton Crater Rim"],
    )
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
    observer_altitude_m: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Observer height above local surface in meters for this scenario (overrides top-level default if set)",
        examples=[0.0],
    )

    @model_validator(mode="after")
    def validate_scenario_coordinates(self) -> "ScenarioDefinition":
        """Validate site_id vs custom coordinates."""
        has_site = self.site_id is not None and bool(self.site_id.strip())
        has_lat = self.latitude_deg is not None
        has_lon = self.longitude_deg is not None

        if not has_site and not has_lat and not has_lon:
            raise ValueError(
                f"Scenario '{self.scenario_id}': Either 'site_id' or both 'latitude_deg' and 'longitude_deg' must be provided."
            )

        if (has_lat and not has_lon) or (has_lon and not has_lat):
            raise ValueError(
                f"Scenario '{self.scenario_id}': Both 'latitude_deg' and 'longitude_deg' must be provided for custom coordinates."
            )

        if has_lat and has_lon:
            lat, lon = validate_lunar_coordinates(self.latitude_deg, self.longitude_deg)
            self.latitude_deg = lat
            self.longitude_deg = lon

        return self


class ComparisonRequest(BaseModel):
    """Request payload for POST /mission/compare."""

    scenarios: List[ScenarioDefinition] = Field(
        ...,
        min_length=MIN_SCENARIOS,
        max_length=MAX_SCENARIOS,
        description=f"List of {MIN_SCENARIOS} to {MAX_SCENARIOS} scenario definitions to compare",
    )
    start_datetime_utc: datetime = Field(
        ...,
        description="Common start instant of the evaluation interval in ISO 8601 UTC format",
        examples=["2027-01-15T00:00:00Z"],
    )
    end_datetime_utc: datetime = Field(
        ...,
        description="Common end instant of the evaluation interval in ISO 8601 UTC format (max 7 days)",
        examples=["2027-01-18T00:00:00Z"],
    )
    step_minutes: int = Field(
        default=30,
        ge=MIN_STEP_MINUTES,
        le=MAX_STEP_MINUTES,
        description=f"Common sampling interval in minutes (between {MIN_STEP_MINUTES} and {MAX_STEP_MINUTES})",
        examples=[30],
    )
    observer_altitude_m: Optional[float] = Field(
        default=0.0,
        ge=0.0,
        description="Default observer height above local surface in meters for scenarios that do not specify one",
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
    def validate_comparison_constraints(self) -> "ComparisonRequest":
        """Validate scenario count, scenario ID uniqueness, and timeline boundaries."""
        # 1. Enforce scenario ID uniqueness
        seen_ids = set()
        duplicates = []
        for s in self.scenarios:
            if s.scenario_id in seen_ids:
                duplicates.append(s.scenario_id)
            seen_ids.add(s.scenario_id)
        if duplicates:
            raise ValueError(
                f"Duplicate scenario IDs detected: {duplicates}. Each scenario must contain a unique 'scenario_id'."
            )

        # 2. Time ordering
        if self.end_datetime_utc <= self.start_datetime_utc:
            raise ValueError(
                f"'end_datetime_utc' ({self.end_datetime_utc.isoformat()}) must be strictly after "
                f"'start_datetime_utc' ({self.start_datetime_utc.isoformat()})."
            )

        diff_seconds = (self.end_datetime_utc - self.start_datetime_utc).total_seconds()

        # 3. Maximum interval range (7 days)
        if diff_seconds > MAX_TIMELINE_SECONDS:
            raise ValueError(
                f"Requested comparison interval exceeds maximum limit of {MAX_TIMELINE_DAYS} days "
                f"({diff_seconds / 86400:.2f} days requested)."
            )

        # 4. Maximum sample limit (<= 700 samples per scenario)
        max_estimated_samples = int(diff_seconds / (self.step_minutes * 60)) + 2
        if max_estimated_samples > MAX_SAMPLE_LIMIT:
            raise ValueError(
                f"Requested interval and step_minutes would generate ~{max_estimated_samples} samples per scenario, "
                f"which exceeds the maximum allowed limit of {MAX_SAMPLE_LIMIT} samples."
            )

        return self


class BodySummaryMetrics(BaseModel):
    """Aggregate statistics and geometric visibility metrics for a celestial body over the evaluation timeline."""

    min_elevation_deg: Optional[float] = Field(
        default=None,
        description="Minimum elevation in degrees across valid calculated samples (null if no valid samples)",
    )
    max_elevation_deg: Optional[float] = Field(
        default=None,
        description="Maximum elevation in degrees across valid calculated samples (null if no valid samples)",
    )
    mean_elevation_deg: Optional[float] = Field(
        default=None,
        description="Arithmetic mean elevation in degrees averaged strictly over valid calculated samples",
    )
    valid_sample_count: int = Field(
        ...,
        description="Count of samples with valid calculated ephemeris (excluding unavailable/missing samples)",
    )
    geometrically_visible_sample_count: int = Field(
        ...,
        description="Count of valid samples where geometric elevation > 0°",
    )
    total_sampled_geometric_visibility_hours: float = Field(
        ...,
        description="Observed geometric visibility duration derived by summing adjacent valid visible sample intervals (hours)",
    )
    interpolated_geometric_visibility_hours: float = Field(
        ...,
        description="Total duration of derived geometric visibility windows using linear horizon boundary interpolation (hours)",
    )


class ScenarioComparisonResult(BaseModel):
    """Complete evaluation result for an individual scenario within the multi-site comparison."""

    scenario_id: str = Field(
        ...,
        description="Unique identifier of this scenario matching the request",
        examples=["shackleton_base"],
    )
    name: Optional[str] = Field(
        default=None,
        description="Optional human-readable label or display name",
        examples=["Shackleton Crater Rim"],
    )
    site_id: Optional[str] = Field(
        default=None,
        description="Catalogue site ID, or null if custom coordinates",
        examples=["shackleton_region"],
    )
    latitude_deg: float = Field(
        ...,
        description="Evaluated lunar latitude in degrees [-90.0, 90.0], negative South",
        examples=[-89.9],
    )
    longitude_deg: float = Field(
        ...,
        description="Evaluated lunar longitude in degrees [-180.0, 180.0], East-positive",
        examples=[0.0],
    )
    observer_altitude_m: float = Field(
        default=0.0,
        description="Observer height above local surface in meters",
        examples=[0.0],
    )
    sun_summary: BodySummaryMetrics = Field(
        ...,
        description="Summary elevation statistics and geometric visibility metrics for the Sun",
    )
    earth_summary: BodySummaryMetrics = Field(
        ...,
        description="Summary elevation statistics and geometric visibility metrics for the Earth",
    )
    samples: List[TimelineSample] = Field(
        ...,
        description="Discrete time-series ephemeris samples along the shared evaluation grid",
    )
    sun_visibility_windows: List[VisibilityWindow] = Field(
        ...,
        description="Derived continuous geometric sunlight intervals above horizon",
    )
    earth_visibility_windows: List[VisibilityWindow] = Field(
        ...,
        description="Derived continuous geometric Earth line-of-sight intervals above horizon",
    )
    windows: Optional[Dict[str, List[VisibilityWindow]]] = Field(
        default=None,
        description="Categorized visibility windows (sunlight, earth_geometric_visibility)",
    )
    metadata: TimelineMetadata = Field(
        ...,
        description="Ephemeris calculation metadata, sources, reference frame, and limitations",
    )


class ComparisonMetadata(BaseModel):
    """Comparison-level scientific metadata, consistency verification, and operational caveats."""

    start_datetime_utc: str = Field(
        ...,
        description="Common evaluation start instant in ISO 8601 UTC format",
        examples=["2027-01-15T00:00:00Z"],
    )
    end_datetime_utc: str = Field(
        ...,
        description="Common evaluation end instant in ISO 8601 UTC format",
        examples=["2027-01-18T00:00:00Z"],
    )
    step_minutes: int = Field(
        ...,
        description="Common sampling interval in minutes used across all scenarios",
        examples=[30],
    )
    sample_count: int = Field(
        ...,
        description="Total sample count per scenario along the shared timestamp grid",
        examples=[145],
    )
    scenario_count: int = Field(
        ...,
        description="Total number of evaluated scenarios (between 2 and 4)",
        examples=[2],
    )
    all_data_complete: bool = Field(
        ...,
        description="True if all scenarios generated complete valid ephemeris without missing data or kernel failures",
    )
    shared_timestamps_utc: List[str] = Field(
        ...,
        description="Explicit shared timestamp grid evaluated identically across all scenarios",
    )
    common_reference_frame: Optional[str] = Field(
        default=None,
        description="Common astronomical body-fixed reference frame (e.g. 'MOON_ME'), or null if frames differ",
        examples=["MOON_ME"],
    )
    frames_consistent: bool = Field(
        ...,
        description="True if all scenarios were evaluated under the exact same reference frame",
    )
    warnings: List[str] = Field(
        default_factory=list,
        description="Scientific caveats, frame discrepancy warnings, or data unavailability alerts",
    )
    limitations: List[str] = Field(
        default_factory=list,
        description="Operational limitations, sampling resolution caveats, and geometric assumptions",
    )
    calculated_at_utc: str = Field(
        ...,
        description="Calculation generation timestamp in ISO 8601 UTC",
    )


class ComparisonResponse(BaseModel):
    """Top-level response payload for POST /mission/compare."""

    results: List[ScenarioComparisonResult] = Field(
        ...,
        description="Ordered list of scenario comparison results matching request order",
    )
    comparison_metadata: ComparisonMetadata = Field(
        ...,
        description="Common comparison metadata, shared timestamp grid, and scientific consistency checks",
    )
