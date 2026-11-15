import json
from pathlib import Path
from typing import Dict, List, Optional

from app.schemas.site import Site, SiteCatalogueMetadata, SiteListResponse
from app.utils.validation import validate_lunar_coordinates


class SiteService:
    """Service for managing, loading, and validating the curated landing site catalogue."""

    def __init__(self, data_file: Optional[Path] = None):
        if data_file is None:
            self.data_file = Path(__file__).resolve().parent.parent / "data" / "sites.json"
        else:
            self.data_file = data_file
        self._sites: Dict[str, Site] = {}
        self._load_sites()

    def _load_sites(self) -> None:
        """Load and strictly validate sites from JSON file."""
        if not self.data_file.exists():
            raise FileNotFoundError(f"Site catalogue data file not found at: {self.data_file}")

        with open(self.data_file, "r", encoding="utf-8") as f:
            raw_sites = json.load(f)

        if not isinstance(raw_sites, list):
            raise ValueError("Site catalogue JSON must contain a top-level list of site objects.")

        loaded_sites: Dict[str, Site] = {}
        for entry in raw_sites:
            # Validate coordinates explicitly using utility
            lat, lon = validate_lunar_coordinates(
                entry.get("latitude_deg"), entry.get("longitude_deg")
            )
            # Create Pydantic site model
            site = Site(
                id=entry["id"],
                name=entry["name"],
                latitude_deg=lat,
                longitude_deg=lon,
                coordinate_status=entry.get("coordinate_status", "approximate_region_center"),
                description=entry.get("description", ""),
                provenance=entry.get("provenance"),
            )
            if site.id in loaded_sites:
                raise ValueError(f"Duplicate site ID '{site.id}' found in site catalogue.")
            loaded_sites[site.id] = site

        self._sites = loaded_sites

    def get_sites(self) -> List[Site]:
        """Return all curated landing sites."""
        return list(self._sites.values())

    def get_site_by_id(self, site_id: str) -> Optional[Site]:
        """Retrieve a specific candidate site by its unique ID."""
        return self._sites.get(site_id)

    def get_catalogue(self) -> SiteListResponse:
        """Return complete landing site catalogue including coordinate conventions and metadata."""
        return SiteListResponse(
            sites=self.get_sites(),
            metadata=SiteCatalogueMetadata(),
        )


_site_service_instance: Optional[SiteService] = None


def get_site_service() -> SiteService:
    """Singleton getter for SiteService."""
    global _site_service_instance
    if _site_service_instance is None:
        _site_service_instance = SiteService()
    return _site_service_instance
