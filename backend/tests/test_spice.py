from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app
from app.services.coordinate_service import CoordinateService
from app.services.ephemeris_service import EphemerisService
from app.services.mission_service import MissionService
from app.services.spice_service import SpiceService

client = TestClient(app)


def test_missing_kernel_directory(tmp_path):
    """Verify that a non-existent kernel directory is handled gracefully without crashing."""
    non_existent = tmp_path / "does_not_exist"
    service = SpiceService(kernel_dir=non_existent)

    assert service.is_ready() is False
    missing = service.get_missing_kernels()
    assert len(missing) == 3
    assert "naif0012.tls" in missing
    assert "pck00010.tpc" in missing
    assert "de421.bsp" in missing


def test_missing_required_kernels_in_empty_dir(tmp_path):
    """Verify that an empty directory correctly reports all required kernels as missing."""
    empty_dir = tmp_path / "empty_kernels"
    empty_dir.mkdir()
    service = SpiceService(kernel_dir=empty_dir)

    assert service.is_ready() is False
    assert service.get_missing_kernels() == [
        "naif0012.tls",
        "pck00010.tpc",
        "de421.bsp",
    ]


def test_invalid_kernel_file_handled_gracefully(tmp_path):
    """Verify that a corrupted or invalid kernel file does not crash the service."""
    bad_dir = tmp_path / "corrupted_kernels"
    bad_dir.mkdir()

    # Create dummy invalid files matching required kernel names
    for name in ["naif0012.tls", "pck00010.tpc", "de421.bsp"]:
        (bad_dir / name).write_text("NOT_A_VALID_SPICE_KERNEL", encoding="utf-8")

    service = SpiceService(kernel_dir=bad_dir)
    # The loader should attempt to load and gracefully handle the SPICE exception
    assert service.is_ready() is False


def test_utc_to_et_when_kernels_unavailable(tmp_path):
    """Verify that attempting to convert UTC to ET without kernels raises RuntimeError with clear message."""
    service = SpiceService(kernel_dir=tmp_path)
    with pytest.raises(RuntimeError, match="SPICE kernels not ready"):
        service.utc_to_et("2027-01-15T12:00:00Z")


def test_ephemeris_service_unavailable_when_missing_kernels(tmp_path):
    """Verify that EphemerisService returns unavailable result when SPICE kernels are missing."""
    spice = SpiceService(kernel_dir=tmp_path)
    coord = CoordinateService()
    ephem = EphemerisService(spice_service=spice, coordinate_service=coord)

    res = ephem.calculate_observer_ephemeris(-89.9, 0.0, "2027-01-15T12:00:00Z")
    assert res.available is False
    assert "SPICE kernels missing" in res.reason
    assert res.sun.status == "unavailable"
    assert res.earth.status == "unavailable"
    assert res.sun.azimuth_deg is None
    assert res.sun.elevation_deg is None


def test_ephemeris_service_with_loaded_kernels():
    """Verify accurate astronomical calculation when core kernels (LSK, PCK, SPK) are loaded."""
    spice = SpiceService()
    if not spice.is_ready():
        pytest.skip("Core SPICE kernels not present in default kernel directory.")

    coord = CoordinateService()
    ephem = EphemerisService(spice_service=spice, coordinate_service=coord)

    # Shackleton Crater region in southern lunar summer
    res = ephem.calculate_observer_ephemeris(-89.9, 0.0, "2027-01-15T12:00:00Z")
    assert res.available is True
    assert res.reference_frame in ["IAU_MOON", "MOON_ME"]
    assert res.sun.status == "calculated"
    assert res.earth.status == "calculated"

    # Sun elevation at south pole in mid-January should be slightly above horizon (~0.5° to 1.5°)
    assert 0.0 < res.sun.elevation_deg < 2.0
    assert res.sun.geometric_above_horizon is True
    assert res.sun.terrain_visible is None

    # Earth at lunar south pole is visible at roughly 3° to 8° elevation
    assert 2.0 < res.earth.elevation_deg < 10.0
    assert res.earth.geometric_above_horizon is True
    assert res.earth.terrain_visible is None


def test_mission_calculate_endpoint_with_ephemeris():
    """Verify POST /mission/calculate returns real ephemeris values when kernels are loaded."""
    spice = SpiceService()
    if not spice.is_ready():
        pytest.skip("Core SPICE kernels not present in default kernel directory.")

    payload = {
        "site_id": "shackleton_region",
        "datetime_utc": "2027-01-15T12:00:00Z",
        "observer_altitude_m": 0.0,
    }
    response = client.post("/mission/calculate", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["metadata"]["data_mode"] == "real_ephemeris"
    assert "de421.bsp" in data["metadata"]["sources"]
    assert data["sun"]["status"] == "calculated"
    assert data["sun"]["azimuth_deg"] is not None
    assert data["sun"]["elevation_deg"] is not None
    assert data["sun"]["geometric_above_horizon"] is True
    assert data["sun"]["terrain_visible"] is None

    assert data["earth"]["status"] == "calculated"
    assert data["earth"]["azimuth_deg"] is not None
    assert data["earth"]["elevation_deg"] is not None
    assert data["earth"]["geometric_above_horizon"] is True
    assert data["earth"]["terrain_visible"] is None


def test_lunar_reference_frame_verification_and_usage(tmp_path):
    """Verify that the selected lunar frame is recognized in SPICE and matches the calculation."""
    import shutil
    import spiceypy

    spice = SpiceService()
    if not spice.is_ready():
        pytest.skip("Core SPICE kernels not present in default kernel directory.")

    coord = CoordinateService()
    ephem = EphemerisService(spice_service=spice, coordinate_service=coord)

    # 1. Active kernel setup verification
    et = spice.utc_to_et("2027-01-15T12:00:00Z")
    frame = spice.determine_lunar_frame(et)
    assert frame in ["MOON_ME", "IAU_MOON"]

    # Frame must have non-zero ID in SPICE
    frame_id = spiceypy.namfrm(frame)
    assert frame_id != 0, f"Frame {frame} is not recognized in SPICE kernel pool"

    # Frame rotation to J2000 must be evaluatable at epoch
    rot = spiceypy.pxform("J2000", frame, et)
    assert rot.shape == (3, 3)

    # Calculation result must use and report the exact active frame
    res = ephem.calculate_observer_ephemeris(-89.9, 0.0, "2027-01-15T12:00:00Z")
    assert res.reference_frame == frame
    assert res.reference_frame in ["MOON_ME", "IAU_MOON"]

    # 2. Test fallback behavior when only core kernels (no binary PCK/FK) are available
    core_dir = tmp_path / "core_only"
    core_dir.mkdir()
    for k in ["naif0012.tls", "pck00010.tpc", "de421.bsp"]:
        src = spice.kernel_dir / k
        if src.exists():
            shutil.copy(src, core_dir / k)

    core_spice = SpiceService(kernel_dir=core_dir)
    assert core_spice.is_ready() is True
    et_core = core_spice.utc_to_et("2027-01-15T12:00:00Z")
    # Without moon_080317.tf, MOON_ME is not known, so must fall back to IAU_MOON
    fallback_frame = core_spice.determine_lunar_frame(et_core)
    assert fallback_frame == "IAU_MOON"
    assert spiceypy.namfrm("IAU_MOON") == 10020


def test_independent_numerical_checks_multi_site_and_date():
    """Verify numerical sanity, boundary constraints, and consistency across diverse sites and dates."""
    import math
    spice = SpiceService()
    if not spice.is_ready():
        pytest.skip("Core SPICE kernels not present in default kernel directory.")

    coord = CoordinateService()
    ephem = EphemerisService(spice_service=spice, coordinate_service=coord)

    test_scenarios = [
        # (name, lat, lon, datetime_utc)
        ("Shackleton_Summer", -89.9, 0.0, "2027-01-15T12:00:00Z"),
        ("Nobile_Summer", -85.28, 37.8, "2027-01-15T12:00:00Z"),
        ("Connecting_Ridge_Winter", -89.44, -137.3, "2027-06-20T00:00:00Z"),
        ("Malapert_Equinox", -85.99, -2.93, "2027-03-21T06:00:00Z"),
    ]

    for name, lat, lon, dt_utc in test_scenarios:
        res = ephem.calculate_observer_ephemeris(lat, lon, dt_utc)
        assert res.available is True, f"Failed calculation for {name}"
        assert res.reference_frame in ["IAU_MOON", "MOON_ME"]

        # Validate Sun geometry constraints
        assert res.sun.status == "calculated"
        assert math.isfinite(res.sun.azimuth_deg), f"Sun azimuth not finite for {name}"
        assert math.isfinite(res.sun.elevation_deg), f"Sun elevation not finite for {name}"
        assert 0.0 <= res.sun.azimuth_deg < 360.0, f"Sun azimuth out of bounds for {name}: {res.sun.azimuth_deg}"
        assert -90.0 <= res.sun.elevation_deg <= 90.0, f"Sun elevation out of bounds for {name}: {res.sun.elevation_deg}"
        assert res.sun.geometric_above_horizon == (res.sun.elevation_deg > 0.0)
        assert res.sun.terrain_visible is None

        # Validate Earth geometry constraints
        assert res.earth.status == "calculated"
        assert math.isfinite(res.earth.azimuth_deg), f"Earth azimuth not finite for {name}"
        assert math.isfinite(res.earth.elevation_deg), f"Earth elevation not finite for {name}"
        assert 0.0 <= res.earth.azimuth_deg < 360.0, f"Earth azimuth out of bounds for {name}: {res.earth.azimuth_deg}"
        assert -90.0 <= res.earth.elevation_deg <= 90.0, f"Earth elevation out of bounds for {name}: {res.earth.elevation_deg}"
        assert res.earth.geometric_above_horizon == (res.earth.elevation_deg > 0.0)
        assert res.earth.terrain_visible is None

        # Validate metadata and provenance
        assert "de421.bsp" in res.sources
        assert any("NONE" in lim for lim in res.limitations), f"Expected geometric abcorr in limitations for {name}"


def test_mission_calculate_endpoint_graceful_fallback_when_kernels_missing(tmp_path):
    """Verify POST /mission/calculate gracefully returns null scientific values when kernels are missing."""
    empty_spice = SpiceService(kernel_dir=tmp_path)
    empty_mission = MissionService(
        ephemeris_service=EphemerisService(spice_service=empty_spice)
    )

    from app.api.dependencies import get_mission_service

    app.dependency_overrides[get_mission_service] = lambda: empty_mission
    try:
        payload = {
            "site_id": "shackleton_region",
            "datetime_utc": "2027-01-15T12:00:00Z",
        }
        response = client.post("/mission/calculate", json=payload)
        assert response.status_code == 200
        data = response.json()

        assert data["metadata"]["data_mode"] == "unavailable"
        assert data["sun"]["status"] == "unavailable"
        assert data["sun"]["azimuth_deg"] is None
        assert data["sun"]["elevation_deg"] is None
        assert data["sun"]["geometric_above_horizon"] is None
        assert "SPICE kernels missing" in data["sun"]["reason"]

        assert data["earth"]["status"] == "unavailable"
        assert data["earth"]["azimuth_deg"] is None
        assert data["earth"]["elevation_deg"] is None
        assert data["earth"]["geometric_above_horizon"] is None
        assert "SPICE kernels missing" in data["earth"]["reason"]
    finally:
        app.dependency_overrides.clear()
