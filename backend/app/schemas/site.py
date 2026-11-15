from typing import List, Optional
from pydantic import BaseModel, Field, field_validator

from app.utils.validation import validate_lunar_coordinates


class Site(BaseModel):
    """Candidate lunar landing site / region definition."""

    id: str = Field(
        ...,
        description="Unique identifier for the site or region (e.g. 'shackleton_region')",
        examples=["shackleton_region"],
    )
    name: str = Field(
        ...,
        description="Human-readable name of the candidate region",
        examples=["Shackleton Crater region"],
    )
    latitude_deg: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        description="Lunar latitude in degrees [-90.0, 90.0], negative South",
        examples=[-89.9],
    )
    longitude_deg: float = Field(
        ...,
        ge=-180.0,
        le=180.0,
        description="Lunar longitude in degrees [-180.0, 180.0], East-positive",
        examples=[0.0],
    )
    coordinate_status: str = Field(
        ...,
        description="Reliability and precision indicator (e.g. 'approximate_region_center', 'illustrative')",
        examples=["approximate_region_center"],
    )
    description: str = Field(
        ...,
        description="Scientific and operational description of the candidate site",
    )
    provenance: Optional[str] = Field(
        default=None,
        description="Scientific reference or dataset source for the coordinate and region definition",
    )

    @field_validator("longitude_deg", mode="before")
    @classmethod
    def normalize_longitude(cls, v: float) -> float:
        if isinstance(v, (int, float)):
            val = float(v)
            if 180.0 < val <= 360.0:
                return val - 360.0
            return val
        return v


class SiteCatalogueMetadata(BaseModel):
    """Metadata regarding coordinate conventions, source provenance, and caveats."""

    coordinate_convention: str = Field(
        default="latitude_deg [-90.0, 90.0] (negative south); longitude_deg [-180.0, 180.0] (east-positive)",
        description="Coordinate system conventions for latitude and longitude",
    )
    source: str = Field(
        default="Curated project catalogue based on NASA Artemis Candidate Landing Regions and IAU Lunar Gazetteer",
        description="Source of curated landing site data",
    )
    note: str = Field(
        default="Coordinates represent broad candidate region reference centers, not pinpoint landing coordinates.",
        description="Operational and scientific disclaimer",
    )


class SiteListResponse(BaseModel):
    """Response payload for GET /sites endpoint."""

    sites: List[Site] = Field(..., description="List of candidate landing sites")
    metadata: SiteCatalogueMetadata = Field(..., description="Catalogue metadata and coordinate convention")
