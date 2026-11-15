import json
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.site_service import SiteService
from app.utils.validation import validate_lunar_coordinates

client = TestClient(app)


def test_get_sites_status_and_schema():
    """Verify that GET /sites returns 200 OK and matches the expected schema."""
    response = client.get("/sites")
    assert response.status_code == 200
    data = response.json()

    assert "sites" in data
    assert "metadata" in data
    assert isinstance(data["sites"], list)
    assert len(data["sites"]) == 4


def test_required_candidate_regions_present():
    """Verify that all four required candidate regions are present in the catalogue."""
    response = client.get("/sites")
    data = response.json()
    sites = data["sites"]

    site_map = {site["id"]: site for site in sites}

    required_ids = [
        "shackleton_region",
        "malapert_massif",
        "connecting_ridge",
        "nobile_crater_region",
    ]

    for req_id in required_ids:
        assert req_id in site_map, f"Missing required site ID: {req_id}"

    # Verify names correspond to required candidate regions
    assert "Shackleton" in site_map["shackleton_region"]["name"]
    assert "Malapert" in site_map["malapert_massif"]["name"]
    assert "Connecting Ridge" in site_map["connecting_ridge"]["name"]
    assert "Nobile" in site_map["nobile_crater_region"]["name"]


def test_sites_have_unique_ids():
    """Verify that each site ID in the catalogue is unique."""
    response = client.get("/sites")
    data = response.json()
    ids = [site["id"] for site in data["sites"]]
    assert len(ids) == len(set(ids)), "Site IDs must be unique"


def test_coordinates_within_valid_ranges():
    """Verify all sites have valid latitude [-90, 90] and longitude [-180, 180]."""
    response = client.get("/sites")
    data = response.json()

    for site in data["sites"]:
        lat = site["latitude_deg"]
        lon = site["longitude_deg"]

        assert -90.0 <= lat <= 90.0, f"Latitude {lat} out of range [-90, 90]"
        assert -180.0 <= lon <= 180.0, f"Longitude {lon} out of range [-180, 180]"

        # South pole candidate regions must have negative latitudes (near south pole)
        assert lat < -80.0, f"South pole candidate site {site['id']} latitude should be < -80°"


def test_coordinate_status_and_provenance():
    """Verify coordinate quality status and provenance are explicitly stated."""
    response = client.get("/sites")
    data = response.json()

    for site in data["sites"]:
        assert site["coordinate_status"] in ["approximate_region_center", "illustrative"]
        assert site["description"] and len(site["description"]) > 10
        assert site["provenance"] is not None and len(site["provenance"]) > 5


def test_metadata_contains_conventions_and_notes():
    """Verify catalogue metadata documents coordinate convention and scientific note."""
    response = client.get("/sites")
    metadata = response.json()["metadata"]

    assert "coordinate_convention" in metadata
    assert "latitude_deg" in metadata["coordinate_convention"]
    assert "longitude_deg" in metadata["coordinate_convention"]
    assert "source" in metadata
    assert "note" in metadata


def test_coordinate_validation_utility_valid():
    """Test coordinate validation function with standard valid coordinates."""
    lat, lon = validate_lunar_coordinates(-89.9, 0.0)
    assert lat == -89.9
    assert lon == 0.0

    # East-positive 0..360 longitude conversion
    lat, lon = validate_lunar_coordinates(-85.0, 350.0)
    assert lat == -85.0
    assert lon == -10.0


def test_coordinate_validation_utility_invalid():
    """Test coordinate validation function raises ValueError for out-of-bounds coordinates."""
    with pytest.raises(ValueError, match="Invalid latitude"):
        validate_lunar_coordinates(-95.0, 0.0)

    with pytest.raises(ValueError, match="Invalid latitude"):
        validate_lunar_coordinates(95.0, 0.0)

    with pytest.raises(ValueError, match="Invalid longitude"):
        validate_lunar_coordinates(0.0, -190.0)

    with pytest.raises(ValueError, match="Invalid longitude"):
        validate_lunar_coordinates(0.0, 370.0)

    with pytest.raises(ValueError, match="Latitude must be a numeric value"):
        validate_lunar_coordinates("invalid", 0.0)  # type: ignore


def test_site_service_get_by_id():
    """Test retrieving site by ID from SiteService."""
    service = SiteService()
    shackleton = service.get_site_by_id("shackleton_region")
    assert shackleton is not None
    assert shackleton.id == "shackleton_region"

    unknown = service.get_site_by_id("non_existent_site")
    assert unknown is None


def test_site_service_duplicate_id_detection(tmp_path):
    """Test that SiteService raises ValueError when duplicate site IDs exist in data."""
    duplicate_sites = [
        {
            "id": "site_1",
            "name": "Site One",
            "latitude_deg": -85.0,
            "longitude_deg": 10.0,
            "coordinate_status": "illustrative",
            "description": "First instance",
        },
        {
            "id": "site_1",
            "name": "Site One Duplicate",
            "latitude_deg": -86.0,
            "longitude_deg": 20.0,
            "coordinate_status": "illustrative",
            "description": "Second instance with duplicate ID",
        },
    ]

    temp_file = tmp_path / "dup_sites.json"
    temp_file.write_text(json.dumps(duplicate_sites), encoding="utf-8")

    with pytest.raises(ValueError, match="Duplicate site ID 'site_1'"):
        SiteService(data_file=temp_file)
