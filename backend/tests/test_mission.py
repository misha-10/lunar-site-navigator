import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_1_valid_site_id_request():
    """Verify that a valid site ID request returns 200 and populates catalogue coordinates."""
    payload = {
        "site_id": "shackleton_region",
        "datetime_utc": "2027-01-15T12:00:00Z",
        "observer_altitude_m": 1.5,
    }
    response = client.post("/mission/calculate", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["scenario"]["site_id"] == "shackleton_region"
    assert data["scenario"]["latitude_deg"] == -89.9
    assert data["scenario"]["longitude_deg"] == 0.0
    assert data["scenario"]["datetime_utc"] == "2027-01-15T12:00:00Z"


def test_2_valid_custom_coordinate_request():
    """Verify that a valid custom coordinate request without site_id returns 200."""
    payload = {
        "latitude_deg": -88.5,
        "longitude_deg": 45.0,
        "datetime_utc": "2027-01-15T12:00:00Z",
    }
    response = client.post("/mission/calculate", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["scenario"]["site_id"] is None
    assert data["scenario"]["latitude_deg"] == -88.5
    assert data["scenario"]["longitude_deg"] == 45.0
    assert data["scenario"]["datetime_utc"] == "2027-01-15T12:00:00Z"


def test_3_missing_datetime():
    """Verify that omitting datetime_utc causes a 422 validation error."""
    payload = {
        "site_id": "shackleton_region",
    }
    response = client.post("/mission/calculate", json=payload)
    assert response.status_code == 422


def test_4_invalid_coordinates():
    """Verify that out-of-range coordinates are rejected with 422."""
    payload = {
        "latitude_deg": -95.0,  # Below -90.0
        "longitude_deg": 0.0,
        "datetime_utc": "2027-01-15T12:00:00Z",
    }
    response = client.post("/mission/calculate", json=payload)
    assert response.status_code == 422

    payload_lon = {
        "latitude_deg": -85.0,
        "longitude_deg": 380.0,  # Exceeds 360°
        "datetime_utc": "2027-01-15T12:00:00Z",
    }
    response_lon = client.post("/mission/calculate", json=payload_lon)
    assert response_lon.status_code == 422


def test_5_unknown_site_id():
    """Verify that requesting an unregistered site_id returns 404 Not Found."""
    payload = {
        "site_id": "non_existent_crater",
        "datetime_utc": "2027-01-15T12:00:00Z",
    }
    response = client.post("/mission/calculate", json=payload)
    assert response.status_code == 404
    assert "not found in catalogue" in response.json()["detail"].lower()


def test_6_missing_both_site_id_and_coordinates():
    """Verify that omitting both site_id and coordinates causes a 422 validation error."""
    payload = {
        "datetime_utc": "2027-01-15T12:00:00Z",
    }
    response = client.post("/mission/calculate", json=payload)
    assert response.status_code == 422
    assert "either 'site_id' or both" in str(response.json()).lower()


def test_7_only_one_custom_coordinate_supplied():
    """Verify that supplying only latitude without longitude (or vice versa) is rejected."""
    payload_only_lat = {
        "latitude_deg": -85.0,
        "datetime_utc": "2027-01-15T12:00:00Z",
    }
    response_lat = client.post("/mission/calculate", json=payload_only_lat)
    assert response_lat.status_code == 422

    payload_only_lon = {
        "longitude_deg": 45.0,
        "datetime_utc": "2027-01-15T12:00:00Z",
    }
    response_lon = client.post("/mission/calculate", json=payload_only_lon)
    assert response_lon.status_code == 422


def test_8_naive_datetime_rejected():
    """Verify that naive timestamps without timezone information are rejected."""
    payload = {
        "site_id": "shackleton_region",
        "datetime_utc": "2027-01-15T12:00:00",  # No timezone offset or 'Z'
    }
    response = client.post("/mission/calculate", json=payload)
    assert response.status_code == 422
    assert "timezone-aware" in str(response.json()).lower()


def test_9_utc_timezone_normalization():
    """Verify that timestamps with explicit UTC offsets are normalized to UTC."""
    # 15:00 at UTC+3 corresponds to 12:00 UTC
    payload = {
        "site_id": "shackleton_region",
        "datetime_utc": "2027-01-15T15:00:00+03:00",
    }
    response = client.post("/mission/calculate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["scenario"]["datetime_utc"] == "2027-01-15T12:00:00Z"


def test_10_unavailable_scientific_values_correctly_represented(tmp_path):
    """Verify that uncalculated celestial values return explicit null and unavailable status when kernels missing."""
    from app.services.spice_service import SpiceService
    from app.services.ephemeris_service import EphemerisService
    from app.services.mission_service import MissionService
    from app.api.dependencies import get_mission_service

    # Override mission service with empty kernel directory to verify unavailable state
    empty_mission = MissionService(
        ephemeris_service=EphemerisService(spice_service=SpiceService(kernel_dir=tmp_path))
    )
    app.dependency_overrides[get_mission_service] = lambda: empty_mission

    try:
        payload = {
            "site_id": "shackleton_region",
            "datetime_utc": "2027-01-15T12:00:00Z",
        }
        response = client.post("/mission/calculate", json=payload)
        assert response.status_code == 200
        data = response.json()

        # Sun status
        sun = data["sun"]
        assert sun["azimuth_deg"] is None
        assert sun["elevation_deg"] is None
        assert sun["geometric_above_horizon"] is None
        assert sun["terrain_visible"] is None
        assert sun["status"] == "unavailable"
        assert "kernels missing" in sun["reason"].lower() or "not" in sun["reason"].lower()

        # Earth status
        earth = data["earth"]
        assert earth["azimuth_deg"] is None
        assert earth["elevation_deg"] is None
        assert earth["geometric_above_horizon"] is None
        assert earth["terrain_visible"] is None
        assert earth["status"] == "unavailable"
        assert "kernels missing" in earth["reason"].lower() or "not" in earth["reason"].lower()

        # Metadata
        metadata = data["metadata"]
        assert metadata["data_mode"] == "unavailable"
        assert metadata["sources"] == []
        assert metadata["reference_frame"] is None
        assert metadata["time_scale"] == "UTC"
        assert metadata["calculated_at_utc"].endswith("Z")
        assert len(metadata["limitations"]) >= 2
    finally:
        app.dependency_overrides.clear()
