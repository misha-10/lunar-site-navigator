"""Domain models for mission calculations and celestial body status."""

from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional


@dataclass
class CelestialBodyState:
    """Internal representation of a celestial body's position relative to the observer."""

    azimuth_deg: Optional[float] = None
    elevation_deg: Optional[float] = None
    geometric_above_horizon: Optional[bool] = None
    terrain_visible: Optional[bool] = None
    status: str = "unavailable"
    reason: Optional[str] = None


@dataclass
class CalculationMetadata:
    """Provenance and calculation limitations metadata."""

    data_mode: str = "unavailable"
    sources: List[str] = None  # type: ignore
    reference_frame: Optional[str] = None
    time_scale: str = "UTC"
    calculated_at_utc: str = ""
    limitations: List[str] = None  # type: ignore

    def __post_init__(self):
        if self.sources is None:
            self.sources = []
        if self.limitations is None:
            self.limitations = []
